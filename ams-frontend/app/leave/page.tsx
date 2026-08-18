// app/leave/page.tsx - AC: employee submits leave and tracks leave + unauthorised request status
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Typography, Paper, Alert, CircularProgress, Tabs, Tab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LeaveRequestTable from "@/components/LeaveRequestTable";
import LeaveRequestForm from "@/components/LeaveRequestForm";
import UnauthorisedRequestTable from "@/components/UnauthorisedRequestTable";
import {
  leaveApi,
  unauthorisedApi,
  getErrorMessage,
  type LeaveRequestRecord,
  type LeaveRequestSubmitPayload,
  type UnauthorisedRequestRecord,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LeaveRequestPage() {
  const { user } = useAuth();

  const [tab, setTab] = useState(0);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRequestRecord[]>([]);
  const [unauthRecords, setUnauthRecords] = useState<UnauthorisedRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!user?.employeeId) return;
    setLoading(true);
    setError("");
    try {
      const [leaveResult, unauthResult] = await Promise.all([
        leaveApi.getForEmployee(user.employeeId, { limit: 100 }),
        unauthorisedApi.getForEmployee(user.employeeId, { limit: 100 }),
      ]);
      setLeaveRecords(leaveResult.data);
      setUnauthRecords(unauthResult.data);
    } catch (err) {
      setLeaveRecords([]);
      setUnauthRecords([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleSubmit = async (data: LeaveRequestSubmitPayload) => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await leaveApi.submit(data);
      setFormOpen(false);
      setSuccess("Leave request submitted. Management has been notified.");
      setTab(0);
      await loadRequests();
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
              My Requests
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Track leave and unauthorised attendance requests, including who approved or rejected them.
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
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Paper sx={{ mb: 2, borderRadius: 2 }} elevation={0}>
        <Tabs
          value={tab}
          onChange={(_, value: number) => setTab(value)}
          sx={{ borderBottom: "1px solid #e2e8f0", px: 1 }}
        >
          <Tab label={`Leave (${leaveRecords.length})`} />
          <Tab label={`Unauthorised (${unauthRecords.length})`} />
        </Tabs>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : tab === 0 ? (
        <LeaveRequestTable records={leaveRecords} />
      ) : (
        <UnauthorisedRequestTable
          records={unauthRecords}
          emptyMessage="You haven't submitted any unauthorised requests yet. Resolve an unauthorised attendance day from My Attendance."
        />
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
