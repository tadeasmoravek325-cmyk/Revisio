"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authError: string;
  isLoggingOut: boolean;
  lastAuthEvent: string;
  clearAuthState: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function logAuth(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[Revisio auth] ${message}`, details ?? {});
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [lastAuthEvent, setLastAuthEvent] = useState("initializing");

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;

    async function loadSession() {
      try {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!active) {
          return;
        }

        setUser(data.session?.user ?? null);
        setLastAuthEvent(data.session ? "session_found" : "session_not_found");
        logAuth(data.session ? "auth session found" : "auth session not found", {
          userId: data.session?.user?.id
        });
        subscription = supabase.auth.onAuthStateChange((_event: string, session: any) => {
          setUser(session?.user ?? null);
          setLoading(false);
          setLastAuthEvent(`${_event}:${session ? "session" : "no_session"}`);
          logAuth(session ? "auth state session found" : "auth state session not found", {
            event: _event,
            userId: session?.user?.id
          });
        }).data.subscription;
      } catch (error) {
        if (active) {
          setAuthError(error instanceof Error ? error.message : "Authentication could not be initialized.");
          setLastAuthEvent("session_error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  function clearAuthState() {
    setUser(null);
    setLoading(false);
    setLastAuthEvent("auth_state_cleared");
    logAuth("auth state cleared");
  }

  async function signOut() {
    logAuth("logout started", { userId: user?.id });
    setIsLoggingOut(true);
    clearAuthState();

    try {
      const supabase = await getSupabaseClient();
      await supabase.auth.signOut();
      setLastAuthEvent("signout_completed");
      logAuth("supabase signOut completed", { userId: user?.id });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Logout could not be completed.");
      setLastAuthEvent("signout_error");
      logAuth("logout failed", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      logAuth("hard redirect to /login", { reason: "logout" });
      window.location.replace("/login");
    }
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      isLoggingOut,
      lastAuthEvent,
      clearAuthState,
      signOut
    }),
    [authError, isLoggingOut, lastAuthEvent, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
