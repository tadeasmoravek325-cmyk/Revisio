"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

const publicRoutes = new Set(["/login", "/signup"]);

function AuthLoadingScreen({ error }: { error?: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="panel w-full max-w-md p-5">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
          Checking session
        </p>
        <div className="skeleton mt-4 h-3 w-full" />
        <div className="skeleton mt-3 h-3 w-2/3" />
        {error ? (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;

    async function checkSession() {
      setLoading(true);
      setError("");

      try {
        const supabase = await getSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!active) {
          return;
        }

        setAuthenticated(Boolean(data.session));
        subscription = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
          setAuthenticated(Boolean(session));
        }).data.subscription;
      } catch (sessionError) {
        if (active) {
          setAuthenticated(false);
          setError(sessionError instanceof Error ? sessionError.message : "Could not check authentication.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkSession();

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

    if (!authenticated && !isPublicRoute) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }

    if (authenticated && isPublicRoute) {
      router.replace("/");
    }
  }, [authenticated, loading, pathname, router]);

  if (loading) {
    return <AuthLoadingScreen error={error} />;
  }

  if (!authenticated && !publicRoutes.has(pathname)) {
    return <AuthLoadingScreen error={error} />;
  }

  if (authenticated && publicRoutes.has(pathname)) {
    return <AuthLoadingScreen />;
  }

  return children;
}
