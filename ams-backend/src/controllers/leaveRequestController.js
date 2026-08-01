const leaveRequestService = require('../services/leaveRequestService');

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
        const statusCode = err.message.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({ status: 'error', error: err.message });
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
        const statusCode = err.message.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({ status: 'error', error: err.message });
    }
};

// GET /leave - leave requests assigned to the signed-in manager/admin-manager
// (viewer is the leave's hod or supervisor); each row includes canAccept
const getAllLeaveRequests = async (req, res) => {
    try {
        const result = await leaveRequestService.getAllLeaveRequests(req.query, req.user.id);

        return res.status(200).json({
            status: 'success',
            count: result.records.length,
            meta: result.meta,
            data: result.records,
        });
    } catch (err) {
        return res.status(400).json({ status: 'error', error: err.message });
    }
};

// GET /leave/:leaveRequestId - a single leave request by its public ID
// Only if the signed-in user is assigned as hod or supervisor on that request
const getLeaveRequestById = async (req, res) => {
    try {
        const leaveRequest = await leaveRequestService.getLeaveRequestById(
            req.params.leaveRequestId,
            req.user.id,
        );

        return res.status(200).json({
            status: 'success',
            data: leaveRequest,
        });
    } catch (err) {
        const statusCode = err.message.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({ status: 'error', error: err.message });
    }
};

module.exports = {
    submitLeaveRequest,
    getEmployeeLeaveRequests,
    getAllLeaveRequests,
    getLeaveRequestById,
};