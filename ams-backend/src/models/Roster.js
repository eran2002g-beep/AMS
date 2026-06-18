// src/models/Roster.js - stores each individual shift row extracted from an uploaded roster file
// one RosterEntry = one employee's schedule for one day
// when a roster file is uploaded and parsed, every row in the file becomes one RosterEntry record

const { DataTypes } = require('sequelize');
const sequelize     = require('../../config/db');

const Roster = sequelize.define('Roster', {

    // id - internal primary key
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // rosterId - links this entry back to the parent Roster record (which file it came from)
    rosterId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    // employeeId - the public-facing employee ID from the file e.g. EMP001
    // used to match against the Employee table when processing attendance (Epic 4)
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // date - the scheduled work date for this entry e.g. 2025-06-01
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },

    // month - extracted from the date column, stored separately for easy filtering
    // e.g. date 2025-06-01 → month = 6
    // used to query "all entries for June" without scanning every date
    month: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    // year - extracted from the date column, stored separately alongside month
    // e.g. date 2025-06-01 → year = 2025
    year: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    // shiftStart - scheduled start time from the file e.g. "08:00"
    shiftStart: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // shiftEnd - scheduled end time from the file e.g. "17:00"
    shiftEnd: {
        type: DataTypes.STRING,
        allowNull: false,
    },

}, {
    tableName: 'roster',
    timestamps: true,
});

module.exports = Roster;