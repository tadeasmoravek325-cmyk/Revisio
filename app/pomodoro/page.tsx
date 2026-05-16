"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { sessionTypeLabels } from "@/data/studyData";
import { useStudyStore } from "@/hooks/useStudyStore";
import { Question, StudySession, StudySessionType } from "@/types/study";
import { sortQuestionsBySubjectAndNumber } from "@/utils/questionSorting";

type TimerPhase = "work" | "short_break" | "long_break";
type TargetMode = "single" | "multiple" | "decide" | "later";
type AllocationMode = "equal" | "manual";
type ReviewSource = "completed" | "existing";

type PendingInterval = {
  sessionId?: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  source: ReviewSource;
  type?: StudySessionType;
  note?: string;
  questionId?: string;
};

const radius = 112;
const circumference = 2 * Math.PI * radius;
const sessionTypeOptions: StudySessionType[] = ["reading", "active_recall", "revision", "test", "summary"];

function playNotificationSound(enabled: boolean, sound: "beep" | "chime") {
  if (!enabled) return;

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
  gain.connect(context.destination);

  const frequencies = sound === "chime" ? [660, 880] : [880];
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.12);
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.12);
    oscillator.stop(context.currentTime + 0.48 + index * 0.12);
  });
}

function getPhaseLabel(phase: TimerPhase) {
  if (phase === "work") return "Work";
  if (phase === "long_break") return "Long break";
  return "Short break";
}

function getQuestionLabel(question: Question) {
  return `${question.number}. ${question.title}`;
}

function getEqualAllocations(questionIds: string[], totalMinutes: number) {
  if (!questionIds.length) return {};
  const base = Math.floor(totalMinutes / questionIds.length);
  let remainder = totalMinutes - base * questionIds.length;

  return questionIds.reduce<Record<string, number>>((allocations, questionId) => {
    allocations[questionId] = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return allocations;
  }, {});
}

export default function PomodoroPage() {
  const { data, deleteSession, hydrated, logSession, updateSession, updateSettings } = useStudyStore();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<TimerPhase>("work");
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [completedWorkCount, setCompletedWorkCount] = useState(0);
  const [targetMode, setTargetMode] = useState<TargetMode>("decide");
  const [plannedQuestionIds, setPlannedQuestionIds] = useState<string[]>([]);
  const [pendingInterval, setPendingInterval] = useState<PendingInterval | null>(null);
  const sessionStartedAtRef = useRef<Date | null>(null);
  const completedRef = useRef(false);

  const durationMinutes =
    phase === "work"
      ? data.settings.pomodoroWorkMinutes
      : phase === "long_break"
        ? data.settings.pomodoroLongBreakMinutes
        : data.settings.pomodoroShortBreakMinutes;
  const duration = durationMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(duration);

  useEffect(() => {
    setSecondsLeft(duration);
    setIsRunning(false);
    setHasStarted(false);
    completedRef.current = false;
    sessionStartedAtRef.current = null;
  }, [duration]);

  const completeInterval = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsRunning(false);
    setHasStarted(false);
    playNotificationSound(data.settings.soundEnabled, data.settings.notificationSound);
    window.navigator.vibrate?.(120);

    if (phase === "work") {
      const endedAt = new Date();
      const startedAt =
        sessionStartedAtRef.current ??
        new Date(endedAt.getTime() - data.settings.pomodoroWorkMinutes * 60 * 1000);
      const nextCompletedCount = completedWorkCount + 1;
      const nextBreak =
        nextCompletedCount % data.settings.pomodoroLongBreakAfter === 0 ? "long_break" : "short_break";

      setCompletedWorkCount(nextCompletedCount);
      setPendingInterval({
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMinutes: data.settings.pomodoroWorkMinutes,
        source: "completed"
      });
      setPhase(nextBreak);
      return;
    }

    setPhase("work");
  }, [
    completedWorkCount,
    data.settings.notificationSound,
    data.settings.pomodoroLongBreakAfter,
    data.settings.pomodoroWorkMinutes,
    data.settings.soundEnabled,
    phase
  ]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          window.setTimeout(completeInterval, 0);
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [completeInterval, isRunning]);

  function startOrResume() {
    completedRef.current = false;

    if (!sessionStartedAtRef.current && phase === "work") {
      sessionStartedAtRef.current = new Date();
    }

    setIsRunning(true);
    setHasStarted(true);
  }

  function reset() {
    setIsRunning(false);
    setSecondsLeft(duration);
    setHasStarted(false);
    completedRef.current = false;
    sessionStartedAtRef.current = null;
  }

  function togglePlannedQuestion(questionId: string) {
    setPlannedQuestionIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId]
    );
  }

  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  const progress = duration ? (duration - secondsLeft) / duration : 0;
  const dashOffset = circumference * (1 - progress);
  const unassignedSessions = data.sessions.filter((session) => session.needsReview || !session.questionId);
  const sortedQuestions = useMemo(
    () => sortQuestionsBySubjectAndNumber(data.questions, data.subjects),
    [data.questions, data.subjects]
  );
  const reviewedSessions = data.sessions
    .filter((session) => !session.needsReview && session.questionId)
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
    .slice(0, 8);

  return (
    <AppShell>
      {!hydrated ? (
        <LoadingState />
      ) : (
        <>
          <PageHeader title="Pomodoro" eyebrow="Study timer" />

          <div className="grid gap-5 lg:grid-cols-[1fr_410px]">
            <section className="panel p-4 sm:p-6">
              <div className="mx-auto max-w-xl">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                  <p className="text-sm font-black text-slate-950 dark:text-slate-50">Study target</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ["single", "One question"],
                      ["multiple", "Multiple questions"],
                      ["decide", "Decide after interval"],
                      ["later", "Log later"]
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={targetMode === value ? "btn-primary" : "btn-secondary"}
                        onClick={() => setTargetMode(value as TargetMode)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {targetMode !== "decide" && targetMode !== "later" ? (
                    <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                      {sortedQuestions.map((question) => {
                        const checked = plannedQuestionIds.includes(question.id);
                        return (
                          <label key={question.id} className="flex items-start gap-2 rounded-md bg-white p-2 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                            <input
                              type={targetMode === "single" ? "radio" : "checkbox"}
                              checked={checked}
                              onChange={() =>
                                targetMode === "single"
                                  ? setPlannedQuestionIds([question.id])
                                  : togglePlannedQuestion(question.id)
                              }
                              className="mt-1 accent-blue-600"
                            />
                            <span>{getQuestionLabel(question)}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid place-items-center">
                  <div className="relative grid aspect-square w-full max-w-[320px] place-items-center">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 260 260" aria-hidden="true">
                      <circle cx="130" cy="130" r={radius} fill="none" stroke="currentColor" strokeWidth="16" className="text-slate-200 dark:text-slate-800" />
                      <circle cx="130" cy="130" r={radius} fill="none" stroke={phase === "work" ? "#2563eb" : "#d97706"} strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" strokeWidth="16" className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-center">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
                          {getPhaseLabel(phase)}
                        </p>
                        <p className="mt-2 text-6xl font-black tabular-nums text-slate-950 dark:text-slate-50 sm:text-7xl">
                          {minutes}:{seconds}
                        </p>
                        <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                          Completed work intervals: {completedWorkCount}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button className="btn-primary" onClick={isRunning ? () => setIsRunning(false) : startOrResume}>
                    {isRunning ? "Pause" : hasStarted ? "Resume" : "Start"}
                  </button>
                  <button className="btn-secondary" onClick={reset}>
                    Reset
                  </button>
                </div>
              </div>
            </section>

            <section className="panel p-4 sm:p-5">
              <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Timer settings</h2>
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumberSetting label="Work" value={data.settings.pomodoroWorkMinutes} onChange={(value) => updateSettings({ ...data.settings, pomodoroWorkMinutes: value })} />
                  <NumberSetting label="Short break" value={data.settings.pomodoroShortBreakMinutes} onChange={(value) => updateSettings({ ...data.settings, pomodoroShortBreakMinutes: value, pomodoroBreakMinutes: value })} />
                  <NumberSetting label="Long break" value={data.settings.pomodoroLongBreakMinutes} onChange={(value) => updateSettings({ ...data.settings, pomodoroLongBreakMinutes: value })} />
                  <NumberSetting label="Long after" value={data.settings.pomodoroLongBreakAfter} onChange={(value) => updateSettings({ ...data.settings, pomodoroLongBreakAfter: value })} />
                </div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Notification sound
                  <select
                    className="field mt-1"
                    value={data.settings.notificationSound}
                    onChange={(event) =>
                      updateSettings({
                        ...data.settings,
                        notificationSound: event.target.value as "beep" | "chime"
                      })
                    }
                  >
                    <option value="beep">Beep</option>
                    <option value="chime">Chime</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  Sound notification
                  <input
                    type="checkbox"
                    checked={data.settings.soundEnabled}
                    onChange={(event) => updateSettings({ ...data.settings, soundEnabled: event.target.checked })}
                    className="h-5 w-5 accent-blue-600"
                  />
                </label>
                <button className="btn-secondary w-full" onClick={() => playNotificationSound(data.settings.soundEnabled, data.settings.notificationSound)}>
                  Test sound
                </button>
              </div>
            </section>
          </div>

          <NeedsReview
            sessions={unassignedSessions}
            questions={sortedQuestions}
            onReview={(session) =>
              setPendingInterval({
                sessionId: session.id,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
                durationMinutes: session.durationMinutes,
                source: "existing",
                type: session.type,
                note: session.note,
                questionId: session.questionId
              })
            }
            onDelete={(id) => {
              deleteSession(id);
              showToast("Session deleted", "warning");
            }}
          />

          <RecentSessions
            sessions={reviewedSessions}
            questions={sortedQuestions}
            onEdit={(session) =>
              setPendingInterval({
                sessionId: session.id,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
                durationMinutes: session.durationMinutes,
                source: "existing",
                type: session.type,
                note: session.note,
                questionId: session.questionId
              })
            }
            onDelete={(id) => {
              deleteSession(id);
              showToast("Session deleted", "warning");
            }}
          />

          {pendingInterval ? (
            <ReviewModal
              interval={pendingInterval}
              initialQuestionIds={
                pendingInterval.source === "existing"
                  ? pendingInterval.questionId
                    ? [pendingInterval.questionId]
                    : []
                  : targetMode === "later" || targetMode === "decide"
                    ? []
                    : plannedQuestionIds
              }
              questions={sortedQuestions}
              onClose={() => setPendingInterval(null)}
              onLogLater={(durationMinutes, type, note) => {
                const endedAt = new Date(
                  new Date(pendingInterval.startedAt).getTime() + durationMinutes * 60 * 1000
                ).toISOString();
                if (pendingInterval.source === "existing" && pendingInterval.sessionId) {
                  updateSession(pendingInterval.sessionId, {
                    endedAt,
                    durationMinutes,
                    type,
                    note,
                    needsReview: true,
                    questionId: undefined
                  });
                } else {
                  logSession({
                    startedAt: pendingInterval.startedAt,
                    endedAt,
                    durationMinutes,
                    type,
                    needsReview: true,
                    note: note || "Pomodoro interval to review later"
                  });
                }
                setPendingInterval(null);
                showToast("Session saved for later", "info");
              }}
              onSave={(sessions) => {
                if (pendingInterval.source === "existing" && pendingInterval.sessionId) {
                  deleteSession(pendingInterval.sessionId);
                }
                sessions.forEach(logSession);
                setPendingInterval(null);
                showToast("Study session logged");
              }}
            />
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <input className="field mt-1" min={1} type="number" value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} />
    </label>
  );
}

function NeedsReview({
  sessions,
  questions,
  onReview,
  onDelete
}: {
  sessions: StudySession[];
  questions: Question[];
  onReview: (session: StudySession) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="panel mt-5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Needs review</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Unassigned sessions count toward total time only.</p>
        </div>
        <span className="badge bg-amber-100 text-amber-800">{sessions.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {!sessions.length ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            No sessions waiting for review.
          </div>
        ) : null}
        {sessions.map((session) => (
          <article key={session.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-slate-950 dark:text-slate-50">{session.durationMinutes} min</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {new Date(session.endedAt).toLocaleDateString()} · {sessionTypeLabels[session.type]}
                </p>
                {session.questionId ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Current question: {questions.find((question) => question.id === session.questionId)?.title ?? "Deleted question"}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary" onClick={() => onReview(session)}>Review</button>
                <button className="btn-secondary" onClick={() => onDelete(session.id)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecentSessions({
  sessions,
  questions,
  onEdit,
  onDelete
}: {
  sessions: StudySession[];
  questions: Question[];
  onEdit: (session: StudySession) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="panel mt-5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Recent sessions</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Edit, split, or delete finished study sessions.</p>
        </div>
        <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{sessions.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {!sessions.length ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            No reviewed sessions yet.
          </div>
        ) : null}
        {sessions.map((session) => {
          const question = questions.find((item) => item.id === session.questionId);
          return (
            <article key={session.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-950 dark:text-slate-50">
                    {question ? getQuestionLabel(question) : "Deleted question"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {session.durationMinutes} min · {sessionTypeLabels[session.type]} · {new Date(session.endedAt).toLocaleDateString()}
                  </p>
                  {session.note ? (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{session.note}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-primary" onClick={() => onEdit(session)}>Edit</button>
                  <button className="btn-secondary" onClick={() => onDelete(session.id)}>Delete</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReviewModal({
  interval,
  initialQuestionIds,
  questions,
  onClose,
  onLogLater,
  onSave
}: {
  interval: PendingInterval;
  initialQuestionIds: string[];
  questions: Question[];
  onClose: () => void;
  onLogLater: (durationMinutes: number, type: StudySessionType, note: string) => void;
  onSave: (sessions: Omit<StudySession, "id">[]) => void;
}) {
  const [durationMinutes, setDurationMinutes] = useState(interval.durationMinutes);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialQuestionIds);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("equal");
  const [allocations, setAllocations] = useState<Record<string, number>>(() =>
    getEqualAllocations(initialQuestionIds, interval.durationMinutes)
  );
  const [type, setType] = useState<StudySessionType>(interval.type ?? "active_recall");
  const [note, setNote] = useState(interval.note ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (allocationMode === "equal") {
      setAllocations(getEqualAllocations(selectedIds, durationMinutes));
    }
  }, [allocationMode, durationMinutes, selectedIds]);

  function toggleQuestion(questionId: string) {
    setSelectedIds((current) => {
      const next = current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId];
      setError("");
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedIds.length) {
      setError("Select at least one question or choose log later.");
      return;
    }

    const resolvedAllocations =
      allocationMode === "equal" ? getEqualAllocations(selectedIds, durationMinutes) : allocations;
    const total = selectedIds.reduce((sum, questionId) => sum + (resolvedAllocations[questionId] || 0), 0);

    if (total !== durationMinutes) {
      setError(`Allocated minutes must equal ${durationMinutes} min.`);
      return;
    }

    const endedAt = new Date(new Date(interval.startedAt).getTime() + durationMinutes * 60 * 1000).toISOString();

    onSave(
      selectedIds.map((questionId) => ({
        questionId,
        startedAt: interval.startedAt,
        endedAt,
        durationMinutes: resolvedAllocations[questionId],
        type,
        note: note.trim(),
        needsReview: false
      }))
    );
  }

  const allocatedTotal = selectedIds.reduce((sum, questionId) => sum + (allocations[questionId] || 0), 0);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="animate-enter max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">What did you study?</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Completed interval: {durationMinutes} min
            </p>
          </div>
          <button className="btn-secondary px-3" type="button" onClick={onClose}>Close</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Duration
            <input
              className="field mt-1"
              min={1}
              type="number"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Math.max(1, Number(event.target.value)))}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Study type
            <select className="field mt-1" value={type} onChange={(event) => setType(event.target.value as StudySessionType)}>
              {sessionTypeOptions.map((option) => (
                <option key={option} value={option}>{sessionTypeLabels[option]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Split mode
            <select className="field mt-1" value={allocationMode} onChange={(event) => setAllocationMode(event.target.value as AllocationMode)}>
              <option value="equal">Equal split</option>
              <option value="manual">Manual allocation</option>
            </select>
          </label>
        </div>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
          {questions.map((question) => (
            <div key={question.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
              <label className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={selectedIds.includes(question.id)} onChange={() => toggleQuestion(question.id)} className="mt-1 accent-blue-600" />
                <span>{getQuestionLabel(question)}</span>
              </label>
              {selectedIds.includes(question.id) ? (
                <label className="mt-2 block text-xs font-bold text-slate-500 dark:text-slate-400">
                  Minutes
                  <input
                    className="field mt-1"
                    disabled={allocationMode === "equal"}
                    min={0}
                    type="number"
                    value={allocations[question.id] ?? 0}
                    onChange={(event) =>
                      setAllocations((current) => ({ ...current, [question.id]: Number(event.target.value) }))
                    }
                  />
                </label>
              ) : null}
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
          Allocated: {allocatedTotal} / {durationMinutes} min
        </p>

        <label className="mt-3 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Note
          <input className="field mt-1" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
        </label>

        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button className="btn-secondary" type="button" onClick={() => onLogLater(durationMinutes, type, note.trim())}>Log later</button>
          <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-primary" type="submit">Save session</button>
        </div>
      </form>
    </div>
  );
}
