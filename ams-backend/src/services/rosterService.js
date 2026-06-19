// src/services/rosterService.js - roster upload and view operations
const Roster = require('../models/Roster');
const { parseRosterFile, extractMonthYear } = require('../utils/rosterParser');

// uploadRoster - called by POST /roster/upload
// Accepts the multer file object, parses it, then bulk-inserts all rows into the roster table.
// Each row in the file becomes one record in the Roster table.
const uploadRoster = async (file) => {

    // Guard: multer should always attach the file, but double-check
    if (!file) {
        throw new Error('Roster file is required.');
    }

    // ---------------------------- Step 1: Parse the file ----------------------------
    // parseRosterFile returns an array of enriched row objects, each with:
    //   employeeId  e.g. "EMP001"
    //   date        normalised YYYY-MM-DD string, e.g. "2025-06-01"
    //   month       integer, e.g. 6
    //   year        integer, e.g. 2025
    //   shiftStart  e.g. "08:00"
    //   shiftEnd    e.g. "17:00"
    const rosterRows = await parseRosterFile(file.path, file.originalname);

    // ---------------------------- Step 2: Generate a unique rosterId for this batch ----------------------------
    // rosterId groups all rows from one upload together.
    // We find the current highest rosterId in the table and add 1.
    // If the table is empty, we start at 1.
    const latestEntry = await Roster.findOne({ order: [['rosterId', 'DESC']] });
    const rosterId    = latestEntry ? latestEntry.rosterId + 1 : 1;

    // ---------------------------- Step 3: Build insert payload matching the Roster model exactly ----------------------------
    // Only include the columns that exist in the Roster model:
    // id (auto), rosterId, employeeId, date, month, year, shiftStart, shiftEnd
    const entriesToInsert = rosterRows.map((row) => ({
        rosterId,
        employeeId: row.employeeId,
        date:       row.date,
        month:      row.month,
        year:       row.year,
        shiftStart: row.shiftStart,
        shiftEnd:   row.shiftEnd,
    }));

    // ---------------------------- Step 4: Bulk insert all entries in a single DB call ----------------------------
    const insertedRecords = await Roster.bulkCreate(entriesToInsert);

    // Return the batch ID, total count, and the inserted rows for the API response
    return {
        rosterId,
        totalInserted: insertedRecords.length,
        insertedRows:  insertedRecords.map((r) => r.toJSON()),
    };
};

// buildRosterViewFilters - validates query params and returns a Sequelize where clause
// At least one of date, year, or month must be provided.
const buildRosterViewFilters = ({ date, year, month }) => {
    const hasDate  = date  !== undefined && date  !== '';
    const hasYear  = year  !== undefined && year  !== '';
    const hasMonth = month !== undefined && month !== '';

    if (!hasDate && !hasYear && !hasMonth) {
        throw new Error('At least one filter is required: date, year, or month.');
    }

    const applied = {};
    const where   = {};

    if (hasDate) {
        const { normalizedDate } = extractMonthYear(String(date).trim());
        where.date = normalizedDate;
        applied.date = normalizedDate;
        return { where, applied };
    }

    if (hasYear) {
        const parsedYear = parseInt(year, 10);
        if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2099) {
            throw new Error('Invalid year. Expected a value between 2000 and 2099.');
        }
        where.year = parsedYear;
        applied.year = parsedYear;
    }

    if (hasMonth) {
        const parsedMonth = parseInt(month, 10);
        if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
            throw new Error('Invalid month. Expected a value between 1 and 12.');
        }
        where.month = parsedMonth;
        applied.month = parsedMonth;
    }

    return { where, applied };
};

// getRosterView - fetch roster entries filtered by date, year, month, or year + month
const getRosterView = async (filters) => {
    const { where, applied } = buildRosterViewFilters(filters);

    const entries = await Roster.findAll({
        where,
        order: [['date', 'ASC'], ['employeeId', 'ASC']],
    });

    return { entries, applied };
};

module.exports = {
    uploadRoster,
    getRosterView,
};
