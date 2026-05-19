"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SmoothNumberInput } from "@/components/ui/SmoothNumberInput";
import { useToast } from "@/components/ui/ToastProvider";
import { sessionTypeLabels } from "@/data/studyData";
import { useStudyStore } from "@/hooks/useStudyStore";
import { Question, Settings, StudySession, StudySessionType, Subject } from "@/types/study";
import { toDateInputValue } from "@/utils/date";
import { sortQuestionsBySubjectAndNumber } from "@/utils/questionSorting";
import { getSessionDate } from "@/utils/studyMetrics";

type TimerMode = "stopwatch" | "pomodoro";
type TimerPhase = "normal" | "work" | "short_break" | "long_break";
type TimerStatus = "idle" | "running" | "paused" | "completed";
type TargetMode = "single" | "multiple" | "decide" | "later";
type AllocationMode = "equal" | "manual";
type ReviewSource = "completed" | "existing";
type NotificationSound = Settings["notificationSound"];
type PendingAfterAction = "reset" | "advancePomodoroAfterWork" | "none";

type TimerSelection = {
  targetMode: TargetMode;
  subjectId: string;
  questionIds: string[];
};

type StoredTimerState = {
  mode: TimerMode | "normal";
  status: TimerStatus;
  phase: TimerPhase;
  durationSeconds: number;
  remainingSeconds: number;
  startedAtMs?: number;
  completedWorkCount: number;
  selection: TimerSelection;
};

type StoredTimerBundle = {
  activeMode: TimerMode;
  timers: Record<TimerMode, StoredTimerState>;
};

type PendingInterval = {
  sessionId?: string;
  date: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  source: ReviewSource;
  type?: StudySessionType;
  note?: string;
  questionId?: string;
  initialQuestionIds?: string[];
  selection?: TimerSelection;
  afterAction?: PendingAfterAction;
};

const storageKey = "revisio-active-timer-v2";
const radius = 112;
const circumference = 2 * Math.PI * radius;
const sessionTypeOptions: StudySessionType[] = ["reading", "active_recall", "revision", "test", "summary"];
const notificationSoundOptions: Array<{ value: NotificationSound; label: string }> = [
  { value: "bell", label: "Bell" },
  { value: "chime", label: "Soft chime" },
  { value: "beep", label: "Digital beep" },
  { value: "alarm", label: "Alarm" }
];

function getAudioContextConstructor() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextCtor;
}

function getSoundPattern(sound: NotificationSound) {
  if (sound === "bell") return [784, 988, 1175, 988];
  if (sound === "chime") return [660, 880];
  if (sound === "alarm") return [880, 660, 880, 660];
  return [880];
}

async function playNotificationSound(context: AudioContext, sound: NotificationSound, volume = 0.18) {
  if (context.state === "suspended") {
    await context.resume();
  }

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (sound === "alarm" ? 1.05 : 0.7));
  gain.connect(context.destination);

  getSoundPattern(sound).forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = sound === "beep" || sound === "alarm" ? "square" : "sine";
    const start = context.currentTime + index * (sound === "alarm" ? 0.18 : 0.14);
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + (sound === "alarm" ? 0.14 : 0.42));
  });
}

function clampPositiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function getPhaseLabel(phase: TimerPhase) {
  if (phase === "normal") return "Stopwatch";
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

function getPomodoroPhaseDurationSeconds(settings: ReturnType<typeof useStudyStore>["data"]["settings"], phase: TimerPhase) {
  if (phase === "long_break") return settings.pomodoroLongBreakMinutes * 60;
  if (phase === "short_break") return settings.pomodoroShortBreakMinutes * 60;
  return settings.pomodoroWorkMinutes * 60;
}

function getRemainingSeconds(timer: StoredTimerState, nowMs: number) {
  if (timer.status === "running" && timer.startedAtMs) {
    const elapsed = Math.floor((nowMs - timer.startedAtMs) / 1000);
    return Math.min(timer.durationSeconds, Math.max(0, timer.durationSeconds - elapsed));
  }

  return Math.min(timer.durationSeconds, Math.max(0, timer.remainingSeconds));
}

function getStopwatchElapsedSeconds(timer: StoredTimerState, nowMs: number) {
  if (timer.status === "running" && timer.startedAtMs) {
    const elapsed = Math.floor((nowMs - timer.startedAtMs) / 1000);
    return Math.max(0, timer.remainingSeconds + elapsed);
  }

  return Math.max(0, timer.remainingSeconds);
}

function getPomodoroElapsedSeconds(timer: StoredTimerState, nowMs: number) {
  if (timer.status === "running" && timer.startedAtMs) {
    const elapsed = Math.floor((nowMs - timer.startedAtMs) / 1000);
    return Math.min(timer.durationSeconds, Math.max(0, elapsed));
  }

  return Math.min(timer.durationSeconds, Math.max(0, timer.durationSeconds - timer.remainingSeconds));
}

function createDefaultSelection(subjects: Subject[]): TimerSelection {
  return {
    targetMode: "decide",
    subjectId: subjects[0]?.id ?? "",
    questionIds: []
  };
}

function createTimerState(
  mode: TimerMode,
  durationSeconds: number,
  selection: TimerSelection,
  completedWorkCount = 0,
  phase?: TimerPhase
): StoredTimerState {
  return {
    mode,
    status: "idle",
    phase: phase ?? (mode === "stopwatch" ? "normal" : "work"),
    durationSeconds,
    remainingSeconds: mode === "stopwatch" ? 0 : durationSeconds,
    completedWorkCount,
    selection
  };
}

function isStoredTimerState(value: unknown): value is StoredTimerState {
  if (!value || typeof value !== "object") return false;
  const timer = value as Partial<StoredTimerState>;
  return (
    (timer.mode === "normal" || timer.mode === "stopwatch" || timer.mode === "pomodoro") &&
    (timer.status === "idle" || timer.status === "running" || timer.status === "paused" || timer.status === "completed") &&
    typeof timer.durationSeconds === "number" &&
    typeof timer.remainingSeconds === "number" &&
    Boolean(timer.selection)
  );
}

function normalizeTimerState(value: StoredTimerState): StoredTimerState {
  return {
    ...value,
    mode: value.mode === "normal" ? "stopwatch" : value.mode,
    phase: value.mode === "normal" ? "normal" : value.phase
  };
}

function isStoredTimerBundle(value: unknown): value is StoredTimerBundle {
  if (!value || typeof value !== "object") return false;
  const bundle = value as Partial<StoredTimerBundle>;
  const timers = bundle.timers;
  return (
    (bundle.activeMode === "stopwatch" || bundle.activeMode === "pomodoro") &&
    Boolean(timers?.stopwatch) &&
    Boolean(timers?.pomodoro) &&
    isStoredTimerState(timers?.stopwatch) &&
    isStoredTimerState(timers?.pomodoro)
  );
}

export default function PomodoroPage() {
  const { data, deleteSession, hydrated, logSession, updateSession, updateSettings } = useStudyStore();
  const { showToast } = useToast();
  const restoredRef = useRef(false);
  const completionHandledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sortedQuestions = useMemo(
    () => sortQuestionsBySubjectAndNumber(data.questions, data.subjects),
    [data.questions, data.subjects]
  );
  const defaultSubjectId = data.subjects[0]?.id ?? "";
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [normalDurationInput, setNormalDurationInput] = useState("30");
  const [pendingInterval, setPendingInterval] = useState<PendingInterval | null>(null);
  const [soundStatus, setSoundStatus] = useState("");
  const [timerBundle, setTimerBundle] = useState<StoredTimerBundle>(() => ({
    activeMode: "pomodoro",
    timers: {
      stopwatch: createTimerState("stopwatch", 30 * 60, createDefaultSelection([])),
      pomodoro: createTimerState("pomodoro", 25 * 60, createDefaultSelection([]))
    }
  }));
  const timer = timerBundle.timers[timerBundle.activeMode];
  const setTimer = useCallback((updater: StoredTimerState | ((current: StoredTimerState) => StoredTimerState)) => {
    setTimerBundle((current) => {
      const currentTimer = current.timers[current.activeMode];
      const nextTimer = typeof updater === "function" ? updater(currentTimer) : updater;
      return {
        ...current,
        timers: {
          ...current.timers,
          [current.activeMode]: nextTimer
        }
      };
    });
  }, []);

  function getTimerAudioContext() {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
      throw new Error("This browser does not support Web Audio notifications.");
    }

    audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  }

  async function primeTimerAudio() {
    if (!data.settings.soundEnabled) {
      setSoundStatus("Sound notifications are disabled.");
      return false;
    }

    try {
      const context = getTimerAudioContext();
      if (context.state === "suspended") {
        await context.resume();
      }
      setSoundStatus("Sound notifications are ready.");
      return true;
    } catch (error) {
      setSoundStatus(error instanceof Error ? error.message : "Sound could not be prepared in this browser.");
      return false;
    }
  }

  async function playTimerEndSound(label = "Timer finished") {
    if (!data.settings.soundEnabled) {
      setSoundStatus("Sound notifications are disabled.");
      return;
    }

    try {
      const context = getTimerAudioContext();
      await playNotificationSound(context, data.settings.notificationSound);
      setSoundStatus(`${label} sound played.`);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(label);
      }
    } catch (error) {
      setSoundStatus(error instanceof Error ? error.message : "Sound could not be played. Try pressing Start or Test sound once.");
      showToast("Sound could not be played. Tap Test sound once to allow audio.", "warning");
    }
  }

  useEffect(() => {
    if (!hydrated || restoredRef.current) return;
    restoredRef.current = true;

    const fallbackSelection = createDefaultSelection(data.subjects);
    const fallback: StoredTimerBundle = {
      activeMode: "pomodoro",
      timers: {
        stopwatch: createTimerState("stopwatch", 30 * 60, fallbackSelection),
        pomodoro: createTimerState(
          "pomodoro",
          getPomodoroPhaseDurationSeconds(data.settings, "work"),
          fallbackSelection
        )
      }
    };

    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (isStoredTimerBundle(parsed)) {
        const stopwatch = normalizeTimerState(parsed.timers.stopwatch);
        const pomodoro = normalizeTimerState(parsed.timers.pomodoro);
        setTimerBundle({
          activeMode: parsed.activeMode,
          timers: {
            stopwatch: {
              ...stopwatch,
              selection: {
                ...fallbackSelection,
                ...stopwatch.selection,
                subjectId: stopwatch.selection.subjectId || fallbackSelection.subjectId,
                questionIds: Array.isArray(stopwatch.selection.questionIds) ? stopwatch.selection.questionIds : []
              }
            },
            pomodoro: {
              ...pomodoro,
              selection: {
                ...fallbackSelection,
                ...pomodoro.selection,
                subjectId: pomodoro.selection.subjectId || fallbackSelection.subjectId,
                questionIds: Array.isArray(pomodoro.selection.questionIds) ? pomodoro.selection.questionIds : []
              }
            }
          }
        });
        setNormalDurationInput(String(Math.max(1, Math.round(stopwatch.durationSeconds / 60))));
        return;
      }

      if (isStoredTimerState(parsed)) {
        const normalized = normalizeTimerState(parsed);
        const selection = {
          ...fallbackSelection,
          ...normalized.selection,
          subjectId: normalized.selection.subjectId || fallbackSelection.subjectId,
          questionIds: Array.isArray(normalized.selection.questionIds) ? normalized.selection.questionIds : []
        };
        const activeMode: TimerMode = normalized.mode === "pomodoro" ? "pomodoro" : "stopwatch";
        const nextBundle = {
          ...fallback,
          activeMode,
          timers: {
            ...fallback.timers,
            [activeMode]: { ...normalized, mode: activeMode, selection }
          }
        };
        setTimerBundle(nextBundle);
        setNormalDurationInput(String(Math.max(1, Math.round(nextBundle.timers.stopwatch.durationSeconds / 60))));
        return;
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }

    setTimerBundle(fallback);
    setNormalDurationInput("30");
  }, [data.settings, data.subjects, hydrated]);

  useEffect(() => {
    if (!hydrated || !restoredRef.current) return;
    window.localStorage.setItem(storageKey, JSON.stringify(timerBundle));
  }, [hydrated, timerBundle]);

  useEffect(() => {
    if (timer.status !== "running") return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timer.status]);

  const secondsLeft = getRemainingSeconds(timer, nowMs);
  const stopwatchElapsedSeconds = getStopwatchElapsedSeconds(timer, nowMs);
  const displayTotalSeconds = timer.mode === "stopwatch" ? stopwatchElapsedSeconds : secondsLeft;
  const progress =
    timer.mode === "stopwatch"
      ? timer.durationSeconds
        ? Math.min(1, stopwatchElapsedSeconds / timer.durationSeconds)
        : 0
      : timer.durationSeconds
        ? (timer.durationSeconds - secondsLeft) / timer.durationSeconds
        : 0;
  const dashOffset = circumference * (1 - progress);
  const displayMinutes = Math.floor(displayTotalSeconds / 60).toString().padStart(2, "0");
  const displaySeconds = (displayTotalSeconds % 60).toString().padStart(2, "0");
  const isBreak = timer.phase === "short_break" || timer.phase === "long_break";
  const unassignedSessions = data.sessions.filter((session) => session.needsReview || !session.questionId);
  const reviewedSessions = data.sessions
    .filter((session) => !session.needsReview && session.questionId)
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
    .slice(0, 8);

  function advancePomodoroAfterWork() {
    const nextCompletedCount = timer.completedWorkCount + 1;
    const nextPhase =
      nextCompletedCount % data.settings.pomodoroLongBreakAfter === 0 ? "long_break" : "short_break";
    const nextDuration = getPomodoroPhaseDurationSeconds(data.settings, nextPhase);
    setTimer((current) => ({
      ...current,
      status: "idle",
      phase: nextPhase,
      durationSeconds: nextDuration,
      remainingSeconds: nextDuration,
      completedWorkCount: nextCompletedCount,
      startedAtMs: undefined
    }));
  }

  function advancePomodoroToWork() {
    const nextDuration = getPomodoroPhaseDurationSeconds(data.settings, "work");
    setTimer((current) => ({
      ...current,
      status: "idle",
      phase: "work",
      durationSeconds: nextDuration,
      remainingSeconds: nextDuration,
      startedAtMs: undefined
    }));
  }

  function finishPendingInterval(action: PendingAfterAction = pendingInterval?.afterAction ?? "none") {
    setPendingInterval(null);
    completionHandledRef.current = false;

    if (action === "advancePomodoroAfterWork") {
      advancePomodoroAfterWork();
      return;
    }

    if (action === "reset") {
      resetTimer();
    }
  }

  function skipBreakInterval() {
    completionHandledRef.current = false;
    setPendingInterval(null);
    advancePomodoroToWork();
    showToast("Break skipped", "info");
  }

  function skipWorkInterval() {
    const now = Date.now();
    const elapsedSeconds = getPomodoroElapsedSeconds(timer, now);
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const endedAt = new Date(now);
    const startedAt = new Date(timer.startedAtMs ?? now - elapsedSeconds * 1000);

    completionHandledRef.current = true;
    setTimer((current) => ({
      ...current,
      status: "paused",
      remainingSeconds: getRemainingSeconds(current, now),
      startedAtMs: undefined
    }));
    setPendingInterval({
      date: toDateInputValue(startedAt),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes,
      source: "completed",
      initialQuestionIds:
        timer.selection.targetMode === "single" || timer.selection.targetMode === "multiple"
          ? timer.selection.questionIds
          : [],
      selection: timer.selection,
      afterAction: "advancePomodoroAfterWork"
    });
  }

  function skipPomodoroInterval() {
    if (timer.mode !== "pomodoro") return;

    if (timer.phase === "work") {
      skipWorkInterval();
      return;
    }

    skipBreakInterval();
  }

  const completeTimer = useCallback(() => {
    if (completionHandledRef.current || timer.status !== "running") return;
    completionHandledRef.current = true;
    void playTimerEndSound(
      timer.mode === "stopwatch"
        ? "Timer finished"
        : timer.phase === "work"
          ? "Pomodoro finished"
          : "Break finished"
    );
    window.navigator.vibrate?.(120);

    const elapsedSeconds = timer.mode === "stopwatch" ? stopwatchElapsedSeconds : timer.durationSeconds;
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const endedAtMs = timer.mode === "stopwatch"
      ? Date.now()
      : (timer.startedAtMs ?? Date.now()) + timer.durationSeconds * 1000;
    const startedAt = new Date(timer.startedAtMs ?? endedAtMs - elapsedSeconds * 1000);
    const endedAt = new Date(endedAtMs);

    if (timer.mode === "stopwatch" || timer.phase === "work") {
      setPendingInterval({
        date: toDateInputValue(startedAt),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMinutes,
        source: "completed",
        initialQuestionIds:
          timer.selection.targetMode === "single" || timer.selection.targetMode === "multiple"
            ? timer.selection.questionIds
            : [],
        selection: timer.selection,
        afterAction: timer.mode === "stopwatch" ? "reset" : "none"
      });
    }

    if (timer.mode === "stopwatch") {
      setTimer((current) => ({ ...current, status: "completed", remainingSeconds: elapsedSeconds, startedAtMs: undefined }));
      return;
    }

    if (timer.phase === "work") {
      advancePomodoroAfterWork();
      return;
    }

    advancePomodoroToWork();
  }, [data.settings, playTimerEndSound, stopwatchElapsedSeconds, timer]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== "s") return;
      if (timerBundle.activeMode !== "pomodoro") return;

      event.preventDefault();
      skipPomodoroInterval();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [timerBundle.activeMode, timer, secondsLeft]);

  useEffect(() => {
    if (timer.status === "running" && timer.mode === "pomodoro" && secondsLeft <= 0) {
      completeTimer();
    }

    if (timer.status === "running" && timer.mode === "stopwatch" && timer.durationSeconds > 0 && stopwatchElapsedSeconds >= timer.durationSeconds) {
      completeTimer();
    }
  }, [completeTimer, secondsLeft, stopwatchElapsedSeconds, timer.durationSeconds, timer.mode, timer.status]);

  function updateSelection(selection: TimerSelection) {
    setTimer((current) => ({ ...current, selection }));
  }

  function switchMode(mode: TimerMode) {
    setTimerBundle((current) => ({ ...current, activeMode: mode }));
  }

  function commitNormalDuration(value: number) {
    const minutes = clampPositiveInteger(value, 30);
    setNormalDurationInput(String(minutes));
    setTimer((current) =>
      current.mode === "stopwatch" && current.status !== "running"
        ? { ...current, durationSeconds: minutes * 60, phase: "normal" }
        : current
    );
  }

  function startOrResume() {
    void primeTimerAudio();
    const durationSeconds =
      timer.mode === "stopwatch"
        ? clampPositiveInteger(Number(normalDurationInput), Math.max(1, Math.round(timer.durationSeconds / 60))) * 60
        : timer.durationSeconds;

    completionHandledRef.current = false;
    setNowMs(Date.now());
    setTimer((current) => {
      if (current.status === "paused") {
        const elapsedSeconds =
          current.mode === "stopwatch" ? current.remainingSeconds : current.durationSeconds - current.remainingSeconds;
        return {
          ...current,
          status: "running",
          startedAtMs: Date.now() - elapsedSeconds * 1000
        };
      }

      return {
        ...current,
        status: "running",
        durationSeconds,
        remainingSeconds: current.mode === "stopwatch" ? 0 : durationSeconds,
        startedAtMs: Date.now()
      };
    });
  }

  function pauseTimer() {
    setTimer((current) => ({
      ...current,
      status: "paused",
      remainingSeconds:
        current.mode === "stopwatch"
          ? getStopwatchElapsedSeconds(current, Date.now())
          : getRemainingSeconds(current, Date.now()),
      startedAtMs: undefined
    }));
  }

  function resetTimer() {
    completionHandledRef.current = false;
    setPendingInterval(null);
    const durationSeconds =
      timer.mode === "stopwatch"
        ? clampPositiveInteger(Number(normalDurationInput), 30) * 60
        : getPomodoroPhaseDurationSeconds(data.settings, timer.phase === "normal" ? "work" : timer.phase);
    setTimer((current) => ({
      ...current,
      status: "idle",
      durationSeconds,
      remainingSeconds: current.mode === "stopwatch" ? 0 : durationSeconds,
      startedAtMs: undefined
    }));
  }

  function updatePomodoroSetting(key: "pomodoroWorkMinutes" | "pomodoroShortBreakMinutes" | "pomodoroLongBreakMinutes" | "pomodoroLongBreakAfter", value: number) {
    const nextValue = clampPositiveInteger(value, data.settings[key]);
    const nextSettings = {
      ...data.settings,
      [key]: nextValue,
      ...(key === "pomodoroShortBreakMinutes" ? { pomodoroBreakMinutes: nextValue } : {})
    };
    updateSettings(nextSettings);
    setTimer((current) => {
      if (current.mode !== "pomodoro" || current.status === "running") return current;
      const durationSeconds = getPomodoroPhaseDurationSeconds(nextSettings, current.phase);
      return { ...current, durationSeconds, remainingSeconds: durationSeconds };
    });
  }

  return (
    <AppShell>
      {!hydrated ? (
        <LoadingState />
      ) : (
        <>
          <PageHeader title="Timer" eyebrow="Study timer" />

          <div className="mb-5 grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 text-sm font-bold dark:border-slate-700 dark:bg-slate-950 sm:max-w-md">
            <button
              className={`rounded-md px-3 py-2 transition ${
                timer.mode === "stopwatch"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "text-slate-600 dark:text-slate-300"
              }`}
              onClick={() => switchMode("stopwatch")}
            >
              Stopwatch
            </button>
            <button
              className={`rounded-md px-3 py-2 transition ${
                timer.mode === "pomodoro"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "text-slate-600 dark:text-slate-300"
              }`}
              onClick={() => switchMode("pomodoro")}
            >
              Pomodoro timer
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_410px]">
            <section className="panel p-4 sm:p-6">
              <div className="mx-auto max-w-xl">
                <StudyTargetPicker
                  subjects={data.subjects}
                  questions={sortedQuestions}
                  selection={timer.selection}
                  onChange={updateSelection}
                />

                <div className="mt-5 grid place-items-center">
                  <div className="relative grid aspect-square w-full max-w-[320px] place-items-center">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 260 260" aria-hidden="true">
                      <circle cx="130" cy="130" r={radius} fill="none" stroke="currentColor" strokeWidth="16" className="text-slate-200 dark:text-slate-800" />
                      <circle cx="130" cy="130" r={radius} fill="none" stroke={isBreak ? "#d97706" : "#2563eb"} strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" strokeWidth="16" className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-center">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
                          {getPhaseLabel(timer.phase)}
                        </p>
                        <p className="mt-2 text-6xl font-black tabular-nums text-slate-950 dark:text-slate-50 sm:text-7xl">
                          {displayMinutes}:{displaySeconds}
                        </p>
                        <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                          {timer.status === "running"
                            ? "Running"
                            : timer.status === "paused"
                              ? "Paused"
                              : timer.status === "completed"
                                ? "Completed"
                                : timer.mode === "pomodoro"
                                  ? `Completed work intervals: ${timer.completedWorkCount}`
                                  : "Ready"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`mt-5 grid gap-2 ${timer.mode === "pomodoro" ? "sm:grid-cols-3" : "grid-cols-2"}`}>
                  <button className="btn-primary" onClick={timer.status === "running" ? pauseTimer : startOrResume}>
                    {timer.status === "running" ? "Pause" : timer.status === "paused" ? "Resume" : "Start"}
                  </button>
                  {timer.mode === "pomodoro" ? (
                    <button className="btn-secondary" type="button" onClick={skipPomodoroInterval}>
                      Skip interval
                    </button>
                  ) : null}
                  <button className="btn-secondary" onClick={resetTimer}>
                    Reset
                  </button>
                </div>
              </div>
            </section>

            <section className="panel p-4 sm:p-5">
              <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Timer settings</h2>
              <div className="mt-4 space-y-3">
                {timer.mode === "stopwatch" ? (
                  <SmoothNumberInput
                    label="Target alert"
                    value={normalDurationInput}
                    suffix="min"
                    fallback={Math.max(1, Math.round(timer.durationSeconds / 60))}
                    onValueChange={setNormalDurationInput}
                    onCommit={commitNormalDuration}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberSetting label="Work" value={data.settings.pomodoroWorkMinutes} onCommit={(value) => updatePomodoroSetting("pomodoroWorkMinutes", value)} />
                    <NumberSetting label="Short break" value={data.settings.pomodoroShortBreakMinutes} onCommit={(value) => updatePomodoroSetting("pomodoroShortBreakMinutes", value)} />
                    <NumberSetting label="Long break" value={data.settings.pomodoroLongBreakMinutes} onCommit={(value) => updatePomodoroSetting("pomodoroLongBreakMinutes", value)} />
                    <NumberSetting label="Long after" value={data.settings.pomodoroLongBreakAfter} onCommit={(value) => updatePomodoroSetting("pomodoroLongBreakAfter", value)} />
                  </div>
                )}
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Notification sound
                  <select
                    className="field mt-1"
                    value={data.settings.notificationSound}
                    onChange={(event) =>
                      updateSettings({
                        ...data.settings,
                        notificationSound: event.target.value as NotificationSound
                      })
                    }
                  >
                    {notificationSoundOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
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
                <button className="btn-secondary w-full" onClick={() => playTimerEndSound("Test")}>
                  Test sound
                </button>
                {soundStatus ? (
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    {soundStatus}
                  </p>
                ) : null}
              </div>
            </section>
          </div>

          <NeedsReview
            sessions={unassignedSessions}
            questions={sortedQuestions}
            onReview={(session) =>
              setPendingInterval({
                sessionId: session.id,
                date: getSessionDate(session),
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
                date: getSessionDate(session),
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
              subjects={data.subjects}
              questions={sortedQuestions}
              initialQuestionIds={
                pendingInterval.source === "existing"
                  ? pendingInterval.questionId
                    ? [pendingInterval.questionId]
                    : []
                  : pendingInterval.initialQuestionIds ?? []
              }
              onClose={() => {
                completionHandledRef.current = false;
                setPendingInterval(null);
              }}
              onSkip={() => {
                const action = pendingInterval.afterAction ?? "none";
                finishPendingInterval(action);
                showToast("Timer finished without logging", "info");
              }}
              onLogLater={(durationMinutes, type, note) => {
                const endedAt = new Date(
                  new Date(pendingInterval.startedAt).getTime() + durationMinutes * 60 * 1000
                ).toISOString();
                if (pendingInterval.source === "existing" && pendingInterval.sessionId) {
                  updateSession(pendingInterval.sessionId, {
                    date: pendingInterval.date,
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
                    date: pendingInterval.date,
                    endedAt,
                    durationMinutes,
                    type,
                    needsReview: true,
                    note: note || "Timer session to assign later"
                  });
                }
                finishPendingInterval(pendingInterval.afterAction ?? "none");
                showToast("Session saved for later", "info");
              }}
              onSave={(sessions) => {
                if (pendingInterval.source === "existing" && pendingInterval.sessionId) {
                  deleteSession(pendingInterval.sessionId);
                }
                sessions.forEach(logSession);
                finishPendingInterval(pendingInterval.afterAction ?? "none");
                showToast("Study session logged");
              }}
            />
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function NumberSetting({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <SmoothNumberInput
      label={label}
      value={draft}
      fallback={value}
      onValueChange={setDraft}
      onCommit={(nextValue) => {
        setDraft(String(nextValue));
        onCommit(nextValue);
      }}
    />
  );
}

function StudyTargetPicker({
  subjects,
  questions,
  selection,
  onChange
}: {
  subjects: Subject[];
  questions: Question[];
  selection: TimerSelection;
  onChange: (selection: TimerSelection) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const shouldShowSelectors = selection.targetMode === "single" || selection.targetMode === "multiple";
  const subjectQuestions = questions.filter((question) => question.subjectId === selection.subjectId);
  const selectedQuestions = selection.questionIds
    .map((id) => questions.find((question) => question.id === id))
    .filter((question): question is Question => Boolean(question));
  const selectedLabels = selectedQuestions.map(getQuestionLabel);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function updateTargetMode(targetMode: TargetMode) {
    onChange({
      ...selection,
      targetMode,
      questionIds: targetMode === "single" ? selection.questionIds.slice(0, 1) : selection.questionIds
    });
    if (targetMode === "decide" || targetMode === "later") {
      setOpen(false);
    }
  }

  function updateSubject(subjectId: string) {
    onChange({
      ...selection,
      subjectId,
      questionIds:
        selection.targetMode === "single"
          ? selection.questionIds.filter((questionId) =>
              questions.some((question) => question.id === questionId && question.subjectId === subjectId)
            )
          : selection.questionIds
    });
    setOpen(false);
  }

  function toggleQuestion(questionId: string) {
    if (selection.targetMode === "single") {
      onChange({ ...selection, questionIds: [questionId] });
      setOpen(false);
      return;
    }

    onChange({
      ...selection,
      questionIds: selection.questionIds.includes(questionId)
        ? selection.questionIds.filter((id) => id !== questionId)
        : [...selection.questionIds, questionId]
    });
  }

  return (
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
            className={selection.targetMode === value ? "btn-primary" : "btn-secondary"}
            type="button"
            onClick={() => updateTargetMode(value as TargetMode)}
          >
            {label}
          </button>
        ))}
      </div>

      {shouldShowSelectors ? (
        <div className="mt-3 space-y-3">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            {selection.targetMode === "multiple" ? "Subject filter" : "Subject"}
            <select className="field mt-1" value={selection.subjectId} onChange={(event) => updateSubject(event.target.value)}>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {shouldShowSelectors ? (
        <div className="relative mt-3" ref={dropdownRef}>
          <button
            className="btn-secondary flex w-full items-center justify-between gap-3 text-left"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="truncate">
              {selectedLabels.length
                ? selection.targetMode === "multiple"
                  ? `${selectedLabels.length} selected`
                  : selectedLabels[0]
                : "Select question"}
            </span>
            <span>{open ? "Close" : "Open"}</span>
          </button>
          {open ? (
            <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-soft dark:border-slate-700 dark:bg-slate-950">
              {!subjectQuestions.length ? (
                <div className="rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  No questions in this subject.
                </div>
              ) : null}
              {subjectQuestions.map((question) => {
                const checked = selection.questionIds.includes(question.id);
                return (
                  <label key={question.id} className="flex items-start gap-2 rounded-md p-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-blue-500/10">
                    <input
                      type={selection.targetMode === "single" ? "radio" : "checkbox"}
                      checked={checked}
                      onChange={() => toggleQuestion(question.id)}
                      className="mt-1 accent-blue-600"
                    />
                    <span>{getQuestionLabel(question)}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
          {selection.targetMode === "multiple" && selectedQuestions.length ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                Selected questions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedQuestions.map((question) => {
                  const subject = subjects.find((item) => item.id === question.subjectId);
                  return (
                    <button
                      key={question.id}
                      className="rounded-md bg-slate-100 px-2 py-1 text-left text-xs font-bold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                      type="button"
                      onClick={() =>
                        onChange({
                          ...selection,
                          questionIds: selection.questionIds.filter((id) => id !== question.id)
                        })
                      }
                    >
                      <span className="font-black">{subject?.abbreviation ?? subject?.name ?? "Subject"}</span>{" "}
                      {getQuestionLabel(question)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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
                  {getSessionDate(session)} · {sessionTypeLabels[session.type]}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="break-words whitespace-normal font-black text-slate-950 dark:text-slate-50">
                    {question ? getQuestionLabel(question) : "Deleted question"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {session.durationMinutes} min · {sessionTypeLabels[session.type]} · {getSessionDate(session)}
                  </p>
                  {session.note ? (
                    <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">{session.note}</p>
                  ) : null}
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-[184px]">
                  <button className="btn-primary min-w-[86px]" onClick={() => onEdit(session)}>Edit</button>
                  <button className="btn-secondary min-w-[86px]" onClick={() => onDelete(session.id)}>Delete</button>
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
  subjects,
  questions,
  onClose,
  onSkip,
  onLogLater,
  onSave
}: {
  interval: PendingInterval;
  initialQuestionIds: string[];
  subjects: Subject[];
  questions: Question[];
  onClose: () => void;
  onSkip: () => void;
  onLogLater: (durationMinutes: number, type: StudySessionType, note: string) => void;
  onSave: (sessions: Omit<StudySession, "id">[]) => void;
}) {
  const initialQuestion = questions.find((question) => initialQuestionIds.includes(question.id));
  const [durationDraft, setDurationDraft] = useState(String(interval.durationMinutes));
  const [durationMinutes, setDurationMinutes] = useState(interval.durationMinutes);
  const [subjectId, setSubjectId] = useState(initialQuestion?.subjectId ?? interval.selection?.subjectId ?? subjects[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialQuestionIds);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("equal");
  const [allocations, setAllocations] = useState<Record<string, number>>(() =>
    getEqualAllocations(initialQuestionIds, interval.durationMinutes)
  );
  const [allocationDrafts, setAllocationDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(getEqualAllocations(initialQuestionIds, interval.durationMinutes)).map(([questionId, minutes]) => [
        questionId,
        String(minutes)
      ])
    )
  );
  const [type, setType] = useState<StudySessionType>(interval.type ?? "active_recall");
  const [note, setNote] = useState(interval.note ?? "");
  const [error, setError] = useState("");
  const subjectQuestions = questions.filter((question) => question.subjectId === subjectId);

  useEffect(() => {
    if (allocationMode === "equal") {
      const nextAllocations = getEqualAllocations(selectedIds, durationMinutes);
      setAllocations(nextAllocations);
      setAllocationDrafts(
        Object.fromEntries(
          Object.entries(nextAllocations).map(([questionId, minutes]) => [questionId, String(minutes)])
        )
      );
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
      onLogLater(durationMinutes, type, note.trim());
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
        date: interval.date,
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
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Confirm study session</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Actual duration: {durationMinutes} min
            </p>
          </div>
          <button className="btn-secondary px-3" type="button" onClick={onClose}>Close</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SmoothNumberInput
            label="Duration"
            value={durationDraft}
            suffix="min"
            fallback={durationMinutes}
            onValueChange={setDurationDraft}
            onCommit={(value) => {
              const next = clampPositiveInteger(value, interval.durationMinutes);
              setDurationDraft(String(next));
              setDurationMinutes(next);
            }}
          />
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Study type
            <select className="field mt-1" value={type} onChange={(event) => setType(event.target.value as StudySessionType)}>
              {sessionTypeOptions.map((option) => (
                <option key={option} value={option}>{sessionTypeLabels[option]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Subject
            <select
              className="field mt-1"
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setSelectedIds([]);
              }}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Split mode
            <select className="field mt-1" value={allocationMode} onChange={(event) => setAllocationMode(event.target.value as AllocationMode)}>
              <option value="equal">Equal split</option>
              <option value="manual">Manual allocation</option>
            </select>
          </label>
        </div>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
          {subjectQuestions.map((question) => (
            <div key={question.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
              <label className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={selectedIds.includes(question.id)} onChange={() => toggleQuestion(question.id)} className="mt-1 accent-blue-600" />
                <span>{getQuestionLabel(question)}</span>
              </label>
              {selectedIds.includes(question.id) ? (
                <SmoothNumberInput
                  label="Minutes"
                  value={allocationDrafts[question.id] ?? String(allocations[question.id] ?? 0)}
                  disabled={allocationMode === "equal"}
                  min={0}
                  onValueChange={(value) =>
                    setAllocationDrafts((current) => ({ ...current, [question.id]: value }))
                  }
                  onCommit={(value) => {
                    const nextValue = Math.max(0, value);
                    setAllocationDrafts((current) => ({ ...current, [question.id]: String(nextValue) }));
                    setAllocations((current) => ({ ...current, [question.id]: nextValue }));
                  }}
                />
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
          <button className="btn-secondary" type="button" onClick={onSkip}>Skip logging</button>
          <button className="btn-secondary" type="button" onClick={() => onLogLater(durationMinutes, type, note.trim())}>Log later</button>
          <button className="btn-primary" type="submit">Save session</button>
        </div>
      </form>
    </div>
  );
}
