import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export type User = { user_id: number; name: string; email: string; role: "player" | "admin" };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Simple: persist user in localStorage (session cookie still required for API access)
  useEffect(() => {
    const saved = localStorage.getItem("bb_user");
    if (saved) setUser(JSON.parse(saved));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem("bb_user", JSON.stringify(user));
    else localStorage.removeItem("bb_user");
  }, [user]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const res = await api.login({ email, password });
        setUser(res.user);
      },
      signup: async (name, email, password) => {
        const res = await api.signup({ name, email, password });
        setUser(res.user);
      },
      logout: async () => {
        await api.logout();
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
