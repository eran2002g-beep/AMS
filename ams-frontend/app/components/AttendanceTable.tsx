"use client";
import { useState } from "react";
import {
  Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Chip,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button, Box, Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import GavelIcon from "@mui/icons-material/Gavel";
import type { AttendanceRecord, Employee } from "@/lib/api";
import {
  formatLateMinutes,
  formatDayType,
  getArrivalLateMinutes,
  getAttendanceDisplayStatus,
  getDayTypeChipSx,
  getLateCoverMinutes,
  getRequiredClockOut,
} from "@/lib/api";

type Props = {
  records: AttendanceRecord[];
  onEdit?: (record: AttendanceRecord) => void;
  onDelete?: (record: AttendanceRecord) => Promise<void>;
  onResolveUnauthorised?: (record: AttendanceRecord) => void;
  /** Internal attendance PKs that already have a pending/approved unauthorised request */
  resolvingAttendanceIds?: number[];
  deletingAttendanceId?: string | null;
  employeeMap?: Record<string, Employee>;
};

const COLUMNS = [
  { id: "date", label: "Date" },
  { id: "clockIn", label: "Clock In" },
  { id: "clockOut", label: "Clock Out" },
  { id: "scheduled", label: "Scheduled" },
  { id: "dayType", label: "Day Type" },
  { id: "status", label: "Status" },
  { id: "lateMinutes", label: "Late (min)" },
  { id: "lateCoverMinutes", label: "Cover owed (min)" },
  { id: "notes", label: "Notes" },
];

const display = (value: string | null) => value || "—";

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function lateCellSx(minutes: number) {
  return minutes > 0
    ? { color: "#c2410c", fontWeight: 700 }
    : { color: "inherit" };
}

function coverCellSx(minutes: number) {
  return minutes > 0
    ? { color: "#b45309", fontWeight: 700 }
    : { color: "inherit" };
}

export default function AttendanceTable({
  records,
  onEdit,
  onDelete,
  onResolveUnauthorised,
  resolvingAttendanceIds = [],
  deletingAttendanceId,
  employeeMap,
}: Props) {
  const [confirmTarget, setConfirmTarget] = useState<AttendanceRecord | null>(null);
  const showActions = !!onEdit || !!onDelete || !!onResolveUnauthorised;
  const columnCount = COLUMNS.length + (showActions ? 1 : 0) + (employeeMap ? 1 : 0);
  const pendingResolveSet = new Set(resolvingAttendanceIds);

  const handleConfirmDelete = async () => {
    if (!confirmTarget || !onDelete) return;
    await onDelete(confirmTarget);
    setConfirmTarget(null);
  };

  return (
    <>
      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#1e293b" }}>
              {employeeMap && (
                <TableCell
                  sx={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                  }}
                >
                  Employee
                </TableCell>
              )}
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
              {showActions && (
                <TableCell
                  sx={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                  }}
                >
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} align="center" sx={{ color: "#94a3b8", py: 4 }}>
                  No attendance records found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => {
                const lateMinutes = getArrivalLateMinutes(record);
                const coverOwed = getLateCoverMinutes(record);
                const displayStatus = getAttendanceDisplayStatus(record);
                const requiredClockOut = getRequiredClockOut(record);
                const emp = employeeMap ? employeeMap[record.employeeId] : undefined;

                return (
                <TableRow key={record.id} hover>
                  {employeeMap && (
                    <TableCell sx={{ fontWeight: 600 }}>
                      {emp ? (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "#1e293b" }}>
                            {emp.firstName} {emp.lastName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                            {emp.employeeId} {emp.department ? `· ${emp.department}` : ""}
                          </Typography>
                        </Box>
                      ) : (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "#94a3b8" }}>
                            Unknown Employee
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                            {record.employeeId}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 600 }}>{formatDate(record.date)}</TableCell>
                  <TableCell>{display(record.clockIn)}</TableCell>
                  <TableCell>{display(record.clockOut)}</TableCell>
                  <TableCell>
                    {record.scheduledStart && record.scheduledEnd
                      ? `${record.scheduledStart} – ${record.scheduledEnd}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {record.dayType ? (
                      <Chip
                        label={formatDayType(record.dayType)}
                        size="small"
                        sx={{
                          ...getDayTypeChipSx(record.dayType),
                          textTransform: "none",
                          fontWeight: 600,
                        }}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={displayStatus.detail ?? ""} disableHoverListener={!displayStatus.detail}>
                      <Chip
                        label={displayStatus.label}
                        size="small"
                        sx={{
                          ...displayStatus.chipSx,
                          textTransform: "none",
                          fontWeight: 600,
                        }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={lateCellSx(lateMinutes)}>
                    {formatLateMinutes(lateMinutes)}
                  </TableCell>
                  <TableCell sx={coverCellSx(coverOwed)}>
                    <Tooltip
                      title={
                        coverOwed > 0 && requiredClockOut
                          ? `Should have clocked out by ${requiredClockOut}`
                          : coverOwed > 0
                            ? "Late cover time not made up"
                            : ""
                      }
                      disableHoverListener={coverOwed <= 0}
                    >
                      <span>{formatLateMinutes(coverOwed)}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{display(record.notes)}</TableCell>
                  {showActions && (
                    <TableCell>
                      {onResolveUnauthorised && record.status === "unauthorised" && (
                        <Tooltip
                          title={
                            pendingResolveSet.has(record.id)
                              ? "Unauthorised request already submitted"
                              : "Resolve Unauthorised Leave"
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<GavelIcon fontSize="small" />}
                              onClick={() => onResolveUnauthorised(record)}
                              disabled={pendingResolveSet.has(record.id)}
                              aria-label={`Resolve unauthorised leave for ${formatDate(record.date)}`}
                              sx={{
                                mr: 0.5,
                                textTransform: "none",
                                borderColor: "#ea580c",
                                color: "#c2410c",
                                "&:hover": {
                                  borderColor: "#c2410c",
                                  backgroundColor: "#fff7ed",
                                },
                              }}
                            >
                              Resolve
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                      {onEdit && (
                        <Tooltip title="Edit attendance">
                          <IconButton
                            size="small"
                            onClick={() => onEdit(record)}
                            aria-label={`Edit attendance for ${formatDate(record.date)}`}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onDelete && (
                        <Tooltip title="Delete attendance">
                          <IconButton
                            size="small"
                            onClick={() => setConfirmTarget(record)}
                            disabled={deletingAttendanceId === record.attendanceId}
                            aria-label={`Delete attendance for ${formatDate(record.date)}`}
                            sx={{ color: "#dc2626", ml: onEdit ? 0.5 : 0 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  )}
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={confirmTarget !== null}
        onClose={() => !deletingAttendanceId && setConfirmTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: "#1e293b", color: "#fff", py: 1.5 }}>
          Delete Attendance
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <DialogContentText>
            {confirmTarget && (
              <>
                Delete attendance record for{" "}
                <strong>{formatDate(confirmTarget.date)}</strong> ({confirmTarget.attendanceId})?
                This cannot be undone.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setConfirmTarget(null)} disabled={!!deletingAttendanceId}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={!!deletingAttendanceId}
          >
            {deletingAttendanceId ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
