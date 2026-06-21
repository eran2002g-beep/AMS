// src/services/employeeService.js - handles business logic for employee operations
// sits between the controller and the model - controller handles HTTP, service handles logic

// Import the Employee model to interact with the employees table
const Employee = require('../models/Employee');

// createEmployee - validates input and creates a new employee record
// receives plain data object from the controller, returns the created employee
const createEmployee = async (data) => {

    // Destructure only the fields we accept - ignores any extra fields sent in the request
    const { firstName, lastName, email, phone, department, role, roster } = data;

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
        roster,
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
// updateEmployee - updates an existing employee record
// accepts employeeId and a data object with fields to update
// returns the updated employee object
// -----------------------------------------------------------------------
const updateEmployee = async (employeeId, updateData) => {
    
    // Check that the employee exists first
    const employee = await Employee.findOne({ where: { employeeId } });
    
    if (!employee) {
        throw new Error(`Employee with ID ${employeeId} not found`);
    }

    // Destructure only the fields we allow to be updated
    const { firstName, lastName, email, phone, department, role, roster } = updateData;

    // If email is being changed, check if the new email already exists
    if (email && email !== employee.email) {
        const existingEmployee = await Employee.findOne({ where: { email } });
        if (existingEmployee) {
            throw new Error('An employee with this email already exists');
        }
    }

    // Build the update object - only include fields that were provided
    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (email !== undefined) updateFields.email = email;
    if (phone !== undefined) updateFields.phone = phone;
    if (department !== undefined) updateFields.department = department;
    if (role !== undefined) updateFields.role = role;
    if (roster !== undefined) updateFields.roster = roster;

    // Update the employee record with the new values
    const updatedEmployee = await employee.update(updateFields);

    return updatedEmployee;
};

// Export all service functions - add new ones here as we build more features
module.exports = {
    createEmployee,
    getAllEmployees,
    updateEmployee, 
};