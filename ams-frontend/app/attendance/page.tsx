"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Typography, Paper, Alert, CircularProgress,
  TextField, MenuItem, TablePagination,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import AttendanceTable from "@/components/AttendanceTable";
import DateRangePicker from "@/components/DateRangePicker";
import {
  attendanceApi,
  employeeApi,
  buildAttendanceUpdatePayload,
  getErrorMessage,
  getTodayDateString,
  type AttendanceRecord,
  type EmployeeAttendanceFilters,
  type AllAttendanceResponse,
  type Employee,
} from "@/lib/api";
import AttendanceForm, { type AttendanceFormData } from "@/components/AttendanceForm";
import AddIcon from "@mui/icons-material/Add";

const TODAY = getTodayDateString();

const now = new Date();
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

type FilterMode = "month" | "range";

const STATUS_OPTIONS: Array<{ value: "" | AttendanceRecord["status"]; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
  { value: "unauthorised", label: "Unauthorised" },
  { value: "holiday", label: "Holiday" },
];

function defaultFilters(): EmployeeAttendanceFilters & { q?: string } {
  return {
    startDate: TODAY,
    endDate: TODAY,
    q: "",
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

export default function AllAttendancePage() {
  const [filterMode, setFilterMode] = useState<FilterMode>("range");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState(String(CURRENT_MONTH));
  const [status, setStatus] = useState<"" | AttendanceRecord["status"]>("");
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);
  const [searchText, setSearchText] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<EmployeeAttendanceFilters & { q?: string }>(defaultFilters());

  const [response, setResponse] = useState<AllAttendanceResponse | null>(null);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [employeesMap, setEmployeesMap] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState<string | null>(null);
  const [processingAttendance, setProcessingAttendance] = useState(false);

  // Load all active employees to map ID to names in table
  useEffect(() => {
    employeeApi.list({ limit: 1000 })
      .then((res) => {
        setEmployeesList(res.employees);
        const map: Record<string, Employee> = {};
        res.employees.forEach((emp) => {
          map[emp.employeeId] = emp;
        });
        setEmployeesMap(map);
      })
      .catch((err) => {
        console.error("Failed to load employees for listing", err);
      });
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await attendanceApi.getAllAttendance(appliedFilters);
      setResponse(result);
    } catch (err) {
      setResponse(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleSearch = () => {
    const filters: EmployeeAttendanceFilters & { q?: string } = {
      page: 1,
      limit: appliedFilters.limit ?? DEFAULT_PAGE_SIZE,
    };

    if (searchText.trim()) {
      filters.q = searchText.trim();
    }

    if (filterMode === "range") {
      if (!startDate || !endDate) {
        setError("Please select both start and end dates.");
        return;
      }

      if (startDate > endDate) {
        setError("Start date must be on or before end date.");
        return;
      }

      filters.startDate = startDate;
      filters.endDate = endDate;
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
    const today = getTodayDateString();
    setFilterMode("range");
    setYear(String(CURRENT_YEAR));
    setMonth(String(CURRENT_MONTH));
    setStatus("");
    setStartDate(today);
    setEndDate(today);
    setSearchText("");
    setError("");
    setAppliedFilters({
      startDate: today,
      endDate: today,
      q: "",
      page: 1,
      limit: appliedFilters.limit ?? DEFAULT_PAGE_SIZE,
    });
  };

  const openCreateForm = () => {
    setEditingRecord(null);
    setFormOpen(true);
  };

  const openEditForm = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingRecord(null);
  };

  const handleAddAttendance = async (data: AttendanceFormData) => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      if (!data.employeeId) {
        throw new Error("Employee selection is required.");
      }
      await attendanceApi.createRecord({
        employeeId: data.employeeId,
        date: data.date,
        status: data.status,
        clockIn: data.clockIn || undefined,
        clockOut: data.clockOut || undefined,
        lateCoverMinutes: data.lateCoverMinutes ? Number(data.lateCoverMinutes) : undefined,
        notes: data.notes || undefined,
      });
      closeForm();
      setSuccess("Attendance record added successfully.");
      await loadAttendance();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAttendance = async (data: AttendanceFormData) => {
    if (!editingRecord) return;

    const changes = buildAttendanceUpdatePayload(editingRecord, data);
    if (Object.keys(changes).length === 0) {
      setSuccess("No changes to save.");
      closeForm();
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await attendanceApi.updateRecord(editingRecord.attendanceId, changes);
      closeForm();
      setSuccess("Attendance record updated successfully.");
      await loadAttendance();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttendance = async (record: AttendanceRecord) => {
    setDeletingAttendanceId(record.attendanceId);
    setError("");
    setSuccess("");
    try {
      await attendanceApi.deleteRecord(record.attendanceId);
      setSuccess(`Attendance record for ${record.date} deleted.`);
      await loadAttendance();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingAttendanceId(null);
    }
  };

  const handleProcessAttendance = async () => {
    setProcessingAttendance(true);
    setError("");
    setSuccess("");
    try {
      const result = await attendanceApi.processToday();
      const discrepancyNote =
        result.discrepancyCount > 0
          ? ` ${result.discrepancyCount} discrepancy found.`
          : "";
      setSuccess(
        `Processed today's attendance for ${result.processedCount} employee${result.processedCount === 1 ? "" : "s"}.${discrepancyNote}`,
      );
      await loadAttendance();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingAttendance(false);
    }
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

  const records = response?.data ?? [];
  const meta = response?.meta;
  const page = (appliedFilters.page ?? 1) - 1;
  const rowsPerPage = appliedFilters.limit ?? DEFAULT_PAGE_SIZE;

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 1 }}>
              All Attendance Records
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Monitor and manage attendance logs across all active company employees.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={processingAttendance ? <CircularProgress size={18} color="inherit" /> : <EventAvailableIcon />}
              onClick={handleProcessAttendance}
              disabled={processingAttendance}
              sx={{ whiteSpace: "nowrap", borderColor: "#16a34a", color: "#16a34a" }}
            >
              Process Attendance
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateForm}
              sx={{ backgroundColor: "#16a34a", "&:hover": { backgroundColor: "#15803d" } }}
            >
              Add Attendance
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "flex-end",
          }}
        >
          <TextField
            label="Search Employee"
            placeholder="Name, ID, Department"
            size="small"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ width: { xs: "100%", md: 240 } }}
          />

          <TextField
            label="Filter by"
            select
            size="small"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            sx={{ width: 140 }}
          >
            <MenuItem value="month">Month</MenuItem>
            <MenuItem value="range">Date range</MenuItem>
          </TextField>

          {filterMode === "month" ? (
            <>
              <TextField
                label="Year"
                type="number"
                size="small"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                sx={{ width: 110 }}
                slotProps={{ htmlInput: { min: 2000, max: 2099 } }}
              />
              <TextField
                label="Month"
                select
                size="small"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                sx={{ width: 140 }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i, 1).toLocaleString("default", { month: "long" })}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <Box sx={{ flex: { xs: "1 1 100%", md: "1 1 480px" }, minWidth: 0 }}>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
            </Box>
          )}

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
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <AttendanceTable
            records={records}
            onEdit={openEditForm}
            onDelete={handleDeleteAttendance}
            deletingAttendanceId={deletingAttendanceId}
            employeeMap={employeesMap}
          />
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

      <AttendanceForm
        open={formOpen}
        onClose={closeForm}
        onSubmit={editingRecord ? handleUpdateAttendance : handleAddAttendance}
        submitting={submitting}
        defaultDate={getTodayDateString()}
        record={editingRecord}
        employeesList={employeesList}
      />
    </Box>
  );
}
