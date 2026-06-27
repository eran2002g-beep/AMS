// src/services/attendanceLogService.js - handles business logic for attendance log operations

const AttendanceLog = require('../models/AttendanceLog');

const VALID_PUNCH_TYPES = ['in', 'out'];
const VALID_SOURCES = ['iot', 'manual'];

// createAttendanceLog - validates input and creates a new attendance log record
const createAttendanceLog = async (data) => {
    const { employeeId, punchDate, punchTime, punchType, source, notes, syncError } = data;

    if (!employeeId || !punchDate || !punchTime) {
        throw new Error('employeeId, punchDate and punchTime are required');
    }

    if (punchType !== undefined && punchType !== null && punchType !== '' && !VALID_PUNCH_TYPES.includes(punchType)) {
        throw new Error('punchType must be "in" or "out"');
    }

    if (source !== undefined && source !== null && !VALID_SOURCES.includes(source)) {
        throw new Error('source must be "iot" or "manual"');
    }

    const log = await AttendanceLog.create({
        employeeId,
        punchDate,
        punchTime,
        ...(punchType !== undefined && punchType !== null && punchType !== '' && { punchType }),
        source: source ?? 'iot',
        notes,
        syncError,
    });

    return log;
};

module.exports = {
    createAttendanceLog,
};
