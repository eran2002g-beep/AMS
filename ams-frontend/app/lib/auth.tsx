// app/lib/auth.tsx - client-side session state for AC1/AC3/AC4 of the login user story
// Wraps the app in RootLayout; any component can read the session via useAuth().
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi, type AuthUser } from "./api";

// Keep these keys in sync with the ones api.ts reads inside its interceptors.
const TOKEN_STORAGE_KEY = "ams_token";
const USER_STORAGE_KEY = "ams_user";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** true only while the initial session restore from localStorage is running */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Restore an existing session on first render so a page refresh doesn't
  // bounce a still-logged-in user back to /login.
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedToken && storedUser) {
        setUser(JSON.parse(storedUser) as AuthUser);
      }
    } catch {
      // Corrupted storage — treat as logged out rather than throwing.
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // AC1/AC2: calls POST /auth/login, throws on invalid credentials (401),
  // otherwise persists the token + role so the frontend can gate routes/features.
  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password);

    const nextUser: AuthUser = {
      employeeId: result.employeeId,
      firstName: result.firstName,
      lastName: result.lastName,
      role: result.role,
    };

    localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);

    return nextUser;
  };

  // AC4: session terminated. JWTs are stateless, so removing the token client-side
  // is what actually ends the session; the /auth/logout call is best-effort housekeeping.
  const logout = () => {
    authApi.logout().catch(() => {
      // Token may already be expired/invalid — that's fine, we're clearing it anyway.
    });

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    router.push("/login");
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}