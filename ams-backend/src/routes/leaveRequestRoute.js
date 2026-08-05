// src/routes/leaveRequestRoute.js - submitting and viewing employee leave requests
const express = require('express');
const router  = express.Router();

const leaveRequestController = require('../controllers/leaveRequestController');
const { verifyToken, authorize, authorizeOwnOrRoles } = require('../middleware/authMiddleware');
const { CAN_MANAGE_LEAVE } = require('../../config/roles');

// POST /leave/submit - any authenticated employee can submit a leave request for themselves
// SUBMIT LEAVE -> all authenticated roles (self-service)
router.post('/submit', verifyToken, leaveRequestController.submitLeaveRequest);

// -----------------------------------------------------------------------
// GET /leave - Retrieve all leave requests across employees
// Supports optional employeeId, status, page, and limit filters
// MANAGE LEAVE -> manager, admin-manager
// -----------------------------------------------------------------------
router.get('/', verifyToken, authorize(...CAN_MANAGE_LEAVE), leaveRequestController.getAllLeaveRequests);

// GET /leave/employee/:employeeId - Retrieve leave requests for one employee
// Supports optional status, page, and limit filters
// Own records: any authenticated user. Others: MANAGE LEAVE -> manager, admin-manager
// -----------------------------------------------------------------------
router.get('/employee/:employeeId', verifyToken, authorizeOwnOrRoles(...CAN_MANAGE_LEAVE), leaveRequestController.getEmployeeLeaveRequests);

// GET /leave/me - leave requests for the signed-in employee (must be before /:leaveRequestId)
router.get('/me', verifyToken, leaveRequestController.getMyLeaveRequests);

// GET /leave/:leaveRequestId - Retrieve a single leave request by its public ID
// MANAGE LEAVE -> manager, admin-manager
router.get('/:leaveRequestId', verifyToken, authorize(...CAN_MANAGE_LEAVE), leaveRequestController.getLeaveRequestById);

module.exports = router;