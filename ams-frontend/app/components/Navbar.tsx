// components/Navbar.tsx — top bar + right hamburger drawer menu
"use client";
import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/api";

const DRAWER_WIDTH = 260;

function isActivePath(pathname: string, itemPath: string) {
  if (pathname === itemPath) return true;
  if (itemPath !== "/dashboard" && pathname.startsWith(`${itemPath}/`)) return true;
  return false;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isAuthenticated || pathname === "/login" || pathname === "/change-password") {
    return null;
  }

  const navItems = getNavItems(user);
  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";

  const goTo = (path: string) => {
    setMenuOpen(false);
    router.push(path);
  };

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: "#1e293b" }}>
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, fontWeight: 700, cursor: "pointer" }}
            onClick={() => router.push("/dashboard")}
          >
            AMS
          </Typography>

          <Box
            onClick={() => router.push("/profile")}
            role="button"
            aria-label="View my profile"
            sx={{
              display: { xs: "none", sm: "flex" },
              alignItems: "center",
              gap: 1,
              mr: 1,
              px: 1,
              py: 0.5,
              borderRadius: 2,
              cursor: "pointer",
              "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
            }}
          >
            <Avatar sx={{ width: 30, height: 30, fontSize: 14, backgroundColor: "#38bdf8", color: "#0f172a" }}>
              {`${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "?"}
            </Avatar>
            <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
              {user?.firstName} {user?.lastName}
              <Box component="span" sx={{ color: "#94a3b8" }}>
                {" "}· {roleLabel}
              </Box>
            </Typography>
          </Box>

          <Button
            onClick={logout}
            startIcon={<LogoutIcon />}
            sx={{ color: "#fff", borderRadius: 0, mr: 0.5 }}
          >
            Logout
          </Button>

          <IconButton
            edge="end"
            color="inherit"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: DRAWER_WIDTH,
              backgroundColor: "#0f172a",
              color: "#e2e8f0",
            },
          },
        }}
      >
        <Box sx={{ px: 2.5, py: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#f8fafc" }}>
            Menu
          </Typography>
          {user && (
            <>
              <Typography variant="body2" sx={{ color: "#e2e8f0", mt: 0.5 }}>
                {user.firstName} {user.lastName}
              </Typography>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                {roleLabel}
              </Typography>
            </>
          )}
        </Box>
        <Divider sx={{ borderColor: "rgba(148,163,184,0.2)" }} />
        <List sx={{ py: 1 }}>
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.path);
            return (
              <ListItemButton
                key={item.path}
                onClick={() => goTo(item.path)}
                selected={active}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  color: active ? "#38bdf8" : "#e2e8f0",
                  "&.Mui-selected": {
                    backgroundColor: "rgba(56,189,248,0.12)",
                  },
                  "&.Mui-selected:hover": {
                    backgroundColor: "rgba(56,189,248,0.18)",
                  },
                  "&:hover": {
                    backgroundColor: "rgba(148,163,184,0.12)",
                  },
                }}
              >
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontWeight: active ? 700 : 500,
                        fontSize: 15,
                      },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>
    </>
  );
}
