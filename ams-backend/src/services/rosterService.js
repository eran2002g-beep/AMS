// src/services/rosterService.js - parses an uploaded roster file and saves every row to the DB
const Roster          = require('../models/Roster');
const { parseRosterFile } = require('../utils/rosterParser');

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

module.exports = {
    uploadRoster,
};
