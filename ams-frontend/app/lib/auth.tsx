// app/lib/auth.tsx - client-side session state for AC1/AC3/AC4 of the login user story
// Wraps the app in RootLayout; any component can read the session via useAuth().
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ACCESS_DENIED_EVENT,
  AUTH_LOGOUT_EVENT,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  authApi,
  type AccessDeniedReason,
  type AuthUser,
  type SessionResponse,
} from "./api";
import AccessDeniedDialog from "@/components/AccessDeniedDialog";
import { getHomePath } from "@/lib/roles";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** true while the initial refresh-cookie session check is running */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  /** Clear mustChangePassword after a successful password change. */
  markPasswordChanged: (token?: string) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const userFromSession = (session: SessionResponse): AuthUser => ({
  employeeId: session.employeeId,
  firstName: session.firstName,
  lastName: session.lastName,
  role: session.role,
  mustChangePassword: !!session.mustChangePassword,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [accessDeniedReason, setAccessDeniedReason] =
    useState<AccessDeniedReason>("forbidden");
  const router = useRouter();

  // Validate the HttpOnly refresh cookie on startup instead of trusting stale
  // localStorage. This also rotates the refresh token on every page reload.
  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const session = await authApi.refresh();
        if (!active) return;
        const nextUser = userFromSession(session);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
        setUser(nextUser);
        setSessionExpiresAt(Date.parse(session.sessionExpiresAt));
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    const handleForcedLogout = () => {
      setUser(null);
      setSessionExpiresAt(null);
    };

    const handleAccessDenied = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; reason?: AccessDeniedReason }>)
        .detail;
      setAccessDeniedReason(detail?.reason ?? "forbidden");
      setAccessDeniedMessage(
        detail?.message ?? "Access denied. You do not have permission to perform this action.",
      );
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
    window.addEventListener(ACCESS_DENIED_EVENT, handleAccessDenied as EventListener);
    void restore();

    return () => {
      active = false;
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
      window.removeEventListener(ACCESS_DENIED_EVENT, handleAccessDenied as EventListener);
    };
  }, []);

  // AC1/AC2: calls POST /auth/login, throws on invalid credentials (401),
  // otherwise persists the token + role so the frontend can gate routes/features.
  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);

    const nextUser = userFromSession(result);

    localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setSessionExpiresAt(Date.parse(result.sessionExpiresAt));

    return nextUser;
  }, []);

  const markPasswordChanged = useCallback((token?: string) => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, mustChangePassword: false };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Revoke the server-side refresh session and always clear local state.
  const logout = useCallback(() => {
    authApi.logout().catch(() => {
      // Token may already be expired/invalid — that's fine, we're clearing it anyway.
    });

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setSessionExpiresAt(null);
    setAccessDeniedMessage(null);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    if (sessionExpiresAt == null) return;
    let timer: number;
    const schedule = () => {
      const remaining = sessionExpiresAt - Date.now();
      if (remaining <= 0) {
        logout();
        return;
      }
      timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [logout, sessionExpiresAt]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      markPasswordChanged,
    }),
    [user, isLoading, login, logout, markPasswordChanged],
  );

  const handleAccessDeniedDialogClose = useCallback(() => {
    setAccessDeniedMessage(null);
    if (accessDeniedReason === "unauthenticated") {
      logout();
      return;
    }
    // Forbidden: stay signed in and return to a safe page.
    const home = user ? getHomePath(user) : "/dashboard";
    router.replace(home);
  }, [accessDeniedReason, logout, router, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AccessDeniedDialog
        open={!!accessDeniedMessage}
        message={accessDeniedMessage ?? "Access denied."}
        reason={accessDeniedReason}
        onClose={handleAccessDeniedDialogClose}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
