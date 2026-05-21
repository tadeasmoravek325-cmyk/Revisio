"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { sessionTypeLabels } from "@/data/studyData";
import { SmoothNumberInput, parsePositiveIntegerDraft } from "@/components/ui/SmoothNumberInput";
import { useToast } from "@/components/ui/ToastProvider";
import { Question, StudySession, Subject } from "@/types/study";
import { toDateInputValue } from "@/utils/date";
import { sortQuestionsBySubjectAndNumber } from "@/utils/questionSorting";
import { SubjectPill } from "./SubjectPill";

type SessionFormProps = {
  subjects: Subject[];
  questions: Question[];
  onSubmit: (session: Omit<StudySession, "id">) => void;
  onSubmitMany?: (sessions: Omit<StudySession, "id">[]) => void;
};

type QuestionSelectionMode = "single" | "multiple";

function getQuestionLabel(question: Question, subjects: Subject[]) {
  const subject = subjects.find((item) => item.id === question.subjectId);
  return `${subject?.abbreviation ?? subject?.name ?? "Subject"} ${question.number}: ${question.title}`;
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

export function SessionForm({ subjects, questions, onSubmit, onSubmitMany }: SessionFormProps) {
  const { showToast } = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [minutesInput, setMinutesInput] = useState("45");
  const [type, setType] = useState<StudySession["type"]>("active_recall");
  const [selectionMode, setSelectionMode] = useState<QuestionSelectionMode>("single");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [studyDate, setStudyDate] = useState(toDateInputValue(new Date()));
  const [note, setNote] = useState("");

  const subjectQuestions = useMemo(
    () => sortQuestionsBySubjectAndNumber(
      questions.filter((question) => question.subjectId === subjectId),
      subjects
    ),
    [questions, subjectId, subjects]
  );
  const selectedQuestions = useMemo(
    () =>
      selectedQuestionIds
        .map((questionId) => questions.find((question) => question.id === questionId))
        .filter((question): question is Question => Boolean(question)),
    [questions, selectedQuestionIds]
  );
  const selectedQuestionsBySubject = useMemo(
    () =>
      subjects
        .map((subject) => ({
          subject,
          questions: selectedQuestions.filter((question) => question.subjectId === subject.id)
        }))
        .filter((group) => group.questions.length > 0),
    [selectedQuestions, subjects]
  );

  useEffect(() => {
    setSelectedQuestionIds((current) =>
      current.filter((questionId) => questions.some((question) => question.id === questionId))
    );
  }, [questions]);

  function toggleQuestion(questionId: string) {
    setSelectedQuestionIds((current) => {
      if (selectionMode === "single") {
        return current.includes(questionId) ? [] : [questionId];
      }

      return current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId];
    });
  }

  function updateSelectionMode(mode: QuestionSelectionMode) {
    setSelectionMode(mode);
    setSelectedQuestionIds((current) => (mode === "single" ? current.slice(0, 1) : current));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const resolvedQuestionIds = selectedQuestionIds.length
      ? selectedQuestionIds
      : subjectQuestions[0]?.id
        ? [subjectQuestions[0].id]
        : [];
    const minutes = parsePositiveIntegerDraft(minutesInput, 45);
    setMinutesInput(String(minutes));
    if (!resolvedQuestionIds.length || minutes < 1) {
      return;
    }

    const now = new Date();
    const endedAt = new Date(
      `${studyDate}T${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:00`
    );
    const startedAt = new Date(endedAt.getTime() - minutes * 60 * 1000);
    const allocations = getEqualAllocations(resolvedQuestionIds, minutes);

    const sessions = resolvedQuestionIds.map((questionId) => ({
        questionId,
        date: studyDate,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMinutes: allocations[questionId] || minutes,
        type,
        note: note.trim()
      }));

    if (onSubmitMany) {
      onSubmitMany(sessions);
    } else {
      sessions.forEach(onSubmit);
    }
    showToast(resolvedQuestionIds.length > 1 ? "Study sessions logged" : "Study session logged");
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-4 sm:p-5">
      <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Log study time</h2>
      {!questions.length ? (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
          Create a question first, then study sessions can be logged against it.
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Subject filter
          <select className="field mt-1" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <section className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className={selectionMode === "single" ? "btn-primary" : "btn-secondary"}
              type="button"
              onClick={() => updateSelectionMode("single")}
            >
              One question
            </button>
            <button
              className={selectionMode === "multiple" ? "btn-primary" : "btn-secondary"}
              type="button"
              onClick={() => updateSelectionMode("multiple")}
            >
              Multiple questions
            </button>
          </div>

          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {!subjectQuestions.length ? (
              <p className="rounded-md bg-white p-3 text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                No questions in this subject.
              </p>
            ) : null}
            {subjectQuestions.map((question) => {
              const checked = selectedQuestionIds.includes(question.id);
              return (
                <label
                  key={question.id}
                  className="flex items-start gap-2 rounded-md bg-white p-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-100 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-blue-500/10"
                >
                  <input
                    type={selectionMode === "single" ? "radio" : "checkbox"}
                    checked={checked}
                    onChange={() => toggleQuestion(question.id)}
                    className="mt-1 accent-blue-600"
                  />
                  <span>{getQuestionLabel(question, subjects)}</span>
                </label>
              );
            })}
          </div>

          {selectedQuestionsBySubject.length ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                Selected questions
              </p>
              <div className="mt-3 space-y-3">
                {selectedQuestionsBySubject.map(({ subject, questions: groupQuestions }) => (
                  <div key={subject.id}>
                    <SubjectPill subject={subject} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {groupQuestions.map((question) => (
                        <button
                          key={question.id}
                          className="rounded-md bg-slate-100 px-2 py-1 text-left text-xs font-bold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                          type="button"
                          onClick={() =>
                            setSelectedQuestionIds((current) => current.filter((id) => id !== question.id))
                          }
                        >
                          {question.number}. {question.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Date
            <input
              className="field mt-1 block h-10"
              type="date"
              value={studyDate}
              onChange={(e) => setStudyDate(e.target.value)}
            />
          </label>
          <SmoothNumberInput
            label="Minutes"
            value={minutesInput}
            fallback={45}
            inputClassName="field block h-10"
            onValueChange={setMinutesInput}
            onCommit={(value) => setMinutesInput(String(value))}
          />
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Mode
            <select className="field mt-1 block h-10" value={type} onChange={(e) => setType(e.target.value as StudySession["type"])}>
              {Object.entries(sessionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <label className="mt-3 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        Note
        <input
          className="field mt-1"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Short session note"
        />
      </label>
      <button className="btn-primary mt-4 w-full sm:w-auto" type="submit">
        Add session
      </button>
    </form>
  );
}
