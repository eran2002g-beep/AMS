// app/rosters/page.tsx
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box, Button, Typography, Paper,
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer,
  Alert, CircularProgress,
  TextField, MenuItem,
  IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import DateRangePicker from "@/components/DateRangePicker";
import { rosterApi, attendanceApi, type RosterEntry, type RosterViewFilters, getErrorMessage, isForbiddenError } from "@/lib/api";
import {
  formatDateRangeLabel,
  getThisMonthRange,
  parseDateRange,
} from "@/lib/dateUtils";
import { useRouter } from "next/navigation";

const now = new Date();

function defaultFilters(): RosterViewFilters {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
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

function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("default", { month: "long" });
}

const defaultProcessRange = getThisMonthRange();

export default function RostersPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [filterMode, setFilterMode] = useState<"month" | "date">("month");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [date, setDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<RosterViewFilters>(defaultFilters());

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState(false);
  const [deletingMonth, setDeletingMonth] = useState(false);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [processingAttendance, setProcessingAttendance] = useState(false);
  const [processStartDate, setProcessStartDate] = useState(defaultProcessRange.startDate);
  const [processEndDate, setProcessEndDate] = useState(defaultProcessRange.endDate);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadRoster = useCallback(async (filters: { date?: string; year?: number; month?: number }) => {
    setLoading(true);
    setError("");
    try {
      const response = await rosterApi.view(filters);
      setEntries(response.data);
    } catch (err) {
      setEntries([]);
      if (isForbiddenError(err)) {
        setAccessDenied(true);
        router.replace("/access-denied");
        return;
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadRoster(appliedFilters);
  }, [appliedFilters, loadRoster]);

  if (accessDenied) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const handleSearch = () => {
    if (filterMode === "date") {
      if (!date.trim()) {
        setError("Please select a date.");
        return;
      }
      setAppliedFilters({ date: date.trim() });
    } else {
      const parsed = parseMonthYear(year, month);
      if (typeof parsed === "string") {
        setError(parsed);
        return;
      }
      setAppliedFilters({ year: parsed.year, month: parsed.month });
    }
    setError("");
  };

  const handleDeleteMonthClick = () => {
    const parsed = parseMonthYear(year, month);
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }
    setError("");
    setConfirmDeleteMonth(true);
  };

  const handleConfirmDeleteMonth = async () => {
    const parsed = parseMonthYear(year, month);
    if (typeof parsed === "string") {
      setError(parsed);
      setConfirmDeleteMonth(false);
      return;
    }

    setDeletingMonth(true);
    setError("");
    setSuccess("");
    try {
      const result = await rosterApi.deleteByMonth(parsed.month, parsed.year);
      setSuccess(result.message);
      setConfirmDeleteMonth(false);
      await loadRoster(appliedFilters);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingMonth(false);
    }
  };

  const handleConfirmDeleteDate = async () => {
    if (!confirmDeleteDate) return;

    setDeletingDate(confirmDeleteDate);
    setError("");
    setSuccess("");
    try {
      const result = await rosterApi.deleteByDate(confirmDeleteDate);
      setSuccess(result.message);
      setConfirmDeleteDate(null);
      await loadRoster(appliedFilters);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingDate(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setError("");
    if (!selected) return;

    const allowed = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const ext = selected.name.split(".").pop()?.toLowerCase();
    const validExt = ext === "csv" || ext === "xlsx" || ext === "xls";

    if (!allowed.includes(selected.type) && !validExt) {
      setError("Only .csv, .xlsx, or .xls files are allowed.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("File size must be under 5MB.");
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const result = await rosterApi.upload(file);
      setFile(null);
      setSuccess(`"${file.name}" uploaded — ${result.totalInserted} shift(s) added (batch #${result.rosterId}).`);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setSuccess(""), 5000);
      await loadRoster(appliedFilters);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleProcessAttendance = async () => {
    const parsed = parseDateRange(processStartDate, processEndDate);
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }

    setProcessingAttendance(true);
    setError("");
    setSuccess("");
    try {
      const result = await attendanceApi.processRoster(parsed);

      const discrepancyNote =
        result.discrepancyCount > 0
          ? ` ${result.discrepancyCount} discrepanc${result.discrepancyCount === 1 ? "y" : "ies"} found.`
          : "";
      const skippedNote =
        (result.skippedCount ?? 0) > 0
          ? ` ${result.skippedCount} shift${result.skippedCount === 1 ? "" : "s"} skipped (employee not on roster).`
          : "";
      const removedNote =
        (result.removedRecordCount ?? 0) > 0
          ? ` ${result.removedRecordCount} mistaken attendance record${result.removedRecordCount === 1 ? "" : "s"} removed.`
          : "";

      setSuccess(
        result.processedCount === 0 && (result.skippedCount ?? 0) > 0
          ? `No roster shifts processed.${skippedNote}${removedNote}`
          : `Processed ${result.processedCount} roster shift${result.processedCount === 1 ? "" : "s"} for ${formatDateRangeLabel(parsed.startDate, parsed.endDate)}.${skippedNote}${removedNote}${discrepancyNote}`,
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingAttendance(false);
    }
  };

  const processRangeReady = processStartDate.trim() !== "" && processEndDate.trim() !== "";

  const filterLabel = appliedFilters.date
    ? `Date: ${appliedFilters.date}`
    : `Year: ${appliedFilters.year}, Month: ${appliedFilters.month}`;

  const parsedMonthYear = parseMonthYear(year, month);
  const deleteMonthLabel =
    typeof parsedMonthYear === "string"
      ? "Delete Month"
      : `Delete ${monthName(parsedMonthYear.month)} ${parsedMonthYear.year}`;

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "center" },
            gap: 2,
            mb: 2,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b" }}>
            Roster Management
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: "#475569" }}>
          Process Roster Attendance
        </Typography>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2, alignItems: { lg: "flex-start" }, mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <DateRangePicker
              startDate={processStartDate}
              endDate={processEndDate}
              onStartDateChange={setProcessStartDate}
              onEndDateChange={setProcessEndDate}
              disabled={processingAttendance}
              helperText={`${formatDateRangeLabel(processStartDate, processEndDate)} — only roster shifts in this range will be processed.`}
            />
          </Box>
          <Button
            variant="outlined"
            startIcon={processingAttendance ? <CircularProgress size={18} color="inherit" /> : <EventAvailableIcon />}
            onClick={handleProcessAttendance}
            disabled={processingAttendance || !processRangeReady}
            sx={{
              whiteSpace: "nowrap",
              borderColor: "#16a34a",
              color: "#16a34a",
              alignSelf: { xs: "stretch", lg: "flex-start" },
              minHeight: 40,
              px: 2.5,
            }}
          >
            Process Roster Attendance
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
          Use quick presets or pick dates from the calendar. Punch logs are matched only for roster shifts that exist in the range.
        </Typography>

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: "#475569" }}>
          Upload Roster File
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 1 }}>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="roster-upload"
            disabled={uploading}
          />
          <label htmlFor="roster-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadFileIcon />}
              disabled={uploading}
            >
              Choose File
            </Button>
          </label>
          {file && (
            <Typography variant="body2" color="text.secondary">
              {file.name}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!file || uploading}
            sx={{ backgroundColor: "#2563eb" }}
          >
            {uploading ? <CircularProgress size={24} color="inherit" /> : "Upload Roster"}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
          Accepted: .csv, .xlsx, .xls — Max 5MB. Required columns: employeeId, date, shiftStart, shiftEnd
        </Typography>

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: "#475569" }}>
          View Roster Shifts
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <TextField
            select
            size="small"
            label="Filter by"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as "month" | "date")}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="month">Year & Month</MenuItem>
            <MenuItem value="date">Specific Date</MenuItem>
          </TextField>

          {filterMode === "month" ? (
            <>
              <TextField
                size="small"
                label="Year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                slotProps={{ htmlInput: { min: 2000, max: 2099 } }}
                sx={{ width: 120 }}
              />
              <TextField
                select
                size="small"
                label="Month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i, 1).toLocaleString("default", { month: "long" })}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <TextField
              size="small"
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 180 }}
            />
          )}

          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            sx={{ backgroundColor: "#1e293b" }}
          >
            Search
          </Button>

          {filterMode === "month" && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteMonthClick}
              disabled={deletingMonth}
            >
              Delete Month
            </Button>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 1, borderRadius: 2 }} elevation={0} variant="outlined">
        <Typography variant="body2" color="text.secondary">
          Showing {entries.length} shift{entries.length === 1 ? "" : "s"} — {filterLabel}
        </Typography>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#1e293b" }}>
                {["Employee ID", "Date", "Shift Start", "Shift End", "Batch ID", "Actions"].map((col) => (
                  <TableCell
                    key={col}
                    sx={{ color: "#fff", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase" }}
                  >
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                    No roster shifts found for the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{entry.employeeId}</TableCell>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{entry.shiftStart}</TableCell>
                    <TableCell>{entry.shiftEnd}</TableCell>
                    <TableCell>{entry.rosterId}</TableCell>
                    <TableCell>
                      <Tooltip title="Delete all shifts for this date">
                        <IconButton
                          size="small"
                          onClick={() => setConfirmDeleteDate(entry.date)}
                          disabled={deletingDate !== null}
                          aria-label={`Delete roster for ${entry.date}`}
                          sx={{ color: "#dc2626" }}
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
        )}
      </TableContainer>

      <Dialog
        open={confirmDeleteMonth}
        onClose={() => !deletingMonth && setConfirmDeleteMonth(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: "#1e293b", color: "#fff", py: 1.5 }}>
          Delete Month
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <DialogContentText>
            {typeof parsedMonthYear !== "string" && (
              <>
                Delete all roster shifts for <strong>{monthName(parsedMonthYear.month)} {parsedMonthYear.year}</strong>?
                This cannot be undone.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setConfirmDeleteMonth(false)} disabled={deletingMonth}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteMonth}
            disabled={deletingMonth}
          >
            {deletingMonth ? "Deleting…" : deleteMonthLabel}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDeleteDate !== null}
        onClose={() => !deletingDate && setConfirmDeleteDate(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: "#1e293b", color: "#fff", py: 1.5 }}>
          Delete Roster by Date
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <DialogContentText>
            {confirmDeleteDate && (
              <>
                Delete all roster shifts for <strong>{confirmDeleteDate}</strong>?
                This removes every employee&apos;s shift on that day.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setConfirmDeleteDate(null)} disabled={!!deletingDate}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteDate}
            disabled={!!deletingDate}
          >
            {deletingDate ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
