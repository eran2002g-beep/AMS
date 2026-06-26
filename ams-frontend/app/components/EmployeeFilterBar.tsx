"use client";
import {
  Box, TextField, FormControl, InputLabel, Select, MenuItem, Button,
} from "@mui/material";

export type EmployeeFilters = {
  search: string;
  department: string;
  role: "" | "admin" | "employee";
};

export const EMPTY_FILTERS: EmployeeFilters = {
  search: "",
  department: "",
  role: "",
};

export function hasActiveFilters(filters: EmployeeFilters): boolean {
  return filters.search.trim() !== "" || filters.department !== "" || filters.role !== "";
}

export function getDepartmentsFromEmployees(
  employees: { department: string | null }[],
): string[] {
  const set = new Set<string>();
  for (const emp of employees) {
    if (emp.department) set.add(emp.department);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

type Props = {
  filters: EmployeeFilters;
  departments: string[];
  onChange: (filters: EmployeeFilters) => void;
  onClear: () => void;
};

export default function EmployeeFilterBar({ filters, departments, onChange, onClear }: Props) {
  const update = (patch: Partial<EmployeeFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
      <TextField
        size="small"
        placeholder="Search name, email, or ID…"
        value={filters.search}
        onChange={(e) => update({ search: e.target.value })}
        sx={{ width: { xs: "100%", sm: 260 } }}
      />

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="department-filter-label">Department</InputLabel>
        <Select
          labelId="department-filter-label"
          label="Department"
          value={filters.department}
          onChange={(e) => update({ department: e.target.value })}
        >
          <MenuItem value="">All</MenuItem>
          {departments.map((dept) => (
            <MenuItem key={dept} value={dept}>{dept}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="role-filter-label">Role</InputLabel>
        <Select
          labelId="role-filter-label"
          label="Role"
          value={filters.role}
          onChange={(e) => update({ role: e.target.value as EmployeeFilters["role"] })}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
          <MenuItem value="employee">Employee</MenuItem>
        </Select>
      </FormControl>

      {hasActiveFilters(filters) && (
        <Button size="small" color="inherit" onClick={onClear}>
          Clear
        </Button>
      )}
    </Box>
  );
}
