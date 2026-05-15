import { difficultyLabels, difficultyStyles, statusLabels, statusStyles } from "@/data/studyData";
import { Question, Subject } from "@/types/study";
import { SubjectPill } from "@/components/study/SubjectPill";

type RecommendedQuestion = {
  question: Question;
  daysSinceLastSeen?: number;
  reviewCount: number;
  totalStudyTime: number;
};

type RecommendedQuestionsWidgetProps = {
  items: RecommendedQuestion[];
  subjects: Subject[];
};

export function RecommendedQuestionsWidget({ items, subjects }: RecommendedQuestionsWidgetProps) {
  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Recommended questions</h2>
      <div className="mt-4 space-y-3">
        {!items.length ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/55 dark:text-slate-400">
            Add questions or log study sessions to generate recommendations.
          </div>
        ) : null}
        {items.map(({ question, daysSinceLastSeen, reviewCount, totalStudyTime }) => {
          const subject = subjects.find((item) => item.id === question.subjectId);

          return (
            <article key={question.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-800/55">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <SubjectPill subject={subject} />
                  <h3 className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
                    {question.number}. {question.title}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <span className={`badge ${statusStyles[question.status]}`}>
                    {statusLabels[question.status]}
                  </span>
                  <span className={`badge ${difficultyStyles[question.difficulty]}`}>
                    {difficultyLabels[question.difficulty]}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {reviewCount === 0
                  ? "Never studied"
                  : `${daysSinceLastSeen ?? 0} days since review`}{" "}
                · {reviewCount} reviews · {totalStudyTime} min total
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
