"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExamTopicsImportDialog } from "@/components/import/ExamTopicsImportDialog";
import { useStudyStore } from "@/hooks/useStudyStore";
import { useToast } from "@/components/ui/ToastProvider";

export function EmptyRevisioState() {
  const { addWorkspace } = useStudyStore();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examDate, setExamDate] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Workspace name is required.");
      return;
    }

    addWorkspace({
      name: trimmedName,
      description: description.trim(),
      examDate,
      color: "#2563eb"
    });
    showToast("Workspace created");
  }

  return (
    <section className="panel mx-auto max-w-3xl p-6 text-center sm:p-8">
      <Image
        src="/revisio-icon.svg"
        alt="Revisio"
        width={72}
        height={72}
        priority
        className="mx-auto h-[72px] w-[72px] rounded-2xl"
      />
      <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
        Welcome to Revisio
      </p>
      <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
        Start with a clean workspace
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
        There is no study data on this device. Create a new workspace or import a backup to continue.
      </p>

      <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-xl rounded-lg bg-slate-50 p-4 text-left dark:bg-slate-800/60">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Workspace name
            <input
              className="field mt-1"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              placeholder="e.g. Státnice Bc."
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Exam date
            <input className="field mt-1" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
          </label>
        </div>
        <label className="mt-3 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Description
          <input
            className="field mt-1"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional"
          />
        </label>
        {error ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button className="btn-primary" type="submit">
            Create workspace
          </button>
          <Link className="btn-secondary text-center" href="/settings">
            Import backup
          </Link>
        </div>
      </form>

      <div className="mx-auto mt-4 max-w-xl rounded-lg border border-slate-200 bg-white p-4 text-left dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-950 dark:text-slate-50">Import exam topics</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create a workspace first, then import TXT, CSV, DOCX, or PDF topics into it.
            </p>
          </div>
          <ExamTopicsImportDialog className="btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
      </div>
    </section>
  );
}
