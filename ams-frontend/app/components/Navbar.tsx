// components/Navbar.tsx
"use client";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: "Employees", path: "/employees" },
    { label: "Rosters", path: "/rosters" },
  ];

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
      </Toolbar>
    </AppBar>
  );
}
