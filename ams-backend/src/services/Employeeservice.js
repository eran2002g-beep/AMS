// src/services/employeeService.js - handles business logic for employee operations
// sits between the controller and the model - controller handles HTTP, service handles logic

// Import the Employee model to interact with the employees table
const Employee = require('../models/Employee');
const { generateNextEmployeeId } = require('./employeeIdGenerator');
const { validateEmployeePayload } = require('./employeeValidation');

// createEmployee - validates input and creates a new employee record
// receives plain data object from the controller, returns the created employee
const createEmployee = async (data) => {

    // Destructure only the fields we accept - ignores any extra fields sent in the request
    const { firstName, lastName, email, phone, department, role, roster } = data;

    // ---------------------------- Validation ----------------------------

    const validatedData = validateEmployeePayload(data, { requireAllFields: true });
    const { firstName: validatedFirstName, lastName: validatedLastName, email: validatedEmail, phone: validatedPhone, department: validatedDepartment, role: validatedRole, roster: validatedRoster } = validatedData;

    // Check if an employee with this email already exists
    // findOne returns the matching record or null if not found
    const existingEmployee = await Employee.findOne({ where: { email: validatedEmail } });

    // If a record was found, this email is already taken
    if (existingEmployee) {
        throw new Error('An employee with this email already exists');
    }

    // ---------------------------- Create Record ----------------------------

    const existingEmployeeIds = await Employee.findAll({
        attributes: ['employeeId'],
        raw: true,
    });

    const nextEmployeeId = generateNextEmployeeId(existingEmployeeIds.map((item) => item.employeeId));

    // Employee.create() inserts a new row into the employees table
    // role defaults to 'employee' and isActive defaults to true if not provided
    const employee = await Employee.create({
        employeeId: nextEmployeeId,
        firstName: validatedFirstName,
        lastName: validatedLastName,
        email: validatedEmail,
        phone: validatedPhone,
        department: validatedDepartment,
        role: validatedRole,
        roster: validatedRoster,
    });

    // Return the newly created employee object back to the controller
    return employee;
};

// -----------------------------------------------------------------------
//  searchEmployees - Fetches active employee records with optional filters
//  Supports: q (search across firstName,lastName,email,employeeId), department, role, pagination
// -----------------------------------------------------------------------
const { Op } = require('sequelize');

const searchEmployees = async (opts = {}) => {
    try {
        const {
            q, // search text
            department,
            role,
            page = 1,
            limit = 50,
        } = opts;

        const where = { isActive: true };

        if (department) where.department = department;
        if (role) where.role = role;

        if (q) {
            const like = { [Op.iLike]: `%${q}%` };
            where[Op.or] = [
                { firstName: like },
                { lastName: like },
                { email: like },
                { employeeId: like },
            ];
        }

        const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * (parseInt(limit, 10) || 50);

        const { rows: employees, count: total } = await Employee.findAndCountAll({
            where,
            limit: parseInt(limit, 10) || 50,
            offset,
            order: [['lastName', 'ASC'], ['firstName', 'ASC']],
        });

        return {
            employees,
            meta: { total, page: parseInt(page, 10) || 1, limit: parseInt(limit, 10) || 50 }
        };
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

// -----------------------------------------------------------------------
// updates an existing employee record
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

    const validatedData = validateEmployeePayload(updateData);
    const { firstName: validatedFirstName, lastName: validatedLastName, email: validatedEmail, phone: validatedPhone, department: validatedDepartment, role: validatedRole, roster: validatedRoster } = validatedData;

    // If email is being changed, check if the new email already exists
    if (validatedEmail && validatedEmail !== employee.email) {
        const existingEmployee = await Employee.findOne({ where: { email: validatedEmail } });
        if (existingEmployee) {
            throw new Error('An employee with this email already exists');
        }
    }

    // Build the update object - only include fields that were provided
    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = validatedFirstName;
    if (lastName !== undefined) updateFields.lastName = validatedLastName;
    if (email !== undefined) updateFields.email = validatedEmail;
    if (phone !== undefined) updateFields.phone = validatedPhone;
    if (department !== undefined) updateFields.department = validatedDepartment;
    if (role !== undefined) updateFields.role = validatedRole;
    if (roster !== undefined) updateFields.roster = validatedRoster;

    // Update the employee record with the new values
    const updatedEmployee = await employee.update(updateFields);

    return updatedEmployee;
};

// getAllEmployees - backward-compatible wrapper that returns only the list
const getAllEmployees = async () => {
    const result = await searchEmployees();
    return result.employees;
};

// Export all service functions - add new ones here as we build more features
module.exports = {
    createEmployee,
    getAllEmployees,
    searchEmployees,
    updateEmployee,
    deleteEmployeeById,
};