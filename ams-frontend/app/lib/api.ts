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
};

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

// ─────────────────────────────────── Employee API ───────────────────────────────────

export const employeeApi = {
  async list() {
    const response = await api.get<{ success: boolean; count: number; data: Employee[] }>("/employee");
    return response.data.data;
  },

  async create(payload: EmployeeFormData) {
    const body = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      ...(payload.phone ? { phone: payload.phone } : {}),
      ...(payload.department ? { department: payload.department } : {}),
    };
    const response = await api.post<Employee>("/employee/create", body);
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
