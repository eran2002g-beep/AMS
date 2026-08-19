// app/unauthorised/review/page.tsx - manager/admin-manager unauthorised request review queue
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Paper, Alert, CircularProgress, FormControl,
  InputLabel, Select, MenuItem, type SelectChangeEvent,
} from "@mui/material";
import UnauthorisedRequestTable from "@/components/UnauthorisedRequestTable";
import RequestReviewDialog from "@/components/RequestReviewDialog";
import {
  unauthorisedApi,
  getErrorMessage,
  type UnauthorisedRequestRecord,
  type UnauthorisedRequestStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageLeave } from "@/lib/roles";
import { useRouter } from "next/navigation";

type UnauthorisedQueueStatusFilter = UnauthorisedRequestStatus | "awaiting";

const STATUS_OPTIONS: Array<{ value: "" | UnauthorisedQueueStatusFilter; label: string }> = [
  { value: "awaiting", label: "Needs review" },
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "supervisor_approved", label: "Awaiting HOD" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export default function UnauthorisedReviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const manageLeave = canManageLeave(user?.role);

  const [statusFilter, setStatusFilter] = useState<"" | UnauthorisedQueueStatusFilter>("awaiting");
  const [records, setRecords] = useState<UnauthorisedRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [reviewTarget, setReviewTarget] = useState<UnauthorisedRequestRecord | null>(null);
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
      const result = await unauthorisedApi.getQueue({
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

  const openReview = (record: UnauthorisedRequestRecord, next: "approve" | "reject") => {
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
        const updated = await unauthorisedApi.approve(reviewTarget.unauthorisedRequestId, payload);
        setSuccess(
          updated.status === "supervisor_approved"
            ? `Supervisor accepted ${reviewTarget.unauthorisedRequestId}. Waiting for HOD.`
            : `Approved ${reviewTarget.unauthorisedRequestId} for ${reviewTarget.employeeId}.`,
        );
      } else {
        await unauthorisedApi.reject(reviewTarget.unauthorisedRequestId, payload);
        setSuccess(
          `Rejected ${reviewTarget.unauthorisedRequestId} for ${reviewTarget.employeeId}.`,
        );
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
              Review Unauthorised Requests
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Approve or reject unauthorised attendance explanations in sequence: supervisor first, then HOD. Decisions record your name.
            </Typography>
          </Box>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="unauth-status-filter">Status</InputLabel>
            <Select
              labelId="unauth-status-filter"
              label="Status"
              value={statusFilter}
              onChange={(e: SelectChangeEvent) => {
                setStatusFilter(e.target.value as "" | UnauthorisedQueueStatusFilter);
              }}
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
        <UnauthorisedRequestTable
          records={records}
          showEmployee
          emptyMessage="No unauthorised requests in your review queue."
          onApprove={(record) => openReview(record, "approve")}
          onReject={(record) => openReview(record, "reject")}
          reviewingId={submitting ? reviewTarget?.unauthorisedRequestId ?? null : null}
        />
      )}

      <RequestReviewDialog
        open={Boolean(reviewTarget && decision)}
        decision={decision}
        title={
          decision === "approve"
            ? reviewTarget?.status === "supervisor_approved"
              ? "Approve unauthorised request as HOD"
              : "Accept unauthorised request"
            : "Reject unauthorised request"
        }
        subtitle={
          reviewTarget
            ? `${reviewTarget.unauthorisedRequestId} · ${reviewTarget.employeeId} · ${reviewTarget.happenDate}`
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
