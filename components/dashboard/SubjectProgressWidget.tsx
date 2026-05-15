import { SubjectPill } from "@/components/study/SubjectPill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Question, Subject } from "@/types/study";

type SubjectProgressWidgetProps = {
  questions: Question[];
  subjects: Subject[];
};

export function SubjectProgressWidget({ questions, subjects }: SubjectProgressWidgetProps) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Subject progress</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Studied questions by subject.</p>
        </div>
      </div>
      <div className="mt-5 space-y-5">
        {subjects.map((subject) => {
          const subjectQuestions = questions.filter((question) => question.subjectId === subject.id);
          const studiedCount = subjectQuestions.filter(
            (question) => question.reviewCount > 0 || question.totalStudyTime > 0
          ).length;
          const progress = Math.round((studiedCount / (subjectQuestions.length || 1)) * 100);

          return (
            <div key={subject.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <SubjectPill subject={subject} />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {studiedCount}/{subjectQuestions.length}
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
