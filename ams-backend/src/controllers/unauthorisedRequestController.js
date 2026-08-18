const unauthorisedRequestService = require('../services/unauthorisedRequestService');

const statusFromError = (err) => {
    if (err.status) return err.status;
    if (err.message && err.message.includes('not found')) return 404;
    return 400;
};

// POST /unauthorised/submit
const submitUnauthorisedRequest = async (req, res) => {
    try {
        const employeeId = req.body.employeeId || req.user.employeeId;

        const request = await unauthorisedRequestService.submitUnauthorisedRequest(
            employeeId,
            req.body,
        );

        return res.status(201).json({
            status: 'success',
            message: 'Unauthorised request submitted successfully.',
            data: request,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

// GET /unauthorised/employee/:employeeId
const getEmployeeUnauthorisedRequests = async (req, res) => {
    try {
        const result = await unauthorisedRequestService.getUnauthorisedRequestsByEmployee(
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

// GET /unauthorised/me - unauthorised request history for the signed-in employee
const getMyUnauthorisedRequests = async (req, res) => {
    try {
        const result = await unauthorisedRequestService.getUnauthorisedRequestsByEmployee(
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

// GET /unauthorised/queue (and GET /unauthorised)
const getAllUnauthorisedRequests = async (req, res) => {
    try {
        const result = await unauthorisedRequestService.getAllUnauthorisedRequests(
            req.query,
            req.user.id,
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

// GET /unauthorised/:unauthorisedRequestId
const getUnauthorisedRequestById = async (req, res) => {
    try {
        const request = await unauthorisedRequestService.getUnauthorisedRequestById(
            req.params.unauthorisedRequestId,
            req.user.id,
        );

        return res.status(200).json({
            status: 'success',
            data: request,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

// POST /unauthorised/:unauthorisedRequestId/approve|reject
const reviewUnauthorisedRequest = async (req, res) => {
    try {
        const decision = req.params.decision === 'approve' ? 'approved' : 'rejected';
        const request = await unauthorisedRequestService.reviewUnauthorisedRequest(
            req.params.unauthorisedRequestId,
            { id: req.user.id, employeeId: req.user.employeeId },
            { decision, reviewComments: req.body?.reviewComments },
        );

        return res.status(200).json({
            status: 'success',
            message: `Unauthorised request ${decision} successfully.`,
            data: request,
        });
    } catch (err) {
        return res.status(statusFromError(err)).json({ status: 'error', error: err.message });
    }
};

module.exports = {
    submitUnauthorisedRequest,
    getEmployeeUnauthorisedRequests,
    getMyUnauthorisedRequests,
    getAllUnauthorisedRequests,
    getUnauthorisedRequestById,
    reviewUnauthorisedRequest,
};
