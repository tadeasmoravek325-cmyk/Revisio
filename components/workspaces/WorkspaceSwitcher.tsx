"use client";

import { FormEvent, useEffect, useState } from "react";
import { useStudyStore } from "@/hooks/useStudyStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";

type WorkspaceSwitcherProps = {
  compact?: boolean;
};

const defaultColor = "#2563eb";

export function WorkspaceSwitcher({ compact = false }: WorkspaceSwitcherProps) {
  const {
    activeWorkspace,
    activeWorkspaceId,
    addWorkspace,
    deleteWorkspace,
    switchWorkspace,
    updateWorkspace,
    workspaces
  } = useStudyStore();
  const { showToast } = useToast();
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examDate, setExamDate] = useState("");
  const [color, setColor] = useState(defaultColor);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "edit" && activeWorkspace) {
      setName(activeWorkspace.name);
      setDescription(activeWorkspace.description);
      setExamDate(activeWorkspace.examDate);
      setColor(activeWorkspace.color ?? defaultColor);
      setError("");
    }

    if (mode === "create") {
      setName("");
      setDescription("");
      setExamDate(activeWorkspace?.examDate ?? "");
      setColor(defaultColor);
      setError("");
    }
  }, [activeWorkspace, mode]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Workspace name is required.");
      return;
    }

    if (mode === "create") {
      addWorkspace({
        name: trimmedName,
        description: description.trim(),
        examDate,
        color
      });
      showToast("Workspace created");
    }

    if (mode === "edit" && activeWorkspace) {
      updateWorkspace(activeWorkspace.id, {
        name: trimmedName,
        description: description.trim(),
        examDate,
        color
      });
      showToast("Workspace updated");
    }

    setMode("closed");
    setError("");
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70 ${compact ? "w-full" : ""}`}>
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: activeWorkspace?.color ?? defaultColor }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950 dark:text-slate-50">
            {activeWorkspace?.name ?? "Workspace"}
          </p>
          {!compact ? (
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              {activeWorkspace?.description || "Current study preparation"}
            </p>
          ) : null}
        </div>
      </div>

      <select
        className="field mt-3"
        value={activeWorkspaceId}
        onChange={(event) => switchWorkspace(event.target.value)}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button className="btn-secondary px-2 py-1.5 text-xs" onClick={() => setMode("create")}>
          New
        </button>
        <button className="btn-secondary px-2 py-1.5 text-xs" onClick={() => setMode("edit")}>
          Edit
        </button>
        <button
          className="btn-secondary px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          disabled={workspaces.length <= 1}
          onClick={() => setDeleteConfirmOpen(true)}
        >
          Delete
        </button>
      </div>

      {mode !== "closed" ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            Name
            <input
              className="field mt-1"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              placeholder="e.g. Státnice Ing."
            />
          </label>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            Description
            <input
              className="field mt-1"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            Exam date
            <input
              className="field mt-1"
              type="date"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
            />
          </label>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            Color
            <div className="mt-1 flex gap-2">
              <input
                aria-label="Workspace color"
                className="h-10 w-12 rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
              <input className="field" value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
          </label>
          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary px-2 py-1.5 text-xs" type="button" onClick={() => setMode("closed")}>
              Cancel
            </button>
            <button className="btn-primary px-2 py-1.5 text-xs" type="submit">
              Save
            </button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete workspace?"
        message={`This will delete "${activeWorkspace?.name ?? "this workspace"}" with its subjects, questions, and study sessions.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (activeWorkspace) {
            deleteWorkspace(activeWorkspace.id);
            showToast("Workspace deleted", "warning");
          }
          setDeleteConfirmOpen(false);
        }}
      />
    </div>
  );
}
