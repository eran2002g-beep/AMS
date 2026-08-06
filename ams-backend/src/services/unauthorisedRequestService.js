// src/services/unauthorisedRequestService.js - business logic for unauthorised attendance requests

const { Op } = require('sequelize');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const UnauthorisedRequest = require('../models/UnauthorisedRequest');
const {
    validateUnauthorisedRequestPayload,
    validateNoPendingForAttendance,
    resolveClaimedTimes,
} = require('./unauthorisedRequestValidation');

const notFoundError = (message) => Object.assign(new Error(message), { status: 404 });

const withCanAccept = (request, viewerId) => {
    const data = typeof request.toJSON === 'function'
        ? request.toJSON()
        : { ...request };

    data.canAccept = data.status === 'pending'
        && (data.hod === viewerId || data.supervisor === viewerId);

    return data;
};

const isAssignedAdmin = (request, viewerId) => (
    request.hod === viewerId || request.supervisor === viewerId
);

// -----------------------------------------------------------------------
// submitUnauthorisedRequest - validates payload, ensures attendance exists,
// snapshots HOD/supervisor, and creates the request linked to that attendance.
// -----------------------------------------------------------------------
const submitUnauthorisedRequest = async (employeeId, data) => {
    if (!employeeId) {
        throw new Error('employeeId is required to submit an unauthorised request.');
    }

    const employee = await Employee.findOne({ where: { employeeId, isActive: true } });
    if (!employee) {
        throw notFoundError(`Active employee with ID ${employeeId} not found.`);
    }

    const validated = validateUnauthorisedRequestPayload(data);

    const attendance = await Attendance.findOne({
        where: { attendanceId: validated.attendanceId },
    });
    if (!attendance) {
        throw notFoundError(
            `Attendance record with ID ${validated.attendanceId} not found.`,
        );
    }

    if (attendance.employeeId !== employeeId) {
        throw new Error(
            `Attendance ${validated.attendanceId} does not belong to employee ${employeeId}.`,
        );
    }

    if (attendance.status !== 'unauthorised') {
        throw new Error(
            `Only attendance with status "unauthorised" can be linked (current: ${attendance.status}).`,
        );
    }

    // Default happenDate to the attendance day; if client sent one it must match
    const happenDate = validated.happenDate ?? attendance.date;
    if (happenDate !== attendance.date) {
        throw new Error(
            `happenDate (${happenDate}) must match attendance date ${attendance.date}.`,
        );
    }

    const { clockIn, clockOut } = resolveClaimedTimes(attendance, validated);

    await validateNoPendingForAttendance(attendance.id);

    const request = await UnauthorisedRequest.create({
        employeeId,
        attendanceId: attendance.id,
        happenDate,
        clockIn,
        clockOut,
        reason: validated.reason,
        description: validated.description,
        status: 'pending',
        hod: employee.hod ?? null,
        supervisor: employee.supervisor ?? null,
    });

    return request;
};

const getUnauthorisedRequestsByEmployee = async (employeeId, opts = {}) => {
    const employee = await Employee.findOne({ where: { employeeId, isActive: true } });
    if (!employee) {
        throw notFoundError(`Active employee with ID ${employeeId} not found.`);
    }

    const { status, page = 1, limit = 50 } = opts;
    const where = { employeeId };
    if (status) where.status = status;

    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    const { rows: records, count: total } = await UnauthorisedRequest.findAndCountAll({
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

const getAllUnauthorisedRequests = async (opts = {}, viewerId) => {
    if (!viewerId) {
        throw new Error('viewerId is required to list assigned unauthorised requests.');
    }

    const { employeeId, status, page = 1, limit = 50 } = opts;

    const where = {
        [Op.or]: [
            { hod: viewerId },
            { supervisor: viewerId },
        ],
    };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    const { rows: records, count: total } = await UnauthorisedRequest.findAndCountAll({
        where,
        limit: parsedLimit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    return {
        records: records.map((row) => withCanAccept(row, viewerId)),
        meta: { total, page: parsedPage, limit: parsedLimit },
    };
};

const getUnauthorisedRequestById = async (unauthorisedRequestId, viewerId) => {
    const request = await UnauthorisedRequest.findOne({
        where: { unauthorisedRequestId },
    });

    if (!request || !isAssignedAdmin(request, viewerId)) {
        throw notFoundError(
            `Unauthorised request with ID ${unauthorisedRequestId} not found.`,
        );
    }

    return withCanAccept(request, viewerId);
};

module.exports = {
    submitUnauthorisedRequest,
    getUnauthorisedRequestsByEmployee,
    getAllUnauthorisedRequests,
    getUnauthorisedRequestById,
};
