// src/routes/leaveRequestRoute.js - submitting and viewing employee leave requests
const express = require('express');
const router  = express.Router();

const leaveRequestController = require('../controllers/leaveRequestController');
const { verifyToken, authorize, authorizeOwnOrRoles } = require('../middleware/authMiddleware');
const { CAN_MANAGE_LEAVE, CAN_VIEW_ALL_LEAVE, CAN_REVIEW_ANY_LEAVE } = require('../../config/roles');

// POST /leave/submit - any authenticated employee can submit a leave request for themselves
// SUBMIT LEAVE -> all authenticated roles (self-service)
router.post('/submit', verifyToken, leaveRequestController.submitLeaveRequest);

// -----------------------------------------------------------------------
// GET /leave/queue - assigned HOD/supervisor queue (preferred for Next.js proxy;
// bare GET /leave collides with the frontend page route)
// MANAGE LEAVE -> manager, admin-manager
router.get('/queue', verifyToken, authorize(...CAN_MANAGE_LEAVE), leaveRequestController.getAllLeaveRequests);

// GET /leave/all - every leave request (admin / admin-manager / super-admin)
router.get('/all', verifyToken, authorize(...CAN_VIEW_ALL_LEAVE), leaveRequestController.getAdminLeaveRequests);

// GET /leave - same as /queue (direct backend / non-proxied clients)
router.get('/', verifyToken, authorize(...CAN_MANAGE_LEAVE), leaveRequestController.getAllLeaveRequests);

// GET /leave/employee/:employeeId - Retrieve leave requests for one employee
// Own records: any authenticated user. Others: MANAGE LEAVE -> manager, admin-manager
router.get('/employee/:employeeId', verifyToken, authorizeOwnOrRoles(...CAN_MANAGE_LEAVE), leaveRequestController.getEmployeeLeaveRequests);

// GET /leave/me - leave requests for the signed-in employee (must be before /:leaveRequestId)
router.get('/me', verifyToken, leaveRequestController.getMyLeaveRequests);

// POST /leave/:leaveRequestId/approve|reject
// Assigned HOD/supervisor follow the sequential chain.
// Admin / super-admin may accept or reject any in-flight request.
router.post(
    '/:leaveRequestId/approve',
    verifyToken,
    authorize(...CAN_MANAGE_LEAVE, ...CAN_REVIEW_ANY_LEAVE),
    (req, res) => {
        req.params.decision = 'approve';
        return leaveRequestController.reviewLeaveRequest(req, res);
    },
);
router.post(
    '/:leaveRequestId/reject',
    verifyToken,
    authorize(...CAN_MANAGE_LEAVE, ...CAN_REVIEW_ANY_LEAVE),
    (req, res) => {
        req.params.decision = 'reject';
        return leaveRequestController.reviewLeaveRequest(req, res);
    },
);

// GET /leave/:leaveRequestId - Retrieve a single leave request by its public ID
router.get(
    '/:leaveRequestId',
    verifyToken,
    authorize(...CAN_MANAGE_LEAVE, ...CAN_VIEW_ALL_LEAVE),
    leaveRequestController.getLeaveRequestById,
);

module.exports = router;
