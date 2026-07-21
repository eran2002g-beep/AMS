// components/Navbar.tsx
"use client";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import LogoutIcon from "@mui/icons-material/Logout";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/api";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();

  // AC1/AC4: no session, or on the login page itself — nothing to navigate to yet.
  if (!isAuthenticated || pathname === "/login") {
    return null;
  }

  const navItems = getNavItems(user?.role);

  return (
    <AppBar position="static" sx={{ backgroundColor: "#1e293b" }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          🏢 AMS Admin
        </Typography>
        <Box>
          {navItems.map((item) => (
            <Button
              key={item.path}
              onClick={() => router.push(item.path)}
              sx={{
                color: pathname === item.path ? "#38bdf8" : "#fff",
                fontWeight: pathname === item.path ? 700 : 400,
                borderBottom: pathname === item.path ? "2px solid #38bdf8" : "none",
                borderRadius: 0,
                mx: 1,
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 2, borderColor: "rgba(255,255,255,0.2)" }} />

        <Typography variant="body2" sx={{ color: "#cbd5e1", mr: 2 }}>
          {user?.firstName} {user?.lastName}
          <Box component="span" sx={{ color: "#64748b" }}>
            {" "}· {user?.role ? ROLE_LABELS[user.role] ?? user.role : ""}
          </Box>
        </Typography>

        <Button
          onClick={logout}
          startIcon={<LogoutIcon />}
          sx={{ color: "#fff", borderRadius: 0 }}
        >
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
}