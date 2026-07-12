// components/AttendanceFilterBar.tsx
"use client";
import { useState } from "react";
import {
  Box, Button, TextField, MenuItem,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DateRangePicker from "@/components/DateRangePicker";
import { getTodayDateString, type AttendanceRecord } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterMode = "month" | "range";

export type AttendanceFilters = {
  /** Full-text search term (employee name / ID / department). Only used when showEmployeeSearch=true. */
  q?: string;
  /** Month number 1-12, mutually exclusive with startDate/endDate. */
  month?: number;
  /** Calendar year, mutually exclusive with startDate/endDate. */
  year?: number;
  /** Start of date range (YYYY-MM-DD). */
  startDate?: string;
  /** End of date range (YYYY-MM-DD). */
  endDate?: string;
  /** Attendance status filter. */
  status?: AttendanceRecord["status"] | "";
};

type Props = {
  /** Called when the user clicks "Search". Receives the built filter object. */
  onSearch: (filters: AttendanceFilters) => void;
  /** Called when the user clicks "Clear filters". */
  onClear: () => void;
  /** Show the employee name/ID search field. Default: false */
  showEmployeeSearch?: boolean;
  /** Validation error message to display (managed by the parent). */
  errorMessage?: string;
  /** Clears the error on the parent when user changes inputs. */
  onErrorClear?: () => void;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

const STATUS_OPTIONS: Array<{ value: "" | AttendanceRecord["status"]; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
  { value: "unauthorised", label: "Unauthorised" },
  { value: "holiday", label: "Holiday" },
];

function parseMonthYear(yearStr: string, monthStr: string): { year: number; month: number } | string {
  const parsedYear = Number(yearStr);
  const parsedMonth = Number(monthStr);
  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2099) {
    return "Year must be between 2000 and 2099.";
  }
  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return "Month must be between 1 and 12.";
  }
  return { year: parsedYear, month: parsedMonth };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AttendanceFilterBar({
  onSearch,
  onClear,
  showEmployeeSearch = false,
  onErrorClear,
}: Props) {
  const TODAY = getTodayDateString();

  const [filterMode, setFilterMode] = useState<FilterMode>("range");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState(String(CURRENT_MONTH));
  const [status, setStatus] = useState<"" | AttendanceRecord["status"]>("");
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);
  const [searchText, setSearchText] = useState("");
  const [localError, setLocalError] = useState("");

  const clearLocalError = () => {
    setLocalError("");
    onErrorClear?.();
  };

  const handleSearch = () => {
    const filters: AttendanceFilters = {};

    if (showEmployeeSearch && searchText.trim()) {
      filters.q = searchText.trim();
    }

    if (filterMode === "range") {
      if (!startDate || !endDate) {
        setLocalError("Please select both start and end dates.");
        return;
      }
      if (startDate > endDate) {
        setLocalError("Start date must be on or before end date.");
        return;
      }
      filters.startDate = startDate;
      filters.endDate = endDate;
    } else {
      const parsed = parseMonthYear(year, month);
      if (typeof parsed === "string") {
        setLocalError(parsed);
        return;
      }
      filters.year = parsed.year;
      filters.month = parsed.month;
    }

    if (status) filters.status = status;

    setLocalError("");
    onSearch(filters);
  };

  const handleClear = () => {
    const today = getTodayDateString();
    setFilterMode("range");
    setYear(String(CURRENT_YEAR));
    setMonth(String(CURRENT_MONTH));
    setStatus("");
    setStartDate(today);
    setEndDate(today);
    setSearchText("");
    setLocalError("");
    onClear();
  };

  return (
    <Box>
      {localError && (
        <Box sx={{ mb: 1.5, color: "#dc2626", fontSize: "0.875rem" }}>
          {localError}
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "flex-end",
        }}
      >
        {/* Employee search — only visible on the global attendance page */}
        {showEmployeeSearch && (
          <TextField
            label="Search Employee"
            placeholder="Name, ID, Department"
            size="small"
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); clearLocalError(); }}
            sx={{ width: { xs: "100%", md: 240 } }}
            id="attendance-search-employee"
          />
        )}

        {/* Filter mode selector */}
        <TextField
          label="Filter by"
          select
          size="small"
          value={filterMode}
          onChange={(e) => { setFilterMode(e.target.value as FilterMode); clearLocalError(); }}
          sx={{ width: 140 }}
          id="attendance-filter-mode"
        >
          <MenuItem value="month">Month</MenuItem>
          <MenuItem value="range">Date range</MenuItem>
        </TextField>

        {/* Month / Year pickers */}
        {filterMode === "month" ? (
          <>
            <TextField
              label="Year"
              type="number"
              size="small"
              value={year}
              onChange={(e) => { setYear(e.target.value); clearLocalError(); }}
              sx={{ width: 110 }}
              slotProps={{ htmlInput: { min: 2000, max: 2099 } }}
              id="attendance-filter-year"
            />
            <TextField
              label="Month"
              select
              size="small"
              value={month}
              onChange={(e) => { setMonth(e.target.value); clearLocalError(); }}
              sx={{ width: 140 }}
              id="attendance-filter-month"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <MenuItem key={i + 1} value={String(i + 1)}>
                  {new Date(2000, i, 1).toLocaleString("default", { month: "long" })}
                </MenuItem>
              ))}
            </TextField>
          </>
        ) : (
          /* Date Range picker */
          <Box sx={{ flex: { xs: "1 1 100%", md: "1 1 480px" }, minWidth: 0 }}>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(v) => { setStartDate(v); clearLocalError(); }}
              onEndDateChange={(v) => { setEndDate(v); clearLocalError(); }}
            />
          </Box>
        )}

        {/* Status filter */}
        <TextField
          label="Status"
          select
          size="small"
          value={status}
          onChange={(e) => { setStatus(e.target.value as "" | AttendanceRecord["status"]); clearLocalError(); }}
          sx={{ width: 160 }}
          id="attendance-filter-status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Actions */}
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={handleSearch}
          sx={{ backgroundColor: "#2563eb", "&:hover": { backgroundColor: "#1d4ed8" } }}
          id="attendance-search-btn"
        >
          Search
        </Button>
        <Button
          variant="outlined"
          onClick={handleClear}
          sx={{ borderColor: "#94a3b8", color: "#64748b" }}
          id="attendance-clear-btn"
        >
          Clear filters
        </Button>
      </Box>
    </Box>
  );
}
