"use client";

import { FormEvent, useMemo, useState } from "react";
import { sessionTypeLabels } from "@/data/studyData";
import { SmoothNumberInput, parsePositiveIntegerDraft } from "@/components/ui/SmoothNumberInput";
import { useToast } from "@/components/ui/ToastProvider";
import { Question, StudySession, Subject } from "@/types/study";
import { toDateInputValue } from "@/utils/date";
import { sortQuestionsBySubjectAndNumber } from "@/utils/questionSorting";

type SessionFormProps = {
  subjects: Subject[];
  questions: Question[];
  onSubmit: (session: Omit<StudySession, "id">) => void;
};

export function SessionForm({ subjects, questions, onSubmit }: SessionFormProps) {
  const { showToast } = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [minutesInput, setMinutesInput] = useState("45");
  const [type, setType] = useState<StudySession["type"]>("active_recall");
  const [questionId, setQuestionId] = useState("");
  const [studyDate, setStudyDate] = useState(toDateInputValue(new Date()));
  const [note, setNote] = useState("");

  const subjectQuestions = useMemo(
    () => sortQuestionsBySubjectAndNumber(
      questions.filter((question) => question.subjectId === subjectId),
      subjects
    ),
    [questions, subjectId, subjects]
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const resolvedQuestionId = questionId || subjectQuestions[0]?.id;
    const minutes = parsePositiveIntegerDraft(minutesInput, 45);
    setMinutesInput(String(minutes));
    if (!resolvedQuestionId || minutes < 1) {
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

    onSubmit({
      questionId: resolvedQuestionId,
      date: studyDate,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes: minutes,
      type,
      note: note.trim()
    });
    showToast("Study session logged");
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
          Subject
          <select className="field mt-1" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Question
          <select className="field mt-1" value={questionId} onChange={(e) => setQuestionId(e.target.value)}>
            <option value="">First question in subject</option>
            {subjectQuestions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.title}
              </option>
            ))}
          </select>
        </label>
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
