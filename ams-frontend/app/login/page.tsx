// app/login/page.tsx - AC1/AC2/AC3: secure login form, invalid-credential handling,
// and a role-aware redirect once authenticated.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import LockOutlined from "@mui/icons-material/LockOutlined";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api";
import { canAccessPath, getHomePath } from "@/lib/roles";

type FormErrors = { email?: string; password?: string };

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: FormErrors = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address";
    if (!password) next.password = "Password is required";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);

      // AC3: redirect by role. Honor a "next" target only if this role may open it.
      const next = searchParams.get("next");
      const destination =
        next && canAccessPath(next, user) ? next : getHomePath(user);
      router.replace(destination);
    } catch (err) {
      // AC2: backend returns a generic "Invalid email or password" for both a
      // bad email and a bad password, and a specific message for deactivated accounts.
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
      <Paper elevation={3} sx={{ p: 4, width: 380, borderRadius: 2 }}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <LockOutlined sx={{ fontSize: 32, color: "#1e293b", mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Sign in to AMS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your credentials to continue
          </Typography>
        </Box>

        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            name="email"
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: "" }));
            }}
            error={!!errors.email}
            helperText={errors.email}
            autoComplete="email"
            autoFocus
          />
          <TextField
            name="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((prev) => ({ ...prev, password: "" }));
            }}
            error={!!errors.password}
            helperText={errors.password}
            autoComplete="current-password"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={submitting}
            sx={{ mt: 3, backgroundColor: "#1e293b", "&:hover": { backgroundColor: "#0f172a" } }}
          >
            {submitting ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Sign In"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}