// src/routes/employeeRoute.js - employee-related routes
const express = require('express');
const router = express.Router();

const employeeService = require('../services/employeeService');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { CAN_MANAGE_EMPLOYEES, CAN_VIEW_ATTENDANCE } = require("../../config/roles");

// -----------------------------------------------------------------------
// GET /employee - Retrieve all employee records API
// Read access: any authenticated admin-tier role needs the directory to do
// -----------------------------------------------------------------------
router.get('/', verifyToken, async (req, res) => {
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
// PUT /employee/:employeeId/hierarchy - Update Role and Reporting Structure (NEW)
// EMPLOYEE CRUD -> admin/super_admin only (via CAN_MANAGE_EMPLOYEES permissions)
// -----------------------------------------------------------------------
router.put('/:employeeId/hierarchy', verifyToken, authorizeRoles(...CAN_MANAGE_EMPLOYEES), async (req, res) => {
    try {
        const { employeeId } = req.params;
        // hierarchyData: { role, hod, supervisor }
        const updatedEmployee = await employeeService.updateEmployeeHierarchy(employeeId, req.body);
        
        return res.status(200).json({
            success: true,
            message: 'Employee role management and hierarchy lines updated successfully.',
            data: updatedEmployee
        });
    } catch (err) {
        return res.status(400).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// -----------------------------------------------------------------------
// GET /employee/:managerId/subordinates - Get all direct reports for a manager (NEW)
// Allowed for authenticated users to view organizational structure
// -----------------------------------------------------------------------
router.get('/:managerId/subordinates', verifyToken, async (req, res) => {
    try {
        const { managerId } = req.params;
        const subordinates = await employeeService.getDirectReports(managerId);
        
        return res.status(200).json({
            success: true,
            count: subordinates.length,
            data: subordinates
        });
    } catch (err) {
        return res.status(404).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// -----------------------------------------------------------------------
// POST /employee/create - Create a new employee record
// EMPLOYEE CRUD -> super_admin only (via CAN_MANAGE_EMPLOYEES permissions)
// -----------------------------------------------------------------------
router.post('/create', verifyToken, authorizeRoles(...CAN_MANAGE_EMPLOYEES), async (req, res) => {
    try {
        const employee = await employeeService.createEmployee(req.body);
        return res.status(201).json(employee);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// -----------------------------------------------------------------------
// DELETE /employee/:employeeId - delete an employee record (Soft Delete)
// EMPLOYEE CRUD -> super_admin only (via CAN_MANAGE_EMPLOYEES permissions)
// -----------------------------------------------------------------------
router.delete('/:employeeId', verifyToken, authorizeRoles(...CAN_MANAGE_EMPLOYEES), async (req, res) => {
    try {
        // Extract employeeId from URL parameters
        const { employeeId } = req.params; 
        
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
// EMPLOYEE CRUD -> super_admin only 
// -----------------------------------------------------------------------
router.patch('/:employeeId', verifyToken, authorizeRoles(...CAN_MANAGE_EMPLOYEES), async (req, res) => {
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

// -----------------------------------------------------------------------
// GET /employee/:employeeId/attendance-summary - Get calculated metrics
// Follows the "view attendance" permission (admin, admin_manager) rather than
// -----------------------------------------------------------------------
router.get('/:employeeId/attendance-summary', verifyToken, authorizeRoles(...CAN_VIEW_ATTENDANCE), async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { startDate, endDate, shiftStartTime } = req.query;

        // Ensure date range params are supplied
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: "Both 'startDate' and 'endDate' query parameters are required."
            });
        }

        // Run core mathematical metrics calculation from service layer
        const metrics = await employeeService.calculateAttendanceMetrics(
            employeeId, 
            startDate, 
            endDate, 
            shiftStartTime || "09:00"
        );

        return res.status(200).json({
            success: true,
            employeeId,
            period: { startDate, endDate },
            data: metrics
        });
    } catch (err) {
        const statusCode = err.message.includes('not found') ? 404 : 500;
        return res.status(statusCode).json({
            success: false,
            error: err.message
        });
    }
});

module.exports = router;