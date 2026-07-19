// src/routes/attendanceRoute.js - normal attendance processing and record management
const express = require('express');
const router  = express.Router();

const attendanceController = require('../controllers/attendanceController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { CAN_EDIT_ATTENDANCE, CAN_VIEW_ATTENDANCE } = require("../../config/roles");

// POST /attendance/process - process normal attendance for non-roster employees
// Body or query: date | month+year | startDate+endDate
// EDIT ATTENDANCE -> admin, admin_manager
router.post('/process', verifyToken, authorizeRoles(...CAN_EDIT_ATTENDANCE), attendanceController.processNormalAttendance);

// POST /attendance/process-roster - process roster attendance for scheduled shifts
// Body or query: date | month+year | startDate+endDate
// EDIT ATTENDANCE -> admin, admin_manager
router.post('/process-roster', verifyToken, authorizeRoles(...CAN_EDIT_ATTENDANCE), attendanceController.processRosterAttendance);

// Legacy: process a single upload batch by rosterId
router.post('/process-roster/:rosterId', verifyToken, authorizeRoles(...CAN_EDIT_ATTENDANCE), attendanceController.processRosterAttendance);

// -----------------------------------------------------------------------
// GET /attendance - Retrieve all attendance records
// Supports optional q, employeeId, month, year, status, startDate, endDate, page, and limit filters
// Prefer /attendance/view from the Next.js admin UI — bare /attendance collides with the page route.
// VIEW ATTENDANCE -> admin, admin_manager
// -----------------------------------------------------------------------
router.get('/', verifyToken, authorizeRoles(...CAN_VIEW_ATTENDANCE), attendanceController.getAllAttendance);

// GET /attendance/employee/:employeeId - Retrieve attendance records for one employee
// Supports optional month, year, status, startDate, endDate, page, and limit filters
// VIEW ATTENDANCE -> admin, admin_manager
// -----------------------------------------------------------------------
router.get('/employee/:employeeId', verifyToken, authorizeRoles(...CAN_VIEW_ATTENDANCE), attendanceController.getEmployeeAttendance);

router.get('/view', verifyToken, authorizeRoles(...CAN_VIEW_ATTENDANCE), attendanceController.getAllAttendance);

// EDIT ATTENDANCE -> admin, admin_manager
router.post('/create', verifyToken, authorizeRoles(...CAN_EDIT_ATTENDANCE), attendanceController.createAttendanceRecord);

// VIEW ATTENDANCE -> admin, admin_manager
router.get('/:attendanceId', verifyToken, authorizeRoles(...CAN_VIEW_ATTENDANCE), attendanceController.getAttendanceById);

// PUT /attendance/:attendanceId - update an attendance record
// EDIT ATTENDANCE -> admin, admin_manager
router.put('/:attendanceId', verifyToken, authorizeRoles(...CAN_EDIT_ATTENDANCE), attendanceController.updateAttendance);

// DELETE /attendance/:attendanceId - permanently remove an attendance record
// EDIT ATTENDANCE -> admin, admin_manager
router.delete('/:attendanceId', verifyToken, authorizeRoles(...CAN_EDIT_ATTENDANCE), attendanceController.deleteAttendance);

module.exports = router;