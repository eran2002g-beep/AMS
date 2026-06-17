// src/utils/rosterParser.js - handles file upload config, parsing and validation for roster files
// used by the roster service when an admin uploads a roster file (Epic 2 - Upload Rosters)

const multer = require('multer');
const xlsx   = require('xlsx');
const fs     = require('fs');
const path   = require('path');
const csv    = require('csv-parser');

// ----------------------- REQUIRED COLUMNS -----------------------
// Every valid roster file must contain these exact column headers
// if any are missing the file is rejected before saving (Epic 2 AC1)
const REQUIRED_COLUMNS = [
    'employeeId',   // links each row to an employee e.g. EMP001
    'date',         // the scheduled work date e.g. 2025-06-01
    'shiftStart',   // shift start time e.g. 08:00
    'shiftEnd',     // shift end time e.g. 17:00
];

// ----------------------- ALLOWED FILE FORMATS -----------------------
// Only these extensions are accepted - anything else is rejected (Epic 2 AC4)
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const ALLOWED_MIME_TYPES = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel',                                           // .xls
];

// ----------------------- MULTER STORAGE CONFIG -----------------------
// Multer controls how uploaded files are saved to disk
const storage = multer.diskStorage({

    // destination - where uploaded files are saved on the server
    // uploads/ folder sits at the project root
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads');

        // Create the uploads folder if it does not exist yet
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },

    // filename - renames the file to avoid collisions
    // format: roster-<timestamp>-<originalname> e.g. roster-1717123456789-june.csv
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `roster-${timestamp}-${file.originalname}`);
    },
});

// fileFilter - runs before the file is saved, rejects invalid formats immediately
// this satisfies Epic 2 AC4: invalid file formats must be rejected
const fileFilter = (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    // Check both the extension and the MIME type for safety
    const isValidExt      = ALLOWED_EXTENSIONS.includes(ext);
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(mimeType);

    if (isValidExt && isValidMimeType) {
        // Accept the file - null means no error
        cb(null, true);
    } else {
        // Reject the file with a clear error message
        cb(new Error(`Invalid file format. Only CSV, XLSX and XLS files are allowed.`), false);
    }
};

// upload - the multer instance used in the route as middleware
// limits.fileSize restricts uploads to 5MB to prevent abuse
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB in bytes
});

// ----------------------- COLUMN VALIDATION -----------------------
// validateColumns - checks that all required columns exist in the parsed file
// returns an error message string if any column is missing, or null if all present
const validateColumns = (headers) => {
    const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));

    if (missing.length > 0) {
        return `Missing required columns: ${missing.join(', ')}`;
    }

    // null means validation passed
    return null;
};

// ----------------------- CSV PARSER -----------------------
// parseCSV - reads a CSV file from disk and returns an array of row objects
// uses a Promise so we can use async/await in the service
const parseCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const rows = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('headers', (headers) => {
                // Validate columns as soon as the header row is read
                const error = validateColumns(headers);
                if (error) reject(new Error(error));
            })
            .on('data', (row) => {
                // Each row is pushed as a plain object e.g. { employeeId: 'EMP001', date: '2025-06-01', ... }
                rows.push(row);
            })
            .on('end', () => {
                // Reject empty files - no rows means nothing to process
                if (rows.length === 0) {
                    reject(new Error('The uploaded CSV file is empty.'));
                } else {
                    resolve(rows);
                }
            })
            .on('error', (err) => reject(err));
    });
};

// ----------------------- EXCEL PARSER -----------------------
// parseExcel - reads an .xlsx or .xls file from disk and returns an array of row objects
const parseExcel = (filePath) => {

    // Read the workbook from the saved file path
    const workbook = xlsx.readFile(filePath);

    // Use the first sheet in the workbook
    const firstSheetName = workbook.SheetNames[0];
    const worksheet      = workbook.Sheets[firstSheetName];

    // sheet_to_json converts each row into a plain JS object using the header row as keys
    const rows = xlsx.utils.sheet_to_json(worksheet);

    // Reject empty files
    if (rows.length === 0) {
        throw new Error('The uploaded Excel file is empty.');
    }

    // Validate that all required columns exist using the keys of the first row
    const headers = Object.keys(rows[0]);
    const error   = validateColumns(headers);
    if (error) throw new Error(error);

    return rows;
};

// ----------------------- MAIN PARSE FUNCTION -----------------------
// parseRosterFile - decides which parser to use based on file extension
// called by the roster service after multer saves the file to disk
const parseRosterFile = async (filePath, originalName) => {
    const ext = path.extname(originalName).toLowerCase();

    if (ext === '.csv') {
        return await parseCSV(filePath);
    }

    if (ext === '.xlsx' || ext === '.xls') {
        return parseExcel(filePath);
    }

    // Should never reach here because multer fileFilter already blocks invalid formats
    // but kept as a safety net
    throw new Error('Unsupported file format.');
};

// Export upload middleware and the parser for use in routes and services
module.exports = {
    upload,          // used in the route: router.post('/upload', upload.single('file'), ...)
    parseRosterFile, // used in the service after the file is saved
};