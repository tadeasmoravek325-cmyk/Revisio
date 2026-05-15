"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ExamTopicsImportDialog } from "@/components/import/ExamTopicsImportDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
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
  const {
    activeWorkspaceId,
    automaticBackupsEnabled,
    hydrated,
    replaceStudyState,
    resetAppData,
    setAutomaticBackupsEnabled,
    workspaces
  } = useStudyStore();
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
        </p>
        <button className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 active:scale-[0.98]" onClick={() => setShowResetConfirm(true)}>
          Reset app data
        </button>
      </section>

      <ConfirmDialog
        open={showImportConfirm}
        title="Import backup?"
        message={`This will overwrite the current local Revisio data with ${pendingImport?.workspaces.length ?? 0} workspace${pendingImport?.workspaces.length === 1 ? "" : "s"} from the selected backup.`}
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
        message="This permanently deletes all local Revisio data and clears Revisio-related localStorage keys. It cannot be undone unless you already have an exported backup."
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
