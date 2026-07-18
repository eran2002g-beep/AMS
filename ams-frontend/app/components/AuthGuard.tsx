// components/AuthGuard.tsx - route-level protection, wraps <main> in RootLayout
// AC1/AC2: only an authenticated session may reach protected AMS pages.
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "@/lib/auth";

// Routes reachable without a session. Extend this list if more public
// pages (e.g. "/forgot-password") are added later.
const PUBLIC_PATHS = ["/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isLoading) return; // wait for the localStorage session check to finish

    if (!isAuthenticated && !isPublicPath) {
      // Preserve where they were headed so login can send them back after AC1.
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isAuthenticated && isPublicPath) {
      // Already logged in — no reason to show the login form again.
      router.replace("/employees");
    }
  }, [isAuthenticated, isLoading, isPublicPath, pathname, router]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Redirect is in flight (see effect above) — render nothing so protected
  // content never flashes on screen before the redirect lands.
  if ((!isAuthenticated && !isPublicPath) || (isAuthenticated && isPublicPath)) {
    return null;
  }

  return <>{children}</>;
}