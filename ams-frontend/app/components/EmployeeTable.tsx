// components/EmployeeTable.tsx
"use client";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper,
  IconButton, Chip, Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import type { Employee } from "@/lib/api";

type Props = {
  employees: Employee[];
  onEdit: (emp: Employee) => void;
  onDelete: (id: number) => void;
};

const COLUMNS = ["Name", "Email", "Phone", "Department", "Employee ID", "Actions"];

const display = (value: string | null) => value || "—";

export default function EmployeeTable({ employees, onEdit, onDelete }: Props) {
  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: "#1e293b" }}>
            {COLUMNS.map((col) => (
              <TableCell
                key={col}
                sx={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                }}
              >
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                No employees found. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            employees.map((emp) => (
              <TableRow key={emp.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>
                  {emp.firstName} {emp.lastName}
                </TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{display(emp.phone)}</TableCell>
                <TableCell>
                  {emp.department ? (
                    <Chip
                      label={emp.department}
                      size="small"
                      sx={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
                    />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{emp.employeeId}</TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(emp)}
                      sx={{ color: "#2563eb", mr: 1 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => onDelete(emp.id)}
                      sx={{ color: "#ef4444" }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
