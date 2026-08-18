"use client";
import { useState } from "react";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Chip, Tooltip, Button, Stack, IconButton,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { LEAVE_TYPE_OPTIONS, type LeaveRequestRecord, type LeaveStatus } from "@/lib/api";
import RequestDetailDialog from "@/components/RequestDetailDialog";

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
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

function leaveTypeLabel(value: LeaveRequestRecord["leaveType"]) {
  return LEAVE_TYPE_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function statusChipSx(status: LeaveStatus) {
  switch (status) {
    case "approved":
      return { backgroundColor: "#dcfce7", color: "#15803d" };
    case "rejected":
      return { backgroundColor: "#fee2e2", color: "#b91c1c" };
    case "cancelled":
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
    case "pending":
    default:
      return { backgroundColor: "#fef3c7", color: "#b45309" };
  }
}

function statusLabel(status: LeaveStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function reviewerLabel(record: LeaveRequestRecord) {
  if (record.status === "pending") return "—";
  if (record.reviewedByName) return record.reviewedByName;
  if (record.reviewedBy) return record.reviewedBy;
  return "—";
}

type Props = {
  records: LeaveRequestRecord[];
  /** When true, show the employee ID column (manager review queue). */
  showEmployee?: boolean;
  emptyMessage?: string;
  onApprove?: (record: LeaveRequestRecord) => void;
  onReject?: (record: LeaveRequestRecord) => void;
  reviewingId?: string | null;
};

export default function LeaveRequestTable({
  records,
  showEmployee = false,
  emptyMessage = "You haven't submitted any leave requests yet.",
  onApprove,
  onReject,
  reviewingId,
}: Props) {
  const [detailRecord, setDetailRecord] = useState<LeaveRequestRecord | null>(null);
  const showReviewActions = Boolean(onApprove || onReject);

  const columns = [
    ...(showEmployee ? [{ id: "employeeId", label: "Employee" }] : []),
    { id: "leaveType", label: "Type" },
    { id: "dates", label: "Dates" },
    { id: "totalDays", label: "Days" },
    { id: "reason", label: "Reason" },
    { id: "status", label: "Status" },
    { id: "reviewedBy", label: "Reviewed by" },
    { id: "reviewedAt", label: "Reviewed at" },
    { id: "submitted", label: "Submitted" },
    { id: "actions", label: "Actions" },
  ];

  return (
    <>
      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#1e293b" }}>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  sx={{ color: "#fff", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase" }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id} hover>
                  {showEmployee && (
                    <TableCell sx={{ fontWeight: 600 }}>{record.employeeId}</TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 600 }}>{leaveTypeLabel(record.leaveType)}</TableCell>
                  <TableCell>
                    {record.startDate === record.endDate
                      ? formatDate(record.startDate)
                      : `${formatDate(record.startDate)} – ${formatDate(record.endDate)}`}
                  </TableCell>
                  <TableCell>{record.totalDays}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Tooltip title={record.reason}>
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {record.reason}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      title={record.status !== "pending" && record.reviewComments ? record.reviewComments : ""}
                      disableHoverListener={record.status === "pending" || !record.reviewComments}
                    >
                      <Chip
                        label={statusLabel(record.status)}
                        size="small"
                        sx={{ ...statusChipSx(record.status), textTransform: "none", fontWeight: 600 }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {reviewerLabel(record)}
                    {record.reviewedBy && record.reviewedByName ? (
                      <Tooltip title={record.reviewedBy}>
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>
                          {record.reviewedBy}
                        </span>
                      </Tooltip>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDateTime(record.reviewedAt)}</TableCell>
                  <TableCell>{record.createdAt ? formatDate(record.createdAt.slice(0, 10)) : "—"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          aria-label="View leave request details"
                          onClick={() => setDetailRecord(record)}
                          sx={{ color: "#475569" }}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {showReviewActions && record.canAccept && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={reviewingId === record.leaveRequestId}
                            onClick={() => onApprove?.(record)}
                            sx={{ backgroundColor: "#16a34a", "&:hover": { backgroundColor: "#15803d" } }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={reviewingId === record.leaveRequestId}
                            onClick={() => onReject?.(record)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <RequestDetailDialog
        kind="leave"
        open={Boolean(detailRecord)}
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
      />
    </>
  );
}
