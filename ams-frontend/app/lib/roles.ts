// Mirrors ams-backend/config/roles.js — keep these permission groups in sync.
import type { AuthUser, EmployeeRole } from "./api";

export const ROLES = {
  EMPLOYEE: "employee",
  MANAGER: "manager",
  ADMIN_MANAGER: "admin-manager",
  ADMIN: "admin",
  SUPER_ADMIN: "super-admin",
} as const satisfies Record<string, EmployeeRole>;

const CAN_MANAGE_EMPLOYEES: EmployeeRole[] = [ROLES.SUPER_ADMIN];
const CAN_MANAGE_ROSTER: EmployeeRole[] = [ROLES.SUPER_ADMIN];
const CAN_VIEW_EMPLOYEES: EmployeeRole[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.ADMIN_MANAGER,
];
const CAN_EDIT_ATTENDANCE: EmployeeRole[] = [ROLES.ADMIN, ROLES.ADMIN_MANAGER];
const CAN_VIEW_ATTENDANCE: EmployeeRole[] = [ROLES.ADMIN, ROLES.ADMIN_MANAGER];

function hasRole(role: EmployeeRole | undefined, allowed: EmployeeRole[]) {
  return !!role && allowed.includes(role);
}

export function canManageEmployees(role?: EmployeeRole) {
  return hasRole(role, CAN_MANAGE_EMPLOYEES);
}

export function canManageRoster(role?: EmployeeRole) {
  return hasRole(role, CAN_MANAGE_ROSTER);
}

export function canViewEmployees(role?: EmployeeRole) {
  return hasRole(role, CAN_VIEW_EMPLOYEES);
}

export function canEditAttendance(role?: EmployeeRole) {
  return hasRole(role, CAN_EDIT_ATTENDANCE);
}

export function canViewAttendance(role?: EmployeeRole) {
  return hasRole(role, CAN_VIEW_ATTENDANCE);
}

/** Post-login / AuthGuard fallback destination for a role. */
export function getHomePath(user: Pick<AuthUser, "role" | "employeeId">): string {
  if (canViewEmployees(user.role)) return "/employees";
  if (canViewAttendance(user.role)) return "/attendance";
  if (canManageRoster(user.role)) return "/rosters";
  return `/employees/attendance/${encodeURIComponent(user.employeeId)}`;
}

/**
 * Whether the current user may open a given app path.
 * Own attendance pages are allowed for any authenticated user (employee/manager home).
 */
export function canAccessPath(
  pathname: string,
  user: Pick<AuthUser, "role" | "employeeId">,
): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/access-denied") return true;

  if (pathname === "/employees" || pathname.startsWith("/employees?")) {
    return canViewEmployees(user.role);
  }

  const ownAttendancePrefix = `/employees/attendance/${user.employeeId}`;
  if (
    pathname === ownAttendancePrefix ||
    pathname.startsWith(`${ownAttendancePrefix}?`) ||
    pathname.startsWith(`${ownAttendancePrefix}/`)
  ) {
    return true;
  }

  if (pathname.startsWith("/employees/attendance/")) {
    return canViewAttendance(user.role);
  }

  if (pathname === "/attendance" || pathname.startsWith("/attendance/")) {
    return canViewAttendance(user.role);
  }

  if (pathname === "/rosters" || pathname.startsWith("/rosters/")) {
    return canManageRoster(user.role);
  }

  if (pathname.startsWith("/mock/punch")) {
    return canEditAttendance(user.role);
  }

  // Unknown authenticated routes — allow and let the page/API decide.
  return true;
}

export type NavItem = { label: string; path: string };

export function getNavItems(role?: EmployeeRole): NavItem[] {
  const items: NavItem[] = [];
  if (canViewEmployees(role)) items.push({ label: "Employees", path: "/employees" });
  if (canViewAttendance(role)) items.push({ label: "Attendance", path: "/attendance" });
  if (canManageRoster(role)) items.push({ label: "Rosters", path: "/rosters" });
  return items;
}
