"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionForm } from "@/components/study/SessionForm";
import { SubjectPill } from "@/components/study/SubjectPill";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import { PageHeader } from "@/components/ui/PageHeader";
import { SmoothNumberInput, parsePositiveIntegerDraft } from "@/components/ui/SmoothNumberInput";
import { useToast } from "@/components/ui/ToastProvider";
import { sessionTypeLabels } from "@/data/studyData";
import { useStudyStore } from "@/hooks/useStudyStore";
import { StudySession, StudySessionType } from "@/types/study";
import { toDateInputValue } from "@/utils/date";
import { sortQuestionsBySubjectAndNumber } from "@/utils/questionSorting";
import { getSessionDate } from "@/utils/studyMetrics";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const sessionTypeOptions: StudySessionType[] = ["reading", "active_recall", "revision", "test", "summary"];

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
    return "border-blue-800 bg-blue-700 text-white";
  }
  if (minutes >= 60) {
    return "border-blue-600 bg-blue-500 text-white";
  }
  if (minutes >= 30) {
    return "border-blue-300 bg-blue-100 text-blue-950";
  }
  if (minutes > 0) {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function getSessionsForDate(sessions: StudySession[], date: string) {
  return sessions.filter((session) => getSessionDate(session) === date);
}

export default function CalendarPage() {
  const { data, deleteSession, hydrated, logSession, updateSession } = useStudyStore();
  const { showToast } = useToast();
  const today = toDateInputValue(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [showLogSession, setShowLogSession] = useState(false);
  const [shouldSpanLogSession, setShouldSpanLogSession] = useState(true);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState("");
  const [deleteSessionId, setDeleteSessionId] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editQuestionId, setEditQuestionId] = useState("");
  const [editDate, setEditDate] = useState(today);
  const [editDurationInput, setEditDurationInput] = useState("25");
  const [editType, setEditType] = useState<StudySessionType>("active_recall");
  const [editNote, setEditNote] = useState("");
  const calendarRef = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const monthKey = getMonthKey(visibleMonth);
  const selectedSessions = getSessionsForDate(data.sessions, selectedDate);
  const selectedMinutes = selectedSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const sortedQuestions = useMemo(
    () => sortQuestionsBySubjectAndNumber(data.questions, data.subjects),
    [data.questions, data.subjects]
  );
  const editingSession = data.sessions.find((session) => session.id === editingSessionId);
  const sessionToDelete = data.sessions.find((session) => session.id === deleteSessionId);
  const editSubjectQuestions = sortedQuestions.filter((question) => question.subjectId === editSubjectId);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateLayout = () => setIsDesktopLayout(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    const calendarElement = calendarRef.current;
    const sidebarElement = sidebarRef.current;

    if (!calendarElement || !sidebarElement) {
      return;
    }

    const measuredCalendarElement = calendarElement;
    const measuredSidebarElement = sidebarElement;

    function updatePlacement() {
      const calendarHeight = measuredCalendarElement.getBoundingClientRect().height;
      const sidebarHeight = measuredSidebarElement.getBoundingClientRect().height;
      setShouldSpanLogSession(sidebarHeight <= calendarHeight + 1);
    }

    updatePlacement();

    const observer = new ResizeObserver(updatePlacement);
    observer.observe(measuredCalendarElement);
    observer.observe(measuredSidebarElement);
    window.addEventListener("resize", updatePlacement);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePlacement);
    };
  }, [selectedSessions.length, showLogSession]);

  function moveMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function startEditSession(session: StudySession) {
    const question = data.questions.find((item) => item.id === session.questionId);
    setEditingSessionId(session.id);
    setEditSubjectId(question?.subjectId ?? data.subjects[0]?.id ?? "");
    setEditQuestionId(question?.id ?? "");
    setEditDate(getSessionDate(session));
    setEditDurationInput(String(session.durationMinutes));
    setEditType(session.type);
    setEditNote(session.note ?? "");
  }

  function handleEditSubjectChange(subjectId: string) {
    const nextQuestionId = sortedQuestions.find((question) => question.subjectId === subjectId)?.id ?? "";
    setEditSubjectId(subjectId);
    setEditQuestionId(nextQuestionId);
  }

  function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    const editDuration = parsePositiveIntegerDraft(editDurationInput, editingSession?.durationMinutes ?? 25);
    setEditDurationInput(String(editDuration));
    if (!editingSession || editDuration < 1 || !editDate) {
      return;
    }

    const originalStart = new Date(editingSession.startedAt);
    const hours = Number.isNaN(originalStart.getHours()) ? 12 : originalStart.getHours();
    const minutes = Number.isNaN(originalStart.getMinutes()) ? 0 : originalStart.getMinutes();
    const startedAt = new Date(`${editDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
    const endedAt = new Date(startedAt.getTime() + editDuration * 60 * 1000);

    updateSession(editingSession.id, {
      questionId: editQuestionId || undefined,
      date: editDate,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes: editDuration,
      type: editType,
      note: editNote.trim(),
      needsReview: !editQuestionId
    });
    setEditingSessionId("");
    showToast("Session updated");
  }

  function handleDeleteConfirm() {
    if (!sessionToDelete) {
      return;
    }

    deleteSession(sessionToDelete.id);
    setDeleteSessionId("");
    showToast("Session deleted", "warning");
  }

  function renderLogSessionForm() {
    return (
      <div id="calendar-log-session">
        <SessionForm subjects={data.subjects} questions={data.questions} onSubmit={logSession} />
      </div>
    );
  }

  return (
    <AppShell>
      {!hydrated ? (
        <LoadingState />
      ) : (
        <>
      <PageHeader title="Calendar" eyebrow="Study rhythm">
        <button
          className="btn-secondary"
          onClick={() => {
            setShowLogSession((value) => {
              const nextValue = !value;
              if (nextValue) {
                window.setTimeout(() => {
                  document.getElementById("calendar-log-session")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }, 0);
              }
              return nextValue;
            });
          }}
        >
          Log session
        </button>
      </PageHeader>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <section ref={calendarRef} className="panel overflow-hidden">
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
                    } ${isSelected ? "ring-2 ring-inset ring-blue-700 dark:ring-blue-300" : ""}`}
                    onClick={() => setSelectedDate(dateKey)}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black sm:text-sm">{date.getDate()}</span>
                      {isToday ? (
                        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white dark:bg-blue-500">
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

          {showLogSession && isDesktopLayout && !shouldSpanLogSession ? renderLogSessionForm() : null}
        </div>

        <aside ref={sidebarRef} className="panel self-start p-4 sm:p-5">
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
            <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-100">{selectedSessions.length} sessions</span>
          </div>

          <div className="mt-4 space-y-3">
            {selectedSessions.map((session) => {
              const question = data.questions.find((item) => item.id === session.questionId);
              const subject = data.subjects.find((item) => item.id === question?.subjectId);

              return (
                <article key={session.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <SubjectPill subject={subject} />
                  <h3 className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
                    {question
                      ? `${question.number}. ${question.title}`
                      : session.needsReview || !session.questionId
                        ? "Unassigned session"
                        : "Deleted question"}
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
                  {session.note ? (
                    <p className="mt-3 rounded-md bg-white p-2 text-sm font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                      {session.note}
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="btn-primary" type="button" onClick={() => startEditSession(session)}>
                      Edit
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => setDeleteSessionId(session.id)}>
                      Delete
                    </button>
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

        {showLogSession && (!isDesktopLayout || shouldSpanLogSession) ? (
          <div className={isDesktopLayout && shouldSpanLogSession ? "lg:col-span-2" : ""}>
            {renderLogSessionForm()}
          </div>
        ) : null}
      </div>
      {editingSession ? (
        <ModalOverlay onClose={() => setEditingSessionId("")}>
          <form onSubmit={handleEditSubmit} className="animate-enter max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Edit study session</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Change the linked question, date, duration, type, or note.
                </p>
              </div>
              <button className="btn-secondary px-3" type="button" onClick={() => setEditingSessionId("")}>
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Subject
                <select className="field mt-1" value={editSubjectId} onChange={(event) => handleEditSubjectChange(event.target.value)}>
                  {data.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Question
                <select className="field mt-1" value={editQuestionId} onChange={(event) => setEditQuestionId(event.target.value)}>
                  <option value="">Unassigned session</option>
                  {editSubjectQuestions.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.number}. {question.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Date
                <input className="field mt-1" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
              </label>
              <SmoothNumberInput
                label="Duration"
                value={editDurationInput}
                fallback={editingSession?.durationMinutes ?? 25}
                inputClassName="field mt-1"
                onValueChange={setEditDurationInput}
                onCommit={(value) => setEditDurationInput(String(value))}
              />
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
                Study type
                <select className="field mt-1" value={editType} onChange={(event) => setEditType(event.target.value as StudySessionType)}>
                  {sessionTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {sessionTypeLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Note
              <textarea
                className="field mt-1 min-h-24 resize-none"
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
                placeholder="Optional session note"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="btn-secondary" type="button" onClick={() => setEditingSessionId("")}>
                Cancel
              </button>
              <button className="btn-primary" type="submit">
                Save changes
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}
      <ConfirmDialog
        open={Boolean(sessionToDelete)}
        title="Delete study session?"
        message="This will remove the logged session from your cloud data. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteSessionId("")}
        onConfirm={handleDeleteConfirm}
      />
      </>
      )}
    </AppShell>
  );
}
