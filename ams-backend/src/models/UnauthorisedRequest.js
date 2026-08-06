// src/models/UnauthorisedRequest.js - employee request explaining an unauthorised attendance day
// Same approval fields as LeaveRequest, plus a link to the Attendance record and a description.
// One Attendance can have many UnauthorisedRequests (one-to-many).

const { DataTypes } = require('sequelize');
const sequelize     = require('../../config/db');
const { nextSequentialPublicId } = require('../utils/publicId');
const Attendance = require('./Attendance');

const UnauthorisedRequest = sequelize.define('UnauthorisedRequest', {

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // unauthorisedRequestId - public-facing ID, auto-generated as UNA001, UNA002...
    unauthorisedRequestId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },

    // employeeId - public-facing employee ID e.g. EMP001
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // attendanceId - internal Attendance PK this request is explaining
    // Attendance hasMany UnauthorisedRequest (one attendance → many requests over time)
    attendanceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'attendance',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
    },

    // happenDate - the day the unauthorised attendance occurred e.g. "2026-08-01"
    happenDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },

    // clockIn / clockOut - times the employee is claiming for this day
    // (fills in a missing punch that caused status = unauthorised)
    clockIn: {
        type: DataTypes.TIME,
        allowNull: true,
    },

    clockOut: {
        type: DataTypes.TIME,
        allowNull: true,
    },

    reason: {
        type: DataTypes.TEXT,
        allowNull: false,
    },

    // description - extra detail about the unauthorised absence / missing punch
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
    },

    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
    },

    reviewedBy: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    reviewComments: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    hod: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'employees',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
    },

    supervisor: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'employees',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
    },

}, {
    tableName: 'unauthorised_requests',
    timestamps: true,

    hooks: {
        beforeValidate: async (request) => {
            if (!request.isNewRecord || request.unauthorisedRequestId) return;

            request.unauthorisedRequestId = await nextSequentialPublicId(
                UnauthorisedRequest, 'unauthorisedRequestId', 'UNA'
            );
        },
    },
});

UnauthorisedRequest.belongsTo(Attendance, {
    foreignKey: 'attendanceId',
    as: 'attendance',
});

Attendance.hasMany(UnauthorisedRequest, {
    foreignKey: 'attendanceId',
    as: 'unauthorisedRequests',
});

module.exports = UnauthorisedRequest;
