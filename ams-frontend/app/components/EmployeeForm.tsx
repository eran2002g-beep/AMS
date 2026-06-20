// components/EmployeeForm.tsx
"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, CircularProgress,
} from "@mui/material";
import type { EmployeeFormData } from "@/lib/api";

const EMPTY: EmployeeFormData = {
  firstName: "", lastName: "", email: "", phone: "", department: "",
};

const FIELDS = [
  { name: "firstName",  label: "First Name", type: "text" },
  { name: "lastName",   label: "Last Name",  type: "text" },
  { name: "email",      label: "Email",      type: "email" },
  { name: "phone",      label: "Phone",      type: "text" },
  { name: "department", label: "Department", type: "text" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  submitting?: boolean;
};

export default function EmployeeForm({ open, onClose, onSubmit, submitting }: Props) {
  const [form, setForm] = useState<EmployeeFormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
    }
  }, [open]);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof EmployeeFormData, string>> = {};

    if (!form.firstName.trim()) newErrors.firstName = "First name is required";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required";

    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Enter a valid email address";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload: EmployeeFormData = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      department: form.department.trim(),
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch {
      // Error surfaced by parent; keep dialog open
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { overflow: "visible" } } }}
    >
      <DialogTitle sx={{ backgroundColor: "#1e293b", color: "#fff", py: 1.5 }}>
        Add Employee
      </DialogTitle>

      <DialogContent
        sx={{
          px: 3,
          pb: 1.5,
          overflow: "visible",
          // MUI sets paddingTop: 0 when DialogContent follows DialogTitle;
          // use && so the override wins and floating labels are not clipped.
          "&&": { paddingTop: 3 },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1.5,
          }}
        >
          {FIELDS.map(({ name, label, type }) => (
            <TextField
              key={name}
              fullWidth
              label={label}
              name={name}
              type={type}
              value={form[name]}
              onChange={handle}
              error={!!errors[name]}
              helperText={errors[name]}
              size="small"
              margin="none"
              slotProps={{
                inputLabel: {
                  sx: {
                    backgroundColor: "#fff",
                    px: 0.5,
                  },
                },
              }}
            />
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={submitting}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting}
          sx={{ backgroundColor: "#2563eb" }}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Add Employee
        </Button>
      </DialogActions>
    </Dialog>
  );
}
