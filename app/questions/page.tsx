"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ExamTopicsImportDialog } from "@/components/import/ExamTopicsImportDialog";
import { QuestionCard } from "@/components/study/QuestionCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SmoothNumberInput, parsePositiveIntegerDraft } from "@/components/ui/SmoothNumberInput";
import { useToast } from "@/components/ui/ToastProvider";
import { difficultyLabels, importanceLabels, statusLabels } from "@/data/studyData";
import { useStudyStore } from "@/hooks/useStudyStore";
import { Difficulty, Importance, QuestionStatus, Subject } from "@/types/study";
import {
  compareQuestionsBySubjectAndNumber,
  parseQuestionNumber
} from "@/utils/questionSorting";
import { isSubjectAbbreviationDuplicate } from "@/utils/subjects";

const statusOptions: QuestionStatus[] = ["unknown", "partial", "known"];
const difficultyOptions: Difficulty[] = ["easy", "medium", "hard"];
const importanceOptions: Importance[] = ["low", "medium", "high"];
const difficultyRank: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3
};

type SortKey = "subjectNumber" | "daysSinceLastSeen" | "reviewCount" | "totalTime" | "difficulty";

const sortLabels: Record<SortKey, string> = {
  subjectNumber: "Subject and number",
  daysSinceLastSeen: "Days since last seen",
  reviewCount: "Review count",
  totalTime: "Total time",
  difficulty: "Difficulty"
};

type SubjectDraft = Pick<Subject, "name" | "abbreviation" | "color">;

function validateSubjectDraft(
  subjects: Subject[],
  draft: SubjectDraft,
  subjectIdToIgnore?: string
) {
  const name = draft.name.trim();
  const abbreviation = draft.abbreviation.trim();

  if (!name) {
    return "Subject name is required.";
  }

  if (!abbreviation) {
    return "Abbreviation is required.";
  }

  if (isSubjectAbbreviationDuplicate(subjects, abbreviation, subjectIdToIgnore)) {
    return "This abbreviation is already used by another subject.";
  }

  return "";
}

export default function QuestionsPage() {
  const { showToast } = useToast();
  const {
    data,
    addQuestion,
    addSubject,
    deleteQuestion,
    deleteSubject,
    getDaysSinceLastSeen,
    getLastSeen,
    getReviewCount,
    getTotalTimeForQuestion,
    hydrated,
    logSession,
    updateQuestion,
    updateSubject
  } = useStudyStore();

  const [subjectId, setSubjectId] = useState("all");
  const [status, setStatus] = useState<QuestionStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("subjectNumber");
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showManageSubjects, setShowManageSubjects] = useState(false);
  const manageSubjectsRef = useRef<HTMLDivElement | null>(null);

  const [subjectName, setSubjectName] = useState("");
  const [subjectAbbreviation, setSubjectAbbreviation] = useState("");
  const [subjectColor, setSubjectColor] = useState("#2563eb");
  const [addSubjectError, setAddSubjectError] = useState("");
  const [editSubjectError, setEditSubjectError] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [subjectToDeleteId, setSubjectToDeleteId] = useState("");
  const [subjectDraft, setSubjectDraft] = useState<SubjectDraft>({
    name: "",
    abbreviation: "",
    color: "#2563eb"
  });

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [questionNumberInput, setQuestionNumberInput] = useState("1");
  const [tags, setTags] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [importance, setImportance] = useState<Importance>("medium");
  const [newSubjectId, setNewSubjectId] = useState(data.subjects[0]?.id ?? "");

  const selectedSubjectId = newSubjectId || data.subjects[0]?.id || "";
  const subjectToDelete = data.subjects.find((subject) => subject.id === subjectToDeleteId);
  const subjectToDeleteQuestionCount = data.questions.filter((question) => question.subjectId === subjectToDeleteId).length;

  const nextQuestionNumber = useMemo(() => {
    const numbers = data.questions
      .filter((question) => question.subjectId === selectedSubjectId)
      .map((question) => parseQuestionNumber(question.number))
      .filter((number): number is number => number !== undefined);
    return numbers.length ? Math.max(...numbers) + 1 : 1;
  }, [data.questions, selectedSubjectId]);

  useEffect(() => {
    setQuestionNumberInput(String(nextQuestionNumber));
  }, [nextQuestionNumber]);

  useEffect(() => {
    if (!data.subjects.some((subject) => subject.id === newSubjectId)) {
      setNewSubjectId(data.subjects[0]?.id ?? "");
    }
  }, [data.subjects, newSubjectId]);

  useEffect(() => {
    if (!showManageSubjects) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!manageSubjectsRef.current?.contains(event.target as Node)) {
        setShowManageSubjects(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showManageSubjects]);

  const filteredQuestions = useMemo(() => {
    const questionOrder = compareQuestionsBySubjectAndNumber(data.subjects);

    return data.questions
      .filter(
        (question) =>
          (subjectId === "all" || question.subjectId === subjectId) &&
          (status === "all" || question.status === status)
      )
      .sort((a, b) => {
        if (sortBy === "subjectNumber") {
          return questionOrder(a, b);
        }

        if (sortBy === "daysSinceLastSeen") {
          const aDays = getDaysSinceLastSeen(a.id) ?? Number.MAX_SAFE_INTEGER;
          const bDays = getDaysSinceLastSeen(b.id) ?? Number.MAX_SAFE_INTEGER;
          return bDays - aDays || questionOrder(a, b);
        }

        if (sortBy === "reviewCount") {
          return getReviewCount(b.id) - getReviewCount(a.id) || questionOrder(a, b);
        }

        if (sortBy === "totalTime") {
          return getTotalTimeForQuestion(b.id) - getTotalTimeForQuestion(a.id) || questionOrder(a, b);
        }

        return difficultyRank[b.difficulty] - difficultyRank[a.difficulty] || questionOrder(a, b);
      });
  }, [
    data.questions,
    data.subjects,
    getDaysSinceLastSeen,
    getReviewCount,
    getTotalTimeForQuestion,
    sortBy,
    status,
    subjectId
  ]);

  function handleAddSubject(event: FormEvent) {
    event.preventDefault();
    const draft = {
      name: subjectName,
      abbreviation: subjectAbbreviation,
      color: subjectColor
    };
    const error = validateSubjectDraft(data.subjects, draft);

    if (error) {
      setAddSubjectError(error);
      return;
    }

    addSubject({
      name: draft.name.trim(),
      abbreviation: draft.abbreviation.trim(),
      color: draft.color
    });
    showToast("Subject added");
    setAddSubjectError("");
    setSubjectName("");
    setSubjectAbbreviation("");
    setSubjectColor("#2563eb");
  }

  function startSubjectEdit(subject: Subject) {
    setEditingSubjectId(subject.id);
    setSubjectDraft({
      name: subject.name,
      abbreviation: subject.abbreviation,
      color: subject.color
    });
    setAddSubjectError("");
    setEditSubjectError("");
  }

  function handleSubjectEditSubmit(event: FormEvent) {
    event.preventDefault();
    const error = validateSubjectDraft(data.subjects, subjectDraft, editingSubjectId);

    if (error) {
      setEditSubjectError(error);
      return;
    }

    updateSubject(editingSubjectId, {
      name: subjectDraft.name.trim(),
      abbreviation: subjectDraft.abbreviation.trim(),
      color: subjectDraft.color
    });
    setEditingSubjectId("");
    setEditSubjectError("");
    showToast("Subject updated");
  }

  function handleDeleteSubjectConfirm() {
    if (!subjectToDelete) {
      return;
    }

    deleteSubject(subjectToDelete.id);
    if (editingSubjectId === subjectToDelete.id) {
      setEditingSubjectId("");
      setEditSubjectError("");
    }
    setSubjectToDeleteId("");
    showToast("Subject deleted", "warning");
  }

  function handleAddQuestion(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !selectedSubjectId) {
      return;
    }

    const questionNumber = parsePositiveIntegerDraft(questionNumberInput, nextQuestionNumber);
    setQuestionNumberInput(String(questionNumber));

    addQuestion({
      subjectId: selectedSubjectId,
      number: questionNumber,
      title: title.trim(),
      notes: notes.trim(),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      difficulty,
      importance,
      status: "unknown"
    });
    showToast("Question added");
    setTitle("");
    setNotes("");
    setTags("");
    setDifficulty("medium");
    setImportance("medium");
    setQuestionNumberInput(String(nextQuestionNumber + 1));
  }

  return (
    <AppShell>
      {!hydrated ? (
        <LoadingState />
      ) : (
        <>
      <PageHeader title="Questions" eyebrow="Study bank" />

      <div className="space-y-5">
        <div ref={manageSubjectsRef} className="relative">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="btn-secondary inline-flex items-center justify-center"
              type="button"
              onClick={() => {
                setShowAddSubject((value) => !value);
                setShowAddQuestion(false);
                setShowManageSubjects(false);
              }}
              aria-expanded={showAddSubject}
            >
              + Add subject
            </button>
            <button
              className="btn-secondary inline-flex items-center justify-center"
              type="button"
              onClick={() => {
                setShowManageSubjects((value) => !value);
                setShowAddSubject(false);
                setShowAddQuestion(false);
              }}
              aria-expanded={showManageSubjects}
            >
              Manage subjects {showManageSubjects ? "▲" : "▼"}
            </button>
            <button
              className="btn-secondary inline-flex items-center justify-center"
              type="button"
              onClick={() => {
                setShowAddQuestion((value) => !value);
                setShowAddSubject(false);
                setShowManageSubjects(false);
              }}
              aria-expanded={showAddQuestion}
            >
              + Add question
            </button>
          </div>
          <ExamTopicsImportDialog
            triggerLabel="Import topics"
            triggerIcon={
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M20 16.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5" />
              </svg>
            }
            className="btn-primary inline-flex items-center justify-center gap-2 sm:ml-auto"
          />
        </div>
        {showManageSubjects ? (
          <section className="animate-enter mt-3 max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-soft transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
            <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-black text-slate-950 dark:text-slate-50">Manage subjects</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Edit names, abbreviations, colors, or delete subjects.</p>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{data.subjects.length} subjects</p>
            </div>

            <div className="mt-3 max-h-[52vh] overflow-auto pr-1">
              <div className="min-w-[760px] space-y-2">
                <div className="grid grid-cols-[120px_minmax(0,1fr)_120px_180px] gap-3 px-3 text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  <span>Abbr.</span>
                  <span>Name</span>
                  <span>Questions</span>
                  <span className="text-right">Actions</span>
                </div>

                {data.subjects.map((subject) => {
                  const questionCount = data.questions.filter((question) => question.subjectId === subject.id).length;

                  return (
                    <div key={subject.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                      {editingSubjectId === subject.id ? (
                        <form onSubmit={handleSubjectEditSubmit} className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_170px_180px] lg:items-end">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Abbreviation
                            <input
                              className="field mt-1"
                              value={subjectDraft.abbreviation}
                              onChange={(event) => {
                                setSubjectDraft((current) => ({
                                  ...current,
                                  abbreviation: event.target.value
                                }));
                                setEditSubjectError("");
                              }}
                            />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Subject name
                            <input
                              className="field mt-1"
                              value={subjectDraft.name}
                              onChange={(event) =>
                                setSubjectDraft((current) => ({ ...current, name: event.target.value }))
                              }
                            />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Color
                            <div className="mt-1 flex gap-2">
                              <input
                                aria-label="Subject color"
                                className="h-10 w-12 rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                                type="color"
                                value={subjectDraft.color}
                                onChange={(event) =>
                                  setSubjectDraft((current) => ({
                                    ...current,
                                    color: event.target.value
                                  }))
                                }
                              />
                              <input
                                className="field"
                                value={subjectDraft.color}
                                onChange={(event) =>
                                  setSubjectDraft((current) => ({
                                    ...current,
                                    color: event.target.value
                                  }))
                                }
                              />
                            </div>
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button className="btn-secondary" type="button" onClick={() => setEditingSubjectId("")}>
                              Cancel
                            </button>
                            <button className="btn-primary" type="submit">
                              Save
                            </button>
                          </div>
                          {editSubjectError ? (
                            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200 lg:col-span-4">
                              {editSubjectError}
                            </p>
                          ) : null}
                        </form>
                      ) : (
                        <div className="grid grid-cols-[120px_minmax(0,1fr)_120px_180px] items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                            <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-900 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700">
                              {subject.abbreviation}
                            </span>
                          </div>
                          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{subject.name}</p>
                          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{questionCount}</p>
                          <div className="flex justify-end gap-2">
                            <button className="btn-secondary px-3" type="button" onClick={() => startSubjectEdit(subject)}>
                              Edit
                            </button>
                            <button className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 active:scale-[0.98] dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-500/10" type="button" onClick={() => setSubjectToDeleteId(subject.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
        </div>

        {showAddSubject ? (
          <section className="animate-enter rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-all duration-200 dark:border-slate-700 dark:bg-slate-900/70 sm:p-5">
            <form onSubmit={handleAddSubject} className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Subject name
                <input
                  className="field mt-1"
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  placeholder="e.g. Administrative Law"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Abbreviation
                <input
                  className="field mt-1"
                  value={subjectAbbreviation}
                  onChange={(event) => {
                    setSubjectAbbreviation(event.target.value);
                    setAddSubjectError("");
                  }}
                  placeholder="e.g. AL"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Color
                <div className="mt-1 flex gap-2">
                  <input
                    aria-label="Subject color"
                    className="h-10 w-12 rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                    type="color"
                    value={subjectColor}
                    onChange={(event) => setSubjectColor(event.target.value)}
                  />
                  <input
                    className="field"
                    value={subjectColor}
                    onChange={(event) => setSubjectColor(event.target.value)}
                  />
                </div>
              </label>
              {addSubjectError ? (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                  {addSubjectError}
                </p>
              ) : null}
              <button className="btn-primary w-full" type="submit">
                Add subject
              </button>
            </form>
          </section>
        ) : null}

        {showAddQuestion ? (
          <section className="animate-enter rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-all duration-200 dark:border-slate-700 dark:bg-slate-900/70 sm:p-5">
            <form onSubmit={handleAddQuestion} className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Subject
                <select
                  className="field mt-1"
                  value={selectedSubjectId}
                  onChange={(event) => setNewSubjectId(event.target.value)}
                >
                  {data.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Question title
                <textarea
                  className="field mt-1 min-h-24 resize-none"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Administrative discretion and judicial review"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <SmoothNumberInput
                  label="Number"
                  value={questionNumberInput}
                  fallback={nextQuestionNumber}
                  inputClassName="field mt-1"
                  onValueChange={setQuestionNumberInput}
                  onCommit={(value) => setQuestionNumberInput(String(value))}
                />
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Importance
                  <select
                    className="field mt-1"
                    value={importance}
                    onChange={(event) => setImportance(event.target.value as Importance)}
                  >
                    {importanceOptions.map((option) => (
                      <option key={option} value={option}>
                        {importanceLabels[option]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Notes
                <textarea
                  className="field mt-1 min-h-20 resize-none"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional memory hooks, weak spots, or source pages"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Tags
                <input
                  className="field mt-1"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="Comma separated, e.g. cash-flow, kalkulace"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Difficulty
                <select
                  className="field mt-1"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                >
                  {difficultyOptions.map((option) => (
                    <option key={option} value={option}>
                      {difficultyLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-primary w-full" type="submit">
                Add question
              </button>
            </form>
          </section>
        ) : null}

        <section className="space-y-3">
          <section className="panel p-4 sm:p-5">
            <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Filters</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Subject
                <select
                  className="field mt-1"
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                >
                  <option value="all">All subjects</option>
                  {data.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Status
                <select
                  className="field mt-1"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as QuestionStatus | "all")}
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {statusLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Sort
                <select
                  className="field mt-1"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortKey)}
                >
                  {(Object.keys(sortLabels) as SortKey[]).map((option) => (
                    <option key={option} value={option}>
                      {sortLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {filteredQuestions.length} of {data.questions.length} questions
            </p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Sorted by {sortLabels[sortBy]}</p>
          </div>

          {filteredQuestions.map((question) => {
            const subject = data.subjects.find((item) => item.id === question.subjectId);
            return (
              <QuestionCard
                key={question.id}
                question={question}
                subject={subject}
                subjects={data.subjects}
                lastSeen={getLastSeen(question.id)}
                daysSinceLastSeen={getDaysSinceLastSeen(question.id)}
                reviewCount={getReviewCount(question.id)}
                totalStudyTime={getTotalTimeForQuestion(question.id)}
                defaultSessionMinutes={data.settings.pomodoroWorkMinutes}
                onUpdate={updateQuestion}
                onDelete={deleteQuestion}
                onLogSession={logSession}
              />
            );
          })}

          {!filteredQuestions.length ? (
            <EmptyState title="No questions found" message="Adjust filters or add a new question." />
          ) : null}
        </section>
      </div>
      <ConfirmDialog
        open={Boolean(subjectToDelete)}
        title="Delete subject?"
        message={
          subjectToDeleteQuestionCount > 0
            ? `This will delete ${subjectToDelete?.name ?? "this subject"} and ${subjectToDeleteQuestionCount} related question${subjectToDeleteQuestionCount === 1 ? "" : "s"}. Existing study sessions for those questions will be moved to Needs review.`
            : `This will delete ${subjectToDelete?.name ?? "this subject"}.`
        }
        confirmLabel="Delete subject"
        destructive
        onCancel={() => setSubjectToDeleteId("")}
        onConfirm={handleDeleteSubjectConfirm}
      />
      </>
      )}
    </AppShell>
  );
}
