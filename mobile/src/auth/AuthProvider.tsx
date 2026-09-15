import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAuthToken, setUnauthorizedHandler } from "@/api/client";
import type { Me, Session, User } from "@/api/types";
import { currentPushToken, registerForPush, unregisterPush } from "@/lib/push";
import { deleteSecure, getSecure, setSecure } from "@/lib/secure";

const TOKEN_KEY = "rl.session";

type AuthState = {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string; role: "renter" | "host"; acceptTerms: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Apply a server-returned user (e.g. after switching to hosting). */
  setUser: (u: User) => void;
  resetPassword: (token: string, password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const clear = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await deleteSecure(TOKEN_KEY).catch(() => {});
    qc.clear();
  }, [qc]);

  const afterSignIn = useCallback(async (session: Session) => {
    await setSecure(TOKEN_KEY, session.token);
    setAuthToken(session.token);
    setUser(session.user);
    qc.invalidateQueries();
    /* Silent: only re-registers if the permission was granted before. */
    registerForPush().catch(() => {});
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clear();
    });
    (async () => {
      try {
        const stored = await getSecure(TOKEN_KEY);
        if (stored) {
          setAuthToken(stored);
          const me = await api<Me>("/api/v1/me");
          setUser(me.user);
          registerForPush().catch(() => {});
        }
      } catch {
        /* Offline at launch keeps the token; a 401 already cleared it. */
      } finally {
        setReady(true);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const s = await api<Session>("/api/v1/auth/login", { body: { email, password } });
      await afterSignIn(s);
    },
    [afterSignIn],
  );

  const signUp = useCallback<AuthState["signUp"]>(
    async (input) => {
      const s = await api<Session>("/api/v1/auth/signup", { body: input });
      await afterSignIn(s);
    },
    [afterSignIn],
  );

  const signOut = useCallback(async () => {
    const t = currentPushToken();
    await api("/api/v1/auth/logout", { body: { pushToken: t ?? undefined } }).catch(() => {});
    await unregisterPush().catch(() => {});
    await clear();
  }, [clear]);

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      const s = await api<Session>("/api/v1/auth/reset", { body: { token, password } });
      await afterSignIn(s);
    },
    [afterSignIn],
  );

  const refresh = useCallback(async () => {
    const me = await api<Me>("/api/v1/me");
    setUser(me.user);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api("/api/v1/me", { method: "DELETE", body: { confirm: "DELETE" } });
    await clear();
  }, [clear]);

  const value = useMemo(
    () => ({ ready, user, signIn, signUp, signOut, refresh, setUser, resetPassword, deleteAccount }),
    [ready, user, signIn, signUp, signOut, refresh, resetPassword, deleteAccount],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export const isHostRole = (u: User | null) => !!u && (u.role === "host" || u.role === "admin");
