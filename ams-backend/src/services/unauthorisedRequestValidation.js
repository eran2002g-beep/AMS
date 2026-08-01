// src/services/unauthorisedRequestValidation.js - validators for unauthorised attendance requests

const { Op } = require('sequelize');
const UnauthorisedRequest = require('../models/UnauthorisedRequest');
const {
    validateTimeString,
    validateClockInBeforeClockOut,
} = require('./attendanceValidation');

const MAX_REASON_LENGTH = 1000;
const MAX_DESCRIPTION_LENGTH = 2000;

const isValidDateOnly = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
};

const normalizeTime = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const trimmed = String(value).trim();
    return trimmed || null;
};

// Optional — when omitted the service fills it from the attendance date
const validateHappenDate = (happenDate) => {
    if (happenDate === undefined || happenDate === null || happenDate === '') {
        return null;
    }
    if (!isValidDateOnly(happenDate)) {
        throw new Error(`happenDate (${happenDate}) must be a valid date in YYYY-MM-DD format.`);
    }
    return happenDate;
};

const validateReason = (reason) => {
    if (typeof reason !== 'string' || !reason.trim()) {
        throw new Error('reason is required.');
    }

    const trimmed = reason.trim();
    if (trimmed.length > MAX_REASON_LENGTH) {
        throw new Error(`reason must be ${MAX_REASON_LENGTH} characters or fewer.`);
    }

    return trimmed;
};

const validateDescription = (description) => {
    if (typeof description !== 'string' || !description.trim()) {
        throw new Error('description is required.');
    }

    const trimmed = description.trim();
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
        throw new Error(`description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
    }

    return trimmed;
};

const validateAttendanceId = (attendanceId) => {
    if (typeof attendanceId !== 'string' || !attendanceId.trim()) {
        throw new Error('attendanceId is required.');
    }
    return attendanceId.trim();
};

const validateNoPendingForAttendance = async (attendanceInternalId, excludeId = null) => {
    const where = {
        attendanceId: attendanceInternalId,
        status: { [Op.in]: ['pending', 'approved'] },
    };

    if (excludeId) {
        where.unauthorisedRequestId = { [Op.ne]: excludeId };
    }

    const existing = await UnauthorisedRequest.findOne({ where });
    if (existing) {
        throw new Error(
            `Attendance already has a ${existing.status} unauthorised request ` +
            `(${existing.unauthorisedRequestId}).`,
        );
    }
};

// Merge attendance punches with employee-supplied times; require any missing side.
const resolveClaimedTimes = (attendance, data = {}) => {
    const providedIn = normalizeTime(data.clockIn);
    const providedOut = normalizeTime(data.clockOut);

    validateTimeString(providedIn, 'clockIn');
    validateTimeString(providedOut, 'clockOut');

    const existingIn = normalizeTime(attendance.clockIn);
    const existingOut = normalizeTime(attendance.clockOut);

    const clockIn = providedIn || existingIn;
    const clockOut = providedOut || existingOut;

    if (!existingIn && !providedIn) {
        throw new Error('clockIn is required — this attendance record is missing a clock-in.');
    }
    if (!existingOut && !providedOut) {
        throw new Error('clockOut is required — this attendance record is missing a clock-out.');
    }

    validateClockInBeforeClockOut(clockIn, clockOut);

    return { clockIn, clockOut };
};

const validateUnauthorisedRequestPayload = (data = {}) => {
    const attendanceId = validateAttendanceId(data.attendanceId);
    const happenDate = validateHappenDate(data.happenDate);
    const reason = validateReason(data.reason);
    const description = validateDescription(data.description);

    // Time strings validated later against attendance (which fields are missing)
    const clockIn = normalizeTime(data.clockIn);
    const clockOut = normalizeTime(data.clockOut);
    validateTimeString(clockIn, 'clockIn');
    validateTimeString(clockOut, 'clockOut');

    return {
        attendanceId,
        happenDate,
        reason,
        description,
        clockIn,
        clockOut,
    };
};

module.exports = {
    validateHappenDate,
    validateReason,
    validateDescription,
    validateAttendanceId,
    validateNoPendingForAttendance,
    resolveClaimedTimes,
    validateUnauthorisedRequestPayload,
};
