// src/routes/rosterRoute.js - roster upload and roster-related endpoints
const express = require('express');
const router = express.Router();
const { upload } = require('../utils/rosterParser');
const rosterService = require('../services/rosterService');

// POST /roster/upload - upload a roster file and map to employee records
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const metadata = {
            rosterName: req.body.rosterName,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            department: req.body.department,
            uploadedBy: req.body.uploadedBy,
        };

        const result = await rosterService.uploadRoster(metadata, req.file);

        return res.status(201).json({
            status: 'success',
            rosterId: result.roster.rosterId,
            matchedRows: result.matchedCount,
            missingEmployeeIds: result.missingEmployeeIds,
            details: result.mappedRows,
        });
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
