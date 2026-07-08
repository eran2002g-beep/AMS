"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, CircularProgress, MenuItem,
} from "@mui/material";
import type { AttendanceRecord } from "@/lib/api";

export type AttendanceFormData = {
  date: string;
  status: AttendanceRecord["status"];
  clockIn: string;
  clockOut: string;
  lateCoverMinutes: string;
  notes: string;
};

const STATUS_OPTIONS: Array<{ value: AttendanceRecord["status"]; label: string }> = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
  { value: "unauthorised", label: "Unauthorised" },
  { value: "holiday", label: "Holiday" },
];

function emptyForm(defaultDate: string): AttendanceFormData {
  return {
    date: defaultDate,
    status: "present",
    clockIn: "",
    clockOut: "",
    lateCoverMinutes: "",
    notes: "",
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AttendanceFormData) => Promise<void>;
  submitting?: boolean;
  defaultDate?: string;
};

export default function AttendanceForm({ open, onClose, onSubmit, submitting, defaultDate = "" }: Props) {
  const [form, setForm] = useState<AttendanceFormData>(emptyForm(defaultDate));
  const [errors, setErrors] = useState<Partial<Record<keyof AttendanceFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultDate));
      setErrors({});
    }
  }, [open, defaultDate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof AttendanceFormData, string>> = {};

    if (!form.date) newErrors.date = "Date is required";
    if (!form.status) newErrors.status = "Status is required";

    if (form.lateCoverMinutes && !/^\d+$/.test(form.lateCoverMinutes)) {
      newErrors.lateCoverMinutes = "Must be a whole number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Attendance Record</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            name="date"
            label="Date"
            type="date"
            value={form.date}
            onChange={handleChange}
            error={!!errors.date}
            helperText={errors.date}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
            required
          />
          <TextField
            name="status"
            label="Status"
            select
            value={form.status}
            onChange={handleChange}
            error={!!errors.status}
            helperText={errors.status}
            fullWidth
            required
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              name="clockIn"
              label="Clock In"
              type="time"
              value={form.clockIn}
              onChange={handleChange}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              name="clockOut"
              label="Clock Out"
              type="time"
              value={form.clockOut}
              onChange={handleChange}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Box>
          <TextField
            name="lateCoverMinutes"
            label="Late (minutes)"
            type="number"
            value={form.lateCoverMinutes}
            onChange={handleChange}
            error={!!errors.lateCoverMinutes}
            helperText={errors.lateCoverMinutes}
            slotProps={{ htmlInput: { min: 0 } }}
            fullWidth
          />
          <TextField
            name="notes"
            label="Notes"
            value={form.notes}
            onChange={handleChange}
            multiline
            minRows={2}
            fullWidth
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
          {submitting ? <CircularProgress size={22} color="inherit" /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
