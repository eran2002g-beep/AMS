// src/models/LeaveRequest.js - stores leave requests and unauthorized leave resolution requests

const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');
const { nextSequentialPublicId } = require('../utils/publicId');

const LeaveRequest = sequelize.define('LeaveRequest', {
// src/models/LeaveRequest.js - stores each leave request submitted by an employee
// one LeaveRequest = one request for a continuous date range submitted for approval
// (Epic: Leave Management) this is what employees create when requesting time off,
// and what managers/admin-managers will act on in the Approve Leave Requests story.

const { DataTypes } = require('sequelize');
const sequelize     = require('../../config/db');
const { nextSequentialPublicId } = require('../utils/publicId');

const LeaveRequest = sequelize.define('LeaveRequest', {

    // id - internal primary key
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // leaveRequestId - public-facing ID, auto-generated as LRQ001, LRQ002...
    // leaveRequestId - public-facing ID, auto-generated as LVR001, LVR002...
    leaveRequestId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },

    // employeeId - public-facing employee ID e.g. EMP001
    // links this request to the employee who submitted it
    // links this request to the employee who submitted it - used for filtering
    // an employee's own requests and for manager/admin-manager review queues
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
    // leaveType - category of leave being requested
    // annual = planned time off, sick = illness, casual = short-notice personal leave,
    // unpaid = leave without pay, other = anything not covered above
    leaveType: {
        type: DataTypes.ENUM('annual', 'sick', 'casual', 'unpaid', 'other'),
        allowNull: false,
    },

    // startDate - first day of the requested leave e.g. "2026-08-10"
    startDate: {
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
    // endDate - last day of the requested leave (inclusive) e.g. "2026-08-12"
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },

    // totalDays - inclusive calendar day count between startDate and endDate
    // calculated by the service layer at submission time, stored for fast display/reporting
    totalDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    // reason - employee-supplied explanation for the leave request
    reason: {
        type: DataTypes.TEXT,
        allowNull: false,
    },

    // status - current state of the request in the approval workflow
    // pending  = awaiting manager/admin-manager decision (default on submission)
    // approved = accepted, expected to be linked to Attendance in the approval story
    // rejected = declined by manager/admin-manager
    // cancelled = withdrawn by the employee before a decision was made
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
    },

    // reviewedBy - public-facing employee ID of the manager/admin-manager who
    // actioned the request - null until a decision is made (future approval story)
    reviewedBy: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    // reviewNotes - optional notes from the manager when approving or rejecting
    reviewNotes: {
    // reviewComments - optional notes left by the reviewer explaining their decision
    reviewComments: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // reviewedAt - when a manager approved or rejected the request
    // reviewedAt - timestamp of the approval/rejection decision - null while pending
    reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'leave_requests',
    timestamps: true,

    hooks: {

}, {
    tableName: 'leave_requests',
    timestamps: true, // createdAt = submission time, updatedAt = last status change

    hooks: {

        // beforeValidate runs before allowNull checks — must run here, not beforeCreate
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
                LeaveRequest, 'leaveRequestId', 'LVR'
            );
        },
    },
});

module.exports = LeaveRequest;
