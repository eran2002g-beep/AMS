// employeeController.js additions
const employeeService = require('../services/employeeService');

const getEmployeeLeaveHistory = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { status, leaveType, year, startDate, endDate } = req.query;

        const leaveHistory = await employeeService.getEmployeeLeaveHistory(employeeId, {
            status, leaveType, year, startDate, endDate,
        });

        res.status(200).json({ success: true, data: leaveHistory });
    } catch (error) {
        res.status(error.message.includes('not found') ? 404 : 400).json({
            success: false,
            message: error.message,
        });
    }
};

const getUnauthorisedLeaveForEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { month, year, startDate, endDate } = req.query;

        const records = await employeeService.getUnauthorisedLeaveRecords(employeeId, {
            month, year, startDate, endDate,
        });

        res.status(200).json({ success: true, data: records });
    } catch (error) {
        res.status(error.message.includes('not found') ? 404 : 400).json({
            success: false,
            message: error.message,
        });
    }
};

const getAllUnauthorisedLeave = async (req, res) => {
    try {
        const { month, year, startDate, endDate } = req.query;

        const records = await employeeService.getUnauthorisedLeaveRecords(null, {
            month, year, startDate, endDate,
        });

        res.status(200).json({ success: true, data: records });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    // ...existing exports
    getEmployeeLeaveHistory,
    getUnauthorisedLeaveForEmployee,
    getAllUnauthorisedLeave,
};