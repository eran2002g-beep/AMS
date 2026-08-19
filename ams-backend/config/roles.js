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
const CAN_VIEW_EMPLOYEES   = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMIN_MANAGER];

// Admin -> can edit attendance, view attendance
// Admin-Manager -> can edit attendance, view attendance & accept/resolve leave
const CAN_EDIT_ATTENDANCE  = [ROLES.ADMIN, ROLES.ADMIN_MANAGER];
const CAN_VIEW_ATTENDANCE  = [ROLES.ADMIN, ROLES.ADMIN_MANAGER];

// Manager -> accept leave req and resolve unauthorized leave
// Admin-Manager -> shares the same leave permissions as Manager
// Used by leaveRequestRoute.js to gate the review/list endpoints. Submitting
// a leave request itself is self-service and open to any authenticated role.
const CAN_MANAGE_LEAVE     = [ROLES.MANAGER, ROLES.ADMIN_MANAGER];

// Org-wide leave list (not limited to assigned HOD/supervisor).
const CAN_VIEW_ALL_LEAVE   = [ROLES.ADMIN, ROLES.ADMIN_MANAGER, ROLES.SUPER_ADMIN];
// Final accept/reject of any in-flight leave request (skips remaining chain).
const CAN_REVIEW_ANY_LEAVE = [ROLES.ADMIN, ROLES.SUPER_ADMIN];

module.exports = {
    ROLES,
    ALL_ROLES,
    CAN_MANAGE_EMPLOYEES,
    CAN_MANAGE_ROSTER,
    CAN_VIEW_EMPLOYEES,
    CAN_EDIT_ATTENDANCE,
    CAN_VIEW_ATTENDANCE,
    CAN_MANAGE_LEAVE,
    CAN_VIEW_ALL_LEAVE,
    CAN_REVIEW_ANY_LEAVE,
};