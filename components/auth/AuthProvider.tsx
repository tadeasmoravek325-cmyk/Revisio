"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const publicRoutes = new Set(["/login", "/signup"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

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
        subscription = supabase.auth.onAuthStateChange((_event: string, session: any) => {
          setUser(session?.user ?? null);
        }).data.subscription;
      } catch (error) {
        if (active) {
          setAuthError(error instanceof Error ? error.message : "Authentication could not be initialized.");
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

  useEffect(() => {
    if (loading) {
      return;
    }

    const isPublicRoute = publicRoutes.has(pathname);

    if (!user && !isPublicRoute) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }

    if (user && isPublicRoute) {
      router.replace("/");
    }
  }, [loading, pathname, router, user]);

  async function signOut() {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
    setUser(null);
    router.replace("/login");
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      signOut
    }),
    [authError, loading, user]
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
