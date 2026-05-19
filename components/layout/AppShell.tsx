"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RevisioLogoImage } from "@/components/branding/RevisioLogoImage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { navItems } from "@/lib/navigation";
import { useStudyStore } from "@/hooks/useStudyStore";
import { useTheme } from "@/components/ui/ThemeProvider";
import { WorkspaceSwitcher } from "@/components/workspaces/WorkspaceSwitcher";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { dismissLocalMigration, migrateLocalDataToCloud, pendingLocalMigration, storageError, syncStatus } = useStudyStore();
  const { toggleTheme } = useTheme();

  const syncLabel =
    syncStatus === "loading"
      ? "Loading cloud data"
      : syncStatus === "syncing"
        ? "Syncing"
        : syncStatus === "synced"
          ? "Synced"
          : syncStatus === "offline_cache"
            ? "Offline/local cache"
            : "Sync failed";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const targetItem = navItems.find((item) => item.shortcut.toLowerCase() === key);

      if (targetItem) {
        event.preventDefault();
        router.push(targetItem.href);
        return;
      }

      if (key === "m") {
        event.preventDefault();
        toggleTheme();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, toggleTheme]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-64 overflow-y-auto border-r border-slate-200/80 bg-white/90 px-3 pb-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75 lg:block">
        <div className="flex min-h-full flex-col">
          <div className="shrink-0">
            <div className="-mx-3 flex w-64 justify-center py-5">
              <Link href="/" className="block rounded-lg transition hover:bg-blue-50 dark:hover:bg-blue-500/10">
                <RevisioLogoImage
                  lightSrc="/revisio-logo-tight.svg"
                  darkSrc="/revisio-logo-tight-darkmode.svg"
                  alt="Revisio - Final exam preparation"
                  width={193}
                  height={66}
                  priority
                  className="h-auto w-[193px] shrink-0"
                />
              </Link>
            </div>

            <WorkspaceSwitcher />
          </div>

          <nav className="mt-5 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-900/10 dark:bg-blue-500 dark:text-white"
                      : "text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-100"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] ${active ? "bg-white/20" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                    {item.shortcut}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="min-h-5 flex-1" />

          <div className="mt-5 shrink-0 space-y-3">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-3 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                Signed in as
              </span>
              <span className="mt-1 block truncate text-sm font-black text-slate-800 dark:text-slate-100">
                {user?.email}
              </span>
              <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300">
                {syncLabel}
              </span>
            </div>
            <button className="btn-secondary w-full" onClick={signOut}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center">
            <RevisioLogoImage
              lightSrc="/revisio-full-lockup.svg"
              darkSrc="/revisio-logo-tight-darkmode.svg"
              alt="Revisio - Final exam preparation"
              width={126}
              height={84}
              priority
              className="h-auto w-[126px] shrink-0"
            />
          </Link>
          <button className="btn-secondary px-3" onClick={signOut}>
            Logout
          </button>
        </div>
        <div className="px-4 pb-3">
          <WorkspaceSwitcher compact />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:ml-64 lg:px-8 lg:py-8 lg:pb-8">
        {storageError ? (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
            Cloud sync failed: {storageError}
          </div>
        ) : null}
        <div className="animate-enter">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-h-11 rounded-lg px-1 py-2 text-center text-[11px] font-black transition ${
                  active
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-100"
                }`}
              >
                <span className="block">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ConfirmDialog
        open={pendingLocalMigration}
        title="Import local study data?"
        message="We found local study data on this device, but your cloud account is empty. Import it to your Supabase cloud account?"
        confirmLabel="Import to cloud"
        onCancel={dismissLocalMigration}
        onConfirm={migrateLocalDataToCloud}
      />
    </div>
  );
}
