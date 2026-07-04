"use client";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Chip,
} from "@mui/material";
import type { AttendanceRecord } from "@/lib/api";

type Props = {
  records: AttendanceRecord[];
};

const COLUMNS = [
  { id: "date", label: "Date" },
  { id: "clockIn", label: "Clock In" },
  { id: "clockOut", label: "Clock Out" },
  { id: "scheduled", label: "Scheduled" },
  { id: "status", label: "Status" },
  { id: "lateCoverMinutes", label: "Late (min)" },
  { id: "notes", label: "Notes" },
];

const display = (value: string | null) => value || "—";

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusChipSx(status: AttendanceRecord["status"]) {
  switch (status) {
    case "present":
      return { backgroundColor: "#dcfce7", color: "#15803d" };
    case "absent":
      return { backgroundColor: "#fee2e2", color: "#b91c1c" };
    case "leave":
      return { backgroundColor: "#e0f2fe", color: "#0369a1" };
    case "unauthorised":
      return { backgroundColor: "#fef3c7", color: "#b45309" };
    case "holiday":
      return { backgroundColor: "#f3e8ff", color: "#7e22ce" };
    default:
      return { backgroundColor: "#f1f5f9", color: "#64748b" };
  }
}

export default function AttendanceTable({ records }: Props) {
  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: "#1e293b" }}>
            {COLUMNS.map((col) => (
              <TableCell
                key={col.id}
                sx={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                }}
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
                No attendance records found for the selected filters.
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{formatDate(record.date)}</TableCell>
                <TableCell>{display(record.clockIn)}</TableCell>
                <TableCell>{display(record.clockOut)}</TableCell>
                <TableCell>
                  {record.scheduledStart && record.scheduledEnd
                    ? `${record.scheduledStart} – ${record.scheduledEnd}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Chip
                    label={record.status}
                    size="small"
                    sx={{
                      ...statusChipSx(record.status),
                      textTransform: "capitalize",
                    }}
                  />
                </TableCell>
                <TableCell>{record.lateCoverMinutes > 0 ? record.lateCoverMinutes : "—"}</TableCell>
                <TableCell>{display(record.notes)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
