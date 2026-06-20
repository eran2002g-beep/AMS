// app/rosters/page.tsx
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box, Button, Typography, Paper,
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer,
  Alert, CircularProgress,
  TextField, MenuItem,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SearchIcon from "@mui/icons-material/Search";
import { rosterApi, type RosterEntry, type RosterViewFilters, getErrorMessage } from "@/lib/api";

const now = new Date();

function defaultFilters(): RosterViewFilters {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function RostersPage() {
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
  const inputRef = useRef<HTMLInputElement>(null);

  const loadRoster = useCallback(async (filters: { date?: string; year?: number; month?: number }) => {
    setLoading(true);
    setError("");
    try {
      const response = await rosterApi.view(filters);
      setEntries(response.data);
    } catch (err) {
      setEntries([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster(appliedFilters);
  }, [appliedFilters, loadRoster]);

  const handleSearch = () => {
    if (filterMode === "date") {
      if (!date.trim()) {
        setError("Please select a date.");
        return;
      }
      setAppliedFilters({ date: date.trim() });
    } else {
      const parsedYear = Number(year);
      const parsedMonth = Number(month);
      if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2099) {
        setError("Year must be between 2000 and 2099.");
        return;
      }
      if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        setError("Month must be between 1 and 12.");
        return;
      }
      setAppliedFilters({ year: parsedYear, month: parsedMonth });
    }
    setError("");
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

  const filterLabel = appliedFilters.date
    ? `Date: ${appliedFilters.date}`
    : `Year: ${appliedFilters.year}, Month: ${appliedFilters.month}`;

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 2 }}>
          Roster Management
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

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
                {["Employee ID", "Date", "Shift Start", "Shift End", "Batch ID"].map((col) => (
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
                  <TableCell colSpan={5} align="center" sx={{ color: "#94a3b8", py: 4 }}>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Box>
  );
}
