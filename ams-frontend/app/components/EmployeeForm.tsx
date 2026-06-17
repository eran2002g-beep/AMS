// components/EmployeeForm.tsx
"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box
} from "@mui/material";

const EMPTY = {
  name: "", email: "", phone: "", department: "", role: "", joinDate: "",
};

type Employee = typeof EMPTY & { id?: number };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Employee) => void;
  initialData?: Employee | null;
};

export default function EmployeeForm({ open, onClose, onSubmit, initialData }: Props) {
  const [form, setForm] = useState<Employee>(EMPTY);
  const [errors, setErrors] = useState<Partial<Employee>>({});

  useEffect(() => {
    setForm(initialData || EMPTY);
    setErrors({});
  }, [initialData, open]);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" }); // clear error on type
  };

  // ── Validation ──────────────────────────────────────────
  const validate = () => {
    const newErrors: Partial<Employee> = {};

    if (!form.name.trim()) newErrors.name = "Full name is required";
    else if (form.name.trim().length < 2) newErrors.name = "Name must be at least 2 characters";

    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Enter a valid email address";

    if (!form.phone.trim()) newErrors.phone = "Phone is required";
    else if (!/^\d{10}$/.test(form.phone.replace(/\s/g, "")))
      newErrors.phone = "Phone must be 10 digits";

    if (!form.department.trim()) newErrors.department = "Department is required";
    if (!form.role.trim()) newErrors.role = "Role is required";
    if (!form.joinDate) newErrors.joinDate = "Join date is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(form);
    onClose();
  };

  const isEdit = !!initialData;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ backgroundColor: "#1e293b", color: "#fff" }}>
        {isEdit ? "✏️ Edit Employee" : "➕ Add Employee"}
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {[
            { name: "name",       label: "Full Name",  type: "text" },
            { name: "email",      label: "Email",      type: "email" },
            { name: "phone",      label: "Phone",      type: "text" },
            { name: "department", label: "Department", type: "text" },
            { name: "role",       label: "Role/Title", type: "text" },
            { name: "joinDate",   label: "Join Date",  type: "date" },
          ].map(({ name, label, type }) => (
            <Box key={name} sx={{ flex: '1 1 calc(50% - 8px)', minWidth: '280px' }}>
              <TextField
                fullWidth
                label={label}
                name={name}
                type={type}
                value={form[name as keyof Employee]}
                onChange={handle}
                error={!!errors[name as keyof Employee]}
                helperText={errors[name as keyof Employee]}
                // TS: some MUI typings may not include InputLabelProps in this union; allow for date label shrink
                // @ts-expect-error
                InputLabelProps={type === "date" ? { shrink: true } : undefined}
                size="small"
              />
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleSubmit} variant="contained"
          sx={{ backgroundColor: "#2563eb" }}>
          {isEdit ? "Save Changes" : "Add Employee"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}