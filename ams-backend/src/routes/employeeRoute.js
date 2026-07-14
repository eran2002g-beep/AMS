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
// GET /employee/:employeeId - Retrieve a specific employee record by employeeId
// -----------------------------------------------------------------------\nrouter.get('/:employeeId', async (req, res) => {\n    try {\n        const { employeeId } = req.params;\n        const employee = await employeeService.getEmployeeById(employeeId);\n        return res.status(200).json({\n            success: true,\n            data: employee\n        });\n    } catch (err) {\n        // Return 404 if employee not found, 400 for invalid input\n        const statusCode = err.message.includes('not found') ? 404 : 400;\n        return res.status(statusCode).json({\n            success: false,\n            error: err.message\n        });\n    }\n});\n\n// -----------------------------------------------------------------------\n// PATCH /employee/:employeeId - Update an existing employee record\n// \n// Request body can include any of: firstName, lastName, email, phone, department, role, roster\n// Cannot update: employeeId, id, isActive, timestamps (createdAt, updatedAt)\n// \n// Response: Updated employee object with all fields\n// -----------------------------------------------------------------------\nrouter.patch('/:employeeId', async (req, res) => {\n    try {\n        const { employeeId } = req.params;\n        \n        // Validate that body is not empty\n        if (!req.body || Object.keys(req.body).length === 0) {\n            return res.status(400).json({\n                success: false,\n                error: 'No fields provided for update. Please provide at least one field to update.'\n            });\n        }\n        \n        const updatedEmployee = await employeeService.updateEmployee(employeeId, req.body);\n        return res.status(200).json({\n            success: true,\n            message: 'Employee updated successfully',\n            data: updatedEmployee\n        });\n    } catch (err) {\n        // Determine appropriate status code based on error message\n        let statusCode = 400; // default to bad request\n        if (err.message.includes('not found')) {\n            statusCode = 404; // not found\n        } else if (err.message.includes('already exists')) {\n            statusCode = 409; // conflict (duplicate email)\n        } else if (err.message.includes('immutable')) {\n            statusCode = 422; // unprocessable entity\n        }\n        \n        return res.status(statusCode).json({\n            success: false,\n            error: err.message\n        });\n    }\n});\n\nmodule.exports = router;