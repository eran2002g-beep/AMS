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
/** Admin-tier roles that may open the Admin Panel hub. */
const CAN_ACCESS_ADMIN_PANEL: EmployeeRole[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.ADMIN_MANAGER,
];

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

export function canAccessAdminPanel(role?: EmployeeRole) {
  return hasRole(role, CAN_ACCESS_ADMIN_PANEL);
}

/** Post-login / AuthGuard fallback — everyone lands on the shared dashboard. */
export function getHomePath(_user: Pick<AuthUser, "role" | "employeeId">): string {
  return "/dashboard";
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
  if (pathname === "/change-password" || pathname.startsWith("/change-password?")) {
    return true;
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard?")) {
    return true;
  }

  // Own profile — any authenticated user.
  if (pathname === "/profile" || pathname.startsWith("/profile?")) {
    return true;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return canAccessAdminPanel(user.role);
  }

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

  // Unknown path — not a known app route (Next.js will render not-found).
  return false;
}

/**
 * True for real AMS pages (including those the user may not be allowed to open).
 * Used so AuthGuard does not hijack missing URLs with a login/access dialog.
 */
export function isKnownAppPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/access-denied") return true;
  if (pathname === "/change-password" || pathname.startsWith("/change-password/")) return true;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/employees" || pathname.startsWith("/employees/")) return true;
  if (pathname === "/attendance" || pathname.startsWith("/attendance/")) return true;
  if (pathname === "/rosters" || pathname.startsWith("/rosters/")) return true;
  if (pathname.startsWith("/mock/punch")) return true;
  return false;
}

export type NavItem = { label: string; path: string };

/**
 * Main hamburger menu — shared employee items only.
 * Admin tools (Employees / Attendance / Rosters) live inside the Admin Panel hub,
 * not in this global menu.
 */
export function getNavItems(user?: Pick<AuthUser, "role" | "employeeId"> | null): NavItem[] {
  const items: NavItem[] = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "My Profile", path: "/profile" },
  ];

  // Every logged-in user can open their own attendance.
  if (user?.employeeId) {
    items.push({
      label: "My Attendance",
      path: `/employees/attendance/${encodeURIComponent(user.employeeId)}`,
    });
  }

  // Admins get a single entry point — tools appear after opening Admin Panel.
  if (canAccessAdminPanel(user?.role)) {
    items.push({ label: "Admin Panel", path: "/admin" });
  }

  return items;
}
