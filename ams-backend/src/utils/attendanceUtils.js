// src/utils/attendanceUtils.js - shared attendance calculation helpers and validation primitives

const Attendance = require('../models/Attendance');

const NORMAL_SHIFT_START = '08:30';
const NORMAL_SHIFT_END   = '17:00';
const MINUTES_PER_DAY    = 24 * 60;

// isValidTimeString - returns true for HH:MM or HH:MM:SS with valid hour/minute/second ranges
const isValidTimeString = (value) => {
    if (typeof value !== 'string') return false;
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
    if (!match) return false;
    const [, h, m, s] = match.map((v) => (v === undefined ? 0 : Number(v)));
    return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
};

const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
};

const normalizeOnShiftTimeline = (scheduledStart, scheduledEnd, clockIn, clockOut) => {
    let startMins = timeToMinutes(scheduledStart);
    let endMins   = timeToMinutes(scheduledEnd);
    let inMins    = timeToMinutes(clockIn);
    let outMins   = timeToMinutes(clockOut);

    if (endMins <= startMins) {
        endMins += MINUTES_PER_DAY;
    }

    if (outMins < inMins) {
        outMins += MINUTES_PER_DAY;
    }

    return { startMins, endMins, inMins, outMins };
};

const calculateLateCover = (scheduledStart, scheduledEnd, clockIn, clockOut) => {
    if (!clockIn || !clockOut) return 0;

    const { startMins, endMins, inMins, outMins } = normalizeOnShiftTimeline(
        scheduledStart, scheduledEnd, clockIn, clockOut
    );

    const arrivalLateMinutes   = Math.max(0, inMins - startMins);
    const requiredClockOutMins = endMins + arrivalLateMinutes;

    return Math.max(0, requiredClockOutMins - outMins);
};

const calculateStatus = (clockIn, clockOut) => {
    if (!clockIn && !clockOut) return 'absent';
    if (!clockIn || !clockOut) return 'unauthorised';
    return 'present';
};

const closestLogToTime = (logs, targetTime, { afterMinutes = null } = {}) => {
    const targetMinutes = timeToMinutes(targetTime);
    let best     = null;
    let bestDiff = Infinity;

    for (const log of logs) {
        const punchMinutes = timeToMinutes(log.punchTime);
        if (afterMinutes !== null && punchMinutes <= afterMinutes) continue;

        const diff = Math.abs(punchMinutes - targetMinutes);
        if (diff < bestDiff) {
            bestDiff = diff;
            best     = log;
        }
    }

    return best;
};

const matchLogsToShift = (logs, shiftStart, shiftEnd) => {
    if (logs.length === 0) {
        return { clockIn: null, clockOut: null, logId: null };
    }

    const clockInLog  = closestLogToTime(logs, shiftStart);
    const clockInMins = clockInLog ? timeToMinutes(clockInLog.punchTime) : null;
    const clockOutLog = closestLogToTime(logs, shiftEnd, { afterMinutes: clockInMins });

    return {
        clockIn:  clockInLog  ? clockInLog.punchTime  : null,
        clockOut: clockOutLog ? clockOutLog.punchTime : null,
        logId:    clockInLog  ? clockInLog.id         : null,
    };
};

const upsertAttendanceRecord = async ({
    employeeId,
    date,
    clockIn,
    clockOut,
    scheduledStart,
    scheduledEnd,
    status,
    lateCoverMinutes,
    rosterId,
    logId,
}) => {
    const [year, month] = date.split('-').map(Number);

    const existing = await Attendance.findOne({
        where: { employeeId, date },
    });

    if (existing) {
        existing.clockIn          = clockIn;
        existing.clockOut         = clockOut;
        existing.scheduledStart   = scheduledStart;
        existing.scheduledEnd     = scheduledEnd;
        existing.status           = status;
        existing.lateCoverMinutes = lateCoverMinutes;
        existing.rosterId         = rosterId;
        existing.attendanceLogId  = logId;
        return existing.save();
    }

    return Attendance.create({
        employeeId,
        date,
        month,
        year,
        clockIn,
        clockOut,
        scheduledStart,
        scheduledEnd,
        status,
        lateCoverMinutes,
        rosterId,
        attendanceLogId: logId,
        isManual: false,
    });
};

const buildDiscrepancy = (employeeId, date, status, lateCoverMinutes) => ({
    employeeId,
    date,
    status,
    lateCoverMinutes,
});

const isDiscrepancy = (status, lateCoverMinutes) =>
    status === 'absent' || status === 'unauthorised' || lateCoverMinutes > 0;

module.exports = {
    NORMAL_SHIFT_START,
    NORMAL_SHIFT_END,
    isValidTimeString,
    calculateLateCover,
    calculateStatus,
    matchLogsToShift,
    upsertAttendanceRecord,
    buildDiscrepancy,
    isDiscrepancy,
};
