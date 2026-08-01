// src/services/employeeService.js - handles business logic for employee operations
// sits between the controller and the model - controller handles HTTP, service handles logic

// Import the Employee and Attendance models to interact with the database
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

// Active managers eligible for supervisor / HOD assignment
const getManagers = async () => Employee.findAll({
    where: {
        isActive: true,
        role: { [Op.in]: [ROLES.MANAGER, ROLES.ADMIN_MANAGER] },
    },
    attributes: ['id', 'employeeId', 'firstName', 'lastName', 'email', 'department', 'role'],
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
        // Admin-set / reset password is temporary until the employee changes it.
        updateFields.mustChangePassword = true;
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

// -----------------------------------------------------------------------
// ROLE MANAGEMENT - Methods to manage roles and permissions
// -----------------------------------------------------------------------

/**
 * validateUserCanManageEmployees - Verify if a user has permission to manage employees
 * @param {string} userRole - The role of the user attempting to manage employees
 * @returns {boolean} - True if user can manage employees, false otherwise
 */
const validateUserCanManageEmployees = (userRole) => {
    if (!userRole || !CAN_MANAGE_EMPLOYEES.includes(userRole)) {
        throw new Error(`User role "${userRole}" does not have permission to manage employees. Only ${CAN_MANAGE_EMPLOYEES.join(', ')} roles can manage employees.`);
    }
    return true;
};

/**
 * getRolePermissions - Get permission details for a specific role
 * @param {string} role - The role to get permissions for
 * @returns {object} - Object containing permission mappings for the role
 */
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

/**
 * getEmployeesByRole - Retrieve all active employees with a specific role
 * @param {string} role - The role to filter by
 * @returns {Promise<Array>} - Array of employees with the specified role
 */
const getEmployeesByRole = async (role) => {
    if (!role) {
        throw new Error('Role is required to filter employees.');
    }

    try {
        getRolePermissions(role); // Validate role exists
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

/**
 * validateRoleAssignment - Verify if a requester can assign a role to an employee
 * Only super-admin can assign roles (especially admin roles)
 * @param {string} requesterRole - The role of the person making the assignment
 * @param {string} targetRole - The role being assigned
 * @returns {boolean} - True if assignment is allowed
 */
const validateRoleAssignment = (requesterRole, targetRole) => {
    // Validate inputs
    if (!requesterRole || !targetRole) {
        throw new Error('Both requesterRole and targetRole are required.');
    }

    try {
        getRolePermissions(targetRole); // Validate target role exists
    } catch (error) {
        throw error;
    }

    // Only super-admin can assign roles
    if (requesterRole !== ROLES.SUPER_ADMIN) {
        throw new Error(`Only ${ROLES.SUPER_ADMIN} can assign roles. User role "${requesterRole}" is not authorized.`);
    }

    return true;
};

/**
 * getEmployeesByPermissionLevel - Get employees that have a specific permission
 * @param {string} permissionKey - The permission key (e.g., 'canManageEmployees')
 * @returns {Promise<Array>} - Array of employees with the specified permission
 */
const getEmployeesByPermissionLevel = async (permissionKey) => {
    if (!permissionKey) {
        throw new Error('Permission key is required.');
    }

    const allowedPermissions = ['canManageEmployees', 'canViewEmployees', 'canEditAttendance', 'canManageLeave'];
    if (!allowedPermissions.includes(permissionKey)) {
        throw new Error(`Invalid permission key: ${permissionKey}. Allowed: ${allowedPermissions.join(', ')}`);
    }

    // Get roles that have this permission
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

// -----------------------------------------------------------------------
// resolveUnauthorisedAttendance - Convert an 'unauthorised' attendance into an approved leave
// reviewerEmployeeId: public-facing employeeId of the manager/admin performing the resolution
// reviewNotes: optional notes about why the unauthorised was resolved to leave
// -----------------------------------------------------------------------
const resolveUnauthorisedAttendance = async (attendanceId, reviewerEmployeeId, reviewNotes = null) => {
    if (!attendanceId) throw new Error('attendanceId is required');
    if (!reviewerEmployeeId) throw new Error('reviewerEmployeeId is required');

    // Lazy require to avoid circular deps in some import orders
    const Attendance = require('../models/Attendance');
    const LeaveRequest = require('../models/LeaveRequest');

    // Fetch reviewer and validate permission
    const reviewer = await Employee.findOne({ where: { employeeId: reviewerEmployeeId, isActive: true } });
    if (!reviewer) throw new Error(`Active reviewer with ID ${reviewerEmployeeId} not found.`);

    const reviewerPerms = getRolePermissions(reviewer.role);
    if (!reviewerPerms.canManageLeave) {
        throw new Error('Reviewer does not have permission to resolve unauthorised attendance.');
    }

    // Load attendance record
    const attendance = await Attendance.findOne({ where: { attendanceId } });
    if (!attendance) throw new Error(`Attendance record with ID ${attendanceId} not found.`);

    if (attendance.status !== 'unauthorised') {
        throw new Error('Only attendance records with status "unauthorised" can be resolved to leave.');
    }

    // Create an approved leave request covering this attendance day
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

    // Update attendance to link leave and set status to 'leave'
    attendance.leaveRequestId = leave.id;
    attendance.status = 'leave';
    await attendance.save();

    return { attendance: await attendance.reload(), leave };
};

// Export all service functions - add new ones here as we build more features
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
    validateUserCanManageEmployees,
    getRolePermissions,
    getEmployeesByRole,
    validateRoleAssignment,
    getEmployeesByPermissionLevel,
    resolveUnauthorisedAttendance,
};