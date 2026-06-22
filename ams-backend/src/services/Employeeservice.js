// src/services/employeeService.js - handles business logic for employee operations
// sits between the controller and the model - controller handles HTTP, service handles logic

// Import the Employee model to interact with the employees table
const Employee = require('../models/Employee');

// createEmployee - validates input and creates a new employee record
// receives plain data object from the controller, returns the created employee
const createEmployee = async (data) => {

    // Destructure only the fields we accept - ignores any extra fields sent in the request
    const { firstName, lastName, email, phone, department, role } = data;

    // ---------------------------- Validation ----------------------------

    // Check all required fields are present before touching the database
    if (!firstName || !lastName || !email) {
        throw new Error('firstName, lastName and email are required');
    }

    // Check if an employee with this email already exists
    // findOne returns the matching record or null if not found
    const existingEmployee = await Employee.findOne({ where: { email } });

    // If a record was found, this email is already taken
    if (existingEmployee) {
        throw new Error('An employee with this email already exists');
    }

    // ---------------------------- Create Record ----------------------------

    // Employee.create() inserts a new row into the employees table
    // employeeId is NOT passed here - the beforeCreate hook generates it automatically
    // role defaults to 'employee' and isActive defaults to true if not provided
    const employee = await Employee.create({
        firstName,
        lastName,
        email,
        phone,
        department,
        role,
    });

    // Return the newly created employee object back to the controller
    return employee;
};

// -----------------------------------------------------------------------
//  getAllEmployees - Fetches all active employee records from Neon DB
// -----------------------------------------------------------------------
const getAllEmployees = async () => {
    try {
        const employees = await Employee.findAll({
            where: {
                isActive: true
            }
        });
        return employees;
    } catch (error) {
        throw new Error("Database Retrieval Error: " + error.message);
    }
};

// -----------------------------------------------------------------------
// Soft Delete Employee - Sets isActive to false using employeeId
// -----------------------------------------------------------------------
const deleteEmployeeById = async (employeeId) => {
    // Check if employeeId is provided
    if (!employeeId) {
        throw new Error('Employee ID is required to perform deletion.');
    }

    // 1. Find the active employee with the given employeeId
    const employee = await Employee.findOne({ 
        where: { employeeId, isActive: true } 
    });

    // 2. If no active employee is found, throw a 404-specific error message
    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    // 3. Perform a soft delete by setting isActive status to false
    employee.isActive = false;
    await employee.save();

    return employee;
};

// Export all service functions - add new ones here as we build more features
module.exports = {
    createEmployee,
    getAllEmployees, 
    deleteEmployeeById, // Added for soft delete functionality
};