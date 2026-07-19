// src/config/roles.js - single source of truth for role names and permission groups
// Route files import the *_ROLES groups below instead of hardcoding role strings,
// so the whole permission table stays readable in one place and can't drift
// between files (e.g. one route saying 'admin-manager', another 'adminManager').

const ROLES = {
    EMPLOYEE:       'employee',       // base role - login only, views own attendance (no admin endpoints)
    MANAGER:        'manager',        // accept leave requests + resolve unauthorized leave
    ADMIN_MANAGER:  'admin-manager',  // edit/view attendance AND accept/resolve leave
    ADMIN:          'admin',          // edit/view attendance
    SUPER_ADMIN:    'super-admin',    // full employee CRUD + roster management
};

// All role values the Employee.role ENUM accepts - kept as an array so
// Employee.js and employeeValidation.js both derive from this instead of
// maintaining their own separate lists.
const ALL_ROLES = Object.values(ROLES);

// ---- Permission groups, per the RBAC guide -------------------------------
// Super admin -> EMPLOYEE CRUD, ROSTER
const CAN_MANAGE_EMPLOYEES = [ROLES.SUPER_ADMIN];
const CAN_MANAGE_ROSTER    = [ROLES.SUPER_ADMIN];

// Admin -> can edit attendance, view attendance
// Admin-Manager -> can edit attendance, view attendance & accept/resolve leave
const CAN_EDIT_ATTENDANCE  = [ROLES.ADMIN, ROLES.ADMIN_MANAGER];
const CAN_VIEW_ATTENDANCE  = [ROLES.ADMIN, ROLES.ADMIN_MANAGER];

// Manager -> accept leave req and resolve unauthorized leave
// Admin-Manager -> shares the same leave permissions as Manager
// NOTE: no leave-request endpoints exist in the codebase yet (no model,
// controller, or route). This group is defined now so that whoever builds
// the leave-request subtask wires straight into this table instead of
// inventing new role strings. Nothing currently imports this constant.
const CAN_MANAGE_LEAVE     = [ROLES.MANAGER, ROLES.ADMIN_MANAGER];

module.exports = {
    ROLES,
    ALL_ROLES,
    CAN_MANAGE_EMPLOYEES,
    CAN_MANAGE_ROSTER,
    CAN_EDIT_ATTENDANCE,
    CAN_VIEW_ATTENDANCE,
    CAN_MANAGE_LEAVE,
};