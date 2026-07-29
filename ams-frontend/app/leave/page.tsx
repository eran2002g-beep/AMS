// app/leave/page.tsx - AC: employee submits a leave request so management is informed
"use client";
import { useState, useEffect, useCallback } from "react";
import { Box, Button, Typography, Paper, Alert, CircularProgress } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LeaveRequestTable from "@/components/LeaveRequestTable";
import LeaveRequestForm from "@/components/LeaveRequestForm";
import {
  leaveApi,
  getErrorMessage,
  type LeaveRequestRecord,
  type LeaveRequestSubmitPayload,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LeaveRequestPage() {
  const { user } = useAuth();

  const [records, setRecords] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadLeaveRequests = useCallback(async () => {
    if (!user?.employeeId) return;
    setLoading(true);
    setError("");
    try {
      const result = await leaveApi.getForEmployee(user.employeeId, { limit: 100 });
      setRecords(result.data);
    } catch (err) {
      setRecords([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId]);

  useEffect(() => { loadLeaveRequests(); }, [loadLeaveRequests]);

  const handleSubmit = async (data: LeaveRequestSubmitPayload) => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await leaveApi.submit(data);
      setFormOpen(false);
      setSuccess("Leave request submitted. Management has been notified.");
      await loadLeaveRequests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }} elevation={1}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 0.5 }}>
              My Leave Requests
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Request time off and track the status of requests you&apos;ve submitted.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
            sx={{ backgroundColor: "#16a34a", "&:hover": { backgroundColor: "#15803d" } }}
          >
            Request Leave
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
        <LeaveRequestTable records={records} />
      )}

      <LeaveRequestForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </Box>
  );
}