// src/routes/attendanceRoute.js - normal attendance processing and record management
const express = require('express');
const router  = express.Router();

const attendanceService = require('../services/attendanceService');

// POST /attendance/process - process normal attendance for non-roster employees
// Body or query: date | month+year | startDate+endDate
router.post('/process', async (req, res) => {
    try {
        const period = { ...req.query, ...req.body };
        const result = await attendanceService.processNormalAttendance(period);

        return res.status(200).json({
            status: 'success',
            ...result,
        });
    } catch (err) {
        return res.status(400).json({ status: 'error', error: err.message });
    }
});

router.get('/employee/:employeeId', async (req, res) => {
    try {
        const records = await attendanceService.getEmployeeAttendance(
            req.params.employeeId,
            req.query
        );
        return res.status(200).json({ status: 'success', count: records.length, data: records });
    } catch (err) {
        return res.status(400).json({ status: 'error', error: err.message });
    }
});

router.get('/view', async (req, res) => {
    try {
        const records = await attendanceService.getAllAttendance(req.query);
        return res.status(200).json({ status: 'success', count: records.length, data: records });
    } catch (err) {
        return res.status(400).json({ status: 'error', error: err.message });
    }
});

module.exports = router;
