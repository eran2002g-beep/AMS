// app/employees/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Typography, Paper, Alert, CircularProgress, TablePagination,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EmployeeForm from "@/components/EmployeeForm";
import EmployeeTable from "@/components/EmployeeTable";
import EmployeeFilterBar, {
  EMPTY_FILTERS,
  getDepartmentsFromEmployees,
  type EmployeeFilters,
} from "@/components/EmployeeFilterBar";
import {
  attendanceApi,
  employeeApi,
  buildEmployeeUpdatePayload,
  getErrorMessage,
  isForbiddenError,
  type Employee,
  type EmployeeFormData,
  type EmployeeListMeta,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  canEditAttendance,
  canManageEmployees,
  canViewAttendance,
} from "@/lib/roles";
import { useRouter } from "next/navigation";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function EmployeesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const manageEmployees = canManageEmployees(user?.role);
  const editAttendance = canEditAttendance(user?.role);
  const viewAttendance = canViewAttendance(user?.role);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<EmployeeListMeta>({ total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
  const [departments, setDepartments] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [filters, setFilters] = useState<EmployeeFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [processingAttendance, setProcessingAttendance] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filters.department, filters.role]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await employeeApi.list({
        q: debouncedSearch.trim() || undefined,
        department: filters.department || undefined,
        role: filters.role || undefined,
        page: page + 1,
        limit: rowsPerPage,
      });
      setEmployees(result.employees);
      setMeta(result.meta);
    } catch (err) {
      if (isForbiddenError(err)) {
        setAccessDenied(true);
        router.replace("/access-denied");
        return;
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters.department, filters.role, page, rowsPerPage, router]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    employeeApi
      .list({ limit: 1000 })
      .then((result) => setDepartments(getDepartmentsFromEmployees(result.employees)))
      .catch(() => {});
  }, []);

  if (accessDenied) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const handleAdd = async (data: EmployeeFormData) => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await employeeApi.create(data);
      setSuccess("Employee added successfully.");
      await loadEmployees();
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (data: EmployeeFormData) => {
    if (!editingEmployee) return;

    const changes = buildEmployeeUpdatePayload(editingEmployee, data);
    if (Object.keys(changes).length === 0) {
      setSuccess("No changes to save.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await employeeApi.update(editingEmployee.employeeId, changes);
      setSuccess("Employee updated successfully.");
      await loadEmployees();
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (employee: Employee) => {
    setDeletingEmployeeId(employee.employeeId);
    setError("");
    setSuccess("");
    try {
      const result = await employeeApi.delete(employee.employeeId);
      setSuccess(result.message);
      await loadEmployees();
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const openCreateForm = () => {
    setEditingEmployee(null);
    setFormOpen(true);
  };

  const openEditForm = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingEmployee(null);
  };

  const handleProcessAttendance = async () => {
    setProcessingAttendance(true);
    setError("");
    setSuccess("");
    try {
      const result = await attendanceApi.processToday();
      const discrepancyNote =
        result.discrepancyCount > 0
          ? ` ${result.discrepancyCount} discrepanc${result.discrepancyCount === 1 ? "y" : "ies"} found.`
          : "";
      setSuccess(
        `Processed today's attendance for ${result.processedCount} employee${result.processedCount === 1 ? "" : "s"}.${discrepancyNote}`,
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingAttendance(false);
    }
  };

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "center" },
            gap: 2,
            mb: 2,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b" }}>
            Employee Management
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignSelf: { xs: "flex-start", md: "center" } }}>
            {editAttendance && (
              <Button
                variant="outlined"
                startIcon={processingAttendance ? <CircularProgress size={18} color="inherit" /> : <EventAvailableIcon />}
                onClick={handleProcessAttendance}
                disabled={processingAttendance}
                sx={{ whiteSpace: "nowrap", borderColor: "#16a34a", color: "#16a34a" }}
              >
                Process Attendance
              </Button>
            )}
            {manageEmployees && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateForm}
                sx={{ backgroundColor: "#2563eb", whiteSpace: "nowrap" }}
              >
                Add Employee
              </Button>
            )}
          </Box>
        </Box>

        <EmployeeFilterBar
          filters={filters}
          departments={departments}
          onChange={setFilters}
          onClear={() => setFilters(EMPTY_FILTERS)}
        />
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <EmployeeTable
            employees={employees}
            onEdit={manageEmployees ? openEditForm : undefined}
            onDelete={manageEmployees ? handleDelete : undefined}
            deletingEmployeeId={deletingEmployeeId}
            showAttendance={viewAttendance}
            showMockPunch={editAttendance}
          />
          <Paper sx={{ borderRadius: 2, mt: 0 }}>
            <TablePagination
              component="div"
              count={meta.total}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={PAGE_SIZE_OPTIONS}
              labelDisplayedRows={({ from, to, count }) =>
                `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
              }
            />
          </Paper>
        </>
      )}

      {manageEmployees && (
        <EmployeeForm
          open={formOpen}
          onClose={closeForm}
          onSubmit={editingEmployee ? handleUpdate : handleAdd}
          submitting={submitting}
          employee={editingEmployee}
        />
      )}
    </Box>
  );
}
