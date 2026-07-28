// components/Footer.tsx — site-wide footer (hidden on login)
"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Footer() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated || pathname === "/login" || pathname === "/change-password") {
    return null;
  }

  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        backgroundColor: "#0f172a",
        color: "#94a3b8",
        borderTop: "1px solid rgba(148,163,184,0.15)",
      }}
    >
      <Box
        sx={{
          maxWidth: 1100,
          mx: "auto",
          px: { xs: 2.5, sm: 3 },
          py: { xs: 3, sm: 3.5 },
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.01em" }}>
            AMS
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 360 }}>
            Attendance Management System — track profiles, attendance, and workplace schedules.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1, sm: 2.5 }}
          sx={{ flexShrink: 0 }}
        >
          <Link href="/dashboard" underline="hover" sx={{ color: "#cbd5e1", fontSize: 14 }}>
            Dashboard
          </Link>
          <Link href="/profile" underline="hover" sx={{ color: "#cbd5e1", fontSize: 14 }}>
            My Profile
          </Link>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: "rgba(148,163,184,0.12)" }} />

      <Box
        sx={{
          maxWidth: 1100,
          mx: "auto",
          px: { xs: 2.5, sm: 3 },
          py: 1.75,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          gap: 0.75,
        }}
      >
        <Typography variant="caption" sx={{ color: "#64748b" }}>
          © {year} AMS. All rights reserved.
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "#64748b", maxWidth: { sm: 420 }, textAlign: { xs: "left", sm: "right" } }}
        >
          Need to update these details? Contact your administrator — profile information is managed
          by HR/Admin.
        </Typography>
      </Box>
    </Box>
  );
}
