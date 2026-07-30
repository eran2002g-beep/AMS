// app/not-found.tsx — shown when a visitor opens a URL that has no matching page
"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getHomePath } from "@/lib/roles";

export default function NotFound() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const goHome = () => {
    if (isAuthenticated && user) {
      router.push(getHomePath(user));
      return;
    }
    router.push("/login");
  };

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 160px)",
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
            backgroundColor: "#eff6ff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <SearchOffIcon sx={{ fontSize: 40, color: "#2563eb" }} />
        </Box>

        <Typography
          variant="h3"
          sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", mb: 0.5 }}
        >
          404
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b", mb: 1 }}>
          Page not found
        </Typography>
        <Typography variant="body1" sx={{ color: "#64748b", mb: 3 }}>
          The page you are looking for does not exist or may have been moved.
        </Typography>

        <Button
          variant="contained"
          onClick={goHome}
          sx={{
            backgroundColor: "#1e293b",
            "&:hover": { backgroundColor: "#0f172a" },
            px: 3,
          }}
        >
          {isAuthenticated ? "Back to Dashboard" : "Go to Sign In"}
        </Button>
      </Paper>
    </Box>
  );
}
