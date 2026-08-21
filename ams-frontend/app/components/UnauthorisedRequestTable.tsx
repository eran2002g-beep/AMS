"use client";
import { useState } from "react";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Chip, Tooltip, Button, Stack, IconButton,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  requestStatusChipSx,
  requestStatusLabel,
  type UnauthorisedRequestRecord,
} from "@/lib/api";
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

function sliceTime(value: string | null) {
  return value ? value.slice(0, 5) : "—";
}

function reviewerLabel(record: UnauthorisedRequestRecord) {
  if (record.status === "pending") return "—";
  if (record.reviewedByName) return record.reviewedByName;
  if (record.reviewedBy) return record.reviewedBy;
  return "—";
}

type Props = {
  records: UnauthorisedRequestRecord[];
  showEmployee?: boolean;
  emptyMessage?: string;
  onApprove?: (record: UnauthorisedRequestRecord) => void;
  onReject?: (record: UnauthorisedRequestRecord) => void;
  reviewingId?: string | null;
};

export default function UnauthorisedRequestTable({
  records,
  showEmployee = false,
  emptyMessage = "No unauthorised requests yet.",
  onApprove,
  onReject,
  reviewingId,
}: Props) {
  const [detailRecord, setDetailRecord] = useState<UnauthorisedRequestRecord | null>(null);
  const showReviewActions = Boolean(onApprove || onReject);

  const columns = [
    ...(showEmployee ? [{ id: "employeeId", label: "Employee" }] : []),
    { id: "happenDate", label: "Date" },
    { id: "times", label: "Claimed times" },
    { id: "reason", label: "Reason" },
    { id: "description", label: "Description" },
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
                    <TableCell>
                      <span style={{ fontWeight: 600, display: "block" }}>
                        {record.employeeName || record.employeeId}
                      </span>
                      {record.employeeName ? (
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          {record.employeeId}
                        </span>
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell>{formatDate(record.happenDate)}</TableCell>
                  <TableCell>
                    {sliceTime(record.clockIn)} – {sliceTime(record.clockOut)}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 180 }}>
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
                  <TableCell sx={{ maxWidth: 200 }}>
                    <Tooltip title={record.description}>
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {record.description}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      title={record.reviewComments ? record.reviewComments : ""}
                      disableHoverListener={!record.reviewComments}
                    >
                      <Chip
                        label={requestStatusLabel(record.status)}
                        size="small"
                        sx={{ ...requestStatusChipSx(record.status), textTransform: "none", fontWeight: 600 }}
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
                          aria-label="View unauthorised request details"
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
                            disabled={reviewingId === record.unauthorisedRequestId}
                            onClick={() => onApprove?.(record)}
                            sx={{ backgroundColor: "#16a34a", "&:hover": { backgroundColor: "#15803d" } }}
                          >
                            {record.status === "supervisor_approved" ? "Approve" : "Accept"}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={reviewingId === record.unauthorisedRequestId}
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
        kind="unauthorised"
        open={Boolean(detailRecord)}
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        canReview={Boolean(showReviewActions && detailRecord?.canAccept)}
        reviewing={reviewingId === detailRecord?.unauthorisedRequestId}
        onApprove={() => {
          if (!detailRecord) return;
          onApprove?.(detailRecord);
          setDetailRecord(null);
        }}
        onReject={() => {
          if (!detailRecord) return;
          onReject?.(detailRecord);
          setDetailRecord(null);
        }}
      />
    </>
  );
}
