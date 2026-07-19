// src/services/employeeService.js - handles business logic for employee operations
// sits between the controller and the model - controller handles HTTP, service handles logic

// Import the Employee and Attendance models to interact with the database
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { validateEmployeePayload } = require('./employeeValidation');
const { hashPassword } = require('./passwordService');
const { Op } = require('sequelize');
const { ROLES } = require('../../config/roles');

const REPORTING_RELATIONSHIPS = [
    { model: Employee, as: 'hodEmployee' },
    { model: Employee, as: 'supervisorEmployee' },
];

const validateReportingRelationships = async ({ hod, supervisor }, currentEmployeeId) => {
    const reportingIds = [...new Set([hod, supervisor].filter((id) => id !== undefined && id !== null))];

    if (currentEmployeeId && reportingIds.includes(currentEmployeeId)) {
        throw new Error('An employee cannot be their own HOD or supervisor');
    }
    if (reportingIds.length === 0) return;

    const reportingEmployees = await Employee.findAll({
        attributes: ['id'],
        where: {
            id: { [Op.in]: reportingIds },
            isActive: true,
        },
        raw: true,
    });
    const foundIds = new Set(reportingEmployees.map(({ id }) => id));
    const missingIds = reportingIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
        throw new Error(`Active reporting employee(s) not found: ${missingIds.join(', ')}`);
    }
};

// createEmployee - validates input and creates a new employee record
const createEmployee = async (data) => {

    // ---------------------------- Validation ----------------------------

    const validatedData = validateEmployeePayload(data, { requireAllFields: true });
    const {
        firstName: validatedFirstName,
        lastName: validatedLastName,
        email: validatedEmail,
        phone: validatedPhone,
        department: validatedDepartment,
        role: validatedRole,
        roster: validatedRoster,
        password: validatedPassword,
        hod: validatedHod,
        supervisor: validatedSupervisor,
    } = validatedData;

    // Check if an employee with this email already exists
    const existingEmployee = await Employee.findOne({ where: { email: validatedEmail } });

    if (existingEmployee) {
        throw new Error('An employee with this email already exists');
    }

    await validateReportingRelationships({
        hod: validatedHod,
        supervisor: validatedSupervisor,
    });

    // ---------------------------- Create Record ----------------------------

    const employee = await Employee.create({
        firstName: validatedFirstName,
        lastName: validatedLastName,
        email: validatedEmail,
        password: await hashPassword(validatedPassword),
        phone: validatedPhone,
        department: validatedDepartment,
        role: validatedRole,
        roster: validatedRoster,
        hod: validatedHod,
        supervisor: validatedSupervisor,
    });

    await employee.reload({ include: REPORTING_RELATIONSHIPS });

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
            include: REPORTING_RELATIONSHIPS,
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

const getAdministrativeEmployees = async () => Employee.findAll({
    where: {
        isActive: true,
        role: { [Op.in]: [ROLES.ADMIN, ROLES.ADMIN_MANAGER] },
    },
    include: REPORTING_RELATIONSHIPS,
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
});

// -----------------------------------------------------------------------
// updateEmployeeHierarchy - Role updates and HOD/Supervisor changes (NEW)
// -----------------------------------------------------------------------
const updateEmployeeHierarchy = async (employeeId, hierarchyData) => {
    const { role, hod, supervisor } = validateEmployeePayload(hierarchyData);

    const employee = await Employee.findOne({ where: { employeeId, isActive: true } });
    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    // Pass HOD & Supervisor to the existing validator along with the internal employee primary key ID
    await validateReportingRelationships({ hod, supervisor }, employee.id);

    const updateFields = {};
    if (role !== undefined) updateFields.role = role;
    if (hod !== undefined) updateFields.hod = hod;
    if (supervisor !== undefined) updateFields.supervisor = supervisor;

    const updatedEmployee = await employee.update(updateFields);
    await updatedEmployee.reload({ include: REPORTING_RELATIONSHIPS });

    return updatedEmployee;
};

// -----------------------------------------------------------------------
// getDirectReports - Fetch subordinates reporting to an HOD or Supervisor (NEW)
// -----------------------------------------------------------------------
const getDirectReports = async (managerEmployeeId) => {
    const manager = await Employee.findOne({ where: { employeeId: managerEmployeeId, isActive: true } });
    if (!manager) {
        throw new Error(`Active employee with management ID ${managerEmployeeId} not found.`);
    }

    // Find any employee where their internal HOD id or Supervisor id matches this manager's primary key id
    return Employee.findAll({
        where: {
            isActive: true,
            [Op.or]: [
                { hod: manager.id },
                { supervisor: manager.id }
            ]
        },
        include: REPORTING_RELATIONSHIPS,
        order: [['lastName', 'ASC'], ['firstName', 'ASC']],
    });
};

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

    // Hierarchy Guard: If this person is soft-deleted, clear out their references from subordinates
    await Employee.update({ hod: null }, { where: { hod: employee.id } });
    await Employee.update({ supervisor: null }, { where: { supervisor: employee.id } });

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

    const validatedData = validateEmployeePayload(updateData);
    const {
        firstName: validatedFirstName,
        lastName: validatedLastName,
        email: validatedEmail,
        phone: validatedPhone,
        department: validatedDepartment,
        role: validatedRole,
        roster: validatedRoster,
        password: validatedPassword,
        hod: validatedHod,
        supervisor: validatedSupervisor,
    } = validatedData;

    await validateReportingRelationships({
        hod: validatedHod,
        supervisor: validatedSupervisor,
    }, employee.id);

    if (validatedEmail && validatedEmail !== employee.email) {
        const existingEmployee = await Employee.findOne({ where: { email: validatedEmail } });
        if (existingEmployee) {
            throw new Error('An employee with this email already exists');
        }
    }

    const updateFields = {};
    if (updateData.firstName !== undefined) updateFields.firstName = validatedFirstName;
    if (updateData.lastName !== undefined) updateFields.lastName = validatedLastName;
    if (updateData.email !== undefined) updateFields.email = validatedEmail;
    if (updateData.phone !== undefined) updateFields.phone = validatedPhone;
    if (updateData.department !== undefined) updateFields.department = validatedDepartment;
    if (updateData.role !== undefined) updateFields.role = validatedRole;
    if (updateData.roster !== undefined) updateFields.roster = validatedRoster;
    if (updateData.hod !== undefined) updateFields.hod = validatedHod;
    if (updateData.supervisor !== undefined) updateFields.supervisor = validatedSupervisor;
    if (validatedPassword !== undefined) {
        updateFields.password = await hashPassword(validatedPassword);
    }

    const updatedEmployee = await employee.update(updateFields);
    await updatedEmployee.reload({ include: REPORTING_RELATIONSHIPS });

    return updatedEmployee;
};

// getAllEmployees - backward-compatible wrapper that returns only the list
const getAllEmployees = async () => {
    const result = await searchEmployees();
    return result.employees;
};

const getEmployeeById = async (employeeId) => {
    const employee = await Employee.findOne({
        where: { employeeId, isActive: true },
        include: REPORTING_RELATIONSHIPS,
    });

    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    return employee;
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

        if (record.checkOut) {
            const checkInTime = new Date(record.checkIn);
            const checkOutTime = new Date(record.checkOut);
            
            const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
            totalWorkingHours += parseFloat(hoursWorked.toFixed(2));
        }

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
    getEmployeeById,
    getAdministrativeEmployees,
    searchEmployees,
    validateReportingRelationships,
    updateEmployee,
    updateEmployeeHierarchy,
    getDirectReports,
    deleteEmployeeById,
    getEmployeeAttendance,
    calculateAttendanceMetrics,
};