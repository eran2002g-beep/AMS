const attendanceService = require('../services/attendanceService');

const processNormalAttendance = async (req, res) => {
    try {
        const period = { ...req.query, ...req.body };
        const result = await attendanceService.processNormalAttendance(period);

        return res.status(200).json({
            status: 'success',
            ...result,
        });
    } catch (err) {
        return res.status(400).json({ status: 'error', error: err.message });
    }
};

const getEmployeeAttendance = async (req, res) => {
    try {
        const result = await attendanceService.getEmployeeAttendance(
            req.params.employeeId,
            req.query,
        );

        return res.status(200).json({
            status: 'success',
            count: result.records.length,
            totalCount: result.meta.total,
            meta: result.meta,
            employee: result.employee,
            filters: result.filters,
            data: result.records,
        });
    } catch (err) {
        return res.status(400).json({ status: 'error', error: err.message });
    }
};

const getAllAttendance = async (req, res) => {
    try {
        const result = await attendanceService.getAllAttendance(req.query);

        return res.status(200).json({
            status: 'success',
            count: result.records.length,
            meta: result.meta,
            filters: result.filters,
            data: result.records,
        });
    } catch (err) {
        return res.status(400).json({ status: 'error', error: err.message });
    }
};

const getAttendanceById = async (req, res) => {
    try {
        const result = await attendanceService.getAttendanceById(req.params.attendanceId);

        return res.status(200).json({
            status: 'success',
            count: 1,
            employee: result.employee,
            data: result.attendance,
        });
    } catch (err) {
        const statusCode = err.message.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({ status: 'error', error: err.message });
    }
};

const deleteAttendance = async (req, res) => {
    try {
        const { attendanceId } = req.params;

        if (!attendanceId || attendanceId.trim() === '') {
            return res.status(400).json({ status: 'error', error: 'Attendance ID is required.' });
        }

        const result = await attendanceService.deleteAttendanceRecord(attendanceId);

        return res.status(200).json({
            status: 'success',
            message: result.message,
            deletedId: result.attendanceId,
        });
    } catch (err) {
        const statusCode = err.message.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({ status: 'error', error: err.message });
    }
};

const createAttendanceRecord = async (req, res) => {
    try {
        const record = await attendanceService.addAttendanceRecord(req.body);

        return res.status(201).json({
            status: 'success',
            data: record,
        });
    } catch (err) {
        const statusCode = err.message.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({ status: 'error', error: err.message });
    }
};

module.exports = {
    processNormalAttendance,
    getEmployeeAttendance,
    getAllAttendance,
    getAttendanceById,
    deleteAttendance,
    createAttendanceRecord,
};