// src/services/leaveRequestService.js - handles business logic for employee leave requests
// sits between the controller and the model - controller handles HTTP, service handles logic
// Mirrors the shape of attendanceService.js so leave management stays consistent with
// how the rest of the Employee Service domain (attendance, roster) is structured.

const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const {
    validateLeaveRequestPayload,
    validateNoOverlappingLeave,
} = require('./leaveRequestValidation');

// -----------------------------------------------------------------------
// submitLeaveRequest - validates and creates a new leave request for an employee
// AC: employee submits a leave request so management can be informed of the absence
// -----------------------------------------------------------------------
const submitLeaveRequest = async (employeeId, data) => {
    if (!employeeId) {
        throw new Error('employeeId is required to submit a leave request.');
    }

    const employee = await Employee.findOne({ where: { employeeId, isActive: true } });
    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    const validated = validateLeaveRequestPayload(data);

    await validateNoOverlappingLeave(employeeId, validated.startDate, validated.endDate);

    const leaveRequest = await LeaveRequest.create({
        employeeId,
        leaveType: validated.leaveType,
        startDate: validated.startDate,
        endDate: validated.endDate,
        totalDays: validated.totalDays,
        reason: validated.reason,
        status: 'pending',
    });

    return leaveRequest;
};

// -----------------------------------------------------------------------
// getLeaveRequestsByEmployee - fetch one employee's leave request history
// Supports optional status filter and pagination, same shape as getEmployeeAttendance.
// -----------------------------------------------------------------------
const getLeaveRequestsByEmployee = async (employeeId, opts = {}) => {
    const employee = await Employee.findOne({ where: { employeeId, isActive: true } });
    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    const { status, page = 1, limit = 50 } = opts;
    const where = { employeeId };
    if (status) where.status = status;

    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    const { rows: records, count: total } = await LeaveRequest.findAndCountAll({
        where,
        limit: parsedLimit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    return {
        records,
        meta: { total, page: parsedPage, limit: parsedLimit },
    };
};

// -----------------------------------------------------------------------
// getAllLeaveRequests - fetch leave requests across all employees (manager/admin view)
// Supports optional employeeId, status, and pagination filters.
// -----------------------------------------------------------------------
const getAllLeaveRequests = async (opts = {}) => {
    const { employeeId, status, page = 1, limit = 50 } = opts;

    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    const { rows: records, count: total } = await LeaveRequest.findAndCountAll({
        where,
        limit: parsedLimit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    return {
        records,
        meta: { total, page: parsedPage, limit: parsedLimit },
    };
};

// -----------------------------------------------------------------------
// getLeaveRequestById - fetch a single leave request by its public ID
// -----------------------------------------------------------------------
const getLeaveRequestById = async (leaveRequestId) => {
    const leaveRequest = await LeaveRequest.findOne({ where: { leaveRequestId } });

    if (!leaveRequest) {
        throw new Error(`Leave request with ID ${leaveRequestId} not found.`);
    }

    return leaveRequest;
};

module.exports = {
    submitLeaveRequest,
    getLeaveRequestsByEmployee,
    getAllLeaveRequests,
    getLeaveRequestById,
};