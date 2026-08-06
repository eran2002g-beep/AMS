"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, CircularProgress, MenuItem,
  FormControlLabel, Switch,
} from "@mui/material";
import type { AttendanceRecord, Employee } from "@/lib/api";
import TimePickerField from "@/components/TimePickerField";

export type AttendanceFormData = {
  employeeId?: string;
  date: string;
  status: AttendanceRecord["status"];
  clockIn: string;
  clockOut: string;
  lateMinutes: string;
  lateCoverMinutes: string;
  dayType: "" | "full_day" | "short_leave" | "half_day";
  isManual: boolean;
  notes: string;
};

const STATUS_OPTIONS: Array<{ value: AttendanceRecord["status"]; label: string }> = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
  { value: "unauthorised", label: "Unauthorised" },
  { value: "holiday", label: "Holiday" },
];

const DAY_TYPE_OPTIONS: Array<{ value: AttendanceFormData["dayType"]; label: string }> = [
  { value: "", label: "None" },
  { value: "full_day", label: "Full day" },
  { value: "short_leave", label: "Short leave" },
  { value: "half_day", label: "Half day" },
];

function emptyForm(defaultDate: string): AttendanceFormData {
  return {
    employeeId: "",
    date: defaultDate,
    status: "present",
    clockIn: "",
    clockOut: "",
    lateMinutes: "",
    lateCoverMinutes: "",
    dayType: "",
    isManual: true,
    notes: "",
  };
}

function recordToForm(record: AttendanceRecord): AttendanceFormData {
  return {
    employeeId: record.employeeId,
    date: record.date,
    status: record.status,
    clockIn: record.clockIn ? record.clockIn.slice(0, 5) : "",
    clockOut: record.clockOut ? record.clockOut.slice(0, 5) : "",
    lateMinutes: record.lateMinutes > 0 ? String(record.lateMinutes) : "",
    lateCoverMinutes: record.lateCoverMinutes > 0 ? String(record.lateCoverMinutes) : "",
    dayType: record.dayType ?? "",
    isManual: !!record.isManual,
    notes: record.notes ?? "",
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AttendanceFormData) => Promise<void>;
  submitting?: boolean;
  defaultDate?: string;
  record?: AttendanceRecord | null;
  employeesList?: Employee[];
};

export default function AttendanceForm({
  open,
  onClose,
  onSubmit,
  submitting,
  defaultDate = "",
  record,
  employeesList,
}: Props) {
  const isEdit = !!record;
  const empName = (id: string) => {
    if (!employeesList) return id;
    const found = employeesList.find((e) => e.employeeId === id);
    return found ? `${found.firstName} ${found.lastName} (${id})` : id;
  };
  const [form, setForm] = useState<AttendanceFormData>(emptyForm(defaultDate));
  const [errors, setErrors] = useState<Partial<Record<keyof AttendanceFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(record ? recordToForm(record) : emptyForm(defaultDate));
      setErrors({});
    }
  }, [open, defaultDate, record]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof AttendanceFormData, string>> = {};

    if (!isEdit && employeesList && !form.employeeId) {
      newErrors.employeeId = "Employee is required";
    }
    if (!form.date) newErrors.date = "Date is required";
    if (!form.status) newErrors.status = "Status is required";

    if (form.lateMinutes && !/^\d+$/.test(form.lateMinutes)) {
      newErrors.lateMinutes = "Must be a whole number";
    }
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
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? "Edit Attendance Record" : "Add Attendance Record"}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {!isEdit && employeesList && (
            <TextField
              name="employeeId"
              label="Employee"
              select
              value={form.employeeId || ""}
              onChange={handleChange}
              error={!!errors.employeeId}
              helperText={errors.employeeId}
              fullWidth
              required
            >
              {employeesList.map((emp) => (
                <MenuItem key={emp.employeeId} value={emp.employeeId}>
                  {emp.firstName} {emp.lastName} ({emp.employeeId})
                </MenuItem>
              ))}
            </TextField>
          )}
          {isEdit && employeesList && (
            <TextField
              label="Employee"
              value={record ? `${empName(record.employeeId)}` : ""}
              disabled
              fullWidth
            />
          )}
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
            <TimePickerField
              label="Clock In"
              value={form.clockIn}
              onChange={(clockIn) => {
                setForm({ ...form, clockIn });
                setErrors({ ...errors, clockIn: "" });
              }}
            />
            <TimePickerField
              label="Clock Out"
              value={form.clockOut}
              onChange={(clockOut) => {
                setForm({ ...form, clockOut });
                setErrors({ ...errors, clockOut: "" });
              }}
            />
          </Box>
          <TextField
            name="lateMinutes"
            label="Late (minutes)"
            type="number"
            value={form.lateMinutes}
            onChange={handleChange}
            error={!!errors.lateMinutes}
            helperText={errors.lateMinutes || "Minutes late vs scheduled start"}
            slotProps={{ htmlInput: { min: 0 } }}
            fullWidth
          />
          <TextField
            name="lateCoverMinutes"
            label="Cover owed (minutes)"
            type="number"
            value={form.lateCoverMinutes}
            onChange={handleChange}
            error={!!errors.lateCoverMinutes}
            helperText={errors.lateCoverMinutes || "Minutes still owed if the employee left before making up lateness"}
            slotProps={{ htmlInput: { min: 0 } }}
            fullWidth
          />
          <TextField
            name="dayType"
            label="Day type"
            select
            value={form.dayType}
            onChange={handleChange}
            helperText="Worked-hours classification for the day"
            fullWidth
          >
            {DAY_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value || "none"} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          {isEdit && (
            <FormControlLabel
              control={
                <Switch
                  checked={form.isManual}
                  onChange={(e) => setForm({ ...form, isManual: e.target.checked })}
                  color="success"
                />
              }
              label="Manual record"
            />
          )}
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
          {submitting ? <CircularProgress size={22} color="inherit" /> : isEdit ? "Save Changes" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
