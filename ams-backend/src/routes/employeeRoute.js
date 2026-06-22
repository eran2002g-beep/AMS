// src/routes/employeeRoute.js - employee-related routes
const express = require('express');
const router = express.Router();

const employeeService = require('../services/employeeService');

// -----------------------------------------------------------------------
// GET /employee - Retrieve all employee records API
// -----------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const { q, department, role, page, limit } = req.query;

        const result = await employeeService.searchEmployees({ q, department, role, page, limit });

        return res.status(200).json({
            success: true,
            meta: result.meta,
            count: result.meta.total,
            data: result.employees
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// -----------------------------------------------------------------------
// POST /employee/create - Create a new employee record
// -----------------------------------------------------------------------
router.post('/create', async (req, res) => {
    try {
        const employee = await employeeService.createEmployee(req.body);
        return res.status(201).json(employee);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// -----------------------------------------------------------------------
// DELETE /employee/:employeeId - delete an employee record
// -----------------------------------------------------------------------
router.delete('/:employeeId', async (req, res) => {
    try {
        // Extract employeeId from URL parameters
        const { employeeId } = req.params; 
        
        // Execute soft delete logic from the service layer
        await employeeService.deleteEmployeeById(employeeId);
        
        return res.status(200).json({
            success: true,
            message: `Employee ${employeeId} has been successfully deleted.`
        });
    } catch (err) {
        // Return 404 if employee was not found, otherwise default to 500 server error
        const statusCode = err.message.includes('not found') ? 404 : 500;
        return res.status(statusCode).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// -----------------------------------------------------------------------
// PATCH /employee/:employeeId - Update an existing employee record
// -----------------------------------------------------------------------
router.patch('/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const updatedEmployee = await employeeService.updateEmployee(employeeId, req.body);
        return res.status(200).json({
            success: true,
            message: 'Employee updated successfully',
            data: updatedEmployee
        });
    } catch (err) {
        return res.status(400).json({ 
            success: false, 
            error: err.message 
        });
    }
});

module.exports = router;