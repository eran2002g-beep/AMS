// src/services/leaveRequestValidation.js - centralised leave-request business-rule validators
// Follows the same pattern as employeeValidation.js / attendanceValidation.js — each
// function either throws on failure or returns a normalized value.

const { Op } = require('sequelize');
const LeaveRequest = require('../models/LeaveRequest');

const VALID_LEAVE_TYPES = ['annual', 'sick', 'casual', 'unpaid', 'other'];
const VALID_DURATIONS = ['full_day', 'half_day'];
const VALID_HALF_DAY_PERIODS = ['morning', 'afternoon'];
const MAX_REASON_LENGTH = 1000;
const MAX_LEAVE_SPAN_DAYS = 90; // guards against accidental multi-year ranges

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

// ---------------------------------------------------------------------------
// validateLeaveType
// Ensures leaveType is one of the ENUM values the LeaveRequest model accepts.
// ---------------------------------------------------------------------------
const validateLeaveType = (leaveType) => {
    if (typeof leaveType !== 'string' || !VALID_LEAVE_TYPES.includes(leaveType)) {
        throw new Error(`leaveType must be one of: ${VALID_LEAVE_TYPES.join(', ')}.`);
    }
    return leaveType;
};

// ---------------------------------------------------------------------------
// validateDateRange
// Ensures startDate/endDate are well-formed YYYY-MM-DD strings, that startDate
// is not in the past, that endDate is not before startDate, and that the span
// does not exceed MAX_LEAVE_SPAN_DAYS. Returns the inclusive day count.
// ---------------------------------------------------------------------------
const validateDateRange = (startDate, endDate) => {
    if (!isValidDateOnly(startDate)) {
        throw new Error(`startDate (${startDate}) must be a valid date in YYYY-MM-DD format.`);
    }
    if (!isValidDateOnly(endDate)) {
        throw new Error(`endDate (${endDate}) must be a valid date in YYYY-MM-DD format.`);
    }

    const todayUtc = new Date().toISOString().slice(0, 10);
    if (startDate < todayUtc) {
        throw new Error(`startDate (${startDate}) cannot be in the past. Today is ${todayUtc}.`);
    }

    if (endDate < startDate) {
        throw new Error(`endDate (${endDate}) cannot be before startDate (${startDate}).`);
    }

    const startMs = Date.UTC(...startDate.split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)));
    const endMs   = Date.UTC(...endDate.split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)));
    const totalDays = Math.round((endMs - startMs) / 86400000) + 1; // inclusive of both ends

    if (totalDays > MAX_LEAVE_SPAN_DAYS) {
        throw new Error(`Leave requests cannot span more than ${MAX_LEAVE_SPAN_DAYS} days (requested ${totalDays}).`);
    }

    return totalDays;
};

// ---------------------------------------------------------------------------
// validateDuration
// full_day (default) or half_day. Half-day leave must be a single calendar day
// and must include morning|afternoon period.
// ---------------------------------------------------------------------------
const validateDuration = (data = {}, startDate, endDate) => {
    const raw = data.duration == null || data.duration === ''
        ? 'full_day'
        : data.duration;

    if (typeof raw !== 'string' || !VALID_DURATIONS.includes(raw)) {
        throw new Error(`duration must be one of: ${VALID_DURATIONS.join(', ')}.`);
    }

    if (raw === 'full_day') {
        return { duration: 'full_day', halfDayPeriod: null };
    }

    if (startDate !== endDate) {
        throw new Error('Half-day leave must use the same startDate and endDate.');
    }

    const period = data.halfDayPeriod;
    if (typeof period !== 'string' || !VALID_HALF_DAY_PERIODS.includes(period)) {
        throw new Error(
            `halfDayPeriod must be one of: ${VALID_HALF_DAY_PERIODS.join(', ')} when duration is half_day.`,
        );
    }

    return { duration: 'half_day', halfDayPeriod: period };
};

// ---------------------------------------------------------------------------
// validateReason
// Reason is required so managers have context to approve/reject against.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// validateNoOverlappingLeave
// Prevents an employee from submitting overlapping date ranges while a prior
// request for the same period is still pending or already approved.
// ---------------------------------------------------------------------------
const validateNoOverlappingLeave = async (employeeId, startDate, endDate, excludeId = null) => {
    const where = {
        employeeId,
        status: { [Op.in]: ['pending', 'approved'] },
        startDate: { [Op.lte]: endDate },
        endDate: { [Op.gte]: startDate },
    };

    if (excludeId) {
        where.leaveRequestId = { [Op.ne]: excludeId };
    }

    const overlapping = await LeaveRequest.findOne({ where });

    if (overlapping) {
        throw new Error(
            `Employee ${employeeId} already has a ${overlapping.status} leave request ` +
            `(${overlapping.leaveRequestId}) that overlaps ${startDate} to ${endDate}.`,
        );
    }
};

// ---------------------------------------------------------------------------
// validateLeaveRequestPayload
// Runs the field-level validators above and returns a normalized payload
// ready to be persisted. Does not check the employee exists or overlaps —
// those need DB access and are handled separately in the service layer.
// ---------------------------------------------------------------------------
const validateLeaveRequestPayload = (data = {}) => {
    const leaveType = validateLeaveType(data.leaveType);
    const totalDays = validateDateRange(data.startDate, data.endDate);
    const reason = validateReason(data.reason);
    const { duration, halfDayPeriod } = validateDuration(
        data,
        data.startDate,
        data.endDate,
    );

    return {
        leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays,
        reason,
        duration,
        halfDayPeriod,
    };
};

module.exports = {
    VALID_LEAVE_TYPES,
    VALID_DURATIONS,
    VALID_HALF_DAY_PERIODS,
    MAX_LEAVE_SPAN_DAYS,
    validateLeaveType,
    validateDateRange,
    validateDuration,
    validateReason,
    validateNoOverlappingLeave,
    validateLeaveRequestPayload,
};