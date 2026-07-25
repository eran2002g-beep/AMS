// app/admin/page.tsx — admin hub for admin-tier roles
"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  canManageRoster,
  canViewAttendance,
  canViewEmployees,
} from "@/lib/roles";

type AdminLink = {
  label: string;
  description: string;
  path: string;
};

export default function AdminPanelPage() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;

  const links: AdminLink[] = [];
  if (canViewEmployees(role)) {
    links.push({
      label: "Employees",
      description: "View and manage employee records",
      path: "/employees",
    });
  }
  if (canViewAttendance(role)) {
    links.push({
      label: "Attendance",
      description: "Review and edit attendance records",
      path: "/attendance",
    });
  }
  if (canManageRoster(role)) {
    links.push({
      label: "Rosters",
      description: "Upload and manage shift rosters",
      path: "/rosters",
    });
  }

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5 }}>
          Admin Panel
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          Administrative tools for your role. These links are only available from this panel —
          not from the main menu.
        </Typography>
      </Paper>

      <Stack spacing={2}>
        {links.map((link) => (
          <Paper
            key={link.path}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1e293b" }}>
                {link.label}
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b" }}>
                {link.description}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => router.push(link.path)}
              sx={{ backgroundColor: "#1e293b", "&:hover": { backgroundColor: "#0f172a" } }}
            >
              Open
            </Button>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
