"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { navItems } from "@/lib/navigation";
import { useTheme } from "@/components/ui/ThemeProvider";
import { useToast } from "@/components/ui/ToastProvider";
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
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [showShortcuts, setShowShortcuts] = useState(false);

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
        showToast("Theme updated", "info");
      }

      if (event.key === "?") {
        event.preventDefault();
        setShowShortcuts((current) => !current);
      }

      if (event.key === "Escape") {
        setShowShortcuts(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, showToast, toggleTheme]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/80 bg-white/90 px-3 pb-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75 lg:block">
        <div className="-mx-3 flex w-64 justify-center py-5">
          <Link href="/" className="block rounded-lg transition hover:bg-blue-50 dark:hover:bg-blue-500/10">
            <Image
              src="/revisio-logo-tight.svg"
              alt="Revisio - Final exam preparation"
              width={193}
              height={66}
              priority
              className="h-auto w-[193px] shrink-0"
            />
          </Link>
        </div>

        <div>
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

        <div className="absolute inset-x-4 bottom-5 space-y-2">
          <button className="btn-secondary w-full" onClick={toggleTheme}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button className="btn-secondary w-full" onClick={() => setShowShortcuts(true)}>
            Shortcuts
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center">
            <Image
              src="/revisio-full-lockup.svg"
              alt="Revisio - Final exam preparation"
              width={126}
              height={84}
              priority
              className="h-auto w-[126px] shrink-0"
            />
          </Link>
          <button className="btn-secondary px-3" onClick={toggleTheme} aria-label="Toggle color theme">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
        <div className="px-4 pb-3">
          <WorkspaceSwitcher compact />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:px-6 lg:ml-64 lg:px-8 lg:py-8">
        <div className="animate-enter">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-1 py-2 text-center text-[11px] font-black transition ${
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

      {showShortcuts ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="animate-enter w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Keyboard shortcuts</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use these when you are not typing in a form.</p>
              </div>
              <button className="btn-secondary px-3" onClick={() => setShowShortcuts(false)}>
                Close
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {navItems.map((item) => (
                <div key={item.href} className="flex items-center justify-between rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-500/10">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                  <span className="rounded-md bg-white px-2 py-1 font-black text-blue-700 ring-1 ring-blue-100 dark:bg-slate-950 dark:text-blue-200 dark:ring-blue-500/30">{item.shortcut}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-500/10">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Toggle theme</span>
                <span className="rounded-md bg-white px-2 py-1 font-black text-blue-700 ring-1 ring-blue-100 dark:bg-slate-950 dark:text-blue-200 dark:ring-blue-500/30">M</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
