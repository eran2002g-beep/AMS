import axios, { type InternalAxiosRequestConfig } from "axios";

// Empty base URL uses Next.js rewrites (same origin) to avoid CORS issues.
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

// Storage keys are also used by app/lib/auth.tsx — kept here so this module
// stays the single source of truth for how the token is persisted.
export const TOKEN_STORAGE_KEY = "ams_token";
export const USER_STORAGE_KEY = "ams_user";
export const AUTH_LOGOUT_EVENT = "ams:logout";
export const ACCESS_DENIED_EVENT = "ams:accessDenied";

/** Why the access-denied dialog opened — drives logout vs stay-signed-in. */
export type AccessDeniedReason = "unauthenticated" | "forbidden";

function clearStoredSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

// Attach "Authorization: Bearer <token>" to every outgoing request when a
// session exists. authMiddleware.js on the backend rejects requests without it.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// On a protected-request 401, rotate the refresh cookie once and retry every
// request that was waiting for it. Log out only when refreshing also fails.
type RetryableRequest = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshRequest: Promise<SessionResponse> | null = null;
let redirectingToLogin = false;

function refreshSession() {
  refreshRequest ??= axios
    .post<SessionResponse>(`${apiBaseUrl}/auth/refresh`, undefined, { withCredentials: true })
    .then(({ data }) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      return data;
    })
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === "undefined" || !axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    // 403 is handled by the calling page via getErrorMessage — do not force a
    // global dialog/logout (permission errors are not session failures).
    if (error.response?.status === 403) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const original = error.config as RetryableRequest | undefined;
    const url = original?.url ?? "";
    const isAuthEndpoint = ["/auth/login", "/auth/refresh", "/auth/logout"].some((path) =>
      url.includes(path),
    );

    if (!original || original._retry || isAuthEndpoint) return Promise.reject(error);
    original._retry = true;

    try {
      const session = await refreshSession();
      original.headers.Authorization = `Bearer ${session.token}`;
      return api.request(original);
    } catch {
      clearStoredSession();
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
      if (!redirectingToLogin) {
        redirectingToLogin = true;
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      }
      return Promise.reject(error);
    }
  },
);

type ApiErrorBody = {
  error?: string;
  message?: string;
  success?: boolean;
  status?: string | number;
};

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return "Unable to reach the server. Check your connection and try again.";
    }

    const status = err.response.status;
    const data = err.response.data as ApiErrorBody | undefined;
    const serverMessage = data?.message || data?.error;

    if (status === 404) {
      return serverMessage && !/^Route not found/i.test(serverMessage)
        ? serverMessage
        : "The requested resource was not found.";
    }
    if (status === 403) {
      return serverMessage ?? "You do not have permission to perform this action.";
    }
    if (status === 401) {
      return serverMessage ?? "Your session has expired. Please sign in again.";
    }
    if (status >= 500) {
      return serverMessage ?? "Something went wrong on the server. Please try again later.";
    }

    if (serverMessage) return serverMessage;
    return err.message || "Something went wrong";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

/** True when the API rejected the request for insufficient permissions (403). */
export function isForbiddenError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 403;
}

/** True when the API responded with not found (404). */
export function isNotFoundError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

// ─────────────────────────────────── Types ───────────────────────────────────

export type EmployeeRole =
  | "employee"
  | "manager"
  | "admin-manager"
  | "admin"
  | "super-admin";

export const EMPLOYEE_ROLES: EmployeeRole[] = [
  "employee",
  "manager",
  "admin-manager",
  "admin",
  "super-admin",
];

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  employee: "Employee",
  manager: "Manager",
  "admin-manager": "Admin Manager",
  admin: "Admin",
  "super-admin": "Super Admin",
};

export type ReportingEmployee = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  role: EmployeeRole;
};

export type Employee = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: EmployeeRole;
  roster: boolean;
  mustChangePassword?: boolean;
  hod: number | null;
  supervisor: number | null;
  hodEmployee?: ReportingEmployee | null;
  supervisorEmployee?: ReportingEmployee | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type EmployeeFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  roster: boolean;
  role?: EmployeeRole;
  hod?: number | null;
  supervisor?: number | null;
  /** Required when creating; optional when editing (leave blank to keep current). */
  password?: string;
};

export type EmployeeUpdatePayload = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: EmployeeRole;
  roster: boolean;
  hod: number | null;
  supervisor: number | null;
  password: string;
}>;

export function buildEmployeeUpdatePayload(
  original: Employee,
  form: EmployeeFormData,
): EmployeeUpdatePayload {
  const changes: EmployeeUpdatePayload = {};
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const email = form.email.trim();
  const phone = form.phone.trim();
  const department = form.department.trim();

  if (firstName !== original.firstName) changes.firstName = firstName;
  if (lastName !== original.lastName) changes.lastName = lastName;
  if (email !== original.email) changes.email = email;
  if (phone !== (original.phone ?? "")) changes.phone = phone || null;
  if (department !== (original.department ?? "")) changes.department = department || null;
  if (form.roster !== original.roster) changes.roster = form.roster;
  if (form.role && form.role !== original.role) changes.role = form.role;
  if (form.hod !== undefined && form.hod !== (original.hod ?? null)) changes.hod = form.hod;
  if (form.supervisor !== undefined && form.supervisor !== (original.supervisor ?? null)) {
    changes.supervisor = form.supervisor;
  }
  if (form.password) changes.password = form.password;

  return changes;
}

export type RosterEntry = {
  id: number;
  rosterId: number;
  employeeId: string;
  date: string;
  month: number;
  year: number;
  shiftStart: string;
  shiftEnd: string;
  createdAt: string;
  updatedAt: string;
};

export type RosterViewFilters = {
  date?: string;
  year?: number;
  month?: number;
};

export type RosterViewResponse = {
  success: boolean;
  count: number;
  filters: RosterViewFilters;
  data: RosterEntry[];
};

export type RosterUploadResponse = {
  status: "success";
  rosterId: number;
  totalInserted: number;
  insertedRows: RosterEntry[];
};

export type RosterDeleteResponse = {
  success: boolean;
  message: string;
  deletedCount?: number;
  deletedRosters?: RosterEntry[];
};

export type EmployeeListParams = {
  q?: string;
  department?: string;
  role?: EmployeeRole;
  page?: number;
  limit?: number;
};

export type EmployeeListMeta = {
  total: number;
  page: number;
  limit: number;
};

export type EmployeeListResponse = {
  success: boolean;
  meta: EmployeeListMeta;
  count: number;
  data: Employee[];
};

export type AttendanceLog = {
  id: number;
  logId: string;
  employeeId: string;
  punchDate: string;
  punchTime: string;
  punchType: "in" | "out" | null;
  attendanceStatus: string;
  source: "iot" | "manual";
  rosterId: number | null;
  notes: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceLogCreatePayload = {
  employeeId: string;
  punchDate: string;
  punchTime: string;
  punchType?: "in" | "out";
  source?: "iot" | "manual";
};

// ─────────────────────────────────── Auth types ───────────────────────────────────

// Mirrors the payload authService.js signs into the JWT (id/employeeId/email/role),
// minus the fields the frontend doesn't need to hold onto.
export type AuthUser = {
  employeeId: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  mustChangePassword: boolean;
};

// Shape of the JSON body returned by POST /auth/login (see authController.js).
// message + token + role + employeeId + firstName + lastName are spread from authService.login().
export type SessionResponse = {
  message?: string;
  token: string;
  sessionExpiresAt: string;
  role: EmployeeRole;
  employeeId: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
};

export type LogoutResponse = {
  message: string;
};

export type ChangePasswordResponse = {
  success: boolean;
  message: string;
  mustChangePassword: boolean;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  token?: string;
};

// ─────────────────────────────────── Auth API ───────────────────────────────────

export const authApi = {
  // POST /auth/login — public route, no token required.
  // Throws (via axios) on 401 with the generic "Invalid email or password"
  // message the backend intentionally uses for both bad email and bad password (AC2).
  async login(email: string, password: string) {
    const response = await api.post<SessionResponse>("/auth/login", { email, password });
    return response.data;
  },

  async refresh() {
    return refreshSession();
  },

  // POST /auth/logout revokes the refresh session and clears its HttpOnly cookie.
  async logout() {
    const response = await api.post<LogoutResponse>("/auth/logout");
    return response.data;
  },

  // GET /auth/me — returns the authenticated employee's full profile
  // (see authController.getMe). Used by the Profile page.
  async me() {
    const response = await api.get<{ success: boolean; data: Employee }>("/auth/me");
    return response.data.data;
  },

  // POST /auth/change-password — replace temporary / current password.
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await api.post<ChangePasswordResponse>("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

// ─────────────────────────────────── Employee API ───────────────────────────────────

export type ManagersListResponse = {
  success: boolean;
  count: number;
  data: ReportingEmployee[];
};

export const employeeApi = {
  async list(params: EmployeeListParams = {}) {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    };
    if (params.q) query.q = params.q;
    if (params.department) query.department = params.department;
    if (params.role) query.role = params.role;

    const response = await api.get<EmployeeListResponse>("/employee", { params: query });
    const body = response.data;
    if (!body.success) {
      throw new Error("Failed to load employees");
    }
    return { employees: body.data, meta: body.meta };
  },

  async listManagers() {
    const response = await api.get<ManagersListResponse>("/employee/managers");
    const body = response.data;
    if (!body.success) {
      throw new Error("Failed to load managers");
    }
    return body.data;
  },

  async create(payload: EmployeeFormData) {
    const body = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: payload.password,
      roster: payload.roster,
      ...(payload.phone ? { phone: payload.phone } : {}),
      ...(payload.department ? { department: payload.department } : {}),
      ...(payload.role ? { role: payload.role } : {}),
      ...(payload.hod !== undefined ? { hod: payload.hod } : {}),
      ...(payload.supervisor !== undefined ? { supervisor: payload.supervisor } : {}),
    };
    const response = await api.post<Employee>("/employee/create", body);
    return response.data;
  },

  async update(employeeId: string, changes: EmployeeUpdatePayload) {
    const response = await api.patch<{ success: boolean; message: string; data: Employee }>(
      `/employee/${employeeId}`,
      changes,
    );
    return response.data.data;
  },

  async delete(employeeId: string) {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/employee/${employeeId}`,
    );
    return response.data;
  },
};

// ─────────────────────────────────── Roster API ───────────────────────────────────

export const rosterApi = {
  async view(filters: RosterViewFilters) {
    const params: Record<string, string | number> = {};
    if (filters.date) {
      params.date = filters.date;
    } else {
      if (filters.year != null) params.year = filters.year;
      if (filters.month != null) params.month = filters.month;
    }

    const response = await api.get<RosterViewResponse>("/roster/view", { params });
    return response.data;
  },

  async upload(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<RosterUploadResponse>("/roster/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data;
  },

  async deleteByMonth(month: number, year: number) {
    const response = await api.delete<RosterDeleteResponse>("/roster/by-month", {
      params: { month, year },
    });
    const body = response.data;
    if (!body.success) {
      throw new Error(body.message || "Delete failed");
    }
    return body;
  },

  async deleteByDate(date: string) {
    const response = await api.delete<RosterDeleteResponse>("/roster/by-date", {
      params: { date },
    });
    const body = response.data;
    if (!body.success) {
      throw new Error(body.message || "Delete failed");
    }
    return body;
  },
};

// ─────────────────────────────────── Attendance Log API ───────────────────────────────────

export const attendanceLogApi = {
  async create(payload: AttendanceLogCreatePayload) {
    const response = await api.post<AttendanceLog>("/attendance-log/create", payload);
    return response.data;
  },
};

// ─────────────────────────────────── Attendance API ───────────────────────────────────

export type AttendanceDiscrepancy = {
  employeeId: string;
  date: string;
  status: string;
  lateMinutes: number;
  lateCoverMinutes: number;
};

export type RosterSkippedEntry = {
  employeeId: string;
  date: string;
  reason: string;
};

export type AttendanceProcessResponse = {
  status: "success";
  processedCount: number;
  skippedCount?: number;
  removedRecordCount?: number;
  discrepancyCount: number;
  discrepancies: AttendanceDiscrepancy[];
  skipped?: RosterSkippedEntry[];
  schedule: {
    shiftStart?: string;
    shiftEnd?: string;
    rosterId?: number;
    date?: string;
    month?: number;
    year?: number;
    startDate?: string;
    endDate?: string;
  };
};

export type AttendanceProcessPeriod = {
  date?: string;
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
};

export type AttendanceRecord = {
  id: number;
  attendanceId: string;
  employeeId: string;
  date: string;
  month: number;
  year: number;
  clockIn: string | null;
  clockOut: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: "present" | "absent" | "leave" | "unauthorised" | "holiday";
  lateMinutes: number;
  lateCoverMinutes: number;
  dayType?: "full_day" | "short_leave" | "half_day" | null;
  rosterId: number | null;
  attendanceLogId: number | null;
  leaveRequestId: number | null;
  /** True when effective leave covers this day (approved or auto-accepted). */
  reqLeave?: boolean;
  notes: string | null;
  isManual: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type EmployeeAttendanceFilters = {
  month?: number;
  year?: number;
  status?: AttendanceRecord["status"];
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

export type EmployeeAttendanceResponse = {
  status: "success";
  count: number;
  totalCount: number;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  employee: Pick<Employee, "employeeId" | "firstName" | "lastName" | "email" | "department" | "role" | "roster" | "isActive">;
  filters: {
    employeeId: string;
    month?: number;
    year?: number;
    status?: AttendanceRecord["status"];
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  };
  data: AttendanceRecord[];
};

export type AllAttendanceResponse = {
  status: "success";
  count: number;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: {
    q?: string;
    employeeId?: string;
    month?: number;
    year?: number;
    status?: AttendanceRecord["status"];
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  };
  data: AttendanceRecord[];
};

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 60) + minutes;
}

export function getArrivalLateMinutes(
  record: Pick<AttendanceRecord, "lateMinutes" | "clockIn" | "scheduledStart">,
): number {
  if (record.clockIn && record.scheduledStart) {
    return Math.max(0, timeToMinutes(record.clockIn) - timeToMinutes(record.scheduledStart));
  }
  return record.lateMinutes ?? 0;
}

const MINUTES_PER_DAY = 24 * 60;

function normalizeOnShiftTimeline(
  scheduledStart: string,
  scheduledEnd: string,
  clockIn: string,
  clockOut: string,
) {
  const startMins = timeToMinutes(scheduledStart);
  let endMins = timeToMinutes(scheduledEnd);
  const inMins = timeToMinutes(clockIn);
  let outMins = timeToMinutes(clockOut);

  if (endMins <= startMins) endMins += MINUTES_PER_DAY;
  if (outMins < inMins) outMins += MINUTES_PER_DAY;

  return { startMins, endMins, inMins, outMins };
}

export function getLateCoverMinutes(
  record: Pick<
    AttendanceRecord,
    "lateCoverMinutes" | "clockIn" | "clockOut" | "scheduledStart" | "scheduledEnd" | "dayType"
  >,
): number {
  if (record.dayType) {
    return record.lateCoverMinutes ?? 0;
  }

  if (record.clockIn && record.clockOut && record.scheduledStart && record.scheduledEnd) {
    const { startMins, endMins, inMins, outMins } = normalizeOnShiftTimeline(
      record.scheduledStart,
      record.scheduledEnd,
      record.clockIn,
      record.clockOut,
    );
    const arrivalLateMinutes = Math.max(0, inMins - startMins);
    const requiredClockOutMins = endMins + arrivalLateMinutes;
    return Math.max(0, requiredClockOutMins - outMins);
  }
  return record.lateCoverMinutes ?? 0;
}

export function formatLateMinutes(value: number): string {
  return value > 0 ? String(value) : "—";
}

export function formatDayType(dayType: AttendanceRecord["dayType"]): string {
  switch (dayType) {
    case "full_day":
      return "Full day";
    case "short_leave":
      return "Short leave";
    case "half_day":
      return "Half day";
    default:
      return "—";
  }
}

export type DayTypeChipSx = { backgroundColor: string; color: string };

export function getDayTypeChipSx(dayType: AttendanceRecord["dayType"]): DayTypeChipSx {
  switch (dayType) {
    case "full_day":
      return { backgroundColor: "#dcfce7", color: "#15803d" };
    case "short_leave":
      return { backgroundColor: "#e0f2fe", color: "#0369a1" };
    case "half_day":
      return { backgroundColor: "#fef3c7", color: "#b45309" };
    default:
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
  }
}

export type AttendanceDisplayStatus = {
  label: string;
  chipSx: { backgroundColor: string; color: string };
  detail?: string;
};

export function getAttendanceDisplayStatus(
  record: Pick<
    AttendanceRecord,
    "status" | "lateMinutes" | "lateCoverMinutes" | "clockIn" | "clockOut" | "scheduledStart" | "scheduledEnd" | "dayType"
  >,
): AttendanceDisplayStatus {
  const lateMinutes = getArrivalLateMinutes(record);
  const coverOwed = getLateCoverMinutes(record);
  const dayTypeLabel = formatDayType(record.dayType);

  if (record.status === "present" && lateMinutes > 0 && coverOwed > 0) {
    return {
      label: "Late · Not covered",
      chipSx: { backgroundColor: "#ffedd5", color: "#c2410c" },
      detail: record.dayType
        ? `${dayTypeLabel} · ${lateMinutes} min late, ${coverOwed} min cover still owed`
        : `${lateMinutes} min late, ${coverOwed} min cover still owed`,
    };
  }

  if (record.status === "present" && lateMinutes > 0 && coverOwed === 0) {
    return {
      label: record.dayType ? `${dayTypeLabel} · Late` : "Late · Covered",
      chipSx: record.dayType
        ? getDayTypeChipSx(record.dayType)
        : { backgroundColor: "#dcfce7", color: "#15803d" },
      detail: record.dayType
        ? `${lateMinutes} min late, minimum hours met for ${dayTypeLabel.toLowerCase()}`
        : `${lateMinutes} min late, cover time made up`,
    };
  }

  if (record.status === "present" && record.dayType) {
    return {
      label: dayTypeLabel,
      chipSx: getDayTypeChipSx(record.dayType),
    };
  }

  switch (record.status) {
    case "present":
      return { label: "Present", chipSx: { backgroundColor: "#dcfce7", color: "#15803d" } };
    case "absent":
      return { label: "Absent", chipSx: { backgroundColor: "#fee2e2", color: "#b91c1c" } };
    case "leave":
      return { label: "Leave", chipSx: { backgroundColor: "#e0f2fe", color: "#0369a1" } };
    case "unauthorised":
      return { label: "Unauthorised", chipSx: { backgroundColor: "#fef3c7", color: "#b45309" } };
    case "holiday":
      return { label: "Holiday", chipSx: { backgroundColor: "#f3e8ff", color: "#7e22ce" } };
    default:
      return { label: record.status, chipSx: { backgroundColor: "#f1f5f9", color: "#64748b" } };
  }
}

export function getRequiredClockOut(
  record: Pick<AttendanceRecord, "scheduledEnd" | "scheduledStart" | "clockIn" | "lateMinutes">,
): string | null {
  const lateMinutes = getArrivalLateMinutes(record);
  if (!record.scheduledEnd || lateMinutes <= 0) return null;

  const [hours, minutes] = record.scheduledEnd.split(":").map(Number);
  const totalMinutes = (hours * 60) + minutes + lateMinutes;
  const normalized = totalMinutes % MINUTES_PER_DAY;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type AttendanceCreatePayload = {
  employeeId: string;
  date: string;
  status: AttendanceRecord["status"];
  clockIn?: string;
  clockOut?: string;
  lateCoverMinutes?: number;
  notes?: string;
};

export type AttendanceCreateResponse = {
  status: "success";
  data: AttendanceRecord;
};

export type AttendanceDeleteResponse = {
  status: "success";
  message: string;
  deletedId: string;
};

export type AttendanceUpdatePayload = Partial<{
  date: string;
  status: AttendanceRecord["status"];
  clockIn: string | null;
  clockOut: string | null;
  lateMinutes: number;
  lateCoverMinutes: number;
  dayType: "full_day" | "short_leave" | "half_day" | null;
  isManual: boolean;
  notes: string | null;
}>;

export type AttendanceUpdateResponse = {
  status: "success";
  message: string;
  data: AttendanceRecord;
};

function normalizeTimeForCompare(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export function buildAttendanceUpdatePayload(
  original: AttendanceRecord,
  form: {
    date: string;
    status: AttendanceRecord["status"];
    clockIn: string;
    clockOut: string;
    lateMinutes: string;
    lateCoverMinutes: string;
    dayType: "" | "full_day" | "short_leave" | "half_day";
    isManual: boolean;
    notes: string;
  },
): AttendanceUpdatePayload {
  const changes: AttendanceUpdatePayload = {};

  if (form.date !== original.date) changes.date = form.date;
  if (form.status !== original.status) changes.status = form.status;

  const origClockIn = normalizeTimeForCompare(original.clockIn);
  const origClockOut = normalizeTimeForCompare(original.clockOut);
  if (form.clockIn !== origClockIn) {
    changes.clockIn = form.clockIn || null;
  }
  if (form.clockOut !== origClockOut) {
    changes.clockOut = form.clockOut || null;
  }

  const arrivalLate = form.lateMinutes ? Number(form.lateMinutes) : 0;
  if (arrivalLate !== (original.lateMinutes ?? 0)) {
    changes.lateMinutes = arrivalLate;
  }

  const coverOwed = form.lateCoverMinutes ? Number(form.lateCoverMinutes) : 0;
  if (coverOwed !== original.lateCoverMinutes) {
    changes.lateCoverMinutes = coverOwed;
  }

  const nextDayType = form.dayType || null;
  const origDayType = original.dayType ?? null;
  if (nextDayType !== origDayType) {
    changes.dayType = nextDayType;
  }

  if (form.isManual !== !!original.isManual) {
    changes.isManual = form.isManual;
  }

  const notes = form.notes.trim();
  const origNotes = original.notes ?? "";
  if (notes !== origNotes) {
    changes.notes = notes || null;
  }

  return changes;
}

export const attendanceApi = {
  async processToday() {
    const response = await api.post<AttendanceProcessResponse>("/attendance/process", {
      date: getTodayDateString(),
    });
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Attendance processing failed");
    }
    return body;
  },

  async processRoster(period: AttendanceProcessPeriod) {
    const response = await api.post<AttendanceProcessResponse>(
      "/attendance/process-roster",
      period,
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Roster attendance processing failed");
    }
    return body;
  },

  async getEmployeeAttendance(employeeId: string, filters: EmployeeAttendanceFilters = {}) {
    const params: Record<string, string | number> = {};

    if (filters.month != null) params.month = filters.month;
    if (filters.year != null) params.year = filters.year;
    if (filters.status) params.status = filters.status;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.page != null) params.page = filters.page;
    if (filters.limit != null) params.limit = filters.limit;

    const response = await api.get<EmployeeAttendanceResponse>(`/attendance/employee/${employeeId}`, {
      params,
    });

    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to load employee attendance records");
    }

    return body;
  },

  async getAllAttendance(filters: EmployeeAttendanceFilters & { q?: string; employeeId?: string } = {}) {
    const params: Record<string, string | number> = {};

    if (filters.q) params.q = filters.q;
    if (filters.employeeId) params.employeeId = filters.employeeId;
    if (filters.month != null) params.month = filters.month;
    if (filters.year != null) params.year = filters.year;
    if (filters.status) params.status = filters.status;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.page != null) params.page = filters.page;
    if (filters.limit != null) params.limit = filters.limit;

    // Use /attendance/view so the request is proxied to Express.
    // Bare GET /attendance is the Next.js page route and returns HTML.
    const response = await api.get<AllAttendanceResponse>("/attendance/view", {
      params,
    });

    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to load attendance records");
    }

    return body;
  },

  async createRecord(payload: AttendanceCreatePayload) {
    const response = await api.post<AttendanceCreateResponse>("/attendance/create", payload);
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to create attendance record");
    }
    return body.data;
  },

  async deleteRecord(attendanceId: string) {
    const response = await api.delete<AttendanceDeleteResponse>(`/attendance/${encodeURIComponent(attendanceId)}`);
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to delete attendance record");
    }
    return body;
  },

  async updateRecord(attendanceId: string, payload: AttendanceUpdatePayload) {
    const response = await api.put<AttendanceUpdateResponse>(
      `/attendance/${encodeURIComponent(attendanceId)}`,
      payload,
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to update attendance record");
    }
    return body.data;
  },
};

// ------------------------------- Leave request types -------------------------------

export type LeaveType = "annual" | "sick" | "casual" | "unpaid" | "other";
export type LeaveStatus =
  | "pending"
  | "supervisor_approved"
  | "approved"
  | "rejected"
  | "cancelled";
export type LeaveQueueStatusFilter = LeaveStatus | "awaiting";
export type LeaveDuration = "full_day" | "half_day";
export type HalfDayPeriod = "morning" | "afternoon";

export const LEAVE_TYPE_OPTIONS: Array<{ value: LeaveType; label: string }> = [
  { value: "annual", label: "Annual" },
  { value: "sick", label: "Sick" },
  { value: "casual", label: "Casual" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
];

export const LEAVE_DURATION_OPTIONS: Array<{ value: LeaveDuration; label: string }> = [
  { value: "full_day", label: "Full day" },
  { value: "half_day", label: "Half day" },
];

export const HALF_DAY_PERIOD_OPTIONS: Array<{ value: HalfDayPeriod; label: string }> = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
];

export function requestStatusLabel(status: LeaveStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "supervisor_approved":
      return "Awaiting HOD";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function requestStatusChipSx(status: LeaveStatus) {
  switch (status) {
    case "approved":
      return { backgroundColor: "#dcfce7", color: "#15803d" };
    case "supervisor_approved":
      return { backgroundColor: "#dbeafe", color: "#1d4ed8" };
    case "rejected":
      return { backgroundColor: "#fee2e2", color: "#b91c1c" };
    case "cancelled":
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
    case "pending":
    default:
      return { backgroundColor: "#fef3c7", color: "#b45309" };
  }
}

export type LeaveRequestRecord = {
  id: number;
  leaveRequestId: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  duration?: LeaveDuration;
  halfDayPeriod?: HalfDayPeriod | null;
  reason: string;
  status: LeaveStatus;
  reviewedBy: string | null;
  /** Display name resolved from reviewedBy (null while pending). */
  reviewedByName?: string | null;
  /** Whether the reviewer was the assigned HOD or supervisor. */
  reviewedByRole?: "hod" | "supervisor" | null;
  reviewComments: string | null;
  reviewedAt: string | null;
  hod?: number | null;
  supervisor?: number | null;
  hodEmployeeId?: string | null;
  hodName?: string | null;
  supervisorEmployeeId?: string | null;
  supervisorName?: string | null;
  canAccept?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LeaveRequestSubmitPayload = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  duration?: LeaveDuration;
  halfDayPeriod?: HalfDayPeriod | null;
};

export type LeaveRequestSubmitResponse = {
  status: "success";
  message: string;
  data: LeaveRequestRecord;
};

export type LeaveRequestListFilters = {
  status?: LeaveStatus | "awaiting";
  employeeId?: string;
  page?: number;
  limit?: number;
};

export type LeaveRequestListResponse = {
  status: "success";
  count: number;
  meta: { total: number; page: number; limit: number };
  data: LeaveRequestRecord[];
};

export type LeaveReviewPayload = {
  reviewComments?: string;
};

// ------------------------------- Leave request API -------------------------------

export const leaveApi = {
  // POST /leave/submit - submit a new leave request for the given employee
  // (defaults to the signed-in user on the backend when employeeId is omitted).
  async submit(payload: LeaveRequestSubmitPayload) {
    const response = await api.post<LeaveRequestSubmitResponse>("/leave/submit", payload);
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to submit leave request");
    }
    return body.data;
  },

  // GET /leave/employee/:employeeId - an employee's own leave request history.
  async getForEmployee(employeeId: string, filters: LeaveRequestListFilters = {}) {
    const params: Record<string, string | number> = {};
    if (filters.status) params.status = filters.status;
    if (filters.page != null) params.page = filters.page;
    if (filters.limit != null) params.limit = filters.limit;

    const response = await api.get<LeaveRequestListResponse>(
      `/leave/employee/${encodeURIComponent(employeeId)}`,
      { params },
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to load leave requests");
    }
    return body;
  },

  // GET /leave/me - signed-in employee's leave history.
  async getMine(filters: LeaveRequestListFilters = {}) {
    const params: Record<string, string | number> = {};
    if (filters.status) params.status = filters.status;
    if (filters.page != null) params.page = filters.page;
    if (filters.limit != null) params.limit = filters.limit;

    const response = await api.get<LeaveRequestListResponse>("/leave/me", { params });
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to load leave requests");
    }
    return body;
  },

  // GET /leave/queue - assigned HOD/supervisor review queue.
  async getQueue(filters: LeaveRequestListFilters = {}) {
    const params: Record<string, string | number> = {};
    if (filters.status) params.status = filters.status;
    if (filters.employeeId) params.employeeId = filters.employeeId;
    if (filters.page != null) params.page = filters.page;
    if (filters.limit != null) params.limit = filters.limit;

    const response = await api.get<LeaveRequestListResponse>("/leave/queue", { params });
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to load leave request queue");
    }
    return body;
  },

  async approve(leaveRequestId: string, payload: LeaveReviewPayload = {}) {
    const response = await api.post<LeaveRequestSubmitResponse>(
      `/leave/${encodeURIComponent(leaveRequestId)}/approve`,
      payload,
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to approve leave request");
    }
    return body.data;
  },

  async reject(leaveRequestId: string, payload: LeaveReviewPayload = {}) {
    const response = await api.post<LeaveRequestSubmitResponse>(
      `/leave/${encodeURIComponent(leaveRequestId)}/reject`,
      payload,
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to reject leave request");
    }
    return body.data;
  },
};

// ------------------------------- Unauthorised request API -------------------------------

export type UnauthorisedRequestStatus =
  | "pending"
  | "supervisor_approved"
  | "approved"
  | "rejected"
  | "cancelled";

export type UnauthorisedRequestRecord = {
  id: number;
  unauthorisedRequestId: string;
  employeeId: string;
  employeeName?: string | null;
  employeeDepartment?: string | null;
  attendanceId: number;
  happenDate: string;
  clockIn: string | null;
  clockOut: string | null;
  reason: string;
  description: string;
  status: UnauthorisedRequestStatus;
  reviewedBy: string | null;
  /** Display name resolved from reviewedBy (null while pending). */
  reviewedByName?: string | null;
  /** Whether the reviewer was the assigned HOD or supervisor. */
  reviewedByRole?: "hod" | "supervisor" | null;
  reviewComments: string | null;
  reviewedAt: string | null;
  hod: number | null;
  supervisor: number | null;
  hodEmployeeId?: string | null;
  hodName?: string | null;
  supervisorEmployeeId?: string | null;
  supervisorName?: string | null;
  canAccept?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UnauthorisedRequestSubmitPayload = {
  attendanceId: string;
  reason: string;
  description: string;
  happenDate?: string;
  clockIn?: string;
  clockOut?: string;
  employeeId?: string;
};

export type UnauthorisedRequestSubmitResponse = {
  status: "success";
  message: string;
  data: UnauthorisedRequestRecord;
};

export type UnauthorisedRequestListResponse = {
  status: "success";
  count: number;
  meta: { total: number; page: number; limit: number };
  data: UnauthorisedRequestRecord[];
};

export type UnauthorisedRequestListFilters = {
  status?: UnauthorisedRequestStatus | "awaiting";
  employeeId?: string;
  page?: number;
  limit?: number;
};

export type UnauthorisedReviewPayload = {
  reviewComments?: string;
};

export const unauthorisedApi = {
  // POST /unauthorised/submit — resolve an unauthorised attendance day
  async submit(payload: UnauthorisedRequestSubmitPayload) {
    const response = await api.post<UnauthorisedRequestSubmitResponse>(
      "/unauthorised/submit",
      payload,
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to submit unauthorised request");
    }
    return body.data;
  },

  async getForEmployee(
    employeeId: string,
    filters: UnauthorisedRequestListFilters = {},
  ) {
    const params: Record<string, string | number> = {};
    if (filters.status) params.status = filters.status;
    if (filters.page != null) params.page = filters.page;
    if (filters.limit != null) params.limit = filters.limit;

    const response = await api.get<UnauthorisedRequestListResponse>(
      `/unauthorised/employee/${encodeURIComponent(employeeId)}`,
      { params },
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to load unauthorised requests");
    }
    return body;
  },

  async getMine(filters: UnauthorisedRequestListFilters = {}) {
    const params: Record<string, string | number> = {};
    if (filters.status) params.status = filters.status;
    if (filters.page != null) params.page = filters.page;
    if (filters.limit != null) params.limit = filters.limit;

    const response = await api.get<UnauthorisedRequestListResponse>("/unauthorised/me", {
      params,
    });
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to load unauthorised requests");
    }
    return body;
  },

  // GET /unauthorised/queue - assigned HOD/supervisor review queue.
  async getQueue(filters: UnauthorisedRequestListFilters = {}) {
    const params: Record<string, string | number> = {};
    if (filters.status) params.status = filters.status;
    if (filters.employeeId) params.employeeId = filters.employeeId;
    if (filters.page != null) params.page = filters.page;
    if (filters.limit != null) params.limit = filters.limit;

    const response = await api.get<UnauthorisedRequestListResponse>("/unauthorised/queue", {
      params,
    });
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to load unauthorised request queue");
    }
    return body;
  },

  async approve(unauthorisedRequestId: string, payload: UnauthorisedReviewPayload = {}) {
    const response = await api.post<UnauthorisedRequestSubmitResponse>(
      `/unauthorised/${encodeURIComponent(unauthorisedRequestId)}/approve`,
      payload,
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to approve unauthorised request");
    }
    return body.data;
  },

  async reject(unauthorisedRequestId: string, payload: UnauthorisedReviewPayload = {}) {
    const response = await api.post<UnauthorisedRequestSubmitResponse>(
      `/unauthorised/${encodeURIComponent(unauthorisedRequestId)}/reject`,
      payload,
    );
    const body = response.data;
    if (body.status !== "success") {
      throw new Error("Failed to reject unauthorised request");
    }
    return body.data;
  },
};