// src/controllers/employeeController.js - handles incoming HTTP requests for employee operations

const employeeService = require('../services/employeeService');

// Helper function to extract query filters for leave history
const leaveHistoryFiltersFromRequest = (req) => {
    const { status, leaveType, year, startDate, endDate } = req.query;

    return {
        status,
        leaveType,
        year,
        startDate,
        endDate,
    };
};

// Retrieve leave history for a specific employee ID
const getEmployeeLeaveHistory = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const leaveHistory = await employeeService.getEmployeeLeaveHistory(
            employeeId,
            leaveHistoryFiltersFromRequest(req),
        );

        return res.status(200).json({ success: true, data: leaveHistory });
    } catch (error) {
        return res.status(error.message.includes('not found') ? 404 : 400).json({
            success: false,
            message: error.message,
        });
    }
};

// Retrieve leave history for the currently authenticated employee
const getMyLeaveHistory = async (req, res) => {
    try {
        const leaveHistory = await employeeService.getEmployeeLeaveHistory(
            req.user.employeeId,
            leaveHistoryFiltersFromRequest(req),
        );

        return res.status(200).json({ success: true, data: leaveHistory });
    } catch (error) {
        return res.status(error.message.includes('not found') ? 404 : 400).json({
            success: false,
            message: error.message,
        });
    }
};

// Fetch unauthorised leave records for a specific employee ID
const getUnauthorisedLeaveForEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { month, year, startDate, endDate } = req.query;

        const records = await employeeService.getUnauthorisedLeaveRecords(employeeId, {
            month, year, startDate, endDate,
        });

        return res.status(200).json({ success: true, data: records });
    } catch (error) {
        return res.status(error.message.includes('not found') ? 404 : 400).json({
            success: false,
            message: error.message,
        });
    }
};

// Fetch organization-wide unauthorised leave records
const getAllUnauthorisedLeave = async (req, res) => {
    try {
        const { month, year, startDate, endDate } = req.query;

        const records = await employeeService.getUnauthorisedLeaveRecords(null, {
            month, year, startDate, endDate,
        });

        return res.status(200).json({ success: true, data: records });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Convert an unauthorised attendance record into an approved leave
const resolveUnauthorisedAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { reviewNotes } = req.body;
        const reviewerEmployeeId = req.user.employeeId;

        if (!attendanceId) {
            return res.status(400).json({
                success: false,
                message: 'Attendance ID is required.'
            });
        }

        const result = await employeeService.resolveUnauthorisedAttendance(
            attendanceId,
            reviewerEmployeeId,
            reviewNotes
        );

        return res.status(200).json({
            success: true,
            message: 'Unauthorised attendance successfully resolved to approved leave.',
            data: result
        });
    } catch (error) {
        const statusCode = error.message.includes('not found') ? 404 : 400;

        return res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getEmployeeLeaveHistory,
    getMyLeaveHistory,
    getUnauthorisedLeaveForEmployee,
    getAllUnauthorisedLeave,
    resolveUnauthorisedAttendance,
};