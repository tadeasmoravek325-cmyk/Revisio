"use client";

import { FormEvent, useState } from "react";
import {
  difficultyLabels,
  difficultyStyles,
  importanceLabels,
  importanceStyles,
  sessionTypeLabels,
  statusLabels,
  statusStyles
} from "@/data/studyData";
import {
  Difficulty,
  Importance,
  Question,
  QuestionStatus,
  StudySession,
  StudySessionType,
  Subject
} from "@/types/study";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { createLocalDateTime, toDateInputValue } from "@/utils/date";
import { SubjectPill } from "./SubjectPill";

const statusOptions: QuestionStatus[] = ["unknown", "partial", "known"];
const difficultyOptions: Difficulty[] = ["easy", "medium", "hard"];
const importanceOptions: Importance[] = ["low", "medium", "high"];
const sessionTypeOptions: StudySessionType[] = ["reading", "active_recall", "revision", "test", "summary"];

type QuestionCardProps = {
  question: Question;
  subject?: Subject;
  subjects: Subject[];
  lastSeen?: string;
  daysSinceLastSeen?: number;
  reviewCount: number;
  totalStudyTime: number;
  onUpdate: (id: string, patch: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onLogSession: (session: Omit<StudySession, "id">) => void;
  defaultSessionMinutes: number;
};

function formatLastSeen(value?: string) {
  if (!value) {
    return "Not seen yet";
  }

  return createLocalDateTime(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function createFinishedSession(
  questionId: string,
  minutes: number,
  type: StudySessionType,
  note: string
): Omit<StudySession, "id"> {
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - minutes * 60 * 1000);

  return {
    questionId,
    date: toDateInputValue(endedAt),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMinutes: minutes,
    type,
    note
  };
}

export function QuestionCard({
  question,
  subject,
  subjects,
  lastSeen,
  daysSinceLastSeen,
  reviewCount,
  totalStudyTime,
  onUpdate,
  onDelete,
  onLogSession,
  defaultSessionMinutes
}: QuestionCardProps) {
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showManualLog, setShowManualLog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [draft, setDraft] = useState({
    title: question.title,
    notes: question.notes ?? "",
    number: question.number,
    tags: question.tags.join(", "),
    subjectId: question.subjectId,
    status: question.status,
    difficulty: question.difficulty,
    importance: question.importance
  });
  const [manualMinutes, setManualMinutes] = useState(30);
  const [manualType, setManualType] = useState<StudySessionType>("revision");
  const [manualNote, setManualNote] = useState("");

  function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) {
      return;
    }

    onUpdate(question.id, {
      title: draft.title.trim(),
      notes: draft.notes.trim(),
      number: draft.number,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      subjectId: draft.subjectId,
      status: draft.status,
      difficulty: draft.difficulty,
      importance: draft.importance
    });
    showToast("Question updated");
    setIsEditing(false);
  }

  function handleStartSession() {
    onLogSession(
      createFinishedSession(
        question.id,
        defaultSessionMinutes,
        "active_recall",
        "Started from question card"
      )
    );
    showToast("Study session logged");
  }

  function handleManualSubmit(event: FormEvent) {
    event.preventDefault();
    if (manualMinutes < 1) {
      return;
    }

    onLogSession(
      createFinishedSession(question.id, manualMinutes, manualType, manualNote.trim())
    );
    showToast("Manual study time logged");
    setManualMinutes(30);
    setManualType("revision");
    setManualNote("");
    setShowManualLog(false);
  }

  return (
    <article className="panel p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <SubjectPill subject={subject} />
          <h2 className="mt-3 text-base font-black text-slate-950 dark:text-slate-50">
            {question.number}. {question.title}
          </h2>
          {question.notes ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{question.notes}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn-secondary flex-1 sm:flex-none" onClick={() => setIsEditing((value) => !value)}>
            {isEditing ? "Cancel" : "Edit"}
          </button>
          <button className="btn-secondary flex-1 sm:flex-none" onClick={() => setShowDeleteConfirm(true)}>
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Last seen</p>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{formatLastSeen(lastSeen)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Days since</p>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
            {daysSinceLastSeen === undefined ? "Never" : `${daysSinceLastSeen} days`}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Reviews</p>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{reviewCount}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Total time</p>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{totalStudyTime} min</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`badge ${statusStyles[question.status]}`}>{statusLabels[question.status]}</span>
        <span className={`badge ${difficultyStyles[question.difficulty]}`}>
          {difficultyLabels[question.difficulty]}
        </span>
        <span className={`badge ${importanceStyles[question.importance]}`}>
          {importanceLabels[question.importance]}
        </span>
        {question.tags.map((tag) => (
          <span key={tag} className="badge bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700">
            {tag}
          </span>
        ))}
      </div>

      {isEditing ? (
        <form onSubmit={handleEditSubmit} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
              Title
              <textarea
                className="field mt-1 min-h-20 resize-none"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Number
              <input
                className="field mt-1"
                min={1}
                type="number"
                value={draft.number}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, number: Number(event.target.value) }))
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
              Notes
              <textarea
                className="field mt-1 min-h-20 resize-none"
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
              Tags
              <input
                className="field mt-1"
                value={draft.tags}
                onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                placeholder="Comma separated"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Subject
              <select
                className="field mt-1"
                value={draft.subjectId}
                onChange={(event) => setDraft((current) => ({ ...current, subjectId: event.target.value }))}
              >
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Status
              <select
                className="field mt-1"
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, status: event.target.value as QuestionStatus }))
                }
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Difficulty
              <select
                className="field mt-1"
                value={draft.difficulty}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, difficulty: event.target.value as Difficulty }))
                }
              >
                {difficultyOptions.map((option) => (
                  <option key={option} value={option}>
                    {difficultyLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Importance
              <select
                className="field mt-1"
                value={draft.importance}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, importance: event.target.value as Importance }))
                }
              >
                {importanceOptions.map((option) => (
                  <option key={option} value={option}>
                    {importanceLabels[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn-primary mt-3 w-full sm:w-auto" type="submit">
            Save changes
          </button>
        </form>
      ) : null}

      {showManualLog ? (
        <form onSubmit={handleManualSubmit} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="grid gap-3 sm:grid-cols-[120px_180px_1fr]">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Minutes
              <input
                className="field mt-1"
                min={1}
                type="number"
                value={manualMinutes}
                onChange={(event) => setManualMinutes(Number(event.target.value))}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Type
              <select
                className="field mt-1"
                value={manualType}
                onChange={(event) => setManualType(event.target.value as StudySessionType)}
              >
                {sessionTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {sessionTypeLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Note
              <input
                className="field mt-1"
                value={manualNote}
                onChange={(event) => setManualNote(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <button className="btn-primary mt-3 w-full sm:w-auto" type="submit">
            Save manual time
          </button>
        </form>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button className="btn-primary" onClick={handleStartSession}>
          Start study session
        </button>
        <button className="btn-secondary" onClick={() => setShowManualLog((value) => !value)}>
          Log manual study time
        </button>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete question?"
        message="This will also remove study sessions attached to this question."
        confirmLabel="Delete"
        destructive
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          onDelete(question.id);
          setShowDeleteConfirm(false);
          showToast("Question deleted", "warning");
        }}
      />
    </article>
  );
}
