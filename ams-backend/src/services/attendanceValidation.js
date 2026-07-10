// src/services/attendanceValidation.js - centralised attendance business-rule validators
// Follows the same pattern as employeeValidation.js — each function throws on failure.

const Attendance = require('../models/Attendance');
const RosterEntry = require('../models/Roster');
const { Op } = require('sequelize');
const { isValidTimeString } = require('../utils/attendanceUtils');

const MAX_LATE_COVER_MINUTES = 1440; // one full day in minutes

// ---------------------------------------------------------------------------
// validateTimeString
// Ensures a field value is a well-formed HH:MM or HH:MM:SS string.
// Pass null / undefined to skip (field is optional).
// ---------------------------------------------------------------------------
const validateTimeString = (value, fieldName) => {
    if (value === null || value === undefined || value === '') return;

    if (!isValidTimeString(value)) {
        throw new Error(
            `${fieldName} must be a valid time string in HH:MM or HH:MM:SS format (e.g. "08:30" or "17:00:00").`,
        );
    }
};

// ---------------------------------------------------------------------------
// validateClockInBeforeClockOut
// Ensures clockIn is earlier than clockOut.
// Handles overnight shifts (e.g. 22:00 → 06:00) by adding 24 h to clockOut
// when the raw clockOut minutes are less than clockIn minutes.
// Skip check if either value is absent (other validators cover missing fields).
// ---------------------------------------------------------------------------
const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const validateClockInBeforeClockOut = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return;

    let inMins  = timeToMinutes(clockIn);
    let outMins = timeToMinutes(clockOut);

    // Overnight shift: if clockOut is earlier on the clock face, add a full day
    if (outMins <= inMins) {
        outMins += 1440;
    }

    if (outMins <= inMins) {
        throw new Error(
            `clockOut (${clockOut}) must be after clockIn (${clockIn}).`,
        );
    }
};

// ---------------------------------------------------------------------------
// validateDateNotInFuture
// Rejects attendance dates that are strictly in the future (UTC date comparison).
// ---------------------------------------------------------------------------
const validateDateNotInFuture = (date) => {
    if (!date) return;

    const todayUtc = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    if (date > todayUtc) {
        throw new Error(
            `date (${date}) cannot be in the future. Today is ${todayUtc}.`,
        );
    }
};

// ---------------------------------------------------------------------------
// validateNoDuplicateAttendance
// Prevents two Attendance records for the same (employeeId, date) pair.
// Pass excludeId (attendanceId string) when validating an edit so we skip
// the current record itself.
// ---------------------------------------------------------------------------
const validateNoDuplicateAttendance = async (employeeId, date, excludeId = null) => {
    if (!employeeId || !date) return;

    const where = { employeeId, date };

    if (excludeId) {
        where.attendanceId = { [Op.ne]: excludeId };
    }

    const existing = await Attendance.findOne({ where });

    if (existing) {
        throw new Error(
            `An attendance record already exists for employee ${employeeId} on ${date} (${existing.attendanceId}).`,
        );
    }
};

// ---------------------------------------------------------------------------
// validateRosterEmployeeMatch
// When a rosterId is provided, confirms the employee actually appears in
// that roster. Prevents linking a record to an unrelated roster batch.
// ---------------------------------------------------------------------------
const validateRosterEmployeeMatch = async (employeeId, rosterId) => {
    if (!employeeId || !rosterId) return;

    const entry = await RosterEntry.findOne({
        where: { employeeId, rosterId: Number(rosterId) },
    });

    if (!entry) {
        throw new Error(
            `Employee ${employeeId} does not appear in roster ${rosterId}.`,
        );
    }
};

// ---------------------------------------------------------------------------
// validateLateCoverMinutes
// Must be a non-negative integer and no larger than one full day (1440 min).
// ---------------------------------------------------------------------------
const validateLateCoverMinutes = (value) => {
    if (value === undefined || value === null || value === '') return;

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('lateCoverMinutes must be a non-negative integer.');
    }

    if (parsed > MAX_LATE_COVER_MINUTES) {
        throw new Error(
            `lateCoverMinutes (${parsed}) exceeds the maximum allowed value of ${MAX_LATE_COVER_MINUTES} minutes (one full day).`,
        );
    }
};

// ---------------------------------------------------------------------------
// validateShiftTimes
// Checks that both scheduledStart and scheduledEnd are valid time strings
// when provided, and that scheduledStart is before scheduledEnd.
// ---------------------------------------------------------------------------
const validateShiftTimes = (scheduledStart, scheduledEnd) => {
    validateTimeString(scheduledStart, 'scheduledStart');
    validateTimeString(scheduledEnd, 'scheduledEnd');

    if (scheduledStart && scheduledEnd) {
        let startMins = timeToMinutes(scheduledStart);
        let endMins   = timeToMinutes(scheduledEnd);

        // Allow overnight shifts
        if (endMins <= startMins) {
            endMins += 1440;
        }

        if (endMins <= startMins) {
            throw new Error(
                `scheduledEnd (${scheduledEnd}) must be after scheduledStart (${scheduledStart}).`,
            );
        }
    }
};

module.exports = {
    validateTimeString,
    validateClockInBeforeClockOut,
    validateDateNotInFuture,
    validateNoDuplicateAttendance,
    validateRosterEmployeeMatch,
    validateLateCoverMinutes,
    validateShiftTimes,
};
