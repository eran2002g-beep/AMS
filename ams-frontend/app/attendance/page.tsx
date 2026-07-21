// app/attendance/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Typography, Paper, Alert, CircularProgress, TablePagination,
} from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import AddIcon from "@mui/icons-material/Add";
import AttendanceTable from "@/components/AttendanceTable";
import AttendanceFilterBar, { type AttendanceFilters } from "@/components/AttendanceFilterBar";
import {
  attendanceApi,
  employeeApi,
  buildAttendanceUpdatePayload,
  getErrorMessage,
  isForbiddenError,
  getTodayDateString,
  type AttendanceRecord,
  type AllAttendanceResponse,
  type Employee,
} from "@/lib/api";
import AttendanceForm, { type AttendanceFormData } from "@/components/AttendanceForm";
import { useAuth } from "@/lib/auth";
import { canEditAttendance } from "@/lib/roles";
import { useRouter } from "next/navigation";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

type AppliedFilters = AttendanceFilters & { page: number; limit: number };

/** Load all records on first visit; date/status filters apply only after Search. */
function defaultApplied(): AppliedFilters {
  return { page: 1, limit: DEFAULT_PAGE_SIZE };
}

export default function AllAttendancePage() {
  const router = useRouter();
  const { user } = useAuth();
  const editAttendance = canEditAttendance(user?.role);

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(defaultApplied());
  const [filterError, setFilterError] = useState("");

  const [response, setResponse] = useState<AllAttendanceResponse | null>(null);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [employeesMap, setEmployeesMap] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState<string | null>(null);
  const [processingAttendance, setProcessingAttendance] = useState(false);

  // Load all active employees to map ID → name in table and populate add-form dropdown
  useEffect(() => {
    employeeApi.list({ limit: 1000 })
      .then((res) => {
        setEmployeesList(res.employees);
        const map: Record<string, Employee> = {};
        res.employees.forEach((emp) => { map[emp.employeeId] = emp; });
        setEmployeesMap(map);
      })
      .catch((err) => console.error("Failed to load employees", err));
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { status, ...rest } = appliedFilters;
      const result = await attendanceApi.getAllAttendance({
        ...rest,
        ...(status ? { status } : {}),
      });
      setResponse(result);
    } catch (err) {
      setResponse(null);
      if (isForbiddenError(err)) {
        setAccessDenied(true);
        router.replace("/access-denied");
        return;
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, router]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // ── Filter bar callbacks ────────────────────────────────────────────────────

  const handleSearch = (filters: AttendanceFilters) => {
    setAppliedFilters({
      ...filters,
      page: 1,
      limit: appliedFilters.limit,
    });
  };

  const handleClear = () => {
    setFilterError("");
    setAppliedFilters(defaultApplied());
  };

  // ── Process attendance ──────────────────────────────────────────────────────

  const handleProcessAttendance = async () => {
    setProcessingAttendance(true);
    setError("");
    setSuccess("");
    try {
      const result = await attendanceApi.processToday();
      const note = result.discrepancyCount > 0
        ? ` ${result.discrepancyCount} discrepancy found.`
        : "";
      setSuccess(
        `Processed today's attendance for ${result.processedCount} employee${result.processedCount === 1 ? "" : "s"}.${note}`,
      );
      await loadAttendance();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingAttendance(false);
    }
  };

  // ── Form callbacks ──────────────────────────────────────────────────────────

  const openCreateForm = () => { setEditingRecord(null); setFormOpen(true); };
  const openEditForm   = (rec: AttendanceRecord) => { setEditingRecord(rec); setFormOpen(true); };
  const closeForm      = () => { setFormOpen(false); setEditingRecord(null); };

  const handleAddAttendance = async (data: AttendanceFormData) => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      if (!data.employeeId) throw new Error("Employee selection is required.");
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
    if (Object.keys(changes).length === 0) { setSuccess("No changes to save."); closeForm(); return; }
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

  // ── Pagination ──────────────────────────────────────────────────────────────

  const handlePageChange = (_: unknown, newPage: number) =>
    setAppliedFilters((prev) => ({ ...prev, page: newPage + 1 }));

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAppliedFilters((prev) => ({ ...prev, page: 1, limit: parseInt(e.target.value, 10) }));

  // ── Render ──────────────────────────────────────────────────────────────────

  if (accessDenied) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const records    = response?.data ?? [];
  const meta       = response?.meta;
  const page       = (appliedFilters.page ?? 1) - 1;
  const rowsPerPage = appliedFilters.limit ?? DEFAULT_PAGE_SIZE;

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        {/* ── Header ── */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 0.5 }}>
              All Attendance Records
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Monitor and manage attendance logs across all active company employees.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {editAttendance && (
              <>
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
              </>
            )}
          </Box>
        </Box>

        {/* ── Filter bar ── */}
        <AttendanceFilterBar
          onSearch={handleSearch}
          onClear={handleClear}
          showEmployeeSearch
          errorMessage={filterError}
          onErrorClear={() => setFilterError("")}
        />
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
            onEdit={editAttendance ? openEditForm : undefined}
            onDelete={editAttendance ? handleDeleteAttendance : undefined}
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

      {editAttendance && (
        <AttendanceForm
          open={formOpen}
          onClose={closeForm}
          onSubmit={editingRecord ? handleUpdateAttendance : handleAddAttendance}
          submitting={submitting}
          defaultDate={getTodayDateString()}
          record={editingRecord}
          employeesList={employeesList}
        />
      )}
    </Box>
  );
}
