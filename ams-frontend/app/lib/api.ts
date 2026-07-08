import axios from "axios";

// Empty base URL uses Next.js rewrites (same origin) to avoid CORS issues.
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const api = axios.create({
  baseURL: apiBaseUrl,
});

type ApiErrorBody = {
  error?: string;
  message?: string;
  success?: boolean;
  status?: string;
};

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorBody | undefined;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

// ─────────────────────────────────── Types ───────────────────────────────────

export type Employee = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: "admin" | "employee";
  roster: boolean;
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
  role?: "admin" | "employee";
};

export type EmployeeUpdatePayload = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: "admin" | "employee";
  roster: boolean;
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
  role?: "admin" | "employee";
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

// ─────────────────────────────────── Employee API ───────────────────────────────────

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

  async create(payload: EmployeeFormData) {
    const body = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      roster: payload.roster,
      ...(payload.phone ? { phone: payload.phone } : {}),
      ...(payload.department ? { department: payload.department } : {}),
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
  lateCoverMinutes: number;
};

export type AttendanceProcessResponse = {
  status: "success";
  processedCount: number;
  discrepancyCount: number;
  discrepancies: AttendanceDiscrepancy[];
  schedule: {
    shiftStart: string;
    shiftEnd: string;
  };
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
  lateCoverMinutes: number;
  rosterId: number | null;
  attendanceLogId: number | null;
  leaveRequestId: number | null;
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

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
};
