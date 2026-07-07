// src/routes/attendanceRoute.js - normal attendance processing and record management
const express = require('express');
const router  = express.Router();

const isAdmin = require('../middleware/isAdmin');
const attendanceController = require('../controllers/attendanceController');

// POST /attendance/process - process normal attendance for non-roster employees
// Body or query: date | month+year | startDate+endDate
router.post('/process', attendanceController.processNormalAttendance);

// -----------------------------------------------------------------------
// GET /attendance/employee/:employeeId - Retrieve attendance records for one employee
// Supports optional month, year, status, startDate, endDate, page, and limit filters
// -----------------------------------------------------------------------
router.get('/employee/:employeeId', attendanceController.getEmployeeAttendance);

router.get('/view', isAdmin, attendanceController.getAllAttendance);

router.get('/:attendanceId', isAdmin, attendanceController.getAttendanceById);

// DELETE /attendance/:attendanceId - permanently remove an attendance record (admin only)
router.delete('/:attendanceId', attendanceController.deleteAttendance);

module.exports = router;
