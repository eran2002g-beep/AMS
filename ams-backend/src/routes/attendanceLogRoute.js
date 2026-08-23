// src/routes/attendanceLogRoute.js - attendance log routes
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { CAN_EDIT_ATTENDANCE } = require('../../config/roles');
const attendanceLogService = require('../services/attendanceLogService');

router.use(verifyToken);

// -----------------------------------------------------------------------
// POST /attendance-log/create - Create a new attendance log record
// Any authenticated employee may punch their own card. Admin-tier roles
// that can edit attendance may still punch on behalf of another employee.
// -----------------------------------------------------------------------
router.post('/create', async (req, res) => {
    try {
        const canPunchOthers = CAN_EDIT_ATTENDANCE.includes(req.user.role);
        // Non-admin roles always punch as themselves so the profile button
        // cannot be blocked by a role check or a mismatched employeeId.
        const employeeId = canPunchOthers
            ? (req.body?.employeeId || req.user.employeeId)
            : req.user.employeeId;

        const log = await attendanceLogService.createAttendanceLog({
            ...req.body,
            employeeId,
        });
        return res.status(201).json(log);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

module.exports = router;
