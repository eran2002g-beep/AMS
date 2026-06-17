// app/employees/page.tsx
"use client";
import { useState } from "react";
import {
  Box, Button, Typography, TextField,
  Paper, Stack
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EmployeeForm from "@/components/EmployeeForm";
import EmployeeTable from "@/components/EmployeeTable";

// Dummy data for now (replace with API calls later)
const DUMMY = [
  { id: 1, name: "Kamal Perera", email: "kamal@example.com", phone: "0771234567", department: "IT", role: "Developer", joinDate: "2023-01-15" },
  { id: 2, name: "Nimal Silva",  email: "nimal@example.com", phone: "0712345678", department: "HR", role: "Manager",   joinDate: "2022-06-01" },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(DUMMY);
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<any>(null);
  const [search, setSearch]       = useState("");

  const handleAdd = (data: any) => {
    setEmployees([...employees, { ...data, id: Date.now() }]);
  };

  const handleUpdate = (data: any) => {
    setEmployees(employees.map((e) => (e.id === editing.id ? { ...data, id: editing.id } : e)));
    setEditing(null);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Remove this employee?")) return;
    setEmployees(employees.filter((e) => e.id !== id));
  };

  const openEdit = (emp: any) => {
    setEditing(emp);
    setFormOpen(true);
  };

  const filtered = employees.filter((e) =>
    `${e.name} ${e.department} ${e.role}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b" }}>
            Employee Management
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search employees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 250 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setEditing(null); setFormOpen(true); }}
              sx={{ backgroundColor: "#2563eb", whiteSpace: "nowrap" }}
            >
              Add Employee
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Table */}
      <EmployeeTable
        employees={filtered}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {/* Form Dialog */}
      <EmployeeForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={editing ? handleUpdate : handleAdd}
        initialData={editing}
      />
    </Box>
  );
}