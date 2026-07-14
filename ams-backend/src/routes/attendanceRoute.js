// src/routes/attendanceRoute.js - normal attendance processing and record management
const express = require('express');
const router  = express.Router();

const isAdmin = require('../middleware/isAdmin');
const attendanceController = require('../controllers/attendanceController');

router.use(isAdmin);

// POST /attendance/process - process normal attendance for non-roster employees
// Body or query: date | month+year | startDate+endDate
router.post('/process', attendanceController.processNormalAttendance);

// POST /attendance/process-roster - process roster attendance for scheduled shifts
// Body or query: date | month+year | startDate+endDate
router.post('/process-roster', attendanceController.processRosterAttendance);

// Legacy: process a single upload batch by rosterId
router.post('/process-roster/:rosterId', attendanceController.processRosterAttendance);

// -----------------------------------------------------------------------
// GET /attendance - Retrieve all attendance records
// Supports optional q, employeeId, month, year, status, startDate, endDate, page, and limit filters
// Prefer /attendance/view from the Next.js admin UI — bare /attendance collides with the page route.
// -----------------------------------------------------------------------
router.get('/', attendanceController.getAllAttendance);

// GET /attendance/employee/:employeeId - Retrieve attendance records for one employee
// Supports optional month, year, status, startDate, endDate, page, and limit filters
// -----------------------------------------------------------------------
router.get('/employee/:employeeId', attendanceController.getEmployeeAttendance);

router.get('/view', attendanceController.getAllAttendance);

router.post('/create', attendanceController.createAttendanceRecord);

router.get('/:attendanceId', attendanceController.getAttendanceById);

// PUT /attendance/:attendanceId - update an attendance record
router.put('/:attendanceId', attendanceController.updateAttendance);

// DELETE /attendance/:attendanceId - permanently remove an attendance record
router.delete('/:attendanceId', attendanceController.deleteAttendance);

module.exports = router;
