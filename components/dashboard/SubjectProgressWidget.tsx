"use client";

import { useEffect, useMemo } from "react";
import { SubjectPill } from "@/components/study/SubjectPill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Question, StudySession, Subject } from "@/types/study";
import { getSubjectProgressDetails } from "@/utils/studyMetrics";

type SubjectProgressWidgetProps = {
  questions: Question[];
  sessions: StudySession[];
  subjects: Subject[];
};

export function SubjectProgressWidget({ questions, sessions, subjects }: SubjectProgressWidgetProps) {
  const subjectProgress = useMemo(
    () =>
      subjects.map((subject) => ({
        subject,
        details: getSubjectProgressDetails({ questions, sessions, subject })
      })),
    [questions, sessions, subjects]
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    subjectProgress.forEach(({ subject, details }) => {
      console.info("[Revisio subject progress]", {
        subjectName: subject.name,
        totalQuestions: details.totalQuestions,
        studiedUniqueQuestionIds: details.studiedQuestionIds,
        sessionsUsed: details.sessionsUsed,
        ignoredInvalidQuestionIds: details.ignoredInvalidQuestionIds
      });
    });
  }, [subjectProgress]);

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Subject progress</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Studied questions by subject.</p>
        </div>
      </div>
      <div className="mt-5 space-y-5">
        {subjectProgress.map(({ subject, details }) => {
          const studiedCount = details.studiedQuestionIds.length;
          const progress = Math.round((studiedCount / (details.totalQuestions || 1)) * 100);

          return (
            <div key={subject.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <SubjectPill subject={subject} />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {studiedCount}/{details.totalQuestions}
                </span>
              </div>
              <ProgressBar value={progress} color={subject.color} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
