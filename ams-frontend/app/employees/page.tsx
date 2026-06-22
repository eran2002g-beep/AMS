// app/employees/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Typography, Paper, Alert, CircularProgress, TablePagination,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EmployeeForm from "@/components/EmployeeForm";
import EmployeeTable from "@/components/EmployeeTable";
import EmployeeFilterBar, {
  EMPTY_FILTERS,
  getDepartmentsFromEmployees,
  type EmployeeFilters,
} from "@/components/EmployeeFilterBar";
import {
  employeeApi,
  buildEmployeeUpdatePayload,
  getErrorMessage,
  type Employee,
  type EmployeeFormData,
  type EmployeeListMeta,
} from "@/lib/api";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function EmployeesPage() {
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
  const [submitting, setSubmitting] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
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
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters.department, filters.role, page, rowsPerPage]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    employeeApi
      .list({ limit: 1000 })
      .then((result) => setDepartments(getDepartmentsFromEmployees(result.employees)))
      .catch(() => {});
  }, []);

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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateForm}
            sx={{ backgroundColor: "#2563eb", whiteSpace: "nowrap", alignSelf: { xs: "flex-start", md: "center" } }}
          >
            Add Employee
          </Button>
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
            onEdit={openEditForm}
            onDelete={handleDelete}
            deletingEmployeeId={deletingEmployeeId}
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

      <EmployeeForm
        open={formOpen}
        onClose={closeForm}
        onSubmit={editingEmployee ? handleUpdate : handleAdd}
        submitting={submitting}
        employee={editingEmployee}
      />
    </Box>
  );
}
