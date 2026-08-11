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
const forbiddenError = (message) => Object.assign(new Error(message), { status: 403 });

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

// Attach reviewer display name + assigned HOD/supervisor names for hierarchy UI.
const attachReviewerNames = async (records) => {
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
        records: await attachReviewerNames(records),
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

    const withNames = await attachReviewerNames(records);
    return {
        records: withNames.map((row) => withCanAccept(row, viewerId)),
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

    const [enriched] = await attachReviewerNames([request]);
    return withCanAccept(enriched, viewerId);
};

// -----------------------------------------------------------------------
// reviewUnauthorisedRequest - approve or reject a pending request.
// On approve: apply claimed clock times and clear unauthorised attendance status.
// -----------------------------------------------------------------------
const reviewUnauthorisedRequest = async (
    unauthorisedRequestId,
    viewer,
    { decision, reviewComments } = {},
) => {
    if (!viewer?.id || !viewer?.employeeId) {
        throw new Error('viewer is required to review an unauthorised request.');
    }
    if (!['approved', 'rejected'].includes(decision)) {
        throw new Error('decision must be "approved" or "rejected".');
    }

    const request = await UnauthorisedRequest.findOne({
        where: { unauthorisedRequestId },
    });
    if (!request) {
        throw notFoundError(
            `Unauthorised request with ID ${unauthorisedRequestId} not found.`,
        );
    }
    if (!isAssignedAdmin(request, viewer.id)) {
        throw forbiddenError('You are not assigned to review this unauthorised request.');
    }
    if (request.status !== 'pending') {
        throw new Error(
            `Only pending unauthorised requests can be reviewed (current: ${request.status}).`,
        );
    }

    request.status = decision;
    request.reviewedBy = viewer.employeeId;
    request.reviewComments = reviewComments?.trim() || null;
    request.reviewedAt = new Date();
    await request.save();

    if (decision === 'approved') {
        const attendance = await Attendance.findByPk(request.attendanceId);
        if (attendance && attendance.status === 'unauthorised') {
            if (request.clockIn) attendance.clockIn = request.clockIn;
            if (request.clockOut) attendance.clockOut = request.clockOut;
            attendance.status = 'present';
            await attendance.save();
        }
    }

    const [enriched] = await attachReviewerNames([request]);
    return withCanAccept(enriched, viewer.id);
};

module.exports = {
    submitUnauthorisedRequest,
    getUnauthorisedRequestsByEmployee,
    getAllUnauthorisedRequests,
    getUnauthorisedRequestById,
    reviewUnauthorisedRequest,
};
