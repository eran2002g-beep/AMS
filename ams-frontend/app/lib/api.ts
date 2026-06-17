import axios from "axios";

// Backend API base URL - change this if your backend runs on a different port
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: apiBaseUrl,
});

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
};

export type EmployeeFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  role: "admin" | "employee";
};

export type Roster = {
  id: number;
  rosterId: string;
  rosterName: string;
  fileName: string;
  fileFormat: "csv" | "xlsx" | "xls";
  startDate: string;
  endDate: string;
  department: string | null;
  uploadedBy: number;
  isProcessed: boolean;
  isActive: boolean;
  createdAt: string;
};

// ─────────────────────────────────── Employee API ───────────────────────────────────

export const employeeApi = {
  // Get all employees
  async list() {
    const response = await api.get("/employee");
    return response.data.data as Employee[];
  },

  // Create a new employee
  async create(payload: EmployeeFormData) {
    const response = await api.post("/employee/create", payload);
    return response.data as Employee;
  },

  // Update an existing employee
  async update(id: number, payload: EmployeeFormData) {
    const response = await api.put(`/employee/${id}`, payload);
    return response.data.data as Employee;
  },

  // Delete (soft delete) an employee
  async remove(id: number) {
    await api.delete(`/employee/${id}`);
  },
};

// ─────────────────────────────────── Roster API ───────────────────────────────────

export const rosterApi = {
  // Get all rosters
  async list() {
    const response = await api.get("/roster");
    return response.data.data as Roster[];
  },

  // Upload a roster file
  async upload(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/roster/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data.data as Roster;
  },

  // Delete a roster
  async remove(id: number) {
    await api.delete(`/roster/${id}`);
  },
};
