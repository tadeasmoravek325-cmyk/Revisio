"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { ExamTopicsImportDialog } from "@/components/import/ExamTopicsImportDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { navItems } from "@/lib/navigation";
import { backupService } from "@/services/backupService";
import { useStudyStore } from "@/hooks/useStudyStore";
import { AppState } from "@/types/study";

function formatDateTime(value?: string) {
  if (!value) {
    return "No snapshots yet";
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function SettingsPage() {
  const { signOut, user } = useAuth();
  const {
    activeWorkspaceId,
    automaticBackupsEnabled,
    hydrated,
    reloadFromCloud,
    replaceStudyState,
    resetAppData,
    setAutomaticBackupsEnabled,
    storageError,
    syncStatus,
    workspaces
  } = useStudyStore();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importError, setImportError] = useState("");
  const [snapshots, setSnapshots] = useState<ReturnType<typeof backupService.listSnapshots>>([]);

  const appState = useMemo(
    () => ({
      activeWorkspaceId,
      workspaces
    }),
    [activeWorkspaceId, workspaces]
  );
  const latestSnapshot = snapshots[0];
  const totalQuestions = workspaces.reduce((sum, workspace) => sum + workspace.questions.length, 0);
  const totalSessions = workspaces.reduce((sum, workspace) => sum + workspace.sessions.length, 0);

  useEffect(() => {
    if (hydrated) {
      setSnapshots(backupService.listSnapshots());
    }
  }, [hydrated]);

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

  function handleExport() {
    const backupJson = backupService.createExport(appState);
    const blob = new Blob([backupJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revisio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Backup exported");
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportError("");

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const nextState = backupService.parseImport(String(reader.result ?? ""));
        setPendingImport(nextState);
        setShowImportConfirm(true);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "This backup file is not valid.");
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setImportError("Could not read this backup file.");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function handleCreateSnapshot() {
    setSnapshots(backupService.createSnapshot(appState, true));
    showToast("Local snapshot created");
  }

  if (!hydrated) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Settings" eyebrow="Data safety" />

      <section className="panel mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Cloud sync</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Status: <span className="font-bold text-slate-700 dark:text-slate-200">{syncLabel}</span>
            </p>
          </div>
          <button className="btn-secondary shrink-0" onClick={reloadFromCloud}>
            Reload from cloud
          </button>
        </div>
      </section>

      {storageError ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          Cloud sync needs attention: {storageError}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <section className="panel p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Backup and restore</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Export all Revisio data as JSON or import a previous backup. Imports are validated before anything is overwritten.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button className="btn-primary" onClick={handleExport}>
              Export data
            </button>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Import backup
            </button>
          </div>
          <input
            ref={fileInputRef}
            accept="application/json,.json"
            className="hidden"
            type="file"
            onChange={handleImportFile}
          />

          {importError ? (
            <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              {importError}
            </p>
          ) : null}
        </section>

        <section className="panel p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Current data</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-500/10">
              <p className="text-2xl font-black text-blue-700 dark:text-blue-200">{workspaces.length}</p>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">workspaces</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-2xl font-black text-slate-950 dark:text-slate-50">{totalQuestions}</p>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">questions</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-2xl font-black text-slate-950 dark:text-slate-50">{totalSessions}</p>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">sessions</p>
            </div>
          </div>
        </section>
      </div>

      <section className="panel mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Signed in as <span className="font-bold text-slate-700 dark:text-slate-200">{user?.email}</span>.
              Study data is synced to Supabase cloud storage for this account.
            </p>
          </div>
          <button className="btn-secondary shrink-0" onClick={signOut}>
            Logout
          </button>
        </div>
      </section>

      <section className="panel mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Appearance</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Switch between light and dark mode for this device.
            </p>
          </div>
          <button
            className="btn-secondary shrink-0"
            onClick={() => {
              toggleTheme();
              showToast("Theme updated", "info");
            }}
          >
            {theme === "dark" ? "Use light mode" : "Use dark mode"}
          </button>
        </div>
      </section>

      <section className="panel mt-5 p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Keyboard shortcuts</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Use these when you are not typing in a form.
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {navItems.map((item) => (
            <div key={item.href} className="flex items-center justify-between rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-500/10">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
              <span className="rounded-md bg-white px-2 py-1 font-black text-blue-700 ring-1 ring-blue-100 dark:bg-slate-950 dark:text-blue-200 dark:ring-blue-500/30">
                {item.shortcut}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-500/10">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Toggle theme</span>
            <span className="rounded-md bg-white px-2 py-1 font-black text-blue-700 ring-1 ring-blue-100 dark:bg-slate-950 dark:text-blue-200 dark:ring-blue-500/30">
              M
            </span>
          </div>
        </div>
      </section>

      <section className="panel mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Import exam topics</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Upload TXT, CSV, DOCX, or text-based PDF exam topics, review detected subjects and questions, then approve what should be added to the active workspace.
            </p>
          </div>
          <ExamTopicsImportDialog className="btn-secondary shrink-0" />
        </div>
      </section>

      <section className="panel mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Automatic local snapshots</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Keep small local backup snapshots in this browser. They stay on this device and are not synced to a server.
            </p>
          </div>
          <label className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            Enabled
            <input
              checked={automaticBackupsEnabled}
              className="h-5 w-5 accent-blue-600"
              type="checkbox"
              onChange={(event) => {
                setAutomaticBackupsEnabled(event.target.checked);
                setSnapshots(backupService.listSnapshots());
                showToast(event.target.checked ? "Automatic backups enabled" : "Automatic backups disabled", "info");
              }}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950 dark:text-slate-50">
              {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Latest: {formatDateTime(latestSnapshot?.createdAt)}
            </p>
          </div>
          <button className="btn-secondary" onClick={handleCreateSnapshot}>
            Create snapshot now
          </button>
        </div>
      </section>

      <section className="panel mt-5 border-rose-200 p-4 dark:border-rose-500/30 sm:p-5">
        <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Reset app data</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Resetting permanently removes all local Revisio data from this browser, including workspaces, subjects, questions, sessions, settings, reports, and local backup snapshots. Export a backup first if you want to keep anything.
          Cloud workspace data for this account will also be deleted.
        </p>
        <button className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 active:scale-[0.98]" onClick={() => setShowResetConfirm(true)}>
          Reset app data
        </button>
      </section>

      <ConfirmDialog
        open={showImportConfirm}
        title="Import backup?"
        message={`This will replace the current Revisio cloud data with ${pendingImport?.workspaces.length ?? 0} workspace${pendingImport?.workspaces.length === 1 ? "" : "s"} from the selected backup.`}
        confirmLabel="Import"
        onCancel={() => {
          setShowImportConfirm(false);
          setPendingImport(null);
        }}
        onConfirm={() => {
          if (pendingImport) {
            backupService.createSnapshot(appState, true);
            replaceStudyState(pendingImport);
            setSnapshots(backupService.listSnapshots());
            showToast("Backup imported");
          }
          setShowImportConfirm(false);
          setPendingImport(null);
        }}
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset app data?"
        message="This permanently deletes all Revisio cloud data for this account and clears Revisio-related local data in this browser. It cannot be undone unless you already have an exported backup."
        confirmLabel="Delete all data"
        destructive
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          resetAppData();
          setSnapshots([]);
          setShowResetConfirm(false);
          showToast("All Revisio data deleted", "warning");
        }}
      />
    </AppShell>
  );
}
