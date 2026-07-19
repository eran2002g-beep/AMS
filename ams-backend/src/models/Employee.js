// src/models/Employee.js - defines the Employee table structure in the database

// DataTypes provides column type options: STRING, INTEGER, BOOLEAN, ENUM, etc.
const { DataTypes } = require('sequelize');

// Import the shared DB connection - this tells Sequelize which database to use
const sequelize = require('../../config/db');
const { generateNextEmployeeId } = require('../services/employeeIdGenerator');
const { ROLES, ALL_ROLES } = require('../../config/roles');

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
    // ENUM restricts the value to the role set defined in src/config/roles.js:
    // employee | super_admin | admin | manager | admin_manager
    role: {
        type: DataTypes.ENUM(...ALL_ROLES),
        defaultValue: ROLES.EMPLOYEE, // new users get least privilege by default
    },

    // reportsTo - Foreign Key linking back to Employee.employeeId for Line Manager Hierarchy (NEW)
    // This defines who the employee directly reports to in the organizational structure.
    reportsTo: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: 'employees', // actual database table name
            key: 'employeeId'
        }
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

// Strip password from every JSON serialization (create/update responses included)
Employee.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    delete values.password;
    return values;
};

// --- SELF-REFERENTIAL ASSOCIATIONS (NEW) ----------------------
// Defines the reporting hierarchy lines using the public employeeId string.
// An employee belongs to one Manager, and a Manager can have many Subordinates.
Employee.hasMany(Employee, { as: 'subordinates', foreignKey: 'reportsTo', sourceKey: 'employeeId' });
Employee.belongsTo(Employee, { as: 'manager', foreignKey: 'reportsTo', targetKey: 'employeeId' });

// Export so the controller can call Employee.create(), findAll(), update(), destroy(), etc.
module.exports = Employee;