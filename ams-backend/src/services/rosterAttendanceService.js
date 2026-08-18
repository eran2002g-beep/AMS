// src/services/rosterAttendanceService.js - roster-based attendance processing

const RosterEntry   = require('../models/Roster');
const AttendanceLog = require('../models/AttendanceLog');
const {
    calculateArrivalLateMinutes,
    calculateLateCover,
    calculateStatus,
    matchLogsToShift,
    upsertAttendanceRecord,
    buildDiscrepancy,
    isDiscrepancy,
} = require('../utils/attendanceUtils');
const { resolveLeaveForAttendance } = require('./leaveAttendanceHelper');

const matchEntryToLogs = async (entry) => {
    const logs = await AttendanceLog.findAll({
        where: {
            employeeId: entry.employeeId,
            punchDate:  entry.date,
        },
        order: [['punchTime', 'ASC']],
    });

    return { logs, matched: matchLogsToShift(logs, entry.shiftStart, entry.shiftEnd) };
};

const processRosterAttendance = async (rosterId) => {
    const entries = await RosterEntry.findAll({ where: { rosterId } });

    if (entries.length === 0) {
        throw new Error('No roster entries found for this roster.');
    }

    const results       = [];
    const discrepancies = [];

    for (const entry of entries) {
        const { logs, matched } = await matchEntryToLogs(entry);
        const { clockIn, clockOut, logId } = matched;

        const leaveOutcome = await resolveLeaveForAttendance({
            employeeId: entry.employeeId,
            date: entry.date,
            shiftStart: entry.shiftStart,
            shiftEnd: entry.shiftEnd,
            logs,
            clockIn,
            clockOut,
            logId,
        });

        let status;
        let lateMinutes;
        let lateCoverMinutes;
        let dayType = null;
        let finalClockIn;
        let finalClockOut;
        let finalLogId;
        let scheduledStart = entry.shiftStart;
        let scheduledEnd = entry.shiftEnd;
        let reqLeave = false;
        let leaveRequestId = null;

        if (leaveOutcome) {
            status = leaveOutcome.status;
            lateMinutes = leaveOutcome.lateMinutes;
            lateCoverMinutes = leaveOutcome.lateCoverMinutes;
            dayType = leaveOutcome.dayType;
            finalClockIn = leaveOutcome.clockIn;
            finalClockOut = leaveOutcome.clockOut;
            finalLogId = leaveOutcome.logId;
            scheduledStart = leaveOutcome.scheduledStart || entry.shiftStart;
            scheduledEnd = leaveOutcome.scheduledEnd || entry.shiftEnd;
            reqLeave = leaveOutcome.reqLeave;
            leaveRequestId = leaveOutcome.leaveRequestId;
        } else {
            finalClockIn = clockIn;
            finalClockOut = clockOut;
            finalLogId = logId;
            status = calculateStatus(clockIn, clockOut);
            lateMinutes = calculateArrivalLateMinutes(entry.shiftStart, clockIn);
            lateCoverMinutes = calculateLateCover(
                entry.shiftStart, entry.shiftEnd, clockIn, clockOut
            );
        }

        if (isDiscrepancy(status, lateMinutes, lateCoverMinutes)) {
            discrepancies.push(buildDiscrepancy(
                entry.employeeId, entry.date, status, lateMinutes, lateCoverMinutes, dayType
            ));
        }

        const attendanceRecord = await upsertAttendanceRecord({
            employeeId:      entry.employeeId,
            date:            entry.date,
            clockIn:         finalClockIn,
            clockOut:        finalClockOut,
            scheduledStart,
            scheduledEnd,
            status,
            lateMinutes,
            lateCoverMinutes,
            dayType,
            rosterId,
            logId:           finalLogId,
            reqLeave,
            leaveRequestId,
        });

        results.push(attendanceRecord);
    }

    return {
        processedCount:   results.length,
        discrepancyCount: discrepancies.length,
        discrepancies,
        records:          results,
    };
};

module.exports = {
    processRosterAttendance,
};
