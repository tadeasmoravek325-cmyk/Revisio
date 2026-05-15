"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { sessionTypeLabels } from "@/data/studyData";
import { useStudyStore } from "@/hooks/useStudyStore";
import { StudySessionType } from "@/types/study";

type TimerPhase = "work" | "break";

const radius = 112;
const circumference = 2 * Math.PI * radius;
const sessionTypeOptions: StudySessionType[] = ["reading", "active_recall", "revision", "test"];

function playNotificationSound(enabled: boolean) {
  if (!enabled) return;

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.5);
}

export default function PomodoroPage() {
  const { data, hydrated, logSession, updateSettings } = useStudyStore();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<TimerPhase>("work");
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [questionId, setQuestionId] = useState("");
  const [sessionType, setSessionType] = useState<StudySessionType>("active_recall");
  const sessionStartedAtRef = useRef<Date | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!questionId && data.questions[0]) {
      setQuestionId(data.questions[0].id);
    }
  }, [data.questions, questionId]);

  const selectedQuestion = data.questions.find((question) => question.id === questionId);
  const selectedSubject = data.subjects.find((subject) => subject.id === selectedQuestion?.subjectId);

  const duration = useMemo(() => {
    return (phase === "work" ? data.settings.pomodoroWorkMinutes : data.settings.pomodoroBreakMinutes) * 60;
  }, [data.settings.pomodoroBreakMinutes, data.settings.pomodoroWorkMinutes, phase]);

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
    playNotificationSound(data.settings.soundEnabled);
    window.navigator.vibrate?.(120);

    if (phase === "work" && questionId) {
      const endedAt = new Date();
      const startedAt =
        sessionStartedAtRef.current ??
        new Date(endedAt.getTime() - data.settings.pomodoroWorkMinutes * 60 * 1000);

      logSession({
        questionId,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMinutes: data.settings.pomodoroWorkMinutes,
        type: sessionType,
        note: "Completed pomodoro work interval"
      });
      showToast("Pomodoro session logged");

      setPhase("break");
      return;
    }

    setPhase("work");
  }, [
    data.settings.pomodoroWorkMinutes,
    data.settings.soundEnabled,
    logSession,
    phase,
    questionId,
    showToast,
    sessionType
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
    if (!questionId) return;
    completedRef.current = false;

    if (!sessionStartedAtRef.current && phase === "work") {
      sessionStartedAtRef.current = new Date();
    }

    setIsRunning(true);
    setHasStarted(true);
  }

  function pause() {
    setIsRunning(false);
  }

  function reset() {
    setIsRunning(false);
    setSecondsLeft(duration);
    setHasStarted(false);
    completedRef.current = false;
    sessionStartedAtRef.current = null;
  }

  function switchPhase(nextPhase: TimerPhase) {
    setPhase(nextPhase);
    setIsRunning(false);
    setHasStarted(false);
    completedRef.current = false;
    sessionStartedAtRef.current = null;
  }

  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  const progress = duration ? (duration - secondsLeft) / duration : 0;
  const dashOffset = circumference * (1 - progress);
  const actionLabel = isRunning ? "Pause" : hasStarted ? "Resume" : "Start";

  return (
    <AppShell>
      {!hydrated ? (
        <LoadingState />
      ) : (
        <>
      <PageHeader title="Pomodoro" eyebrow="Study timer" />

      <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
        <section className="panel p-4 sm:p-6">
          <div className="mx-auto max-w-xl">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Question
                <select
                  className="field mt-1"
                  value={questionId}
                  onChange={(event) => {
                    setQuestionId(event.target.value);
                    reset();
                  }}
                >
                  <option value="">Select question</option>
                  {data.questions.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.number}. {question.title}
                    </option>
                  ))}
                </select>
              </label>
              {selectedQuestion ? (
                <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  {selectedSubject?.name ?? "No subject"} · {selectedQuestion.difficulty} ·{" "}
                  {selectedQuestion.status}
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid place-items-center">
              <div className="relative grid aspect-square w-full max-w-[320px] place-items-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 260 260" aria-hidden="true">
                  <circle
                    cx="130"
                    cy="130"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="16"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <circle
                    cx="130"
                    cy="130"
                    r={radius}
                    fill="none"
                    stroke={phase === "work" ? "#0f766e" : "#d97706"}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    strokeWidth="16"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
                      {phase === "work" ? "Work" : "Break"}
                    </p>
                    <p className="mt-2 text-6xl font-black tabular-nums text-slate-950 dark:text-slate-50 sm:text-7xl">
                      {minutes}:{seconds}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                className={phase === "work" ? "btn-primary" : "btn-secondary"}
                onClick={() => switchPhase("work")}
              >
                Work
              </button>
              <button
                className={phase === "break" ? "btn-primary" : "btn-secondary"}
                onClick={() => switchPhase("break")}
              >
                Break
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!questionId}
                onClick={isRunning ? pause : startOrResume}
              >
                {actionLabel}
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
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Session type
              <select
                className="field mt-1"
                value={sessionType}
                onChange={(event) => setSessionType(event.target.value as StudySessionType)}
              >
                {sessionTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {sessionTypeLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Work
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  value={data.settings.pomodoroWorkMinutes}
                  onChange={(event) =>
                    updateSettings({
                      ...data.settings,
                      pomodoroWorkMinutes: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Break
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  value={data.settings.pomodoroBreakMinutes}
                  onChange={(event) =>
                    updateSettings({
                      ...data.settings,
                      pomodoroBreakMinutes: Number(event.target.value)
                    })
                  }
                />
              </label>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              Sound notification
              <input
                type="checkbox"
                checked={data.settings.soundEnabled}
                onChange={(event) => {
                  updateSettings({ ...data.settings, soundEnabled: event.target.checked });
                  showToast("Sound setting updated", "info");
                }}
                className="h-5 w-5 accent-teal-700"
              />
            </label>
            <button
              className="btn-secondary w-full"
              onClick={() => playNotificationSound(data.settings.soundEnabled)}
            >
              Test sound
            </button>
          </div>
        </section>
      </div>
      </>
      )}
    </AppShell>
  );
}
