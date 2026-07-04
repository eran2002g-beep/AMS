"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box, Button, Typography, Paper, Alert, CircularProgress,
  TextField, MenuItem, TablePagination, Chip, Link,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttendanceTable from "@/components/AttendanceTable";
import {
  attendanceApi,
  getErrorMessage,
  type AttendanceRecord,
  type EmployeeAttendanceFilters,
  type EmployeeAttendanceResponse,
} from "@/lib/api";

const now = new Date();
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_OPTIONS: Array<{ value: "" | AttendanceRecord["status"]; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
  { value: "unauthorised", label: "Unauthorised" },
  { value: "holiday", label: "Holiday" },
];

function defaultFilters(): EmployeeAttendanceFilters {
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  };
}

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

export default function EmployeeAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = typeof params.employeeId === "string" ? params.employeeId : "";

  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [status, setStatus] = useState<"" | AttendanceRecord["status"]>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<EmployeeAttendanceFilters>(defaultFilters());

  const [showBackLink, setShowBackLink] = useState(false);
  const [response, setResponse] = useState<EmployeeAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("ams-from-employees") === "1") {
      setShowBackLink(true);
      sessionStorage.removeItem("ams-from-employees");
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!employeeId) {
      setError("Employee ID is required.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await attendanceApi.getEmployeeAttendance(employeeId, appliedFilters);
      setResponse(result);
    } catch (err) {
      setResponse(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [employeeId, appliedFilters]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleSearch = () => {
    if (startDate && endDate && startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }

    const filters: EmployeeAttendanceFilters = {
      page: 1,
      limit: appliedFilters.limit ?? DEFAULT_PAGE_SIZE,
    };

    if (startDate || endDate) {
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
    } else {
      const parsed = parseMonthYear(year, month);
      if (typeof parsed === "string") {
        setError(parsed);
        return;
      }
      filters.year = parsed.year;
      filters.month = parsed.month;
    }

    if (status) filters.status = status;

    setError("");
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    setYear(String(now.getFullYear()));
    setMonth(String(now.getMonth() + 1));
    setStatus("");
    setStartDate("");
    setEndDate("");
    setError("");
    setAppliedFilters({
      page: 1,
      limit: appliedFilters.limit ?? DEFAULT_PAGE_SIZE,
    });
  };

  const handlePageChange = (_: unknown, newPage: number) => {
    setAppliedFilters((prev) => ({
      ...prev,
      page: newPage + 1,
    }));
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const limit = parseInt(event.target.value, 10);
    setAppliedFilters((prev) => ({
      ...prev,
      page: 1,
      limit,
    }));
  };

  const employee = response?.employee;
  const records = response?.data ?? [];
  const meta = response?.meta;
  const page = (appliedFilters.page ?? 1) - 1;
  const rowsPerPage = appliedFilters.limit ?? DEFAULT_PAGE_SIZE;

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        {showBackLink && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push("/employees")}
              sx={{ color: "#64748b" }}
            >
              Back to Employees
            </Button>
          </Box>
        )}

        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 1 }}>
          Employee Attendance
        </Typography>

        {employee ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {employee.firstName} {employee.lastName}
            </Typography>
            <Chip label={employee.employeeId} size="small" sx={{ backgroundColor: "#e0f2fe", color: "#0369a1" }} />
            {employee.department && (
              <Chip label={employee.department} size="small" sx={{ backgroundColor: "#f1f5f9", color: "#64748b" }} />
            )}
            <Chip
              label={employee.roster ? "Roster" : "Normal shift"}
              size="small"
              sx={{
                backgroundColor: employee.roster ? "#dcfce7" : "#f1f5f9",
                color: employee.roster ? "#15803d" : "#64748b",
              }}
            />
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
            Employee ID: <Link component="span" sx={{ fontWeight: 600 }}>{employeeId}</Link>
          </Typography>
        )}

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "flex-end",
          }}
        >
          <TextField
            label="Year"
            type="number"
            size="small"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={!!startDate || !!endDate}
            sx={{ width: 110 }}
            slotProps={{ htmlInput: { min: 2000, max: 2099 } }}
          />
          <TextField
            label="Month"
            select
            size="small"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={!!startDate || !!endDate}
            sx={{ width: 140 }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <MenuItem key={i + 1} value={String(i + 1)}>
                {new Date(2000, i, 1).toLocaleString("default", { month: "long" })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Status"
            select
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | AttendanceRecord["status"])}
            sx={{ width: 160 }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Start date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 160 }}
          />
          <TextField
            label="End date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            sx={{ backgroundColor: "#2563eb" }}
          >
            Search
          </Button>
          <Button variant="outlined" onClick={handleClearFilters} sx={{ borderColor: "#94a3b8", color: "#64748b" }}>
            Clear filters
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <AttendanceTable records={records} />
          {meta && (
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
          )}
        </>
      )}
    </Box>
  );
}
