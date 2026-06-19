// src/routes/rosterRoute.js - roster upload and roster-related endpoints
const express = require('express');
const router  = express.Router();
const { upload } = require('../utils/rosterParser');
const rosterService = require('../services/rosterService');

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

module.exports = router;
