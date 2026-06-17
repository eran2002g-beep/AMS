"use client";
import {
  Box, TextField, FormControl, InputLabel, Select, MenuItem, Button,
} from "@mui/material";
import type { Employee } from "@/lib/api";

export type EmployeeFilters = {
  search: string;
  department: string;
};

export const EMPTY_FILTERS: EmployeeFilters = {
  search: "",
  department: "",
};

export function hasActiveFilters(filters: EmployeeFilters): boolean {
  return filters.search.trim() !== "" || filters.department !== "";
}

export function filterEmployees(employees: Employee[], filters: EmployeeFilters): Employee[] {
  const query = filters.search.trim().toLowerCase();

  return employees.filter((emp) => {
    if (filters.department && emp.department !== filters.department) return false;

    if (!query) return true;

    const haystack = [
      emp.firstName,
      emp.lastName,
      `${emp.firstName} ${emp.lastName}`,
      emp.email,
      emp.phone ?? "",
      emp.department ?? "",
      emp.employeeId,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function getDepartments(employees: Employee[]): string[] {
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
        placeholder="Search employees…"
        value={filters.search}
        onChange={(e) => update({ search: e.target.value })}
        sx={{ width: { xs: "100%", sm: 220 } }}
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

      {hasActiveFilters(filters) && (
        <Button size="small" color="inherit" onClick={onClear}>
          Clear
        </Button>
      )}
    </Box>
  );
}
