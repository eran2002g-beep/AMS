// src/routes/attendanceLogRoute.js - attendance log routes
const express = require('express');
const router = express.Router();

const attendanceLogService = require('../services/attendanceLogService');

// -----------------------------------------------------------------------
// POST /attendance-log/create - Create a new attendance log record
// -----------------------------------------------------------------------
router.post('/create', async (req, res) => {
    try {
        const log = await attendanceLogService.createAttendanceLog(req.body);
        return res.status(201).json(log);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

module.exports = router;
