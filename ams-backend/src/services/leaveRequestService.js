// src/services/leaveRequestService.js - handles business logic for employee leave requests
// sits between the controller and the model - controller handles HTTP, service handles logic
// Mirrors the shape of attendanceService.js so leave management stays consistent with
// how the rest of the Employee Service domain (attendance, roster) is structured.

const { Op } = require('sequelize');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const {
    validateLeaveRequestPayload,
    validateNoOverlappingLeave,
} = require('./leaveRequestValidation');

const notFoundError = (message) => Object.assign(new Error(message), { status: 404 });
const forbiddenError = (message) => Object.assign(new Error(message), { status: 403 });

// canAccept - true when the viewer is this leave's HOD or supervisor and status is still pending
const withCanAccept = (leaveRequest, viewerId) => {
    const data = typeof leaveRequest.toJSON === 'function'
        ? leaveRequest.toJSON()
        : { ...leaveRequest };

    data.canAccept = data.status === 'pending'
        && (data.hod === viewerId || data.supervisor === viewerId);

    return data;
};

const isAssignedAdmin = (leaveRequest, viewerId) => (
    leaveRequest.hod === viewerId || leaveRequest.supervisor === viewerId
);

// Attach reviewer display name + assigned HOD/supervisor names for hierarchy UI.
const enrichRequestRecords = async (records) => {
    const list = records.map((row) => (
        typeof row.toJSON === 'function' ? row.toJSON() : { ...row }
    ));

    const reviewerPublicIds = [...new Set(list.map((r) => r.reviewedBy).filter(Boolean))];
    const hierarchyInternalIds = [
        ...new Set(list.flatMap((r) => [r.hod, r.supervisor].filter(Boolean))),
    ];

    const [reviewers, hierarchyEmployees] = await Promise.all([
        reviewerPublicIds.length
            ? Employee.findAll({
                where: { employeeId: { [Op.in]: reviewerPublicIds } },
                attributes: ['id', 'employeeId', 'firstName', 'lastName'],
            })
            : Promise.resolve([]),
        hierarchyInternalIds.length
            ? Employee.findAll({
                where: { id: { [Op.in]: hierarchyInternalIds } },
                attributes: ['id', 'employeeId', 'firstName', 'lastName'],
            })
            : Promise.resolve([]),
    ]);

    const reviewerNameByPublicId = Object.fromEntries(
        reviewers.map((e) => [e.employeeId, `${e.firstName} ${e.lastName}`]),
    );
    const hierarchyByInternalId = Object.fromEntries(
        hierarchyEmployees.map((e) => [e.id, e]),
    );

    return list.map((r) => {
        const hod = r.hod != null ? hierarchyByInternalId[r.hod] : null;
        const supervisor = r.supervisor != null ? hierarchyByInternalId[r.supervisor] : null;

        let reviewedByRole = null;
        if (r.reviewedBy && hod && r.reviewedBy === hod.employeeId) reviewedByRole = 'hod';
        else if (r.reviewedBy && supervisor && r.reviewedBy === supervisor.employeeId) {
            reviewedByRole = 'supervisor';
        }

        return {
            ...r,
            reviewedByName: r.reviewedBy
                ? (reviewerNameByPublicId[r.reviewedBy] ?? r.reviewedBy)
                : null,
            reviewedByRole,
            hodEmployeeId: hod?.employeeId ?? null,
            hodName: hod ? `${hod.firstName} ${hod.lastName}` : null,
            supervisorEmployeeId: supervisor?.employeeId ?? null,
            supervisorName: supervisor
                ? `${supervisor.firstName} ${supervisor.lastName}`
                : null,
        };
    });
};

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
        // Snapshot HOD/supervisor at submit so the admin queue stays correct even if
        // the employee's hierarchy changes later
        hod: employee.hod ?? null,
        supervisor: employee.supervisor ?? null,
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
        records: await enrichRequestRecords(records),
        meta: { total, page: parsedPage, limit: parsedLimit },
    };
};

// -----------------------------------------------------------------------
// getAllLeaveRequests - leave requests assigned to the viewing manager/admin-manager
// Only returns rows where the viewer is the leave's hod or supervisor.
// Supports optional employeeId, status, and pagination filters.
// -----------------------------------------------------------------------
const getAllLeaveRequests = async (opts = {}, viewerId) => {
    if (!viewerId) {
        throw new Error('viewerId is required to list assigned leave requests.');
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

    const { rows: records, count: total } = await LeaveRequest.findAndCountAll({
        where,
        limit: parsedLimit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const withNames = await enrichRequestRecords(records);
    return {
        records: withNames.map((row) => withCanAccept(row, viewerId)),
        meta: { total, page: parsedPage, limit: parsedLimit },
    };
};

// -----------------------------------------------------------------------
// getLeaveRequestById - fetch a single leave request by its public ID
// Viewer must be the leave's assigned hod or supervisor.
// -----------------------------------------------------------------------
const getLeaveRequestById = async (leaveRequestId, viewerId) => {
    const leaveRequest = await LeaveRequest.findOne({ where: { leaveRequestId } });

    if (!leaveRequest || !isAssignedAdmin(leaveRequest, viewerId)) {
        throw notFoundError(`Leave request with ID ${leaveRequestId} not found.`);
    }

    const [enriched] = await enrichRequestRecords([leaveRequest]);
    return withCanAccept(enriched, viewerId);
};

// -----------------------------------------------------------------------
// reviewLeaveRequest - approve or reject a pending leave request.
// Only the assigned HOD/supervisor may review. On approve, marks overlapping
// attendance days as leave and links them to this request.
// -----------------------------------------------------------------------
const reviewLeaveRequest = async (leaveRequestId, viewer, { decision, reviewComments } = {}) => {
    if (!viewer?.id || !viewer?.employeeId) {
        throw new Error('viewer is required to review a leave request.');
    }
    if (!['approved', 'rejected'].includes(decision)) {
        throw new Error('decision must be "approved" or "rejected".');
    }

    const leaveRequest = await LeaveRequest.findOne({ where: { leaveRequestId } });
    if (!leaveRequest) {
        throw notFoundError(`Leave request with ID ${leaveRequestId} not found.`);
    }
    if (!isAssignedAdmin(leaveRequest, viewer.id)) {
        throw forbiddenError('You are not assigned to review this leave request.');
    }
    if (leaveRequest.status !== 'pending') {
        throw new Error(
            `Only pending leave requests can be reviewed (current: ${leaveRequest.status}).`,
        );
    }

    leaveRequest.status = decision;
    leaveRequest.reviewedBy = viewer.employeeId;
    leaveRequest.reviewComments = reviewComments?.trim() || null;
    leaveRequest.reviewedAt = new Date();
    await leaveRequest.save();

    if (decision === 'approved') {
        await Attendance.update(
            {
                status: 'leave',
                leaveRequestId: leaveRequest.id,
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
    }

    const [enriched] = await enrichRequestRecords([leaveRequest]);
    return withCanAccept(enriched, viewer.id);
};

module.exports = {
    submitLeaveRequest,
    getLeaveRequestsByEmployee,
    getAllLeaveRequests,
    getLeaveRequestById,
    reviewLeaveRequest,
};