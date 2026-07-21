// app/employees/attendance/[employeeId]/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box, Button, Typography, Paper, Alert, CircularProgress,
  TablePagination, Chip, Link,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import AttendanceTable from "@/components/AttendanceTable";
import AttendanceFilterBar, { type AttendanceFilters } from "@/components/AttendanceFilterBar";
import {
  attendanceApi,
  buildAttendanceUpdatePayload,
  getErrorMessage,
  isForbiddenError,
  getTodayDateString,
  type AttendanceRecord,
  type EmployeeAttendanceResponse,
} from "@/lib/api";
import AttendanceForm, { type AttendanceFormData } from "@/components/AttendanceForm";
import { useAuth } from "@/lib/auth";
import { canEditAttendance, canViewEmployees } from "@/lib/roles";

const TODAY = getTodayDateString();
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

type AppliedFilters = AttendanceFilters & { page: number; limit: number };

function defaultApplied(): AppliedFilters {
  return { startDate: TODAY, endDate: TODAY, page: 1, limit: DEFAULT_PAGE_SIZE };
}

export default function EmployeeAttendancePage() {
  const params    = useParams();
  const router    = useRouter();
  const { user } = useAuth();
  const editAttendance = canEditAttendance(user?.role);
  const viewEmployees = canViewEmployees(user?.role);
  const employeeId = typeof params.employeeId === "string" ? params.employeeId : "";

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(defaultApplied());

  const [showBackLink, setShowBackLink] = useState(false);
  const [response, setResponse]     = useState<EmployeeAttendanceResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [formOpen, setFormOpen]     = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("ams-from-employees") === "1") {
      setShowBackLink(true);
      sessionStorage.removeItem("ams-from-employees");
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!employeeId) { setError("Employee ID is required."); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const { status, ...rest } = appliedFilters;
      const result = await attendanceApi.getEmployeeAttendance(employeeId, {
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
  }, [employeeId, appliedFilters, router]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // ── Filter bar callbacks ────────────────────────────────────────────────────

  const handleSearch = (filters: AttendanceFilters) => {
    setAppliedFilters({ ...filters, page: 1, limit: appliedFilters.limit });
  };

  const handleClear = () => {
    setAppliedFilters(defaultApplied());
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
      await attendanceApi.createRecord({
        employeeId,
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

  const employee   = response?.employee;
  const records    = response?.data ?? [];
  const meta       = response?.meta;
  const page       = (appliedFilters.page ?? 1) - 1;
  const rowsPerPage = appliedFilters.limit ?? DEFAULT_PAGE_SIZE;

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        {/* Back link */}
        {showBackLink && viewEmployees && (
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

        {/* Header */}
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
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 1 }}>
              Employee Attendance
            </Typography>

            {employee ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
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
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                Employee ID: <Link component="span" sx={{ fontWeight: 600 }}>{employeeId}</Link>
              </Typography>
            )}
          </Box>

          {editAttendance && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateForm}
              sx={{ backgroundColor: "#16a34a", "&:hover": { backgroundColor: "#15803d" } }}
            >
              Add Attendance
            </Button>
          )}
        </Box>

        {/* Filter bar — employee search hidden since we're scoped to one employee */}
        <AttendanceFilterBar
          onSearch={handleSearch}
          onClear={handleClear}
          showEmployeeSearch={false}
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
        />
      )}
    </Box>
  );
}