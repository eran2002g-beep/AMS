// app/leave/review/page.tsx - manager/admin-manager leave request review queue
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Paper, Alert, CircularProgress, FormControl,
  InputLabel, Select, MenuItem, type SelectChangeEvent,
} from "@mui/material";
import LeaveRequestTable from "@/components/LeaveRequestTable";
import RequestReviewDialog from "@/components/RequestReviewDialog";
import {
  leaveApi,
  getErrorMessage,
  type LeaveRequestRecord,
  type LeaveQueueStatusFilter,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageLeave } from "@/lib/roles";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS: Array<{ value: "" | LeaveQueueStatusFilter; label: string }> = [
  { value: "awaiting", label: "Needs review" },
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "supervisor_approved", label: "Awaiting HOD" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export default function LeaveReviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const manageLeave = canManageLeave(user?.role);

  const [statusFilter, setStatusFilter] = useState<"" | LeaveQueueStatusFilter>("awaiting");
  const [records, setRecords] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [reviewTarget, setReviewTarget] = useState<LeaveRequestRecord | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !manageLeave) {
      router.replace("/access-denied");
    }
  }, [user, manageLeave, router]);

  const loadQueue = useCallback(async () => {
    if (!manageLeave) return;
    setLoading(true);
    setError("");
    try {
      const result = await leaveApi.getQueue({
        ...(statusFilter ? { status: statusFilter } : {}),
        limit: 100,
      });
      setRecords(result.data);
    } catch (err) {
      setRecords([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [manageLeave, statusFilter]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const openReview = (record: LeaveRequestRecord, next: "approve" | "reject") => {
    setReviewTarget(record);
    setDecision(next);
  };

  const handleConfirm = async (reviewComments: string) => {
    if (!reviewTarget || !decision) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = reviewComments ? { reviewComments } : {};
      if (decision === "approve") {
        const updated = await leaveApi.approve(reviewTarget.leaveRequestId, payload);
        setSuccess(
          updated.status === "supervisor_approved"
            ? `Supervisor accepted ${reviewTarget.leaveRequestId}. Waiting for HOD.`
            : `Approved ${reviewTarget.leaveRequestId} for ${reviewTarget.employeeId}.`,
        );
      } else {
        await leaveApi.reject(reviewTarget.leaveRequestId, payload);
        setSuccess(`Rejected ${reviewTarget.leaveRequestId} for ${reviewTarget.employeeId}.`);
      }
      setReviewTarget(null);
      setDecision(null);
      await loadQueue();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!manageLeave) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

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
              Review Leave Requests
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Approve or reject leave in sequence: supervisor first, then HOD. Decisions record your name.
            </Typography>
          </Box>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="leave-status-filter">Status</InputLabel>
            <Select
              labelId="leave-status-filter"
              label="Status"
              value={statusFilter}
              onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value as "" | LeaveQueueStatusFilter)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value || "all"} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <LeaveRequestTable
          records={records}
          showEmployee
          emptyMessage="No leave requests in your review queue."
          onApprove={(record) => openReview(record, "approve")}
          onReject={(record) => openReview(record, "reject")}
          reviewingId={submitting ? reviewTarget?.leaveRequestId ?? null : null}
        />
      )}

      <RequestReviewDialog
        open={Boolean(reviewTarget && decision)}
        decision={decision}
        title={
          decision === "approve"
            ? reviewTarget?.status === "supervisor_approved"
              ? "Approve leave request as HOD"
              : "Accept leave request"
            : "Reject leave request"
        }
        subtitle={
          reviewTarget
            ? `${reviewTarget.leaveRequestId} · ${reviewTarget.employeeId}`
            : undefined
        }
        submitting={submitting}
        onClose={() => {
          if (!submitting) {
            setReviewTarget(null);
            setDecision(null);
          }
        }}
        onConfirm={handleConfirm}
      />
    </Box>
  );
}
