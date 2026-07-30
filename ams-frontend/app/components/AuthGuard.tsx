// components/AuthGuard.tsx - route-level protection, wraps <main> in RootLayout
// AC1/AC2: only an authenticated session may reach protected AMS pages.
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "@/lib/auth";
import { ACCESS_DENIED_EVENT } from "@/lib/api";
import { canAccessPath, getHomePath, isKnownAppPath } from "@/lib/roles";

// Routes reachable without a session. Extend this list if more public
// pages (e.g. "/forgot-password") are added later.
const PUBLIC_PATHS = ["/login"];
const CHANGE_PASSWORD_PATH = "/change-password";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const isChangePasswordPath = pathname === CHANGE_PASSWORD_PATH;
  const knownPath = isKnownAppPath(pathname);
  const homePath = user ? getHomePath(user) : "/dashboard";
  const mustChangePassword = !!user?.mustChangePassword;
  const allowed = !user || isPublicPath || isChangePasswordPath || canAccessPath(pathname, user);

  useEffect(() => {
    if (isLoading) return;

    // Missing URLs — let Next.js not-found UI show (no login/access dialog).
    if (!knownPath) return;

    if (!isAuthenticated && !isPublicPath) {
      window.dispatchEvent(
        new CustomEvent(ACCESS_DENIED_EVENT, {
          detail: {
            reason: "unauthenticated",
            message: "Your session has expired or you are not signed in. Please log in again.",
          },
        }),
      );
      return;
    }

    if (isAuthenticated && user && isPublicPath) {
      router.replace(mustChangePassword ? CHANGE_PASSWORD_PATH : homePath);
      return;
    }

    // Temp / reset password — lock the app to the change-password page.
    if (isAuthenticated && user && mustChangePassword && !isChangePasswordPath) {
      router.replace(CHANGE_PASSWORD_PATH);
      return;
    }

    if (isAuthenticated && user && !mustChangePassword && isChangePasswordPath) {
      router.replace(homePath);
      return;
    }

    if (isAuthenticated && user && !allowed) {
      window.dispatchEvent(
        new CustomEvent(ACCESS_DENIED_EVENT, {
          detail: {
            reason: "forbidden",
            message: "You do not have permission to view this page. Please contact your administrator.",
          },
        }),
      );
    }
  }, [
    isAuthenticated,
    isLoading,
    isPublicPath,
    isChangePasswordPath,
    knownPath,
    mustChangePassword,
    pathname,
    router,
    user,
    homePath,
    allowed,
  ]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Unknown route — always render so app/not-found.tsx can show.
  if (!knownPath) {
    return <>{children}</>;
  }

  if (!isAuthenticated && !isPublicPath) {
    return null;
  }

  if (isAuthenticated && isPublicPath) {
    return null;
  }

  if (isAuthenticated && mustChangePassword && !isChangePasswordPath) {
    return null;
  }

  if (isAuthenticated && !mustChangePassword && isChangePasswordPath) {
    return null;
  }

  if (isAuthenticated && !allowed) {
    return null;
  }

  return <>{children}</>;
}
