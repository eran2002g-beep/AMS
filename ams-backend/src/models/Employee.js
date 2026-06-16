// src/models/Employee.js - defines the Employee table structure in the database

// DataTypes provides column type options: STRING, INTEGER, BOOLEAN, ENUM, etc.
const { DataTypes } = require('sequelize');

// Import the shared DB connection - this tells Sequelize which database to use
const sequelize = require('../../config/db');

// Define the Employee model - each property below becomes a column in the table
const Employee = sequelize.define('Employee', {

    // id - internal primary key, auto-assigned by the database (1, 2, 3...)
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // employeeId - public-facing ID, auto-generated as EMP001, EMP002, EMP003...
    // generated automatically in the beforeCreate hook below, never set manually
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },

    // firstName - employee's first name
    firstName: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // lastName - stored separately so we can sort/search by last name
    lastName: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    // email - used for login (Epic 3) and must be unique across all employees
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true, // Sequelize rejects invalid email formats before saving
        },
    },

    // phone - optional contact number for HR use
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    // department - used for filtering reports and managing rosters in Epic 4
    department: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    // role - controls what the user can access (Epic 3 RBAC)
    // ENUM restricts the value to only these two options, enforced by the database
    role: {
        type: DataTypes.ENUM('admin', 'employee'),
        defaultValue: 'employee', // new users get least privilege by default
    },

    // isActive - false = soft deleted, keeps attendance history intact
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },

}, {
    // Sets the actual PostgreSQL table name
    tableName: 'employees',

    // Auto-adds createdAt and updatedAt columns to track when records change
    timestamps: true,

    // hooks run automatically at specific points in a record's lifecycle
    hooks: {

        // beforeCreate runs just before a new employee is saved to the database
        // we use this to generate the employeeId so it is always set automatically
        beforeCreate: async (employee) => {

            // Count how many employees already exist in the table
            const count = await Employee.count();

            // Build the ID: pad the next number to 3 digits, prefix with EMP
            // e.g. count=0 -> EMP001, count=1 -> EMP002, count=99 -> EMP100
            const padded = String(count + 1).padStart(3, '0');
            employee.employeeId = `EMP${padded}`;
        },
    },
});

// Export so the controller can call Employee.create(), findAll(), update(), destroy(), etc.
module.exports = Employee;