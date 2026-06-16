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

    // employeeId - public-facing ID shown in the UI and printed on punch cards e.g. "EMP-0001"
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false, // required
        unique: true,     // no two employees can share the same ID
    },

    // firstName - employee's first name
    firstName: {
        type: DataTypes.STRING,
        allowNull: false, // required
    },

    // lastName - stored separately so we can sort/search by last name
    lastName: {
        type: DataTypes.STRING,
        allowNull: false, // required
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
        allowNull: true, // optional
    },

    // department - used for filtering reports and managing rosters in Epic 4
    department: {
        type: DataTypes.STRING,
        allowNull: true, // optional, can be assigned later
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
        defaultValue: true, // active by default when created
    },

}, {
    // Sets the actual PostgreSQL table name - without this Sequelize uses "Employees"
    tableName: 'employees',

    // Auto-adds createdAt and updatedAt columns to track when records change
    timestamps: true,
});

// Export so the controller can call Employee.create(), findAll(), update(), destroy(), etc.
module.exports = Employee;