import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { api, setUnauthorizedHandler, isTokenExpired } from "../api/client";

type User = {
  id: string;
  name: string;
  role: "admin" | "team_leader" | "supervisor" | "agent";
  employee_id: string;
  email?: string;
  pool_id?: string | null;
  shift?: string | null;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof localStorage === "undefined") return null;
    const token = localStorage.getItem("access_token");
    const stored = localStorage.getItem("user");
    if (!token || isTokenExpired(token) || !stored) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      localStorage.removeItem("refresh_token");
      return null;
    }
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      return null;
    }
  });

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post("/api/auth/login", { email, password });
    if (!data?.access_token) {
      throw new Error("Authentication response did not contain access token");
    }
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    setUser(data.user);
  }, []);

  const isAuthenticated = useMemo(() => {
    if (!user) return false;
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;
    return Boolean(token && !isTokenExpired(token));
  }, [user]);

  const value = useMemo(() => ({ user, isAuthenticated, login, logout }), [user, isAuthenticated, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

