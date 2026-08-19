const leaveRequestService = require('../services/leaveRequestService');
const AdminService = require('../services/adminService');
const { reviewSuccessMessage } = require('../services/reviewChain');

const statusFromError = (err) => {
    if (err.status) return err.status;
    if (err.message && err.message.includes('not found')) return 404;
    return 400;
};

// POST /leave/submit - employee submits a new leave request for themselves
// Defaults to the signed-in user's employeeId; a manager/admin-manager may
// submit on behalf of someone else by passing employeeId in the body.
const submitLeaveRequest = async (req, res) => {
    try {
        const employeeId = req.body.employeeId || req.user.employeeId;

        const leaveRequest = await leaveRequestService.submitLeaveRequest(employeeId, req.body);

        return res.status(201).json({
            status: 'success',
            message: 'Leave request submitted successfully.',
            data: leaveRequest,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

// GET /leave/employee/:employeeId - an employee's own leave request history
const getEmployeeLeaveRequests = async (req, res) => {
    try {
        const result = await leaveRequestService.getLeaveRequestsByEmployee(
            req.params.employeeId,
            req.query,
        );

        return res.status(200).json({
            status: 'success',
            count: result.records.length,
            meta: result.meta,
            data: result.records,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

// GET /leave/me - leave request history for the signed-in employee
const getMyLeaveRequests = async (req, res) => {
    try {
        const result = await leaveRequestService.getLeaveRequestsByEmployee(
            req.user.employeeId,
            req.query,
        );

        return res.status(200).json({
            status: 'success',
            count: result.records.length,
            meta: result.meta,
            data: result.records,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

// GET /leave/queue (and GET /leave) - leave requests assigned to the signed-in
// manager/admin-manager; each row includes canAccept and reviewedByName
const getAllLeaveRequests = async (req, res) => {
    try {
        const result = await leaveRequestService.getAllLeaveRequests(
            req.query,
            req.user.id,
            req.user.role,
        );

        return res.status(200).json({
            status: 'success',
            count: result.records.length,
            meta: result.meta,
            data: result.records,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

// GET /leave/all - every leave request for admin / admin-manager / super-admin
const getAdminLeaveRequests = async (req, res) => {
    try {
        const result = await leaveRequestService.getAdminLeaveRequests(
            req.query,
            req.user.id,
            req.user.role,
        );

        return res.status(200).json({
            status: 'success',
            count: result.records.length,
            meta: result.meta,
            data: result.records,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

// GET /leave/:leaveRequestId - a single leave request by its public ID
const getLeaveRequestById = async (req, res) => {
    try {
        const leaveRequest = await leaveRequestService.getLeaveRequestById(
            req.params.leaveRequestId,
            req.user.id,
            req.user.role,
        );

        return res.status(200).json({
            status: 'success',
            data: leaveRequest,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

// POST /leave/:leaveRequestId/approve|reject
const reviewLeaveRequest = async (req, res) => {
    try {
        const leaveRequestId = req.params.leaveRequestId;
        const adminUser = {
            id: req.user.id,
            employeeId: req.user.employeeId,
            role: req.user.role,
        };
        const comments = req.body?.reviewComments;

        let leaveRequest;
        if (req.params.decision === 'approve') {
            leaveRequest = await AdminService.approveLeaveRequest(leaveRequestId, adminUser, comments);
        } else {
            leaveRequest = await AdminService.rejectLeaveRequest(leaveRequestId, adminUser, comments);
        }

        return res.status(200).json({
            status: 'success',
            message: reviewSuccessMessage('Leave request', leaveRequest.status),
            data: leaveRequest,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

module.exports = {
    submitLeaveRequest,
    getEmployeeLeaveRequests,
    getMyLeaveRequests,
    getAllLeaveRequests,
    getAdminLeaveRequests,
    getLeaveRequestById,
    reviewLeaveRequest,
};
