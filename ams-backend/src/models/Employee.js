// src/models/Employee.js - defines the Employee table structure in the database

// DataTypes provides column type options: STRING, INTEGER, BOOLEAN, ENUM, etc.
const { DataTypes } = require('sequelize');

// Import the shared DB connection - this tells Sequelize which database to use
const sequelize = require('../../config/db');
const { generateNextEmployeeId } = require('../services/employeeIdGenerator');

// Define the Employee model - each property below becomes a column in the table
const Employee = sequelize.define('Employee', {

    // id - internal primary key, auto-assigned by the database (1, 2, 3...)
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // employeeId - public-facing ID, auto-generated as EMP001, EMP002, EMP003...
    // generated automatically in the beforeValidate hook below, never set manually
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

    // password - bcrypt hash used for login (Epic 3); never returned in API responses
    password: {
        type: DataTypes.STRING,
        allowNull: false,
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

    // roster - whether this employee is assigned to a roster
    roster: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // role - controls what the user can access (Epic 3 RBAC)
    // ENUM restricts the value to the supported roles, enforced by the database
    role: {
        type: DataTypes.ENUM('employee', 'manager', 'admin-manager', 'admin', 'super-admin'),
        defaultValue: 'employee', // new users get least privilege by default
    },

    // Internal Employee IDs for the employee's reporting relationships
    hod: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'employees',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
    },

    supervisor: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'employees',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    // Never include password hash in default queries / JSON responses
    defaultScope: {
        attributes: { exclude: ['password'] },
    },

    scopes: {
        withPassword: {
            attributes: { include: ['password'] },
        },
    },

    indexes: [
        { fields: ['hod'] },
        { fields: ['supervisor'] },
    ],

    // hooks run automatically at specific points in a record's lifecycle
    hooks: {

        // beforeValidate runs before allowNull checks — must run here, not beforeCreate
        beforeValidate: async (employee) => {
            if (!employee.isNewRecord || employee.employeeId) return;

            const existingEmployeeIds = await Employee.findAll({
                attributes: ['employeeId'],
                raw: true,
            });

            employee.employeeId = generateNextEmployeeId(existingEmployeeIds.map((item) => item.employeeId));
        },
    },
});

Employee.belongsTo(Employee, {
    as: 'hodEmployee',
    foreignKey: 'hod',
});
Employee.hasMany(Employee, {
    as: 'hodReports',
    foreignKey: 'hod',
});
Employee.belongsTo(Employee, {
    as: 'supervisorEmployee',
    foreignKey: 'supervisor',
});
Employee.hasMany(Employee, {
    as: 'supervisorReports',
    foreignKey: 'supervisor',
});

// Strip password from every JSON serialization (create/update responses included)
Employee.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    delete values.password;
    return values;
};

// Export so the controller can call Employee.create(), findAll(), update(), destroy(), etc.
module.exports = Employee;