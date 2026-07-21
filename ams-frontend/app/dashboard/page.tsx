// app/dashboard/page.tsx — shared home for every authenticated role
"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/api";

export default function DashboardPage() {
  const { user } = useAuth();
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || "User"
    : "User";
  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Paper
        elevation={1}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 2,
          background: "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
          border: "1px solid #e2e8f0",
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: "#0f172a", mb: 1, letterSpacing: "-0.02em" }}
        >
          Welcome {displayName}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 500, color: "#64748b" }}>
          {roleLabel}
        </Typography>
      </Paper>
    </Box>
  );
}
