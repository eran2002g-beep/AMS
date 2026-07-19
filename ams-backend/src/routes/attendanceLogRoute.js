// src/routes/attendanceLogRoute.js - attendance log routes
const express = require('express');
const router = express.Router();

const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { CAN_EDIT_ATTENDANCE } = require('../../config/roles');
const attendanceLogService = require('../services/attendanceLogService');

router.use(verifyToken, authorizeRoles(...CAN_EDIT_ATTENDANCE));

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
