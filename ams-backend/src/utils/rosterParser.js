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
// returns an error message string if columns are missing, or null if all present
const validateColumns = (headers) => {
    const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));

    if (missing.length > 0) {
        return `Missing required columns: ${missing.join(', ')}`;
    }

    // null means validation passed
    return null;
};

// ----------------------- MONTH/YEAR EXTRACTOR -----------------------
// extractMonthYear - pulls month and year out of a date string
// called for every row so we can store month and year as separate columns
// e.g. "2025-06-01" → { month: 6, year: 2025 }
const extractMonthYear = (dateString) => {

    // Parse the date string into a JS Date object
    const date = new Date(dateString);

    // Check if the date is valid - Invalid Date means the format was wrong
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: "${dateString}". Expected format: YYYY-MM-DD`);
    }

    // getMonth() returns 0-11 so we add 1 to get the real month number (1-12)
    const month = date.getMonth() + 1;

    // getFullYear() returns the 4-digit year e.g. 2025
    const year  = date.getFullYear();

    return { month, year };
};

// ----------------------- ROW ENRICHER -----------------------
// enrichRow - adds month and year fields to each parsed row
// called on every row after parsing so the service can save them directly to RosterEntry
const enrichRow = (row) => {

    // Extract month and year from the date value in this row
    const { month, year } = extractMonthYear(row.date);

    // Return the original row plus the two new fields
    return {
        ...row,    // spread keeps all original fields: employeeId, date, shiftStart, shiftEnd
        month,     // e.g. 6
        year,      // e.g. 2025
    };
};

// ----------------------- CSV PARSER -----------------------
// parseCSV - reads a CSV file from disk and returns an enriched array of row objects
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
                // Enrich each row with month and year before collecting it
                try {
                    rows.push(enrichRow(row));
                } catch (err) {
                    reject(err);
                }
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
// parseExcel - reads an .xlsx or .xls file and returns an enriched array of row objects
const parseExcel = (filePath) => {

    // Read the workbook from the saved file path
    const workbook = xlsx.readFile(filePath);

    // Use the first sheet in the workbook
    const firstSheetName = workbook.SheetNames[0];
    const worksheet      = workbook.Sheets[firstSheetName];

    // sheet_to_json converts the sheet into an array of plain JS objects
    // raw: false tells xlsx to return formatted strings instead of raw serial numbers
    // this ensures dates come out as readable strings not Excel serial numbers e.g. 45443
    const rows = xlsx.utils.sheet_to_json(worksheet, { raw: false });

    // Reject empty files
    if (rows.length === 0) {
        throw new Error('The uploaded Excel file is empty.');
    }

    // Validate required columns using keys of the first row
    const headers = Object.keys(rows[0]);
    const error   = validateColumns(headers);
    if (error) throw new Error(error);

    // Enrich every row with month and year before returning
    return rows.map(enrichRow);
};

// ----------------------- MAIN PARSE FUNCTION -----------------------
// parseRosterFile - decides which parser to use based on file extension
// returns enriched rows ready to be bulk inserted into the roster_entries table
const parseRosterFile = async (filePath, originalName) => {
    const ext = path.extname(originalName).toLowerCase();

    if (ext === '.csv') {
        return await parseCSV(filePath);
    }

    if (ext === '.xlsx' || ext === '.xls') {
        return parseExcel(filePath);
    }

    // Safety net - multer fileFilter already blocks invalid formats before reaching here
    throw new Error('Unsupported file format.');
};

module.exports = {
    upload,          // used in the route: router.post('/upload', upload.single('file'), ...)
    parseRosterFile, // used in the service to get enriched rows after file is saved
};