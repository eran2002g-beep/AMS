"use client";
import type { ReactNode } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, Typography, Box, Divider, Stack,
} from "@mui/material";
import {
  LEAVE_TYPE_OPTIONS,
  requestStatusChipSx,
  requestStatusLabel,
  type LeaveRequestRecord,
  type LeaveStatus,
  type UnauthorisedRequestRecord,
  type UnauthorisedRequestStatus,
} from "@/lib/api";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sliceTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "—";
}

function statusChipSx(status: LeaveStatus | UnauthorisedRequestStatus) {
  return requestStatusChipSx(status);
}

function statusLabel(status: LeaveStatus | UnauthorisedRequestStatus) {
  return requestStatusLabel(status);
}

function leaveTypeLabel(value: LeaveRequestRecord["leaveType"]) {
  return LEAVE_TYPE_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function personLabel(name?: string | null, employeeId?: string | null) {
  if (name && employeeId) return `${name} (${employeeId})`;
  if (name) return name;
  if (employeeId) return employeeId;
  return "Not assigned";
}

function hierarchyStatus(
  record: LeaveRequestRecord | UnauthorisedRequestRecord,
  role: "hod" | "supervisor",
) {
  const assigned =
    role === "hod"
      ? Boolean(record.hodName || record.hodEmployeeId || record.hod)
      : Boolean(record.supervisorName || record.supervisorEmployeeId || record.supervisor);

  if (!assigned) return "Not assigned";

  if (record.status === "pending") {
    if (role === "supervisor") return "Pending review";
    if (record.supervisorName || record.supervisorEmployeeId || record.supervisor) {
      return "Waiting for supervisor";
    }
    return "Pending review";
  }

  if (record.status === "supervisor_approved") {
    if (role === "supervisor") return "Accepted";
    return "Pending review";
  }

  if (record.reviewedByRole === role) {
    if (record.status === "approved") return "Accepted";
    if (record.status === "rejected") return "Rejected";
  }

  if (record.status === "approved") {
    return "Accepted";
  }

  if (record.status === "rejected") {
    if (role === "supervisor" && record.reviewedByRole === "hod") return "Accepted";
    if (role === "hod" && record.reviewedByRole === "supervisor") return "Not reached";
    return "Decision made by other assigned admin";
  }

  return statusLabel(record.status);
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "150px 1fr" },
        gap: { xs: 0.25, sm: 2 },
        py: 1.25,
      }}
    >
      <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: "#1e293b", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Box>
  );
}

type LeaveProps = {
  kind: "leave";
  open: boolean;
  record: LeaveRequestRecord | null;
  onClose: () => void;
};

type UnauthProps = {
  kind: "unauthorised";
  open: boolean;
  record: UnauthorisedRequestRecord | null;
  onClose: () => void;
};

type Props = LeaveProps | UnauthProps;

function reviewerDisplay(record: LeaveRequestRecord | UnauthorisedRequestRecord) {
  if (record.status === "pending") {
    const hasSupervisor = Boolean(
      record.supervisorName || record.supervisorEmployeeId || record.supervisor,
    );
    return hasSupervisor ? "Awaiting supervisor" : "Awaiting HOD";
  }
  if (record.status === "supervisor_approved") {
    return "Supervisor accepted · awaiting HOD";
  }
  if (record.reviewedBy === "SYSTEM") return "System (auto-accept)";
  const role =
    record.reviewedByRole === "hod"
      ? "HOD"
      : record.reviewedByRole === "supervisor"
        ? "Supervisor"
        : null;
  const who =
    record.reviewedByName && record.reviewedBy
      ? `${record.reviewedByName} (${record.reviewedBy})`
      : record.reviewedByName || record.reviewedBy || "—";
  return role ? `${who} · ${role}` : who;
}

function decisionLabel(status: string) {
  if (status === "approved") return "Accepted / approved";
  if (status === "supervisor_approved") return "Supervisor accepted · awaiting HOD";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";
  return "Pending decision";
}

export default function RequestDetailDialog(props: Props) {
  const { open, onClose, kind, record } = props;
  if (!record) return null;

  const requestId =
    kind === "leave"
      ? (record as LeaveRequestRecord).leaveRequestId
      : (record as UnauthorisedRequestRecord).unauthorisedRequestId;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        {kind === "leave" ? "Leave request details" : "Unauthorised request details"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: "#94a3b8", letterSpacing: 0.4 }}>
            {requestId}
          </Typography>
          <Chip
            label={statusLabel(record.status)}
            size="small"
            sx={{
              ...statusChipSx(record.status),
              textTransform: "none",
              fontWeight: 600,
              alignSelf: "flex-start",
            }}
          />
        </Stack>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
          Request
        </Typography>
        <DetailRow label="Employee">{record.employeeId}</DetailRow>
        {kind === "leave" ? (
          <>
            <DetailRow label="Type">
              {leaveTypeLabel((record as LeaveRequestRecord).leaveType)}
            </DetailRow>
            <DetailRow label="Dates">
              {(record as LeaveRequestRecord).startDate === (record as LeaveRequestRecord).endDate
                ? formatDate((record as LeaveRequestRecord).startDate)
                : `${formatDate((record as LeaveRequestRecord).startDate)} – ${formatDate((record as LeaveRequestRecord).endDate)}`}
            </DetailRow>
            <DetailRow label="Duration">
              {(record as LeaveRequestRecord).duration === "half_day"
                ? `Half day (${(record as LeaveRequestRecord).halfDayPeriod ?? "morning"})`
                : `Full day · ${(record as LeaveRequestRecord).totalDays} day(s)`}
            </DetailRow>
            <DetailRow label="Reason">{(record as LeaveRequestRecord).reason}</DetailRow>
          </>
        ) : (
          <>
            <DetailRow label="Happen date">
              {formatDate((record as UnauthorisedRequestRecord).happenDate)}
            </DetailRow>
            <DetailRow label="Claimed times">
              {`${sliceTime((record as UnauthorisedRequestRecord).clockIn)} – ${sliceTime((record as UnauthorisedRequestRecord).clockOut)}`}
            </DetailRow>
            <DetailRow label="Reason">{(record as UnauthorisedRequestRecord).reason}</DetailRow>
            <DetailRow label="Description">
              {(record as UnauthorisedRequestRecord).description}
            </DetailRow>
          </>
        )}
        <DetailRow label="Submitted">{formatDateTime(record.createdAt)}</DetailRow>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
          Admin hierarchy
        </Typography>
        <DetailRow label="HOD">
          {`${personLabel(record.hodName, record.hodEmployeeId)} · ${hierarchyStatus(record, "hod")}`}
        </DetailRow>
        <DetailRow label="Supervisor">
          {`${personLabel(record.supervisorName, record.supervisorEmployeeId)} · ${hierarchyStatus(record, "supervisor")}`}
        </DetailRow>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
          Admin decision
        </Typography>
        <DetailRow label="Decision">{decisionLabel(record.status)}</DetailRow>
        <DetailRow label="Reviewed by">{reviewerDisplay(record)}</DetailRow>
        <DetailRow label="Reviewed at">{formatDateTime(record.reviewedAt)}</DetailRow>
        <DetailRow label="Comments">
          {record.reviewComments?.trim() || (record.status === "pending" || record.status === "supervisor_approved" ? "No comments yet" : "—")}
        </DetailRow>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} variant="contained" sx={{ backgroundColor: "#1e293b" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
