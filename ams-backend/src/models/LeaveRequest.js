// src/models/LeaveRequest.js - stores leave requests and unauthorized leave resolution requests

const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');
const { nextSequentialPublicId } = require('../utils/publicId');

const LeaveRequest = sequelize.define('LeaveRequest', {
    // id - internal primary key
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // leaveRequestId - public-facing ID, auto-generated as LRQ001, LRQ002...
    leaveRequestId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },

    // employeeId - public-facing employee ID e.g. EMP001
    // links this request to the employee who submitted it
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // attendanceId - optional link to an existing attendance record
    // used when resolving an unauthorised day or attaching an approved leave
    attendanceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },

    // date - the date the leave request is for
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },

    // requestType - distinguishes an unauthorised resolution request from a regular leave request
    requestType: {
        type: DataTypes.ENUM('unauthorised', 'leave'),
        allowNull: false,
        defaultValue: 'unauthorised',
    },

    // status - current workflow status of the request
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
    },

    // reason - employee-provided reason for the leave or unauthorized request
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // reviewerId - public-facing employee ID of the manager who reviewed this request
    reviewerId: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    // reviewNotes - optional notes from the manager when approving or rejecting
    reviewNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // reviewedAt - when a manager approved or rejected the request
    reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'leave_requests',
    timestamps: true,

    hooks: {
        beforeValidate: async (leaveRequest) => {
            if (!leaveRequest.isNewRecord || leaveRequest.leaveRequestId) return;

            leaveRequest.leaveRequestId = await nextSequentialPublicId(
                LeaveRequest,
                'leaveRequestId',
                'LRQ',
            );
        },
    },
});

module.exports = LeaveRequest;
