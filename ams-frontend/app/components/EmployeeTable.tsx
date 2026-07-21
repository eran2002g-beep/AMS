// components/EmployeeTable.tsx
"use client";
import { useMemo, useState } from "react";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper,
  Chip, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Button,
  TableSortLabel,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { useRouter } from "next/navigation";
import type { Employee } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/api";

type Props = {
  employees: Employee[];
  onEdit?: (employee: Employee) => void;
  onDelete?: (employee: Employee) => Promise<void>;
  deletingEmployeeId?: string | null;
};

type SortField = "name" | "email" | "createdAt";
type SortDirection = "asc" | "desc";
type SortConfig = { field: SortField; direction: SortDirection };

type ColumnDef = {
  id: string;
  label: string;
  sortable?: SortField;
};

const COLUMNS: ColumnDef[] = [
  { id: "name", label: "Name", sortable: "name" },
  { id: "email", label: "Email", sortable: "email" },
  { id: "phone", label: "Phone" },
  { id: "department", label: "Department" },
  { id: "roster", label: "Roster" },
  { id: "employeeId", label: "Employee ID" },
  { id: "role", label: "Role" },
  { id: "createdAt", label: "Created", sortable: "createdAt" },
  { id: "actions", label: "Actions" },
];

const ROLE_CHIP_SX: Record<string, { backgroundColor: string; color: string }> = {
  "super-admin": { backgroundColor: "#fce7f3", color: "#9d174d" },
  admin: { backgroundColor: "#fef3c7", color: "#b45309" },
  "admin-manager": { backgroundColor: "#e0e7ff", color: "#3730a3" },
  manager: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  employee: { backgroundColor: "#f1f5f9", color: "#64748b" },
};

const display = (value: string | null) => value || "—";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function sortEmployees(employees: Employee[], config: SortConfig | null): Employee[] {
  if (!config) return employees;

  const { field, direction } = config;
  const multiplier = direction === "asc" ? 1 : -1;

  return [...employees].sort((a, b) => {
    switch (field) {
      case "name": {
        const nameA = `${a.firstName} ${a.lastName}`.trim();
        const nameB = `${b.firstName} ${b.lastName}`.trim();
        return multiplier * nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      }
      case "email":
        return multiplier * a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
      case "createdAt": {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
        const aMissing = Number.isNaN(aTime);
        const bMissing = Number.isNaN(bTime);
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;
        return multiplier * (aTime - bTime);
      }
      default:
        return 0;
    }
  });
}

const sortLabelSx = {
  color: "#fff !important",
  "&:hover": { color: "#e2e8f0 !important" },
  "&.Mui-active": { color: "#fff !important" },
  "& .MuiTableSortLabel-icon": { color: "#94a3b8 !important" },
  "&.Mui-active .MuiTableSortLabel-icon": { color: "#fff !important" },
};

export default function EmployeeTable({ employees, onEdit, onDelete, deletingEmployeeId }: Props) {
  const router = useRouter();
  const [confirmTarget, setConfirmTarget] = useState<Employee | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const sortedEmployees = useMemo(
    () => sortEmployees(employees, sortConfig),
    [employees, sortConfig],
  );

  const handleSort = (field: SortField) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: "asc" };
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget || !onDelete) return;
    try {
      await onDelete(confirmTarget);
      setConfirmTarget(null);
    } catch {
      // Parent surfaces the error; keep dialog open for retry or cancel.
    }
  };

  return (
    <>
    <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: "#1e293b" }}>
            {COLUMNS.map((col) => {
              const isActive = col.sortable != null && sortConfig?.field === col.sortable;
              return (
              <TableCell
                key={col.id}
                sortDirection={isActive ? sortConfig.direction : false}
                sx={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                }}
              >
                {col.sortable ? (
                  <TableSortLabel
                    active={isActive}
                    direction={isActive ? sortConfig.direction : "asc"}
                    onClick={() => handleSort(col.sortable!)}
                    sx={sortLabelSx}
                  >
                    {col.label}
                  </TableSortLabel>
                ) : (
                  col.label
                )}
              </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedEmployees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                No employees found. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            sortedEmployees.map((emp) => (
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
                    label={ROLE_LABELS[emp.role] ?? emp.role}
                    size="small"
                    sx={ROLE_CHIP_SX[emp.role] ?? ROLE_CHIP_SX.employee}
                  />
                </TableCell>
                <TableCell>{formatDate(emp.createdAt)}</TableCell>
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
                  {onDelete && (
                    <Tooltip title="Delete employee">
                      <IconButton
                        size="small"
                        onClick={() => setConfirmTarget(emp)}
                        disabled={deletingEmployeeId === emp.employeeId}
                        aria-label={`Delete ${emp.firstName} ${emp.lastName}`}
                        sx={{ color: "#dc2626", ml: onEdit ? 0.5 : 0 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="View attendance">
                    <IconButton
                      size="small"
                      onClick={() => {
                        sessionStorage.setItem("ams-from-employees", "1");
                        router.push(
                          `/employees/attendance/${encodeURIComponent(emp.employeeId)}`,
                        );
                      }}
                      aria-label={`View attendance for ${emp.firstName} ${emp.lastName}`}
                      sx={{ color: "#16a34a", ml: 0.5 }}
                    >
                      <EventNoteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Mock punch">
                    <IconButton
                      size="small"
                      onClick={() =>
                        router.push(
                          `/mock/punch/system?employeeId=${encodeURIComponent(emp.employeeId)}`,
                        )
                      }
                      aria-label={`Mock punch for ${emp.firstName} ${emp.lastName}`}
                      sx={{ color: "#2563eb", ml: 0.5 }}
                    >
                      <FingerprintIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>

    <Dialog
      open={confirmTarget !== null}
      onClose={() => !deletingEmployeeId && setConfirmTarget(null)}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ backgroundColor: "#1e293b", color: "#fff", py: 1.5 }}>
        Delete Employee
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <DialogContentText>
          {confirmTarget && (
            <>
              <p></p>
              Delete <strong>{confirmTarget.firstName} {confirmTarget.lastName} ?</strong>{" "}
            </>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button
          onClick={() => setConfirmTarget(null)}
          disabled={!!deletingEmployeeId}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirmDelete}
          disabled={!!deletingEmployeeId}
        >
          {deletingEmployeeId ? "Deactivating…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
