// src/routes/employeeRoute.js - employee-related routes
const express = require('express');
const router = express.Router();

const employeeService = require('../services/employeeService');

// -----------------------------------------------------------------------
// employee - Retrieve all employee records API
// -----------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const employees = await employeeService.getAllEmployees();
        return res.status(200).json({
            success: true,
            count: employees.length,
            data: employees
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// POST /employee/create - Create a new employee record
router.post('/create', async (req, res) => {
    try {
        const employee = await employeeService.createEmployee(req.body);
        return res.status(201).json(employee);
    } catch (err) {
        return res.status(400).json({ error: err.message });
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