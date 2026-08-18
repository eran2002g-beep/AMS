// src/services/leaveAttendanceHelper.js
// Bridges leave requests with attendance processing:
// - approved (and unreviewed pending) leave → reqLeave=true, absence does not reflect
// - rejected leave → reqLeave=false, absence reflects
// - half-day leave → only the working half is checked for In/Out punches
// Used by normal and roster attendance processing.

const { Op } = require('sequelize');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const {
    matchLogsToShift,
    calculateArrivalLateMinutes,
    timeToMinutes,
} = require('../utils/attendanceUtils');

const SYSTEM_REVIEWER_ID = 'SYSTEM';
const AUTO_ACCEPT_COMMENT = 'Auto-accepted during attendance processing (no admin decision).';
const MINUTES_PER_DAY = 24 * 60;

const minutesToTime = (totalMinutes) => {
    const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Split a shift into morning / afternoon halves at the midpoint.
const splitShiftHalves = (shiftStart, shiftEnd) => {
    let startMins = timeToMinutes(shiftStart);
    let endMins = timeToMinutes(shiftEnd);
    if (endMins <= startMins) endMins += MINUTES_PER_DAY;

    const midMins = Math.floor((startMins + endMins) / 2);
    const midTime = minutesToTime(midMins);

    return {
        morning: { start: shiftStart, end: midTime },
        afternoon: { start: midTime, end: shiftEnd },
    };
};

// Pending or approved leave covering a date is effective for attendance.
// Rejected / cancelled leave is ignored so absence can reflect.
const findEffectiveLeaveForDate = async (employeeId, date) => {
    const rows = await LeaveRequest.findAll({
        where: {
            employeeId,
            status: { [Op.in]: ['pending', 'approved'] },
            startDate: { [Op.lte]: date },
            endDate: { [Op.gte]: date },
        },
        order: [['id', 'DESC']],
    });

    if (rows.length === 0) return null;
    return rows.find((row) => row.status === 'approved') || rows[0];
};

// Spec: if admin never accepts/rejects, system treats the leave as accepted.
const autoAcceptPendingLeave = async (leaveRequest) => {
    if (!leaveRequest || leaveRequest.status !== 'pending') {
        return leaveRequest;
    }

    leaveRequest.status = 'approved';
    leaveRequest.reviewedBy = SYSTEM_REVIEWER_ID;
    leaveRequest.reviewComments = leaveRequest.reviewComments?.trim() || AUTO_ACCEPT_COMMENT;
    leaveRequest.reviewedAt = new Date();
    await leaveRequest.save();
    return leaveRequest;
};

const applyFullDayLeaveOutcome = ({ clockIn, clockOut, logId, leaveRequestId }) => ({
    reqLeave: true,
    leaveRequestId,
    status: 'leave',
    lateMinutes: 0,
    lateCoverMinutes: 0,
    dayType: null,
    clockIn: clockIn ?? null,
    clockOut: clockOut ?? null,
    logId: logId ?? null,
});

// Half-day leave: employee is off for halfDayPeriod; check the opposite (working) half.
// Missing In or Out on the working half → unauthorised; both present → present half_day.
const applyHalfDayLeaveOutcome = ({
    logs,
    shiftStart,
    shiftEnd,
    halfDayPeriod,
    leaveRequestId,
}) => {
    const halves = splitShiftHalves(shiftStart, shiftEnd);
    const period = halfDayPeriod === 'afternoon' ? 'afternoon' : 'morning';
    const workingHalf = period === 'morning' ? halves.afternoon : halves.morning;

    const { clockIn, clockOut, logId } = matchLogsToShift(
        logs,
        workingHalf.start,
        workingHalf.end,
    );

    if (!clockIn || !clockOut) {
        return {
            reqLeave: true,
            leaveRequestId,
            status: 'unauthorised',
            lateMinutes: 0,
            lateCoverMinutes: 0,
            dayType: null,
            clockIn: clockIn ?? null,
            clockOut: clockOut ?? null,
            logId: logId ?? null,
            scheduledStart: workingHalf.start,
            scheduledEnd: workingHalf.end,
        };
    }

    return {
        reqLeave: true,
        leaveRequestId,
        status: 'present',
        lateMinutes: calculateArrivalLateMinutes(workingHalf.start, clockIn),
        lateCoverMinutes: 0,
        dayType: 'half_day',
        clockIn,
        clockOut,
        logId,
        scheduledStart: workingHalf.start,
        scheduledEnd: workingHalf.end,
    };
};

/**
 * Resolve how leave affects one employee/date during attendance processing.
 * Returns null when no effective leave applies (process punches normally, reqLeave=false).
 */
const resolveLeaveForAttendance = async ({
    employeeId,
    date,
    shiftStart,
    shiftEnd,
    logs = [],
    clockIn = null,
    clockOut = null,
    logId = null,
}) => {
    const leave = await findEffectiveLeaveForDate(employeeId, date);
    if (!leave) {
        return null;
    }

    await autoAcceptPendingLeave(leave);

    const duration = leave.duration === 'half_day' ? 'half_day' : 'full_day';

    if (duration === 'half_day') {
        return applyHalfDayLeaveOutcome({
            logs,
            shiftStart,
            shiftEnd,
            halfDayPeriod: leave.halfDayPeriod,
            leaveRequestId: leave.id,
        });
    }

    return applyFullDayLeaveOutcome({
        clockIn,
        clockOut,
        logId,
        leaveRequestId: leave.id,
    });
};

const eachDateInRange = (startDate, endDate) => {
    const dates = [];
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const cursor = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(ey, em - 1, ed));

    while (cursor <= end) {
        const y = cursor.getUTCFullYear();
        const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
        const d = String(cursor.getUTCDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
};

// After explicit admin approve: mark overlapping attendance as requested leave.
const applyApprovedLeaveToAttendance = async (leaveRequest) => {
    const isHalfDay = leaveRequest.duration === 'half_day';

    await Attendance.update(
        {
            reqLeave: true,
            leaveRequestId: leaveRequest.id,
            ...(isHalfDay ? {} : { status: 'leave' }),
        },
        {
            where: {
                employeeId: leaveRequest.employeeId,
                date: {
                    [Op.between]: [leaveRequest.startDate, leaveRequest.endDate],
                },
                status: { [Op.ne]: 'holiday' },
            },
        },
    );
};

// After reject: clear leave flag so absence can reflect (e.g. no-pay).
const applyRejectedLeaveToAttendance = async (leaveRequest) => {
    const linked = await Attendance.findAll({
        where: {
            employeeId: leaveRequest.employeeId,
            date: {
                [Op.between]: [leaveRequest.startDate, leaveRequest.endDate],
            },
            [Op.or]: [
                { leaveRequestId: leaveRequest.id },
                { reqLeave: true },
            ],
        },
    });

    for (const row of linked) {
        const wasThisLeave = row.leaveRequestId === leaveRequest.id;
        if (!wasThisLeave && row.leaveRequestId != null) continue;

        row.reqLeave = false;
        row.leaveRequestId = null;
        if (row.status === 'leave') {
            row.status = 'absent';
        }
        await row.save();
    }
};

module.exports = {
    SYSTEM_REVIEWER_ID,
    AUTO_ACCEPT_COMMENT,
    splitShiftHalves,
    findEffectiveLeaveForDate,
    autoAcceptPendingLeave,
    resolveLeaveForAttendance,
    applyApprovedLeaveToAttendance,
    applyRejectedLeaveToAttendance,
    eachDateInRange,
};
