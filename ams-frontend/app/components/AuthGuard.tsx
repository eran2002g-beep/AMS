// components/AuthGuard.tsx - route-level protection, wraps <main> in RootLayout
// AC1/AC2: only an authenticated session may reach protected AMS pages.
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "@/lib/auth";
import { ACCESS_DENIED_EVENT } from "@/lib/api";
import { canAccessPath, getHomePath } from "@/lib/roles";

// Routes reachable without a session. Extend this list if more public
// pages (e.g. "/forgot-password") are added later.
const PUBLIC_PATHS = ["/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const homePath = user ? getHomePath(user) : "/employees";
  const allowed = !user || isPublicPath || canAccessPath(pathname, user);

  useEffect(() => {
    if (isLoading) return; // wait for the localStorage session check to finish

    if (!isAuthenticated && !isPublicPath) {
      window.dispatchEvent(
        new CustomEvent(ACCESS_DENIED_EVENT, {
          detail: {
            message: "Your session has expired or you are not signed in. Please log in again.",
          },
        }),
      );
      return;
    }

    if (isAuthenticated && user && isPublicPath) {
      // Already logged in — send them to their role home, not a fixed page.
      router.replace(homePath);
      return;
    }

    if (isAuthenticated && user && !allowed) {
      window.dispatchEvent(
        new CustomEvent(ACCESS_DENIED_EVENT, {
          detail: {
            message: "You do not have permission to view this page. Please contact your administrator.",
          },
        }),
      );
    }
  }, [isAuthenticated, isLoading, isPublicPath, pathname, router, user, homePath, allowed]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Redirect is in flight (see effect above) — render nothing so protected
  // content never flashes on screen before the redirect lands.
  if ((!isAuthenticated && !isPublicPath) || (isAuthenticated && isPublicPath) || !allowed) {
    return null;
  }

  return <>{children}</>;
}
