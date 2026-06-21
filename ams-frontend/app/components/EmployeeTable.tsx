// components/EmployeeTable.tsx
"use client";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper,
  Chip, IconButton, Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { Employee } from "@/lib/api";

type Props = {
  employees: Employee[];
  onEdit?: (employee: Employee) => void;
};

const COLUMNS = ["Name", "Email", "Phone", "Department", "Roster", "Employee ID", "Role", "Actions"];

const display = (value: string | null) => value || "—";

export default function EmployeeTable({ employees, onEdit }: Props) {
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
              <TableCell colSpan={8} align="center" sx={{ color: "#94a3b8", py: 4 }}>
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
                <TableCell>
                  <Chip
                    label={emp.roster ? "Yes" : "No"}
                    size="small"
                    sx={{
                      backgroundColor: emp.roster ? "#dcfce7" : "#f1f5f9",
                      color: emp.roster ? "#15803d" : "#64748b",
                    }}
                  />
                </TableCell>
                <TableCell>{emp.employeeId}</TableCell>
                <TableCell>
                  <Chip
                    label={emp.role}
                    size="small"
                    sx={{
                      backgroundColor: emp.role === "admin" ? "#fef3c7" : "#f1f5f9",
                      color: emp.role === "admin" ? "#b45309" : "#64748b",
                      textTransform: "capitalize",
                    }}
                  />
                </TableCell>
                <TableCell>
                  {onEdit && (
                    <Tooltip title="Edit employee">
                      <IconButton
                        size="small"
                        onClick={() => onEdit(emp)}
                        aria-label={`Edit ${emp.firstName} ${emp.lastName}`}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
