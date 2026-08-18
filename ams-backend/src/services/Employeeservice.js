// src/services/employeeService.js - handles business logic for employee operations
// sits between the controller and the model - controller handles HTTP, service handles logic

// Import Employee and Attendance models
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { validateEmployeePayload } = require('./employeeValidation');
const { hashPassword } = require('./passwordService');
const { Op } = require('sequelize');
const { 
    ROLES,
    CAN_MANAGE_EMPLOYEES,
    CAN_VIEW_EMPLOYEES,
    CAN_EDIT_ATTENDANCE,
    CAN_MANAGE_LEAVE,
} = require('../../config/roles');

const REPORTING_RELATIONSHIPS = [
    { model: Employee, as: 'hodEmployee' },
    { model: Employee, as: 'supervisorEmployee' },
];

// Validate if reporting managers (HOD/Supervisor) exist and prevent circular self-reporting
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

    // Check if employee with email exists
    const existingEmployee = await Employee.findOne({ where: { email: validatedEmail } });
    if (existingEmployee) {
        throw new Error('An employee with this email already exists');
    }

    await validateReportingRelationships({
        hod: validatedHod,
        supervisor: validatedSupervisor,
    });

    const employee = await Employee.create({
        firstName: validatedFirstName,
        lastName: validatedLastName,
        email: validatedEmail,
        password: await hashPassword(validatedPassword),
        mustChangePassword: true,
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

// searchEmployees - Fetches active employee records with optional filters
const searchEmployees = async (opts = {}) => {
    try {
        const {
            q,
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

// Retrieve active admin employees
const getAdministrativeEmployees = async () => Employee.findAll({
    where: {
        isActive: true,
        role: { [Op.in]: [ROLES.ADMIN, ROLES.ADMIN_MANAGER] },
    },
    include: REPORTING_RELATIONSHIPS,
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
});

// Active managers eligible for supervisor / HOD assignment
const getManagers = async () => Employee.findAll({
    where: {
        isActive: true,
        role: { [Op.in]: [ROLES.MANAGER, ROLES.ADMIN_MANAGER] },
    },
    attributes: ['id', 'employeeId', 'firstName', 'lastName', 'email', 'department', 'role'],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']],
});

// updateEmployeeHierarchy - Role updates and HOD/Supervisor changes
const updateEmployeeHierarchy = async (employeeId, hierarchyData) => {
    const { role, hod, supervisor } = validateEmployeePayload(hierarchyData);

    const employee = await Employee.findOne({ where: { employeeId, isActive: true } });
    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    await validateReportingRelationships({ hod, supervisor }, employee.id);

    const updateFields = {};
    if (role !== undefined) updateFields.role = role;
    if (hod !== undefined) updateFields.hod = hod;
    if (supervisor !== undefined) updateFields.supervisor = supervisor;

    const updatedEmployee = await employee.update(updateFields);
    await updatedEmployee.reload({ include: REPORTING_RELATIONSHIPS });

    return updatedEmployee;
};

// getDirectReports - Fetch subordinates reporting to an HOD or Supervisor
const getDirectReports = async (managerEmployeeId) => {
    const manager = await Employee.findOne({ where: { employeeId: managerEmployeeId, isActive: true } });
    if (!manager) {
        throw new Error(`Active employee with management ID ${managerEmployeeId} not found.`);
    }

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

    await Employee.update({ hod: null }, { where: { hod: employee.id } });
    await Employee.update({ supervisor: null }, { where: { supervisor: employee.id } });

    employee.isActive = false;
    await employee.save();

    return employee;
};

// Update existing employee record
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
        updateFields.mustChangePassword = true;
    }

    const updatedEmployee = await employee.update(updateFields);
    await updatedEmployee.reload({ include: REPORTING_RELATIONSHIPS });

    return updatedEmployee;
};

// getAllEmployees - backward-compatible wrapper
const getAllEmployees = async () => {
    const result = await searchEmployees();
    return result.employees;
};

// Get single employee by public ID
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

// getEmployeeAttendance - fetch attendance records tied to an employee
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

// calculateAttendanceMetrics - Core math logic for summary dashboards
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

// -----------------------------------------------------------------------
// getUnauthorisedLeaveDetails - Retrieve detailed unauthorised leave records
// Returns formatted records with date, attendance status, reason, and employee info
// -----------------------------------------------------------------------
const getUnauthorisedLeaveDetails = async (filters = {}) => {
    const { startDate, endDate, department, employeeId } = filters;

    const where = {
        [Op.or]: [
            { status: 'ABSENT' },
            { status: 'absent' },
            { status: 'UNAUTHORISED' },
            { status: 'unauthorised' },
            { status: 'UNEXCUSED' }
        ]
    };

    if (employeeId) where.employeeId = employeeId;
    if (startDate && endDate) {
        where.date = { [Op.between]: [startDate, endDate] };
    }

    const employeeWhere = { isActive: true };
    if (department) employeeWhere.department = department;

    const records = await Attendance.findAll({
        where,
        include: [{
            model: Employee,
            where: employeeWhere,
            attributes: ['id', 'employeeId', 'firstName', 'lastName', 'department', 'role']
        }],
        order: [['date', 'DESC']]
    });

    return records.map((record) => ({
        date: record.date,
        attendanceStatus: record.status,
        reason: record.reason || 'Unauthorised Absence / No leave requested',
        employee: {
            employeeId: record.employee?.employeeId,
            fullName: `${record.employee?.firstName || ''} ${record.employee?.lastName || ''}`.trim(),
            department: record.employee?.department,
            role: record.employee?.role
        }
    }));
};

// getEmployeeLeaveHistory - fetch leave requests tied to an employee
// getEmployeeLeaveHistory - fetch leave requests tied to an employee (NEW)
// Supports filtering by status (pending/approved/rejected), leaveType,
// a specific year, or an explicit startDate/endDate range.
// -----------------------------------------------------------------------
const getEmployeeLeaveHistory = async (employeeId, filters = {}) => {
    if (!employeeId) {
        throw new Error('Employee ID is required to retrieve leave history.');
    }

    const LeaveRequest = require('../models/LeaveRequest');

    const employee = await Employee.findOne({ where: { employeeId, isActive: true } });
    if (!employee) {
        throw new Error(`Active employee with ID ${employeeId} not found.`);
    }

    const where = { employeeId };

    if (filters.status) where.status = filters.status;
    if (filters.leaveType) where.leaveType = filters.leaveType;

    if (filters.startDate && filters.endDate) {
        where.startDate = { [Op.between]: [filters.startDate, filters.endDate] };
    } else if (filters.year) {
        const year = Number(filters.year);
        where.startDate = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
    }

    return LeaveRequest.findAll({
        where,
        order: [['startDate', 'DESC']],
    });
};

// -----------------------------------------------------------------------
// ROLE MANAGEMENT - Methods to manage roles and permissions
// -----------------------------------------------------------------------

const validateUserCanManageEmployees = (userRole) => {
    if (!userRole || !CAN_MANAGE_EMPLOYEES.includes(userRole)) {
        throw new Error(`User role "${userRole}" does not have permission to manage employees. Only ${CAN_MANAGE_EMPLOYEES.join(', ')} roles can manage employees.`);
    }
    return true;
};

const getRolePermissions = (role) => {
    if (!role) {
        throw new Error('Role is required to retrieve permissions.');
    }

    const permissionMap = {
        [ROLES.EMPLOYEE]: {
            canManageEmployees: CAN_MANAGE_EMPLOYEES.includes(ROLES.EMPLOYEE),
            canViewEmployees: CAN_VIEW_EMPLOYEES.includes(ROLES.EMPLOYEE),
            canEditAttendance: CAN_EDIT_ATTENDANCE.includes(ROLES.EMPLOYEE),
            canManageLeave: CAN_MANAGE_LEAVE.includes(ROLES.EMPLOYEE),
            description: 'Base role - login only, views own attendance'
        },
        [ROLES.MANAGER]: {
            canManageEmployees: CAN_MANAGE_EMPLOYEES.includes(ROLES.MANAGER),
            canViewEmployees: CAN_VIEW_EMPLOYEES.includes(ROLES.MANAGER),
            canEditAttendance: CAN_EDIT_ATTENDANCE.includes(ROLES.MANAGER),
            canManageLeave: CAN_MANAGE_LEAVE.includes(ROLES.MANAGER),
            description: 'Manager - accept leave requests and resolve unauthorized leave'
        },
        [ROLES.ADMIN_MANAGER]: {
            canManageEmployees: CAN_MANAGE_EMPLOYEES.includes(ROLES.ADMIN_MANAGER),
            canViewEmployees: CAN_VIEW_EMPLOYEES.includes(ROLES.ADMIN_MANAGER),
            canEditAttendance: CAN_EDIT_ATTENDANCE.includes(ROLES.ADMIN_MANAGER),
            canManageLeave: CAN_MANAGE_LEAVE.includes(ROLES.ADMIN_MANAGER),
            description: 'Admin-Manager - edit/view attendance AND accept/resolve leave'
        },
        [ROLES.ADMIN]: {
            canManageEmployees: CAN_MANAGE_EMPLOYEES.includes(ROLES.ADMIN),
            canViewEmployees: CAN_VIEW_EMPLOYEES.includes(ROLES.ADMIN),
            canEditAttendance: CAN_EDIT_ATTENDANCE.includes(ROLES.ADMIN),
            canManageLeave: CAN_MANAGE_LEAVE.includes(ROLES.ADMIN),
            description: 'Admin - edit/view attendance'
        },
        [ROLES.SUPER_ADMIN]: {
            canManageEmployees: CAN_MANAGE_EMPLOYEES.includes(ROLES.SUPER_ADMIN),
            canViewEmployees: CAN_VIEW_EMPLOYEES.includes(ROLES.SUPER_ADMIN),
            canEditAttendance: CAN_EDIT_ATTENDANCE.includes(ROLES.SUPER_ADMIN),
            canManageLeave: CAN_MANAGE_LEAVE.includes(ROLES.SUPER_ADMIN),
            description: 'Super Admin - full employee CRUD + roster management'
        }
    };

    if (!permissionMap[role]) {
        throw new Error(`Invalid role: ${role}`);
    }

    return permissionMap[role];
};

const getEmployeesByRole = async (role) => {
    if (!role) {
        throw new Error('Role is required to filter employees.');
    }

    try {
        getRolePermissions(role);
    } catch (error) {
        throw error;
    }

    return Employee.findAll({
        where: {
            isActive: true,
            role
        },
        include: REPORTING_RELATIONSHIPS,
        order: [['lastName', 'ASC'], ['firstName', 'ASC']],
    });
};

const validateRoleAssignment = (requesterRole, targetRole) => {
    if (!requesterRole || !targetRole) {
        throw new Error('Both requesterRole and targetRole are required.');
    }

    try {
        getRolePermissions(targetRole);
    } catch (error) {
        throw error;
    }

    if (requesterRole !== ROLES.SUPER_ADMIN) {
        throw new Error(`Only ${ROLES.SUPER_ADMIN} can assign roles. User role "${requesterRole}" is not authorized.`);
    }

    return true;
};

const getEmployeesByPermissionLevel = async (permissionKey) => {
    if (!permissionKey) {
        throw new Error('Permission key is required.');
    }

    const allowedPermissions = ['canManageEmployees', 'canViewEmployees', 'canEditAttendance', 'canManageLeave'];
    if (!allowedPermissions.includes(permissionKey)) {
        throw new Error(`Invalid permission key: ${permissionKey}. Allowed: ${allowedPermissions.join(', ')}`);
    }

    const rolesWithPermission = Object.entries(ROLES).reduce((acc, [key, role]) => {
        const permissions = getRolePermissions(role);
        if (permissions[permissionKey] === true) {
            acc.push(role);
        }
        return acc;
    }, []);

    if (rolesWithPermission.length === 0) {
        return [];
    }

    return Employee.findAll({
        where: {
            isActive: true,
            role: { [Op.in]: rolesWithPermission }
        },
        include: REPORTING_RELATIONSHIPS,
        order: [['lastName', 'ASC'], ['firstName', 'ASC']],
    });
};

// resolveUnauthorisedAttendance - Convert an 'unauthorised' attendance into an approved leave
const resolveUnauthorisedAttendance = async (attendanceId, reviewerEmployeeId, reviewNotes = null) => {
    if (!attendanceId) throw new Error('attendanceId is required');
    if (!reviewerEmployeeId) throw new Error('reviewerEmployeeId is required');

    const LeaveRequest = require('../models/LeaveRequest');

    const reviewer = await Employee.findOne({ where: { employeeId: reviewerEmployeeId, isActive: true } });
    if (!reviewer) throw new Error(`Active reviewer with ID ${reviewerEmployeeId} not found.`);

    const reviewerPerms = getRolePermissions(reviewer.role);
    if (!reviewerPerms.canManageLeave) {
        throw new Error('Reviewer does not have permission to resolve unauthorised attendance.');
    }

    const attendance = await Attendance.findOne({ where: { attendanceId } });
    if (!attendance) throw new Error(`Attendance record with ID ${attendanceId} not found.`);

    if (attendance.status !== 'unauthorised') {
        throw new Error('Only attendance records with status "unauthorised" can be resolved to leave.');
    }

    const leave = await LeaveRequest.create({
        employeeId: attendance.employeeId,
        leaveType: 'other',
        startDate: attendance.date,
        endDate: attendance.date,
        totalDays: 1,
        reason: reviewNotes || 'Resolved unauthorised attendance to approved leave',
        status: 'approved',
        reviewedBy: reviewerEmployeeId,
        reviewComments: reviewNotes || null,
        reviewedAt: new Date(),
        hod: reviewer.hod ?? null,
        supervisor: reviewer.supervisor ?? null,
    });

    attendance.leaveRequestId = leave.id;
    attendance.status = 'leave';
    await attendance.save();

    return { attendance: await attendance.reload(), leave };
};

// Export all service functions
module.exports = {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    getAdministrativeEmployees,
    getManagers,
    searchEmployees,
    validateReportingRelationships,
    updateEmployee,
    updateEmployeeHierarchy,
    getDirectReports,
    deleteEmployeeById,
    getEmployeeAttendance,
    calculateAttendanceMetrics,
    getUnauthorisedLeaveDetails,
    getUnauthorisedLeaveRecords,
    getEmployeeLeaveHistory,
    validateUserCanManageEmployees,
    getRolePermissions,
    getEmployeesByRole,
    validateRoleAssignment,
    getEmployeesByPermissionLevel,
    resolveUnauthorisedAttendance,
};