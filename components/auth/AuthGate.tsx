"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

const publicRoutes = new Set(["/login", "/signup"]);

type AuthDebugInfo = {
  pathname: string;
  loading: boolean;
  userExists: boolean;
  isLoggingOut: boolean;
  lastAuthEvent: string;
  lastRedirectAttempt: string;
  timestamp: string;
};

function AuthLoadingScreen({ debugInfo, error }: { debugInfo?: AuthDebugInfo; error?: string }) {
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
        {process.env.NODE_ENV === "development" && debugInfo ? (
          <dl className="mt-4 grid gap-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
            <div className="flex justify-between gap-3">
              <dt className="font-bold">pathname</dt>
              <dd className="truncate">{debugInfo.pathname}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">auth loading</dt>
              <dd>{String(debugInfo.loading)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">user exists</dt>
              <dd>{String(debugInfo.userExists)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">isLoggingOut</dt>
              <dd>{String(debugInfo.isLoggingOut)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">last auth event</dt>
              <dd className="truncate">{debugInfo.lastAuthEvent}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">last redirect</dt>
              <dd className="truncate">{debugInfo.lastRedirectAttempt}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold">timestamp</dt>
              <dd className="truncate">{debugInfo.timestamp}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  );
}

function LogoutScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="panel w-full max-w-md p-5">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
          Logging out
        </p>
        <div className="skeleton mt-4 h-3 w-full" />
        <div className="skeleton mt-3 h-3 w-2/3" />
      </section>
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { authError, isLoggingOut, lastAuthEvent, loading, user } = useAuth();
  const [lastRedirectAttempt, setLastRedirectAttempt] = useState("none");
  const [timedOut, setTimedOut] = useState(false);
  const isPublicRoute = publicRoutes.has(pathname);
  const debugInfo = {
    pathname,
    loading,
    userExists: Boolean(user),
    isLoggingOut,
    lastAuthEvent,
    lastRedirectAttempt,
    timestamp: new Date().toISOString()
  };

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
      const redirectValue = `/login?next=${encodeURIComponent(pathname)}`;
      setLastRedirectAttempt(redirectValue);
      if (process.env.NODE_ENV === "development") {
        console.info("[Revisio auth] redirect to /login", { pathname, redirectValue, timedOut });
      }
      router.replace(redirectValue);
    }
  }, [isPublicRoute, loading, pathname, router, timedOut, user]);

  useEffect(() => {
    if (user && isPublicRoute) {
      setLastRedirectAttempt("/");
      router.replace("/");
    }
  }, [isPublicRoute, router, user]);

  if (isPublicRoute) {
    return children;
  }

  if (isLoggingOut) {
    return <LogoutScreen />;
  }

  if (loading && !timedOut) {
    return <AuthLoadingScreen debugInfo={debugInfo} error={authError} />;
  }

  if (!user) {
    return <AuthLoadingScreen debugInfo={debugInfo} error={authError} />;
  }

  return children;
}
