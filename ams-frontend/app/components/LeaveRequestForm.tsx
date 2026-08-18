"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, CircularProgress, MenuItem, Typography,
} from "@mui/material";
import {
  LEAVE_TYPE_OPTIONS,
  LEAVE_DURATION_OPTIONS,
  HALF_DAY_PERIOD_OPTIONS,
  getTodayDateString,
  type LeaveRequestSubmitPayload,
  type LeaveType,
  type LeaveDuration,
  type HalfDayPeriod,
} from "@/lib/api";

export type LeaveRequestFormData = {
  leaveType: LeaveType;
  duration: LeaveDuration;
  halfDayPeriod: HalfDayPeriod;
  startDate: string;
  endDate: string;
  reason: string;
};

function emptyForm(defaultDate: string): LeaveRequestFormData {
  return {
    leaveType: "annual",
    duration: "full_day",
    halfDayPeriod: "morning",
    startDate: defaultDate,
    endDate: defaultDate,
    reason: "",
  };
}

function countInclusiveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: LeaveRequestSubmitPayload) => Promise<void>;
  submitting?: boolean;
};

export default function LeaveRequestForm({ open, onClose, onSubmit, submitting }: Props) {
  const today = getTodayDateString();
  const [form, setForm] = useState<LeaveRequestFormData>(emptyForm(today));
  const [errors, setErrors] = useState<Partial<Record<keyof LeaveRequestFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(emptyForm(today));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };

    if (name === "duration" && value === "half_day") {
      next.endDate = next.startDate;
    }
    if (name === "startDate" && form.duration === "half_day") {
      next.endDate = value;
    }

    setForm(next);
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof LeaveRequestFormData, string>> = {};

    if (!form.leaveType) newErrors.leaveType = "Leave type is required";
    if (!form.duration) newErrors.duration = "Duration is required";
    if (!form.startDate) newErrors.startDate = "Start date is required";
    if (!form.endDate) newErrors.endDate = "End date is required";

    if (form.startDate && form.startDate < today) {
      newErrors.startDate = "Start date cannot be in the past";
    }
    if (form.duration === "half_day") {
      if (form.startDate !== form.endDate) {
        newErrors.endDate = "Half-day leave must be a single date";
      }
      if (!form.halfDayPeriod) {
        newErrors.halfDayPeriod = "Choose morning or afternoon";
      }
    } else if (form.startDate && form.endDate && form.endDate < form.startDate) {
      newErrors.endDate = "End date cannot be before start date";
    }
    if (!form.reason.trim()) {
      newErrors.reason = "Please provide a reason for management";
    } else if (form.reason.trim().length > 1000) {
      newErrors.reason = "Reason must be 1000 characters or fewer";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit({
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate: form.duration === "half_day" ? form.startDate : form.endDate,
      reason: form.reason.trim(),
      duration: form.duration,
      halfDayPeriod: form.duration === "half_day" ? form.halfDayPeriod : null,
    });
  };

  const totalDays = form.duration === "half_day"
    ? 0.5
    : countInclusiveDays(form.startDate, form.endDate);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Request Leave</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            name="leaveType"
            label="Leave Type"
            select
            value={form.leaveType}
            onChange={handleChange}
            error={!!errors.leaveType}
            helperText={errors.leaveType}
            fullWidth
            required
          >
            {LEAVE_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            name="duration"
            label="Duration"
            select
            value={form.duration}
            onChange={handleChange}
            error={!!errors.duration}
            helperText={errors.duration}
            fullWidth
            required
          >
            {LEAVE_DURATION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          {form.duration === "half_day" && (
            <TextField
              name="halfDayPeriod"
              label="Half-day period"
              select
              value={form.halfDayPeriod}
              onChange={handleChange}
              error={!!errors.halfDayPeriod}
              helperText={errors.halfDayPeriod || "You are off this half; the other half still needs In and Out punches"}
              fullWidth
              required
            >
              {HALF_DAY_PERIOD_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              name="startDate"
              label={form.duration === "half_day" ? "Date" : "Start Date"}
              type="date"
              value={form.startDate}
              onChange={handleChange}
              error={!!errors.startDate}
              helperText={errors.startDate}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }}
              fullWidth
              required
            />
            {form.duration === "full_day" && (
              <TextField
                name="endDate"
                label="End Date"
                type="date"
                value={form.endDate}
                onChange={handleChange}
                error={!!errors.endDate}
                helperText={errors.endDate}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: form.startDate || today } }}
                fullWidth
                required
              />
            )}
          </Box>

          {totalDays > 0 && (
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              {form.duration === "half_day"
                ? `Half day (${form.halfDayPeriod}) requested`
                : `${totalDays} day${totalDays === 1 ? "" : "s"} requested`}
            </Typography>
          )}

          <TextField
            name="reason"
            label="Reason"
            value={form.reason}
            onChange={handleChange}
            error={!!errors.reason}
            helperText={errors.reason || "Let management know why you're requesting this leave"}
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
          disabled={submitting}
          sx={{ backgroundColor: "#16a34a", "&:hover": { backgroundColor: "#15803d" } }}
        >
          {submitting ? <CircularProgress size={22} color="inherit" /> : "Submit Request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
