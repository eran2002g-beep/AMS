// src/routes/rosterRoute.js - roster upload and roster-related endpoints
const express = require('express');
const router  = express.Router();
const { upload } = require('../utils/rosterParser');
const rosterService = require('../services/rosterService');
const attendanceController = require('../controllers/attendanceController');
const isAdmin = require('../middleware/isAdmin');
const {
  deleteRosterByDate,
  deleteRostersByMonth,
} = require('../controllers/rosterController');

router.use(isAdmin);

// DELETE /roster/by-date?date=YYYY-MM-DD
router.delete('/by-date', deleteRosterByDate);

// DELETE /roster/by-month?month=MM&year=YYYY
router.delete('/by-month', deleteRostersByMonth);



// POST /roster/upload - upload a roster CSV/Excel file, parse it, and save all entries to the DB

// Request: multipart/form-data - file (required) : the roster file (.csv, .xlsx, .xls)

// Response 201:
//   - rosterId       : batch ID assigned to all rows in this upload
//   - totalInserted  : number of rows saved to the roster table
//   - insertedRows   : the actual data saved (employeeId, date, month, year, shiftStart, shiftEnd)

// Two-middleware pattern is used here intentionally:
// Middleware 1 - 
        // Runs multer manually via a callback so that multer errors (invalid file type, file too large) are caught and returned as a clean JSON response instead of crashing Express.
        // A plain try/catch CANNOT catch multer errors because multer signals errors through its own callback, not by throwing.

// Middleware 2 - runs the service logic inside a try/catch for all other errors.

// GET /roster/view - fetch roster entries filtered by date, year, month, or year + month
// Query params (at least one required):
//   date  - exact day, e.g. 2025-06-01 or 01-06-25
//   year  - e.g. 2025
//   month - e.g. 6
//   year + month together - e.g. ?year=2025&month=6
router.get('/view', async (req, res) => {
    try {
        const { entries, applied } = await rosterService.getRosterView(req.query);

        return res.status(200).json({
            success: true,
            count:   entries.length,
            filters: applied,
            data:    entries,
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            error:   err.message,
        });
    }
});

router.post(
    '/upload',

    // ---------------------------- Middleware 1: multer file handling ----------------------------
    (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err) {
                // multer rejected the file (wrong type, too large, etc.)
                return res.status(400).json({ status: 'error', error: err.message });
            }
            // File accepted - pass control to service middleware
            next();
        });
    },

    // ---------------------------- Middleware 2: parse file and save to DB ----------------------------
    async (req, res) => {
        try {
            // Pass only the file - no extra metadata needed (not in Roster model)
            const result = await rosterService.uploadRoster(req.file);

            return res.status(201).json({
                status:        'success',
                rosterId:      result.rosterId,
                totalInserted: result.totalInserted,
                insertedRows:  result.insertedRows,
            });
        } catch (err) {
            return res.status(400).json({ status: 'error', error: err.message });
        }
    }
);

// POST /roster/process/:rosterId - legacy alias for /attendance/process-roster/:rosterId
router.post('/process/:rosterId', attendanceController.processRosterAttendance);

module.exports = router;
