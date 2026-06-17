// components/EmployeeTable.tsx
"use client";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper,
  IconButton, Chip, Tooltip
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

type Employee = {
  id: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  joinDate: string;
};

type Props = {
  employees: Employee[];
  onEdit: (emp: Employee) => void;
  onDelete: (id: number) => void;
};

const COLUMNS = ["Name", "Email", "Phone", "Department", "Role", "Join Date", "Actions"];

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
              <TableCell colSpan={7} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                No employees found. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            employees.map((emp) => (
              <TableRow key={emp.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{emp.name}</TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.phone}</TableCell>
                <TableCell>
                  <Chip
                    label={emp.department}
                    size="small"
                    sx={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
                  />
                </TableCell>
                <TableCell>{emp.role}</TableCell>
                <TableCell>{emp.joinDate}</TableCell>
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