"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SubjectPill } from "@/components/study/SubjectPill";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { sessionTypeLabels } from "@/data/studyData";
import { useStudyStore } from "@/hooks/useStudyStore";
import { StudySession } from "@/types/study";
import { toDateInputValue } from "@/utils/date";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthTitle(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function getCalendarDays(monthDate: Date) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const firstGridDate = new Date(firstOfMonth);
  firstGridDate.setDate(firstOfMonth.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate);
    date.setDate(firstGridDate.getDate() + index);
    return date;
  });
}

function getIntensityClass(minutes: number) {
  if (minutes >= 90) {
    return "border-teal-800 bg-teal-700 text-white";
  }
  if (minutes >= 60) {
    return "border-teal-600 bg-teal-500 text-white";
  }
  if (minutes >= 30) {
    return "border-teal-300 bg-teal-100 text-teal-950";
  }
  if (minutes > 0) {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function getSessionsForDate(sessions: StudySession[], date: string) {
  return sessions.filter((session) => session.startedAt.slice(0, 10) === date);
}

export default function CalendarPage() {
  const { data, hydrated } = useStudyStore();
  const today = toDateInputValue(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(today);

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const monthKey = getMonthKey(visibleMonth);
  const selectedSessions = getSessionsForDate(data.sessions, selectedDate);
  const selectedMinutes = selectedSessions.reduce((sum, session) => sum + session.durationMinutes, 0);

  function moveMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <AppShell>
      {!hydrated ? (
        <LoadingState />
      ) : (
        <>
      <PageHeader title="Calendar" eyebrow="Study rhythm" />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:text-slate-50">{getMonthTitle(visibleMonth)}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tap a day to inspect study sessions.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button className="btn-secondary" onClick={() => moveMonth(-1)}>
                Previous
              </button>
              <button className="btn-secondary" onClick={() => moveMonth(1)}>
                Next
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            {weekdayLabels.map((day) => (
              <div key={day} className="px-1 py-2 text-center text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 sm:text-xs">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800">
            {calendarDays.map((date) => {
              const dateKey = toDateInputValue(date);
              const daySessions = getSessionsForDate(data.sessions, dateKey);
              const minutes = daySessions.reduce((sum, session) => sum + session.durationMinutes, 0);
              const isCurrentMonth = getMonthKey(date) === monthKey;
              const isSelected = selectedDate === dateKey;
              const isToday = today === dateKey;

              return (
                <button
                  key={dateKey}
                  className={`min-h-[72px] p-1 text-left transition sm:min-h-[104px] sm:p-2 ${getIntensityClass(minutes)} ${
                    isCurrentMonth ? "" : "opacity-45"
                  } ${isSelected ? "ring-2 ring-inset ring-slate-950 dark:ring-teal-300" : ""}`}
                  onClick={() => setSelectedDate(dateKey)}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black sm:text-sm">{date.getDate()}</span>
                    {isToday ? (
                      <span className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-black text-white">
                        Today
                      </span>
                    ) : null}
                  </span>
                  {minutes > 0 ? (
                    <span className="mt-2 block text-xs font-black sm:text-sm">{minutes} min</span>
                  ) : null}
                  {daySessions.length ? (
                    <span className="mt-1 block text-[11px] font-bold opacity-80">
                      {daySessions.length} session{daySessions.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric"
                })}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{selectedMinutes} min studied</p>
            </div>
            <span className="badge bg-teal-100 text-teal-800">{selectedSessions.length} sessions</span>
          </div>

          <div className="mt-4 space-y-3">
            {selectedSessions.map((session) => {
              const question = data.questions.find((item) => item.id === session.questionId);
              const subject = data.subjects.find((item) => item.id === question?.subjectId);

              return (
                <article key={session.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <SubjectPill subject={subject} />
                  <h3 className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
                    {question ? `${question.number}. ${question.title}` : "Deleted question"}
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-white p-2 dark:bg-slate-950">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Duration</p>
                      <p className="font-black text-slate-900 dark:text-slate-100">{session.durationMinutes} min</p>
                    </div>
                    <div className="rounded-md bg-white p-2 dark:bg-slate-950">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Type</p>
                      <p className="font-black text-slate-900 dark:text-slate-100">{sessionTypeLabels[session.type]}</p>
                    </div>
                  </div>
                </article>
              );
            })}

            {!selectedSessions.length ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                No study sessions logged for this day.
              </div>
            ) : null}
          </div>
        </aside>
      </div>
      </>
      )}
    </AppShell>
  );
}
