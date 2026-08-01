"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, CircularProgress, Typography,
} from "@mui/material";
import type { AttendanceRecord, UnauthorisedRequestSubmitPayload } from "@/lib/api";
import TimePickerField from "@/components/TimePickerField";

type FormData = {
  clockIn: string;
  clockOut: string;
  reason: string;
  description: string;
};

type Props = {
  open: boolean;
  record: AttendanceRecord | null;
  onClose: () => void;
  onSubmit: (data: UnauthorisedRequestSubmitPayload) => Promise<void>;
  submitting?: boolean;
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function sliceTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export default function UnauthorisedRequestForm({
  open,
  record,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const needsClockIn = !!record && !record.clockIn;
  const needsClockOut = !!record && !record.clockOut;

  const [form, setForm] = useState<FormData>({
    clockIn: "",
    clockOut: "",
    reason: "",
    description: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (open && record) {
      setForm({
        clockIn: sliceTime(record.clockIn),
        clockOut: sliceTime(record.clockOut),
        reason: "",
        description: "",
      });
      setErrors({});
    }
  }, [open, record]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (needsClockIn && !form.clockIn) {
      newErrors.clockIn = "Clock in is required (missing on this record)";
    }
    if (needsClockOut && !form.clockOut) {
      newErrors.clockOut = "Clock out is required (missing on this record)";
    }
    if (form.clockIn && form.clockOut && form.clockOut <= form.clockIn) {
      // Allow overnight later on backend; for typical day shifts keep a soft check
      // Overnight (e.g. 22:00 → 06:00) is OK — skip when out < in
    }

    if (!form.reason.trim()) {
      newErrors.reason = "Reason is required";
    } else if (form.reason.trim().length > 1000) {
      newErrors.reason = "Reason must be 1000 characters or fewer";
    }
    if (!form.description.trim()) {
      newErrors.description = "Description is required";
    } else if (form.description.trim().length > 2000) {
      newErrors.description = "Description must be 2000 characters or fewer";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!record || !validate()) return;
    await onSubmit({
      attendanceId: record.attendanceId,
      happenDate: record.date,
      clockIn: needsClockIn ? form.clockIn : undefined,
      clockOut: needsClockOut ? form.clockOut : undefined,
      reason: form.reason.trim(),
      description: form.description.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Resolve Unauthorised Leave
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {record && (
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Submit a request for unauthorised attendance on{" "}
              <strong>{formatDate(record.date)}</strong> ({record.attendanceId}).
              Fill in the missing punch time so your HOD / supervisor can review it.
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <TimePickerField
                label={needsClockIn ? "Clock In (required)" : "Clock In"}
                value={form.clockIn}
                onChange={(clockIn) => {
                  setForm({ ...form, clockIn });
                  setErrors({ ...errors, clockIn: "" });
                }}
                disabled={!needsClockIn}
              />
              {errors.clockIn && (
                <Typography variant="caption" color="error">{errors.clockIn}</Typography>
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <TimePickerField
                label={needsClockOut ? "Clock Out (required)" : "Clock Out"}
                value={form.clockOut}
                onChange={(clockOut) => {
                  setForm({ ...form, clockOut });
                  setErrors({ ...errors, clockOut: "" });
                }}
                disabled={!needsClockOut}
              />
              {errors.clockOut && (
                <Typography variant="caption" color="error">{errors.clockOut}</Typography>
              )}
            </Box>
          </Box>

          <TextField
            name="reason"
            label="Reason"
            value={form.reason}
            onChange={handleChange}
            error={!!errors.reason}
            helperText={errors.reason || "Short reason for the unauthorised day"}
            fullWidth
            required
          />
          <TextField
            name="description"
            label="Description"
            value={form.description}
            onChange={handleChange}
            error={!!errors.description}
            helperText={errors.description || "Explain what happened (missing punch, etc.)"}
            multiline
            minRows={3}
            fullWidth
            required
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting} sx={{ color: "#64748b" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !record}
          sx={{ backgroundColor: "#ea580c", "&:hover": { backgroundColor: "#c2410c" } }}
        >
          {submitting ? <CircularProgress size={22} color="inherit" /> : "Submit Request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
