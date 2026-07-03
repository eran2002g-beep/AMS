// src/services/rosterAttendanceService.js - roster-based attendance processing

const RosterEntry   = require('../models/Roster');
const AttendanceLog = require('../models/AttendanceLog');
const {
    calculateLateCover,
    calculateStatus,
    matchLogsToShift,
    upsertAttendanceRecord,
    buildDiscrepancy,
    isDiscrepancy,
} = require('../utils/attendanceUtils');

const matchEntryToLogs = async (entry) => {
    const logs = await AttendanceLog.findAll({
        where: {
            employeeId: entry.employeeId,
            punchDate:  entry.date,
        },
        order: [['punchTime', 'ASC']],
    });

    return matchLogsToShift(logs, entry.shiftStart, entry.shiftEnd);
};

const processRosterAttendance = async (rosterId) => {
    const entries = await RosterEntry.findAll({ where: { rosterId } });

    if (entries.length === 0) {
        throw new Error('No roster entries found for this roster.');
    }

    const results       = [];
    const discrepancies = [];

    for (const entry of entries) {
        const { clockIn, clockOut, logId } = await matchEntryToLogs(entry);

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
            rosterId,
            logId,
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
