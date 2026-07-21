// app/access-denied/page.tsx — full-page response for insufficient permissions
"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import BlockIcon from "@mui/icons-material/Block";
import { useAuth } from "@/lib/auth";

export default function AccessDeniedPage() {
  const { logout } = useAuth();

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 112px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={2}
        sx={{
          p: { xs: 3, sm: 5 },
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            backgroundColor: "#fef2f2",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <BlockIcon sx={{ fontSize: 40, color: "#dc2626" }} />
        </Box>

        <Typography variant="h4" sx={{ fontWeight: 700, color: "#1e293b", mb: 1 }}>
          Access Denied
        </Typography>
        <Typography variant="body1" sx={{ color: "#64748b", mb: 3 }}>
          You do not have permission to view this page. If you believe this is a
          mistake, contact your administrator.
        </Typography>

        <Button
          variant="contained"
          onClick={logout}
          sx={{
            backgroundColor: "#1e293b",
            "&:hover": { backgroundColor: "#0f172a" },
            px: 3,
          }}
        >
          Return to Login
        </Button>
      </Paper>
    </Box>
  );
}
