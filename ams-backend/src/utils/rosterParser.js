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

// ----------------------- DATE/TIME VALIDATION -----------------------
// isValidCalendarDate - confirms day/month/year form a real calendar date
const isValidCalendarDate = (year, month, day) => {
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
           date.getUTCMonth() === month - 1 &&
           date.getUTCDate() === day;
};

// validateTime - checks shift times are valid 24-hour HH:mm values
const validateTime = (timeString, fieldName) => {
    const trimmed = String(timeString ?? '').trim();

    if (!trimmed) {
        throw new Error(`${fieldName} is required. Expected HH:mm (24-hour), e.g. 08:00.`);
    }

    const match = trimmed.match(/^(\d{1,2}):([0-5]\d)$/);
    if (!match) {
        throw new Error(`Invalid ${fieldName} time "${timeString}". Expected HH:mm (24-hour), e.g. 08:00.`);
    }

    const hours = parseInt(match[1], 10);
    if (hours > 23) {
        throw new Error(`Invalid ${fieldName} time "${timeString}". Hour must be between 00 and 23.`);
    }

    return `${String(hours).padStart(2, '0')}:${match[2]}`;
};

// ----------------------- MONTH/YEAR EXTRACTOR -----------------------
// extractMonthYear - pulls month, year and a normalised YYYY-MM-DD date string out of a date string
// supports two formats:
//   DD-MM-YY   e.g. "01-06-25"  → month: 6, year: 2025, normalizedDate: "2025-06-01"
//   YYYY-MM-DD e.g. "2025-06-01" → month: 6, year: 2025, normalizedDate: "2025-06-01"
const extractMonthYear = (dateString) => {
    const trimmed = String(dateString ?? '').trim();

    if (!trimmed) {
        throw new Error('Date is required. Expected DD-MM-YY or YYYY-MM-DD.');
    }

    // ---- Format 1: DD-MM-YY (used in the CSV, e.g. 01-06-25) ----
    const ddmmyyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{2})$/);
    if (ddmmyyMatch) {
        const day   = parseInt(ddmmyyMatch[1], 10);
        const month = parseInt(ddmmyyMatch[2], 10);
        const year  = 2000 + parseInt(ddmmyyMatch[3], 10);

        if (!isValidCalendarDate(year, month, day)) {
            throw new Error(`Invalid date "${trimmed}". Expected a valid calendar date in DD-MM-YY format.`);
        }

        const normalizedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        return { month, year, normalizedDate };
    }

    // ---- Format 2: YYYY-MM-DD ----
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const year  = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day   = parseInt(isoMatch[3], 10);

        if (!isValidCalendarDate(year, month, day)) {
            throw new Error(`Invalid date "${trimmed}". Expected a valid calendar date in YYYY-MM-DD format.`);
        }

        const normalizedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        return { month, year, normalizedDate };
    }

    throw new Error(`Invalid date format "${trimmed}". Expected DD-MM-YY or YYYY-MM-DD.`);
};

// ----------------------- ROW ENRICHER -----------------------
// enrichRow - validates and normalises each row before bulk insert
// if any row is invalid the whole upload is rejected (all-or-nothing)
const enrichRow = (row, rowNumber) => {
    const employeeId = String(row.employeeId ?? '').trim();

    if (!employeeId) {
        throw new Error(`Row ${rowNumber}: employeeId is required.`);
    }

    const rowLabel = `Row ${rowNumber} (employeeId ${employeeId})`;

    let month;
    let year;
    let normalizedDate;

    try {
        ({ month, year, normalizedDate } = extractMonthYear(row.date));
    } catch (err) {
        throw new Error(`${rowLabel}: ${err.message}`);
    }

    let shiftStart;
    let shiftEnd;

    try {
        shiftStart = validateTime(row.shiftStart, 'shiftStart');
        shiftEnd   = validateTime(row.shiftEnd, 'shiftEnd');
    } catch (err) {
        throw new Error(`${rowLabel}: ${err.message}`);
    }

    return {
        ...row,
        employeeId,
        date:       normalizedDate,
        month,
        year,
        shiftStart,
        shiftEnd,
    };
};

// ----------------------- CSV PARSER -----------------------
// parseCSV - reads a CSV file from disk and returns an enriched array of row objects
const parseCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const rows = [];
        let rowNumber = 2; // row 1 is the header

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('headers', (headers) => {
                // Validate columns as soon as the header row is read
                const error = validateColumns(headers);
                if (error) reject(new Error(error));
            })
            .on('data', (row) => {
                try {
                    rows.push(enrichRow(row, rowNumber));
                    rowNumber += 1;
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

    // Validate and enrich every row before returning
    return rows.map((row, index) => enrichRow(row, index + 2));
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
    upload,            // used in the route: router.post('/upload', upload.single('file'), ...)
    parseRosterFile,   // used in the service to get enriched rows after file is saved
    extractMonthYear,  // used by roster view to normalise date query params
};