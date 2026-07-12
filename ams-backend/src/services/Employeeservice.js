// src/services/employeeService.js - handles business logic for employee operations
// sits between the controller and the model - controller handles HTTP, service handles logic

// Import the Employee and Attendance models to interact with the database
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { validateEmployeePayload } = require('./employeeValidation');
const { Op } = require('sequelize');

// createEmployee - validates input and creates a new employee record
const createEmployee = async (data) => {
    // Destructure only the fields we accept - ignores any extra fields sent in the request
    const { firstName, lastName, email, phone, department, role, roster } = data;

    // ---------------------------- Validation ----------------------------
    const validatedData = validateEmployeePayload(data, { requireAllFields: true });
    const { firstName: validatedFirstName, lastName: validatedLastName, email: validatedEmail, phone: validatedPhone, department: validatedDepartment, role: validatedRole, roster: validatedRoster } = validatedData;

    // Check if an employee with this email already exists
    const existingEmployee = await Employee.findOne({ where: { email: validatedEmail } });

    if (existingEmployee) {
        throw new Error('An employee with this email already exists');
    }

    // ---------------------------- Create Record ----------------------------
    const employee = await Employee.create({
        firstName: validatedFirstName,
        lastName: validatedLastName,
        email: validatedEmail,
        phone: validatedPhone,
        department: validatedDepartment,
        role: validatedRole,
        roster: validatedRoster,
    });

    return employee;
};

// -----------------------------------------------------------------------
//  searchEmployees - Fetches active employee records with optional filters
// -----------------------------------------------------------------------
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
    if (!employeeId) {
        throw new Error('Employee ID is required to perform deletion.');
    }

    const employee = await Employee.findOne({ 
        where: { employeeId, isActive: true } 
    });

    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    employee.isActive = false;
    await employee.save();

    return employee;
};

// -----------------------------------------------------------------------
// updates an existing employee record
// -----------------------------------------------------------------------
const updateEmployee = async (employeeId, updateData) => {
    const employee = await Employee.findOne({ where: { employeeId } });
    
    if (!employee) {
        throw new Error(`Employee with ID ${employeeId} not found`);
    }

    const { firstName, lastName, email, phone, department, role, roster } = updateData;

    const validatedData = validateEmployeePayload(updateData);
    const { firstName: validatedFirstName, lastName: validatedLastName, email: validatedEmail, phone: validatedPhone, department: validatedDepartment, role: validatedRole, roster: validatedRoster } = validatedData;

    if (validatedEmail && validatedEmail !== employee.email) {
        const existingEmployee = await Employee.findOne({ where: { email: validatedEmail } });
        if (existingEmployee) {
            throw new Error('An employee with this email already exists');
        }
    }

    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = validatedFirstName;
    if (lastName !== undefined) updateFields.lastName = validatedLastName;
    if (email !== undefined) updateFields.email = validatedEmail;
    if (phone !== undefined) updateFields.phone = validatedPhone;
    if (department !== undefined) updateFields.department = validatedDepartment;
    if (role !== undefined) updateFields.role = validatedRole;
    if (roster !== undefined) updateFields.roster = validatedRoster;

    const updatedEmployee = await employee.update(updateFields);
    return updatedEmployee;
};

// getAllEmployees - backward-compatible wrapper that returns only the list
const getAllEmployees = async () => {
    const result = await searchEmployees();
    return result.employees;
};

// -----------------------------------------------------------------------
// getEmployeeAttendance - fetch attendance records tied to an employee
// -----------------------------------------------------------------------
const getEmployeeAttendance = async (employeeId, filters = {}) => {
    if (!employeeId) {
        throw new Error('Employee ID is required to retrieve attendance.');
    }

    const employee = await Employee.findOne({ where: { employeeId, isActive: true } });
    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    const where = { employeeId };

    if (filters.month) where.month = Number(filters.month);
    if (filters.year) where.year = Number(filters.year);
    if (filters.status) where.status = filters.status;

    if (filters.startDate && filters.endDate) {
        where.date = {
            [Op.between]: [filters.startDate, filters.endDate],
        };
    }

    return Attendance.findAll({
        where,
        order: [['date', 'DESC']],
    });
};

// -----------------------------------------------------------------------
// calculateAttendanceMetrics - Core math logic for summary dashboards
// -----------------------------------------------------------------------
const calculateAttendanceMetrics = async (employeeId, startDate, endDate, shiftStartTime = "09:00") => {
    if (!startDate || !endDate) {
        throw new Error('Both startDate and endDate are required for metric calculations.');
    }

    const records = await getEmployeeAttendance(employeeId, { startDate, endDate });

    let totalPresentDays = 0;
    let totalWorkingHours = 0;
    let totalLateMinutes = 0;

    records.forEach(record => {
        if (!record.checkIn) return; 

        totalPresentDays++;

        // 1. Calculate working hours duration
        if (record.checkOut) {
            const checkInTime = new Date(record.checkIn);
            const checkOutTime = new Date(record.checkOut);
            
            const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
            totalWorkingHours += parseFloat(hoursWorked.toFixed(2));
        }

        // 2. Calculate late time shifts
        const actualCheckIn = new Date(record.checkIn);
        const [expectedHour, expectedMinute] = shiftStartTime.split(":").map(Number);
        
        const expectedCheckInTimeToday = new Date(actualCheckIn);
        expectedCheckInTimeToday.setHours(expectedHour, expectedMinute, 0, 0);

        if (actualCheckIn > expectedCheckInTimeToday) {
            const lateMs = actualCheckIn - expectedCheckInTimeToday;
            const lateMins = Math.floor(lateMs / (1000 * 60));
            totalLateMinutes += lateMins;
        }
    });

    return {
        totalPresentDays,
        totalWorkingHours: parseFloat(totalWorkingHours.toFixed(2)),
        totalLateMinutes,
        attendancePercentage: records.length > 0 
            ? parseFloat(((totalPresentDays / records.length) * 100).toFixed(2)) 
            : 0
    };
};

// Export all service functions - add new ones here as we build more features
module.exports = {
    createEmployee,
    getAllEmployees,
    searchEmployees,
    updateEmployee,
    deleteEmployeeById,
    getEmployeeAttendance,
    calculateAttendanceMetrics,
};