"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

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
  const { authError, loading, user } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const isPublicRoute = publicRoutes.has(pathname);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setTimedOut(true);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    if (isPublicRoute) {
      return;
    }

    if ((!loading || timedOut) && !user) {
      if (process.env.NODE_ENV === "development") {
        console.info("[Revisio auth] redirect to /login", { pathname, timedOut });
      }
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPublicRoute, loading, pathname, router, timedOut, user]);

  useEffect(() => {
    if (user && isPublicRoute) {
      router.replace("/");
    }
  }, [isPublicRoute, router, user]);

  if (isPublicRoute) {
    return children;
  }

  if (loading && !timedOut) {
    return <AuthLoadingScreen error={authError} />;
  }

  if (!user) {
    return <AuthLoadingScreen error={authError} />;
  }

  return children;
}
