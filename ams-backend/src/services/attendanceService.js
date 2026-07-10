// src/services/attendanceService.js - normal and roster attendance processing and attendance record management

const { Op } = require('sequelize');
const Employee      = require('../models/Employee');
const AttendanceLog = require('../models/AttendanceLog');
const Attendance    = require('../models/Attendance');
const RosterEntry   = require('../models/Roster');
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
const {
    validateTimeString,
    validateClockInBeforeClockOut,
    validateDateNotInFuture,
    validateNoDuplicateAttendance,
    validateLateCoverMinutes,
    validateShiftTimes,
} = require('./attendanceValidation');

const pad = (n) => String(n).padStart(2, '0');

const VALID_ATTENDANCE_STATUSES = ['present', 'absent', 'leave', 'unauthorised', 'holiday'];

const isValidDateOnly = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year
        && date.getUTCMonth() + 1 === month
        && date.getUTCDate() === day;
};

const normalizePositiveInteger = (value, fallback, fieldName) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${fieldName} must be a positive integer.`);
    }

    return parsed;
};

const buildAttendanceFilters = (filters = {}) => {
    const where = {};
    const hasDateRange = Boolean(filters.startDate && filters.endDate);

    if (!hasDateRange) {
        if (filters.month !== undefined && filters.month !== '') {
            const month = Number(filters.month);
            if (!Number.isInteger(month) || month < 1 || month > 12) {
                throw new Error('month must be an integer between 1 and 12.');
            }
            where.month = month;
        }

        if (filters.year !== undefined && filters.year !== '') {
            const year = Number(filters.year);
            if (!Number.isInteger(year) || year < 1) {
                throw new Error('year must be a positive integer.');
            }
            where.year = year;
        }
    }

    if (filters.status) {
        if (!VALID_ATTENDANCE_STATUSES.includes(filters.status)) {
            throw new Error(`status must be one of: ${VALID_ATTENDANCE_STATUSES.join(', ')}.`);
        }

        where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
        if (!filters.startDate || !filters.endDate) {
            throw new Error('startDate and endDate must be provided together.');
        }

        if (!isValidDateOnly(filters.startDate) || !isValidDateOnly(filters.endDate)) {
            throw new Error('startDate and endDate must use YYYY-MM-DD format.');
        }

        if (filters.startDate > filters.endDate) {
            throw new Error('startDate must be less than or equal to endDate.');
        }

        where.date = {
            [Op.between]: [filters.startDate, filters.endDate],
        };
    }

    return where;
};

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

// ---------------------------------------------------------------------------
// processRosterAttendance
// Processes attendance for all entries in a given roster batch.
// For each RosterEntry, it:
//   1. Finds the matching AttendanceLog punches for that employee on that date
//   2. Selects the closest clock-in / clock-out times to the scheduled shift
//   3. Calculates status (present / absent / unauthorised) and lateCoverMinutes
//   4. Upserts a final Attendance record (creates or overwrites the existing one)
// Returns processedCount, discrepancyCount, discrepancies, records, and schedule info
// ---------------------------------------------------------------------------
const processRosterAttendance = async (rosterId) => {
    if (!rosterId || !Number.isInteger(Number(rosterId)) || Number(rosterId) <= 0) {
        throw new Error('A valid positive integer rosterId is required.');
    }

    const rosterIdNum = Number(rosterId);

    const entries = await RosterEntry.findAll({ where: { rosterId: rosterIdNum } });

    if (entries.length === 0) {
        throw new Error(`No roster entries found for roster ID ${rosterIdNum}.`);
    }

    const results       = [];
    const discrepancies = [];

    for (const entry of entries) {
        // Fetch all punch logs for this employee on this roster date, ordered by time
        const logs = await AttendanceLog.findAll({
            where: {
                employeeId: entry.employeeId,
                punchDate:  entry.date,
            },
            order: [['punchTime', 'ASC']],
        });

        // Match the closest clock-in / clock-out to the scheduled shift window
        const { clockIn, clockOut, logId } = matchLogsToShift(
            logs, entry.shiftStart, entry.shiftEnd
        );

        const status           = calculateStatus(clockIn, clockOut);
        const lateCoverMinutes = calculateLateCover(
            entry.shiftStart, entry.shiftEnd, clockIn, clockOut
        );

        if (isDiscrepancy(status, lateCoverMinutes)) {
            discrepancies.push(buildDiscrepancy(
                entry.employeeId, entry.date, status, lateCoverMinutes
            ));
        }

        const attendanceRecord = await upsertAttendanceRecord({
            employeeId:      entry.employeeId,
            date:            entry.date,
            clockIn,
            clockOut,
            scheduledStart:  entry.shiftStart,
            scheduledEnd:    entry.shiftEnd,
            status,
            lateCoverMinutes,
            rosterId:        rosterIdNum,
            logId,
        });

        results.push(attendanceRecord);
    }

    return {
        processedCount:   results.length,
        discrepancyCount: discrepancies.length,
        discrepancies,
        records:          results,
        schedule: {
            rosterId: rosterIdNum,
        },
    };
};

const getEmployeeAttendance = async (employeeId, filters = {}) => {
    if (!employeeId) {
        throw new Error('Employee ID is required to retrieve attendance records.');
    }

    const employee = await Employee.findOne({
        where: {
            employeeId,
            isActive: true,
        },
        attributes: ['employeeId', 'firstName', 'lastName', 'email', 'department', 'role', 'roster', 'isActive'],
    });

    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    const where = {
        employeeId,
        ...buildAttendanceFilters(filters),
    };

    const hasPagination = filters.page !== undefined || filters.limit !== undefined;
    const page = hasPagination ? normalizePositiveInteger(filters.page, 1, 'page') : 1;
    const limit = hasPagination ? normalizePositiveInteger(filters.limit, 20, 'limit') : undefined;
    const offset = hasPagination ? (page - 1) * limit : undefined;

    const { count, rows } = await Attendance.findAndCountAll({
        where,
        order: [['date', 'DESC'], ['clockIn', 'DESC']],
        limit,
        offset,
    });

    return {
        employee: employee.get({ plain: true }),
        filters: {
            employeeId,
            ...(filters.month !== undefined && filters.month !== '' ? { month: Number(filters.month) } : {}),
            ...(filters.year !== undefined && filters.year !== '' ? { year: Number(filters.year) } : {}),
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.startDate ? { startDate: filters.startDate } : {}),
            ...(filters.endDate ? { endDate: filters.endDate } : {}),
            ...(hasPagination ? { page, limit } : {}),
        },
        meta: {
            total: count,
            page,
            limit: limit ?? count,
            totalPages: hasPagination ? Math.ceil(count / limit) : (count > 0 ? 1 : 0),
        },
        records: rows,
    };
};

const getAllAttendance = async (filters = {}) => {
    const where = {
        ...buildAttendanceFilters(filters),
    };

    if (filters.employeeId) {
        where.employeeId = filters.employeeId;
    }

    const hasPagination = filters.page !== undefined || filters.limit !== undefined;
    const page = hasPagination ? normalizePositiveInteger(filters.page, 1, 'page') : 1;
    const limit = hasPagination ? normalizePositiveInteger(filters.limit, 20, 'limit') : undefined;
    const offset = hasPagination ? (page - 1) * limit : undefined;

    const { count, rows } = await Attendance.findAndCountAll({
        where,
        order: [['date', 'DESC']],
        limit,
        offset,
    });

    return {
        records: rows,
        meta: {
            total: count,
            page,
            limit: limit ?? count,
            totalPages: hasPagination ? Math.ceil(count / limit) : (count > 0 ? 1 : 0),
        },
        filters: {
            ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
            ...(filters.month !== undefined && filters.month !== '' ? { month: Number(filters.month) } : {}),
            ...(filters.year !== undefined && filters.year !== '' ? { year: Number(filters.year) } : {}),
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.startDate ? { startDate: filters.startDate } : {}),
            ...(filters.endDate ? { endDate: filters.endDate } : {}),
            ...(hasPagination ? { page, limit } : {}),
        },
    };
};

const getAttendanceById = async (attendanceId) => {
    if (!attendanceId) {
        throw new Error('Attendance ID is required to retrieve a record.');
    }

    const attendance = await Attendance.findOne({
        where: { attendanceId },
    });

    if (!attendance) {
        throw new Error(`Attendance record with ID ${attendanceId} not found.`);
    }

    const employee = await Employee.findOne({
        where: { employeeId: attendance.employeeId },
        attributes: ['employeeId', 'firstName', 'lastName', 'email', 'department', 'role', 'roster', 'isActive'],
    });

    return {
        attendance: attendance.get({ plain: true }),
        employee: employee ? employee.get({ plain: true }) : null,
    };
};

const addAttendanceRecord = async (data) => {
    const employeeId = String(data?.employeeId || '').trim();
    const date = String(data?.date || '').trim();
    const status = String(data?.status || '').trim().toLowerCase();

    if (!employeeId || !date || !status) {
        throw new Error('employeeId, date and status are required');
    }

    if (!isValidDateOnly(date)) {
        throw new Error('date must use YYYY-MM-DD format.');
    }

    if (!VALID_ATTENDANCE_STATUSES.includes(status)) {
        throw new Error(`status must be one of: ${VALID_ATTENDANCE_STATUSES.join(', ')}.`);
    }

    // --- Attendance validation checks ---
    validateDateNotInFuture(date);

    const clockIn  = data?.clockIn  ? String(data.clockIn).trim()  : null;
    const clockOut = data?.clockOut ? String(data.clockOut).trim() : null;
    validateTimeString(clockIn,  'clockIn');
    validateTimeString(clockOut, 'clockOut');
    validateClockInBeforeClockOut(clockIn, clockOut);
    validateLateCoverMinutes(data?.lateCoverMinutes);

    const employee = await Employee.findOne({
        where: { employeeId, isActive: true },
    });

    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    await validateNoDuplicateAttendance(employeeId, date);

    const dateObj = new Date(`${date}T00:00:00Z`);
    const normalizedNotes = typeof data?.notes === 'string' ? data.notes.trim() : null;

    return Attendance.create({
        employeeId,
        date,
        month: dateObj.getUTCMonth() + 1,
        year:  dateObj.getUTCFullYear(),
        clockIn,
        clockOut,
        status,
        lateCoverMinutes: Number.isInteger(Number(data?.lateCoverMinutes)) ? Number(data.lateCoverMinutes) : 0,
        notes: normalizedNotes,
        isManual: true,
    });
};

const normalizeAttendanceUpdatePayload = (data = {}) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Update data must be an object.');
    }

    const allowedFields = [
        'employeeId', 'date', 'clockIn', 'clockOut', 'status', 'lateCoverMinutes',
        'notes', 'scheduledStart', 'scheduledEnd', 'rosterId', 'attendanceLogId',
        'leaveRequestId', 'isManual', 'month', 'year',
    ];

    const update = {};

    for (const [key, value] of Object.entries(data)) {
        if (!allowedFields.includes(key) || value === undefined) {
            continue;
        }

        if (key === 'employeeId') {
            const employeeId = String(value || '').trim();
            if (!employeeId) {
                continue;
            }
            update.employeeId = employeeId;
            continue;
        }

        if (key === 'date') {
            const date = String(value || '').trim();
            if (!date) {
                continue;
            }
            if (!isValidDateOnly(date)) {
                throw new Error('date must use YYYY-MM-DD format.');
            }
            const dateObj = new Date(`${date}T00:00:00Z`);
            update.date = date;
            update.month = dateObj.getUTCMonth() + 1;
            update.year = dateObj.getUTCFullYear();
            continue;
        }

        if (['clockIn', 'clockOut', 'scheduledStart', 'scheduledEnd'].includes(key)) {
            const normalizedTime = value === null || value === '' ? null : String(value).trim();
            // Validate the time string format when a non-null value is supplied
            if (normalizedTime !== null) {
                validateTimeString(normalizedTime, key);
            }
            update[key] = normalizedTime;
            continue;
        }

        if (key === 'status') {
            const status = String(value || '').trim().toLowerCase();
            if (!VALID_ATTENDANCE_STATUSES.includes(status)) {
                throw new Error(`status must be one of: ${VALID_ATTENDANCE_STATUSES.join(', ')}.`);
            }
            update.status = status;
            continue;
        }

        if (key === 'lateCoverMinutes') {
            validateLateCoverMinutes(value);
            update.lateCoverMinutes = Number(value);
            continue;
        }

        if (key === 'notes') {
            update.notes = typeof value === 'string' ? value.trim() : null;
            continue;
        }

        if (key === 'isManual') {
            update.isManual = Boolean(value);
            continue;
        }

        if (['rosterId', 'attendanceLogId', 'leaveRequestId'].includes(key)) {
            if (value === null || value === '') {
                update[key] = null;
                continue;
            }

            const parsed = Number(value);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                throw new Error(`${key} must be a positive integer.`);
            }
            update[key] = parsed;
            continue;
        }

        if (key === 'month') {
            const parsed = Number(value);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
                throw new Error('month must be an integer between 1 and 12.');
            }
            update.month = parsed;
            continue;
        }

        if (key === 'year') {
            const parsed = Number(value);
            if (!Number.isInteger(parsed) || parsed < 1) {
                throw new Error('year must be a positive integer.');
            }
            update.year = parsed;
        }
    }

    if (Object.keys(update).length === 0) {
        throw new Error('No valid fields provided to update attendance record.');
    }

    return update;
};

const editAttendanceRecord = async (attendanceId, data) => {
    if (!attendanceId || String(attendanceId).trim() === '') {
        throw new Error('Attendance ID is required to edit a record.');
    }

    const record = await Attendance.findOne({ where: { attendanceId } });

    if (!record) {
        throw new Error('Attendance record not found');
    }

    const updatePayload = normalizeAttendanceUpdatePayload(data);

    if (updatePayload.employeeId) {
        const employee = await Employee.findOne({
            where: { employeeId: updatePayload.employeeId, isActive: true },
        });

        if (!employee) {
            throw new Error(`Active employee with ID ${updatePayload.employeeId} not found.`);
        }
    }

    // --- Cross-field validation using merged (existing + incoming) values ---

    // Merge clockIn / clockOut: incoming payload wins, fall back to existing record
    const mergedClockIn  = 'clockIn'  in updatePayload ? updatePayload.clockIn  : record.clockIn;
    const mergedClockOut = 'clockOut' in updatePayload ? updatePayload.clockOut : record.clockOut;
    validateClockInBeforeClockOut(mergedClockIn, mergedClockOut);

    // Merge scheduledStart / scheduledEnd and validate the shift window
    const mergedStart = 'scheduledStart' in updatePayload ? updatePayload.scheduledStart : record.scheduledStart;
    const mergedEnd   = 'scheduledEnd'   in updatePayload ? updatePayload.scheduledEnd   : record.scheduledEnd;
    validateShiftTimes(mergedStart, mergedEnd);

    // If date or employeeId is changing, guard against creating a duplicate record
    const targetEmployeeId = updatePayload.employeeId ?? record.employeeId;
    const targetDate       = updatePayload.date       ?? record.date;
    const dateOrEmpChanged = updatePayload.employeeId || updatePayload.date;
    if (dateOrEmpChanged) {
        await validateNoDuplicateAttendance(targetEmployeeId, targetDate, attendanceId);
    }

    await record.update(updatePayload);
    return record.reload();
};

const deleteAttendanceRecord = async (attendanceId) => {
    if (!attendanceId || attendanceId.trim() === '') {
        throw new Error('Attendance ID is required to delete a record.');
    }

    const record = await Attendance.findOne({ where: { attendanceId } });

    if (!record) {
        throw new Error(`Attendance record with ID ${attendanceId} not found.`);
    }

    await record.destroy();

    return {
        message: `Attendance record ${attendanceId} deleted successfully.`,
        attendanceId,
    };
};

module.exports = {
    processNormalAttendance,
    processRosterAttendance,
    getEmployeeAttendance,
    getAllAttendance,
    getAttendanceById,
    addAttendanceRecord,
    editAttendanceRecord,
    deleteAttendanceRecord,
};
