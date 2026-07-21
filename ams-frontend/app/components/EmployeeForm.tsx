// components/EmployeeForm.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, CircularProgress,
  FormControlLabel, Checkbox, FormControl, InputLabel, Select, MenuItem,
  Autocomplete, Alert,
} from "@mui/material";
import {
  EMPLOYEE_ROLES,
  ROLE_LABELS,
  employeeApi,
  getErrorMessage,
  type Employee,
  type EmployeeFormData,
  type EmployeeRole,
  type ReportingEmployee,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

const EMPTY: EmployeeFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  department: "",
  roster: false,
  role: "employee",
  hod: null,
  supervisor: null,
  password: "",
};

const FIELDS = [
  { name: "firstName",  label: "First Name", type: "text" },
  { name: "lastName",   label: "Last Name",  type: "text" },
  { name: "email",      label: "Email",      type: "email" },
  { name: "phone",      label: "Phone",      type: "text" },
  { name: "department", label: "Department", type: "text" },
] as const;

function employeeToForm(employee: Employee): EmployeeFormData {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? "",
    department: employee.department ?? "",
    roster: employee.roster,
    role: employee.role,
    hod: employee.hod ?? null,
    supervisor: employee.supervisor ?? null,
    password: "",
  };
}

function formatManagerOption(manager: ReportingEmployee) {
  return `${manager.firstName} ${manager.lastName} · ${ROLE_LABELS[manager.role]} · ${manager.employeeId}`;
}

function findManager(
  managers: ReportingEmployee[],
  id: number | null | undefined,
): ReportingEmployee | null {
  if (id == null) return null;
  return managers.find((manager) => manager.id === id) ?? null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  submitting?: boolean;
  employee?: Employee | null;
};

export default function EmployeeForm({ open, onClose, onSubmit, submitting, employee }: Props) {
  const { user } = useAuth();
  const isEdit = !!employee;
  const isSuperAdmin = user?.role === "super-admin";
  const [form, setForm] = useState<EmployeeFormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({});
  const [managers, setManagers] = useState<ReportingEmployee[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [managersError, setManagersError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(employee ? employeeToForm(employee) : EMPTY);
      setErrors({});
    }
  }, [open, employee]);

  useEffect(() => {
    if (!open || !isSuperAdmin) {
      setManagers([]);
      setManagersError("");
      return;
    }

    let active = true;
    setLoadingManagers(true);
    setManagersError("");
    employeeApi
      .listManagers()
      .then((data) => {
        if (!active) return;
        setManagers(data);
        if (data.length === 0) {
          setManagersError(
            "No managers found. Assign someone the Manager or Admin Manager role first.",
          );
        }
      })
      .catch((err) => {
        if (!active) return;
        setManagers([]);
        setManagersError(getErrorMessage(err) || "Failed to load supervisors / HODs.");
      })
      .finally(() => {
        if (active) setLoadingManagers(false);
      });

    return () => {
      active = false;
    };
  }, [open, isSuperAdmin]);

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

    if (!isEdit) {
      if (!form.password) newErrors.password = "Password is required";
      else if (form.password.length < 8)
        newErrors.password = "Password must be at least 8 characters";
    } else if (form.password && form.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

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
      roster: form.roster,
      ...(form.role ? { role: form.role } : {}),
      ...(isSuperAdmin
        ? {
            supervisor: form.supervisor ?? null,
            hod: form.hod ?? null,
          }
        : {}),
      ...(form.password ? { password: form.password } : {}),
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch {
      // Error surfaced by parent; keep dialog open
    }
  };

  const managerOptions = useMemo(() => {
    const byId = new Map<number, ReportingEmployee>();

    for (const manager of managers) {
      if (manager.id !== employee?.id) byId.set(manager.id, manager);
    }

    // Keep a currently assigned person visible even if their role changed.
    const ensureAssigned = (assigned: ReportingEmployee | null | undefined) => {
      if (!assigned || assigned.id === employee?.id) return;
      if (!byId.has(assigned.id)) {
        byId.set(assigned.id, {
          id: assigned.id,
          employeeId: assigned.employeeId,
          firstName: assigned.firstName,
          lastName: assigned.lastName,
          email: assigned.email,
          department: assigned.department ?? null,
          role: assigned.role,
        });
      }
    };

    ensureAssigned(employee?.supervisorEmployee ?? undefined);
    ensureAssigned(employee?.hodEmployee ?? undefined);

    return Array.from(byId.values()).sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, undefined, {
        sensitivity: "base",
      }),
    );
  }, [managers, employee]);

  const selectedSupervisor = findManager(managerOptions, form.supervisor);
  const selectedHod = findManager(managerOptions, form.hod);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { overflow: "visible" } } }}
    >
      <DialogTitle sx={{ backgroundColor: "#1e293b", color: "#fff", py: 1.5 }}>
        {isEdit ? "Edit Employee" : "Add Employee"}
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
          <TextField
            fullWidth
            label={isEdit ? "New Password (optional)" : "Password"}
            name="password"
            type="password"
            value={form.password ?? ""}
            onChange={handle}
            error={!!errors.password}
            helperText={
              errors.password
                || (isEdit ? "Leave blank to keep the current password" : "At least 8 characters")
            }
            size="small"
            margin="none"
            autoComplete="new-password"
            sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}
            slotProps={{
              inputLabel: {
                sx: {
                  backgroundColor: "#fff",
                  px: 0.5,
                },
              },
            }}
          />
          <FormControl fullWidth size="small" sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={form.role ?? "employee"}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as EmployeeRole })
              }
            >
              {EMPLOYEE_ROLES.map((role) => (
                <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {isSuperAdmin && (
            <>
              {managersError && (
                <Alert severity="warning" sx={{ gridColumn: "1 / -1", py: 0 }}>
                  {managersError}
                </Alert>
              )}

              <Autocomplete
                options={managerOptions}
                loading={loadingManagers}
                value={selectedSupervisor}
                onChange={(_, value) =>
                  setForm({ ...form, supervisor: value ? value.id : null })
                }
                getOptionLabel={(option) => formatManagerOption(option)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options, { inputValue }) => {
                  const q = inputValue.trim().toLowerCase();
                  if (!q) return options;
                  return options.filter((option) => {
                    const haystack = [
                      option.firstName,
                      option.lastName,
                      option.email,
                      option.employeeId,
                      option.department ?? "",
                      ROLE_LABELS[option.role],
                    ]
                      .join(" ")
                      .toLowerCase();
                    return haystack.includes(q);
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Supervisor"
                    size="small"
                    placeholder="Search managers…"
                    helperText="Search, assign, or clear a supervisor"
                  />
                )}
                sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}
              />

              <Autocomplete
                options={managerOptions}
                loading={loadingManagers}
                value={selectedHod}
                onChange={(_, value) =>
                  setForm({ ...form, hod: value ? value.id : null })
                }
                getOptionLabel={(option) => formatManagerOption(option)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options, { inputValue }) => {
                  const q = inputValue.trim().toLowerCase();
                  if (!q) return options;
                  return options.filter((option) => {
                    const haystack = [
                      option.firstName,
                      option.lastName,
                      option.email,
                      option.employeeId,
                      option.department ?? "",
                      ROLE_LABELS[option.role],
                    ]
                      .join(" ")
                      .toLowerCase();
                    return haystack.includes(q);
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="HOD"
                    size="small"
                    placeholder="Search managers…"
                    helperText="Search, assign, or clear a HOD"
                  />
                )}
                sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}
              />
            </>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={form.roster}
                onChange={(e) => setForm({ ...form, roster: e.target.checked })}
              />
            }
            label="On roster"
            sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}
          />
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
          {isEdit ? "Save Changes" : "Add Employee"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
