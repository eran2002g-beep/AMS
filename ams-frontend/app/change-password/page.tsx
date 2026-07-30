// app/change-password/page.tsx — forced password change after temp / admin reset
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";
import { useAuth } from "@/lib/auth";
import { authApi, getErrorMessage } from "@/lib/api";
import { getHomePath } from "@/lib/roles";

type FormErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function ChangePasswordPage() {
  const { user, logout, markPasswordChanged } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: FormErrors = {};
    if (!currentPassword) next.currentPassword = "Current password is required";
    if (!newPassword) next.newPassword = "New password is required";
    else if (newPassword.length < 8) next.newPassword = "New password must be at least 8 characters";
    else if (newPassword === currentPassword) {
      next.newPassword = "New password must be different from the current password";
    }
    if (!confirmPassword) next.confirmPassword = "Confirm your new password";
    else if (confirmPassword !== newPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await authApi.changePassword(currentPassword, newPassword);
      markPasswordChanged(result.token);
      router.replace(user ? getHomePath(user) : "/dashboard");
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: 400, maxWidth: "100%", borderRadius: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <LockResetOutlined sx={{ fontSize: 36, color: "#1e293b", mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Change password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 0.5 }}>
            You must set a new password before continuing. Use your temporary password as the
            current password.
          </Typography>
        </Box>

        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Current (temporary) password"
            type={showCurrent ? "text" : "password"}
            fullWidth
            margin="normal"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setErrors((prev) => ({ ...prev, currentPassword: "" }));
            }}
            error={!!errors.currentPassword}
            helperText={errors.currentPassword}
            autoComplete="current-password"
            autoFocus
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showCurrent ? "Hide password" : "Show password"}
                      onClick={() => setShowCurrent((v) => !v)}
                      edge="end"
                      tabIndex={-1}
                    >
                      {showCurrent ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="New password"
            type={showNew ? "text" : "password"}
            fullWidth
            margin="normal"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setErrors((prev) => ({ ...prev, newPassword: "" }));
            }}
            error={!!errors.newPassword}
            helperText={errors.newPassword || "At least 8 characters"}
            autoComplete="new-password"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showNew ? "Hide password" : "Show password"}
                      onClick={() => setShowNew((v) => !v)}
                      edge="end"
                      tabIndex={-1}
                    >
                      {showNew ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="Confirm new password"
            type="password"
            fullWidth
            margin="normal"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setErrors((prev) => ({ ...prev, confirmPassword: "" }));
            }}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            autoComplete="new-password"
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={submitting}
            sx={{ mt: 3, backgroundColor: "#1e293b", "&:hover": { backgroundColor: "#0f172a" } }}
          >
            {submitting ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Update password"}
          </Button>

          <Button fullWidth onClick={logout} sx={{ mt: 1.5, color: "#64748b" }}>
            Sign out
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
