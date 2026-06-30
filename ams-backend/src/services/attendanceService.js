// src/services/attendanceService.js - business logic for calculating and managing attendance matches RosterEntry (scheduled shifts) against AttendanceLog (actual punches) to produce Attendance records implements Epic 4: Process Roster Attendance

const { Op }         = require('sequelize'); // Sequelize operators for filtering queries
const RosterEntry    = require('../models/Roster');         // scheduled shifts (table: roster)
const AttendanceLog  = require('../models/AttendanceLog');  // raw punch events
const Attendance     = require('../models/Attendance');     // final calculated records

// ----------------------- GRACE PERIOD CONFIG -----------------------
// minutes an employee can clock in after shiftStart before being marked 'late'
// e.g. shift starts 08:00, grace = 10 → clocking in at 08:09 is still 'present'
const LATE_GRACE_MINUTES = 10;

// ----------------------- TIME HELPER -----------------------
// timeToMinutes - converts a "HH:MM" or "HH:MM:SS" string into total minutes used to compare clockIn time against scheduledStart time
// e.g. "08:15" -> 495 (8*60 + 15)
const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
};

// ----------------------- STATUS CALCULATOR -----------------------
// calculateStatus - decides present/late/absent by comparing punch time to scheduled time
// pure function - no database calls, easy to test on its own
const calculateStatus = (scheduledStart, clockIn) => {

    // No punch found at all for a scheduled shift
    if (!clockIn) {
        return 'absent';
    }

    // Compare clock-in time against scheduled start + grace period
    const scheduledMinutes = timeToMinutes(scheduledStart);
    const clockInMinutes   = timeToMinutes(clockIn);
    const lateThreshold    = scheduledMinutes + LATE_GRACE_MINUTES;

    if (clockInMinutes > lateThreshold) {
        return 'late';
    }

    return 'present';
};

// ----------------------- MATCH ONE ROSTER ENTRY TO ITS LOGS -----------------------
// matchEntryToLogs - finds the clock-in and clock-out punches for one scheduled shift
// searches AttendanceLog for punches matching the same employeeId and date
const matchEntryToLogs = async (entry) => {

    // Find all punches for this employee on this exact date
    const logs = await AttendanceLog.findAll({
        where: {
            employeeId: entry.employeeId,
            punchDate: entry.date,
        },
        order: [['punchTime', 'ASC']], // earliest punch first
    });

    // clockIn = first 'in' punch found, clockOut = last 'out' punch found
    const clockInLog  = logs.find(log => log.punchType === 'in');
    const clockOutLog = logs.find(log => log.punchType === 'out');

    return {
        clockIn:  clockInLog  ? clockInLog.punchTime  : null,
        clockOut: clockOutLog ? clockOutLog.punchTime : null,
        logId:    clockInLog  ? clockInLog.id         : null, // for attendanceLogId reference
    };
};

// ----------------------- PROCESS A SINGLE ROSTER FILE -----------------------
// processRosterAttendance - main entry point, runs the full matching process for one roster called by the controller when admin triggers "Process Attendance" (Epic 4 AC1)
const processRosterAttendance = async (rosterId) => {

    // Step 1 - get every scheduled shift entry that belongs to this roster
    const entries = await RosterEntry.findAll({ where: { rosterId } });

    if (entries.length === 0) {
        throw new Error('No roster entries found for this roster.');
    }

    const results       = [];  // every Attendance record created
    const discrepancies = [];  // entries where something looked off (AC3)

    // Step 2 - loop through each scheduled shift and match it against punch logs
    for (const entry of entries) {

        const { clockIn, clockOut, logId } = await matchEntryToLogs(entry);

        // Step 3 - calculate the status by comparing scheduled vs actual time
        const status = calculateStatus(entry.shiftStart, clockIn);

        // Flag this entry as a discrepancy if absent or late (AC3: discrepancies recorded for review)
        if (status === 'absent' || status === 'late') {
            discrepancies.push({
                employeeId: entry.employeeId,
                date: entry.date,
                status,
            });
        }

        // Step 4 - check if an Attendance record already exists for this employee+date
        // prevents duplicate records if processing is run more than once on the same roster
        const existing = await Attendance.findOne({
            where: { employeeId: entry.employeeId, date: entry.date },
        });

        let attendanceRecord;

        if (existing) {
            // Update the existing record instead of creating a duplicate
            existing.clockIn         = clockIn;
            existing.clockOut        = clockOut;
            existing.scheduledStart  = entry.shiftStart;
            existing.scheduledEnd    = entry.shiftEnd;
            existing.status          = status;
            existing.rosterId        = rosterId;
            existing.attendanceLogId = logId;
            attendanceRecord = await existing.save();
        } else {
            // Create a new Attendance record (Epic 4 AC2: attendance statuses shall be calculated)
            attendanceRecord = await Attendance.create({
                employeeId:      entry.employeeId,
                date:            entry.date,
                month:           entry.month,
                year:            entry.year,
                clockIn,
                clockOut,
                scheduledStart:  entry.shiftStart,
                scheduledEnd:    entry.shiftEnd,
                status,
                rosterId,
                attendanceLogId: logId,
                isManual:        false, // auto-generated by processing, not admin-entered
            });
        }

        results.push(attendanceRecord);
    }

    // Step 5 - return a summary so the controller can send a confirmation response (AC4)
    return {
        processedCount: results.length,
        discrepancyCount: discrepancies.length,
        discrepancies,
        records: results,
    };
};

// ----------------------- VIEW ATTENDANCE (EMPLOYEE SIDE) -----------------------
// getEmployeeAttendance - returns attendance records for one employee with optional filters
// supports Epic 4 AC3: filter by date range, month, or status
const getEmployeeAttendance = async (employeeId, filters = {}) => {

    const where = { employeeId };

    // Filter by specific month and year if provided
    if (filters.month) where.month = filters.month;
    if (filters.year)  where.year  = filters.year;

    // Filter by attendance status if provided e.g. "late", "absent"
    if (filters.status) where.status = filters.status;

    // Filter by date range if both start and end dates are provided
    if (filters.startDate && filters.endDate) {
        where.date = { [Op.between]: [filters.startDate, filters.endDate] };
    }

    const records = await Attendance.findAll({
        where,
        order: [['date', 'DESC']], // most recent first
    });

    return records;
};

// ----------------------- VIEW ALL ATTENDANCE (ADMIN SIDE) -----------------------
// getAllAttendance - returns attendance records across all employees with optional filters
const getAllAttendance = async (filters = {}) => {

    const where = {};

    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status)     where.status     = filters.status;
    if (filters.month)      where.month      = filters.month;
    if (filters.year)       where.year       = filters.year;

    const records = await Attendance.findAll({
        where,
        order: [['date', 'DESC']],
    });

    return records;
};

// ----------------------- ADD ATTENDANCE RECORD (ADMIN MANUAL ENTRY) -----------------------
// addAttendanceRecord - lets an admin manually create a record (Epic 4: Add Attendance Records)
const addAttendanceRecord = async (data) => {

    const { employeeId, date, clockIn, clockOut, status, notes } = data;

    if (!employeeId || !date || !status) {
        throw new Error('employeeId, date and status are required');
    }

    const dateObj = new Date(date);

    const record = await Attendance.create({
        employeeId,
        date,
        month: dateObj.getMonth() + 1,
        year:  dateObj.getFullYear(),
        clockIn,
        clockOut,
        status,
        notes,
        isManual: true, // flagged as manually entered, not auto-processed
    });

    return record;
};

// ----------------------- EDIT ATTENDANCE RECORD (ADMIN) -----------------------
// editAttendanceRecord - updates an existing record (Epic 4: Edit Attendance Records)
const editAttendanceRecord = async (attendanceId, data) => {

    const record = await Attendance.findOne({ where: { attendanceId } });

    if (!record) {
        throw new Error('Attendance record not found');
    }

    // Only update fields that were actually provided
    await record.update(data);

    return record;
};

// ----------------------- DELETE ATTENDANCE RECORD (ADMIN) -----------------------
// deleteAttendanceRecord - removes a record (Epic 4: Delete Attendance Records)
const deleteAttendanceRecord = async (attendanceId) => {

    const record = await Attendance.findOne({ where: { attendanceId } });

    if (!record) {
        throw new Error('Attendance record not found');
    }

    await record.destroy();

    return { message: 'Attendance record deleted successfully' };
};

module.exports = {
    processRosterAttendance,
    getEmployeeAttendance,
    getAllAttendance,
    addAttendanceRecord,
    editAttendanceRecord,
    deleteAttendanceRecord,
};
