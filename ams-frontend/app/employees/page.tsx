// app/employees/page.tsx
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Button, Typography, Paper, Alert, CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EmployeeForm from "@/components/EmployeeForm";
import EmployeeTable from "@/components/EmployeeTable";
import EmployeeFilterBar, {
  EMPTY_FILTERS,
  filterEmployees,
  getDepartments,
  type EmployeeFilters,
} from "@/components/EmployeeFilterBar";
import { employeeApi, getErrorMessage, type Employee, type EmployeeFormData } from "@/lib/api";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [filters, setFilters] = useState<EmployeeFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await employeeApi.list();
      setEmployees(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleAdd = async (data: EmployeeFormData) => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const created = await employeeApi.create(data);
      setEmployees((prev) => [...prev, created]);
      setSuccess("Employee added successfully.");
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (data: EmployeeFormData) => {
    if (!editing) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const updated = await employeeApi.update(editing.id, data);
      setEmployees((prev) => prev.map((e) => (e.id === editing.id ? updated : e)));
      setEditing(null);
      setSuccess("Employee updated successfully.");
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Remove this employee?")) return;
    setError("");
    setSuccess("");
    try {
      await employeeApi.remove(id);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      setSuccess("Employee removed successfully.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setFormOpen(true);
  };

  const filtered = useMemo(
    () => filterEmployees(employees, filters),
    [employees, filters],
  );

  const departments = useMemo(() => getDepartments(employees), [employees]);

  const editingFormData: EmployeeFormData | null = editing
    ? {
        firstName: editing.firstName,
        lastName: editing.lastName,
        email: editing.email,
        phone: editing.phone ?? "",
        department: editing.department ?? "",
      }
    : null;

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
            onClick={() => { setEditing(null); setFormOpen(true); }}
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
        <EmployeeTable
          employees={filtered}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      <EmployeeForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={editing ? handleUpdate : handleAdd}
        initialData={editingFormData}
        submitting={submitting}
      />
    </Box>
  );
}
