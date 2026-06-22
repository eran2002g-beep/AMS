import axios from "axios";

// Empty base URL uses Next.js rewrites (same origin) to avoid CORS issues.
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const api = axios.create({
  baseURL: apiBaseUrl,
});

type ApiErrorBody = {
  error?: string;
  success?: boolean;
  status?: string;
};

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorBody | undefined;
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
};
