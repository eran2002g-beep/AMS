// src/services/leaveRequestService.js - handles business logic for employee leave requests
// sits between the controller and the model - controller handles HTTP, service handles logic
// Mirrors the shape of attendanceService.js so leave management stays consistent with
// how the rest of the Employee Service domain (attendance, roster) is structured.

const { Op } = require('sequelize');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const {
    validateLeaveRequestPayload,
    validateNoOverlappingLeave,
} = require('./leaveRequestValidation');
const leaveAttendanceHelper = require('./leaveAttendanceHelper');
const {
    isAssignedAdmin,
    canAcceptRequest,
    canViewAnyRequest,
    assertCanReview,
    applyReviewDecision,
    statusFilterWhere,
} = require('./reviewChain');

const notFoundError = (message) => Object.assign(new Error(message), { status: 404 });

// canAccept - true when it is this viewer's turn in the supervisor → HOD chain,
// or when the viewer is admin/super-admin (org-wide final review).
const withCanAccept = (leaveRequest, viewerId, employeeRole) => {
    const data = typeof leaveRequest.toJSON === 'function'
        ? leaveRequest.toJSON()
        : { ...leaveRequest };

    data.canAccept = canAcceptRequest(data, viewerId, employeeRole);

    return data;
};

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

        const reviewedByName = r.reviewedBy === 'SYSTEM'
            ? 'System (auto-accept)'
            : (r.reviewedBy
                ? (reviewerNameByPublicId[r.reviewedBy] ?? r.reviewedBy)
                : null);

        return {
            ...r,
            reviewedByName,
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
        duration: validated.duration,
        halfDayPeriod: validated.halfDayPeriod,
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
    const statusWhere = statusFilterWhere(status);
    if (statusWhere !== undefined) where.status = statusWhere;

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

const paginatedLeaveWhere = (opts = {}) => {
    const { employeeId, status, page = 1, limit = 50 } = opts;
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    const statusWhere = statusFilterWhere(status);
    if (statusWhere !== undefined) where.status = statusWhere;

    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    return { where, parsedLimit, parsedPage, offset };
};

// -----------------------------------------------------------------------
// getAllLeaveRequests - leave requests assigned to the viewing manager/admin-manager
// Only returns rows where the viewer is the leave's hod or supervisor.
// Supports optional employeeId, status, and pagination filters.
// -----------------------------------------------------------------------
const getAllLeaveRequests = async (opts = {}, viewerId, employeeRole) => {
    if (!viewerId) {
        throw new Error('viewerId is required to list assigned leave requests.');
    }

    const { where, parsedLimit, parsedPage, offset } = paginatedLeaveWhere(opts);
    where[Op.or] = [
        { hod: viewerId },
        { supervisor: viewerId },
    ];

    const { rows: records, count: total } = await LeaveRequest.findAndCountAll({
        where,
        limit: parsedLimit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const withNames = await enrichRequestRecords(records);
    return {
        records: withNames.map((row) => withCanAccept(row, viewerId, employeeRole)),
        meta: { total, page: parsedPage, limit: parsedLimit },
    };
};

// -----------------------------------------------------------------------
// getAdminLeaveRequests - every leave request in the system (admin overview)
// Not filtered by assigned HOD/supervisor. Supports the same query filters
// as getAllLeaveRequests (employeeId, status, page, limit).
// -----------------------------------------------------------------------
const getAdminLeaveRequests = async (opts = {}, viewerId, employeeRole) => {
    if (!viewerId) {
        throw new Error('viewerId is required to list leave requests.');
    }

    const { where, parsedLimit, parsedPage, offset } = paginatedLeaveWhere(opts);

    const { rows: records, count: total } = await LeaveRequest.findAndCountAll({
        where,
        limit: parsedLimit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const withNames = await enrichRequestRecords(records);
    return {
        records: withNames.map((row) => withCanAccept(row, viewerId, employeeRole)),
        meta: { total, page: parsedPage, limit: parsedLimit },
    };
};

// -----------------------------------------------------------------------
// getLeaveRequestById - fetch a single leave request by its public ID
// Assigned HOD/supervisor, or admin-tier roles that may view any request.
// -----------------------------------------------------------------------
const getLeaveRequestById = async (leaveRequestId, viewerId, employeeRole) => {
    const leaveRequest = await LeaveRequest.findOne({ where: { leaveRequestId } });

    if (
        !leaveRequest
        || (!isAssignedAdmin(leaveRequest, viewerId) && !canViewAnyRequest(employeeRole))
    ) {
        throw notFoundError(`Leave request with ID ${leaveRequestId} not found.`);
    }

    const [enriched] = await enrichRequestRecords([leaveRequest]);
    return withCanAccept(enriched, viewerId, employeeRole);
};

// -----------------------------------------------------------------------
// reviewLeaveRequest - sequential chain: supervisor first, then HOD.
// Supervisor accept → supervisor_approved (attendance unchanged).
// HOD accept → approved + apply leave to attendance.
// Either step may reject (final) and clear leave from attendance.
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

    assertCanReview(leaveRequest, viewer.id, {
        kind: 'leave request',
        employeeRole: viewer.role,
    });

    const nextStatus = applyReviewDecision(leaveRequest, viewer, decision, reviewComments);
    await leaveRequest.save();

    if (nextStatus === 'approved') {
        await leaveAttendanceHelper.applyApprovedLeaveToAttendance(leaveRequest);
    } else if (nextStatus === 'rejected') {
        await leaveAttendanceHelper.applyRejectedLeaveToAttendance(leaveRequest);
    }

    const [enriched] = await enrichRequestRecords([leaveRequest]);
    return withCanAccept(enriched, viewer.id, viewer.role);
};

module.exports = {
    submitLeaveRequest,
    getLeaveRequestsByEmployee,
    getAllLeaveRequests,
    getAdminLeaveRequests,
    getLeaveRequestById,
    reviewLeaveRequest,
};