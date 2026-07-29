"use client";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Chip, Tooltip,
} from "@mui/material";
import { LEAVE_TYPE_OPTIONS, type LeaveRequestRecord, type LeaveStatus } from "@/lib/api";

const COLUMNS = [
  { id: "leaveType", label: "Type" },
  { id: "dates", label: "Dates" },
  { id: "totalDays", label: "Days" },
  { id: "reason", label: "Reason" },
  { id: "status", label: "Status" },
  { id: "submitted", label: "Submitted" },
];

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

type Props = {
  records: LeaveRequestRecord[];
};

export default function LeaveRequestTable({ records }: Props) {
  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: "#1e293b" }}>
            {COLUMNS.map((col) => (
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
              <TableCell colSpan={COLUMNS.length} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                You haven&apos;t submitted any leave requests yet.
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{leaveTypeLabel(record.leaveType)}</TableCell>
                <TableCell>
                  {record.startDate === record.endDate
                    ? formatDate(record.startDate)
                    : `${formatDate(record.startDate)} – ${formatDate(record.endDate)}`}
                </TableCell>
                <TableCell>{record.totalDays}</TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
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
                <TableCell>{record.createdAt ? formatDate(record.createdAt.slice(0, 10)) : "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}