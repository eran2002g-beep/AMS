// src/models/Roster.js - defines the Roster table structure in the database
// a Roster represents one uploaded work schedule file assigned to a group of employees

// DataTypes provides column type options: STRING, INTEGER, BOOLEAN, ENUM, etc.
const { DataTypes } = require('sequelize');

// Import the shared DB connection
const sequelize = require('../../config/db');

const Roster = sequelize.define('Roster', {

    // id - internal primary key, auto-assigned by the database
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // rosterId - public-facing ID, auto-generated as RST001, RST002...
    // generated in the beforeCreate hook below, never set manually
    rosterId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },

    // rosterName - a human-readable label for the roster e.g. "June 2025 - Engineering"
    // used in the admin roster list view and employee roster attendance view
    rosterName: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // fileName - original name of the uploaded file e.g. "june_roster.csv"
    // stored so admins can identify which file was uploaded
    fileName: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // filePath - where the file is stored on the server after upload
    // used to retrieve and process the file during roster processing (Epic 4)
    filePath: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // fileFormat - the type of the uploaded file
    // ENUM restricts to only valid formats - invalid formats are rejected (Epic 2 AC4)
    fileFormat: {
        type: DataTypes.ENUM('csv', 'xlsx', 'xls'),
        allowNull: false,
    },

    // startDate - the first date this roster schedule covers
    // used when matching attendance logs against the roster (Epic 4)
    startDate: {
        type: DataTypes.DATEONLY, // stores date only, no time - e.g. "2025-06-01"
        allowNull: false,
    },

    // endDate - the last date this roster schedule covers
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },

    // department - which department this roster applies to
    // allows filtering roster attendance by department in Epic 4
    department: {
        type: DataTypes.STRING,
        allowNull: true, // optional - some rosters may apply to all departments
    },

    // uploadedBy - the id of the admin who uploaded this roster
    // references the Employee table - used for audit trail
    uploadedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    // isProcessed - tracks whether this roster has been run through the attendance processor
    // false = uploaded but not yet processed, true = attendance statuses have been calculated
    // used in Epic 4: Process Roster Attendance
    isProcessed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false, // newly uploaded rosters are unprocessed by default
    },

    // isActive - false = soft deleted, keeps history intact
    // used in Epic 2: Delete Rosters - we never hard delete roster files
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },

}, {
    // Sets the actual PostgreSQL table name
    tableName: 'rosters',

    // Auto-adds createdAt and updatedAt columns
    timestamps: true,

    hooks: {

        // beforeCreate - auto-generates rosterId like RST001, RST002...
        // same pattern used in the Employee model for EMP001
        beforeCreate: async (roster) => {

            // Count existing rosters to determine the next number
            const count = await Roster.count();

            // Pad to 3 digits and prefix with RST
            const padded = String(count + 1).padStart(3, '0');
            roster.rosterId = `RST${padded}`;
        },
    },
});

// Export so the service and controller can use Roster.create(), findAll(), etc.
module.exports = Roster;