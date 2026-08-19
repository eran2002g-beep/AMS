// src/services/reviewChain.js - shared supervisor → HOD sequential review
// Leave and unauthorised requests both use this chain:
//   pending → supervisor accepts → supervisor_approved → HOD accepts → approved
// Either reviewer may reject at their step (final).
// If only one of HOD/supervisor is assigned, or they are the same person,
// that person completes the chain in a single step.

const { Op } = require('sequelize');

const IN_FLIGHT_STATUSES = ['pending', 'supervisor_approved'];
const EFFECTIVE_LEAVE_STATUSES = ['pending', 'supervisor_approved', 'approved'];
const BLOCKING_REQUEST_STATUSES = ['pending', 'supervisor_approved', 'approved'];

const forbiddenError = (message) => Object.assign(new Error(message), { status: 403 });

const isAssignedAdmin = (request, viewerId) => (
    request.hod === viewerId || request.supervisor === viewerId
);

const hasSupervisor = (request) => request.supervisor != null;
const hasHod = (request) => request.hod != null;
const isSamePerson = (request) => (
    hasSupervisor(request) && hasHod(request) && request.hod === request.supervisor
);

const requiresSupervisorFirst = (request) => (
    hasSupervisor(request) && hasHod(request) && !isSamePerson(request)
);

const viewerRole = (request, viewerId) => {
    const asHod = request.hod === viewerId;
    const asSupervisor = request.supervisor === viewerId;
    if (asHod && asSupervisor) return 'both';
    if (asSupervisor) return 'supervisor';
    if (asHod) return 'hod';
    return null;
};

const canAcceptRequest = (request, viewerId) => {
    if (!IN_FLIGHT_STATUSES.includes(request.status)) return false;
    const role = viewerRole(request, viewerId);
    if (!role) return false;

    if (requiresSupervisorFirst(request)) {
        if (request.status === 'pending') return role === 'supervisor';
        if (request.status === 'supervisor_approved') return role === 'hod';
        return false;
    }

    return request.status === 'pending';
};

const assertCanReview = (request, viewerId, { kind = 'request' } = {}) => {
    if (!isAssignedAdmin(request, viewerId)) {
        throw forbiddenError(`You are not assigned to review this ${kind}.`);
    }

    if (!IN_FLIGHT_STATUSES.includes(request.status)) {
        throw new Error(
            `Only pending ${kind}s can be reviewed (current: ${request.status}).`,
        );
    }

    if (canAcceptRequest(request, viewerId)) return;

    const role = viewerRole(request, viewerId);

    if (requiresSupervisorFirst(request) && request.status === 'pending' && role === 'hod') {
        throw forbiddenError(
            'Supervisor must accept this request before the HOD can review it.',
        );
    }

    if (
        requiresSupervisorFirst(request)
        && request.status === 'supervisor_approved'
        && role === 'supervisor'
    ) {
        throw new Error(
            'Supervisor already accepted this request. It is waiting for HOD review.',
        );
    }

    throw new Error(`You cannot review this ${kind} at the current step.`);
};

const resolveReviewStatus = (request, viewerId, decision) => {
    if (decision === 'rejected') return 'rejected';

    const role = viewerRole(request, viewerId);
    if (
        requiresSupervisorFirst(request)
        && request.status === 'pending'
        && role === 'supervisor'
    ) {
        return 'supervisor_approved';
    }

    return 'approved';
};

const applyReviewDecision = (request, viewer, decision, reviewComments) => {
    const nextStatus = resolveReviewStatus(request, viewer.id, decision);
    request.status = nextStatus;
    request.reviewedBy = viewer.employeeId;
    request.reviewComments = reviewComments?.trim() || null;
    request.reviewedAt = new Date();
    return nextStatus;
};

const statusFilterWhere = (status) => {
    if (!status) return undefined;
    if (status === 'awaiting') return { [Op.in]: IN_FLIGHT_STATUSES };
    return status;
};

const reviewSuccessMessage = (kind, status) => {
    if (status === 'supervisor_approved') {
        return `${kind} accepted by supervisor. Awaiting HOD approval.`;
    }
    if (status === 'rejected') {
        return `${kind} rejected successfully.`;
    }
    return `${kind} approved successfully.`;
};

module.exports = {
    IN_FLIGHT_STATUSES,
    EFFECTIVE_LEAVE_STATUSES,
    BLOCKING_REQUEST_STATUSES,
    isAssignedAdmin,
    canAcceptRequest,
    assertCanReview,
    resolveReviewStatus,
    applyReviewDecision,
    statusFilterWhere,
    reviewSuccessMessage,
};
