// src/services/attendanceService.js - normal attendance processing and attendance record management

const { Op } = require('sequelize');
const Employee      = require('../models/Employee');
const AttendanceLog = require('../models/AttendanceLog');
const Attendance    = require('../models/Attendance');
const {
    NORMAL_SHIFT_START,
    NORMAL_SHIFT_END,
    calculateLateCover,
    calculateStatus,
    matchLogsToShift,
    upsertAttendanceRecord,
    buildDiscrepancy,
    isDiscrepancy,
} = require('../utils/attendanceUtils');

const pad = (n) => String(n).padStart(2, '0');

const toDateOnly = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

const resolvePeriodDates = ({ date, month, year, startDate, endDate }) => {
    if (date) {
        return [date];
    }

    if (month && year) {
        const m = Number(month);
        const y = Number(year);
        const daysInMonth = new Date(y, m, 0).getDate();
        return Array.from({ length: daysInMonth }, (_, i) => toDateOnly(y, m, i + 1));
    }

    if (startDate && endDate) {
        const dates = [];
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const cursor = new Date(sy, sm - 1, sd);
        const end    = new Date(ey, em - 1, ed);

        while (cursor <= end) {
            dates.push(toDateOnly(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
            cursor.setDate(cursor.getDate() + 1);
        }

        return dates;
    }

    throw new Error('Provide date, month+year, or startDate+endDate.');
};

const processNormalAttendance = async (period = {}) => {
    const dates = resolvePeriodDates(period);

    const employees = await Employee.findAll({
        where: { roster: false, isActive: true },
        attributes: ['employeeId'],
    });

    if (employees.length === 0) {
        throw new Error('No active non-roster employees found.');
    }

    const results       = [];
    const discrepancies = [];

    for (const employee of employees) {
        for (const date of dates) {
            const logs = await AttendanceLog.findAll({
                where: {
                    employeeId: employee.employeeId,
                    punchDate:  date,
                },
                order: [['punchTime', 'ASC']],
            });

            const { clockIn, clockOut, logId } = matchLogsToShift(
                logs, NORMAL_SHIFT_START, NORMAL_SHIFT_END
            );

            const status           = calculateStatus(clockIn, clockOut);
            const lateCoverMinutes = calculateLateCover(
                NORMAL_SHIFT_START, NORMAL_SHIFT_END, clockIn, clockOut
            );

            if (isDiscrepancy(status, lateCoverMinutes)) {
                discrepancies.push(buildDiscrepancy(
                    employee.employeeId, date, status, lateCoverMinutes
                ));
            }

            const attendanceRecord = await upsertAttendanceRecord({
                employeeId:      employee.employeeId,
                date,
                clockIn,
                clockOut,
                scheduledStart:  NORMAL_SHIFT_START,
                scheduledEnd:    NORMAL_SHIFT_END,
                status,
                lateCoverMinutes,
                rosterId:        null,
                logId,
            });

            results.push(attendanceRecord);
        }
    }

    return {
        processedCount:   results.length,
        discrepancyCount: discrepancies.length,
        discrepancies,
        records:          results,
        schedule: {
            shiftStart: NORMAL_SHIFT_START,
            shiftEnd:   NORMAL_SHIFT_END,
        },
    };
};

const getEmployeeAttendance = async (employeeId, filters = {}) => {
    const where = { employeeId };

    if (filters.month)  where.month  = filters.month;
    if (filters.year)   where.year   = filters.year;
    if (filters.status) where.status = filters.status;

    if (filters.startDate && filters.endDate) {
        where.date = { [Op.between]: [filters.startDate, filters.endDate] };
    }

    return Attendance.findAll({
        where,
        order: [['date', 'DESC']],
    });
};

const getAllAttendance = async (filters = {}) => {
    const where = {};

    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status)     where.status     = filters.status;
    if (filters.month)      where.month      = filters.month;
    if (filters.year)       where.year       = filters.year;

    return Attendance.findAll({
        where,
        order: [['date', 'DESC']],
    });
};

const addAttendanceRecord = async (data) => {
    const { employeeId, date, clockIn, clockOut, status, notes, lateCoverMinutes } = data;

    if (!employeeId || !date || !status) {
        throw new Error('employeeId, date and status are required');
    }

    const dateObj = new Date(date);

    return Attendance.create({
        employeeId,
        date,
        month: dateObj.getMonth() + 1,
        year:  dateObj.getFullYear(),
        clockIn,
        clockOut,
        status,
        lateCoverMinutes: lateCoverMinutes ?? 0,
        notes,
        isManual: true,
    });
};

const editAttendanceRecord = async (attendanceId, data) => {
    const record = await Attendance.findOne({ where: { attendanceId } });

    if (!record) {
        throw new Error('Attendance record not found');
    }

    await record.update(data);
    return record;
};

const deleteAttendanceRecord = async (attendanceId) => {
    const record = await Attendance.findOne({ where: { attendanceId } });

    if (!record) {
        throw new Error('Attendance record not found');
    }

    await record.destroy();
    return { message: 'Attendance record deleted successfully' };
};

module.exports = {
    processNormalAttendance,
    getEmployeeAttendance,
    getAllAttendance,
    addAttendanceRecord,
    editAttendanceRecord,
    deleteAttendanceRecord,
};
