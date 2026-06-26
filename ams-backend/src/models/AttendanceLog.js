// src/models/AttendanceLog.js - stores each individual punch card swipe recorded by the IoT device one AttendanceLog = one punch event for one employee (clock in or clock out) this is the raw attendance data that gets matched against RosterEntry records in Epic 4

const { DataTypes } = require('sequelize');
const sequelize     = require('../../config/db');

const AttendanceLog = sequelize.define('AttendanceLog', {

    // id - internal primary key
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // logId - public-facing ID, auto-generated as LOG001, LOG002...
    // generated in the beforeCreate hook below, never set manually
    logId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },

    // employeeId - public-facing employee ID e.g. EMP001
    // links this log to the employee who punched - used when processing roster attendance (Epic 4)
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // punchDate - the date of this punch event e.g. "2025-06-01"
    // stored separately from punchTime so we can filter records by date easily (Epic 4 AC1)
    punchDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },

    // punchTime - the exact time of the punch e.g. "08:03:45"
    // used to calculate late arrivals or early departures when matched against roster shift times
    punchTime: {
        type: DataTypes.TIME,
        allowNull: false,
    },

    // punchType - whether this is a clock-in or clock-out event
    // ENUM restricts to only these two values - every punch must be one or the other
    punchType: {
        type: DataTypes.ENUM('in', 'out'),
        allowNull: false,
    },

    // attendanceStatus - the calculated status of this attendance record
    // set after roster processing runs in Epic 4 - starts as 'pending' until processed
    // present   = punched in on time
    // late      = punched in after scheduled shiftStart
    // absent    = no punch found for a scheduled shift
    // leave     = covered by an approved leave request
    // unauthorised = absent with no approved leave
    attendanceStatus: {
        type: DataTypes.ENUM('pending', 'present', 'late', 'absent', 'leave', 'unauthorised'),
        defaultValue: 'pending', // status is calculated later during roster processing
    },

    // source - how this log was created
    // iot    = recorded automatically by the IoT punch device (Epic 1)
    // manual = added manually by an admin (Epic 4: Add Attendance Records)
    source: {
        type: DataTypes.ENUM('iot', 'manual'),
        defaultValue: 'iot',
    },

    // rosterId - links this log to the roster it was matched against during processing
    // null until roster processing runs - set by the attendance processor in Epic 4
    rosterId: {
        type: DataTypes.INTEGER,
        allowNull: true, // null = not yet matched to a roster
    },

    // notes - optional admin notes e.g. reason for manual entry or correction
    // used when admin adds or edits a record manually (Epic 4: Add/Edit Attendance Records)
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // syncError - stores the error message if IoT sync failed for this record
    // used in Epic 1 AC4: given synchronization fails, an error message shall be logged
    syncError: {
        type: DataTypes.TEXT,
        allowNull: true, // null = no sync error, value = the error message that was logged
    },

}, {
    tableName: 'attendance_logs',
    timestamps: true, // createdAt and updatedAt track when records are added or edited

    hooks: {

        // beforeCreate - auto-generates logId like LOG001, LOG002...
        // same pattern used in Employee (EMP001) and Roster (RST001)
        beforeCreate: async (log) => {

            const count  = await AttendanceLog.count();
            const padded = String(count + 1).padStart(3, '0');
            log.logId    = `LOG${padded}`;
        },
    },
});

module.exports = AttendanceLog;