"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { ReportCard } from "@/components/reports/ReportCard";
import { SubjectPill } from "@/components/study/SubjectPill";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { difficultyLabels } from "@/data/studyData";
import { useStudyStore } from "@/hooks/useStudyStore";
import { Question, StudySession, Subject } from "@/types/study";
import { addDays, createLocalDateTime, toDateInputValue } from "@/utils/date";
import { compareQuestionsBySubjectAndNumber, parseQuestionNumber } from "@/utils/questionSorting";
import {
  getAverageStudyMinutesPerDay,
  getDaysSinceLastSeen,
  getLastSeen,
  getReviewCount,
  getSessionDate,
  getStudiedQuestionCount,
  getTotalStudyMinutes,
  getTotalTimeForQuestion
} from "@/utils/studyMetrics";

const chartTextColor = "#64748b";
const chartGridColor = "#e2e8f0";

type SubjectChartItem = {
  id: string;
  subject: string;
  abbreviation: string;
  minutes: number;
  color: string;
};

type QuestionChartItem = {
  id: string;
  label: string;
  title: string;
  questionNumber: number | string;
  question: Question;
  subject: string;
  subjectAbbreviation: string;
  minutes: number;
  reviewCount: number;
  lastSeen?: string;
  daysSinceLastSeen?: number;
};

type QuestionLimit = "8" | "15" | "all";
type QuestionView = "chart" | "table";

function formatShortDate(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function formatLastReviewed(value?: string, daysSinceLastSeen?: number) {
  if (!value) {
    return "Never";
  }

  if (daysSinceLastSeen === 0) {
    return "Today";
  }

  if (daysSinceLastSeen === 1) {
    return "1 day ago";
  }

  if (daysSinceLastSeen !== undefined) {
    return `${daysSinceLastSeen} days ago`;
  }

  return createLocalDateTime(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getStudyTimeByDay(sessions: StudySession[]) {
  const today = new Date();

  return Array.from({ length: 14 }, (_, index) => {
    const date = toDateInputValue(addDays(today, index - 13));
    const minutes = sessions
      .filter((session) => getSessionDate(session) === date)
      .reduce((sum, session) => sum + session.durationMinutes, 0);

    return {
      date,
      day: formatShortDate(date),
      minutes
    };
  });
}

function getStudyStreaks(sessions: StudySession[]) {
  const studyDays = new Set(
    sessions
      .filter((session) => session.durationMinutes > 0)
      .map((session) => getSessionDate(session))
  );

  let current = 0;
  let cursor = new Date();
  while (studyDays.has(toDateInputValue(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sortedDays = [...studyDays].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | undefined;

  sortedDays.forEach((dateValue) => {
    const date = new Date(`${dateValue}T12:00:00`);
    const isNextDay = previous
      ? Math.round((date.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)) === 1
      : false;

    run = isNextDay ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  });

  return { current, longest };
}

function getNeglectedQuestions(
  questions: Question[],
  subjects: Subject[],
  getDays: (questionId: string) => number | undefined
) {
  const questionOrder = compareQuestionsBySubjectAndNumber(subjects);

  return [...questions]
    .map((question) => ({
      question,
      daysSinceLastSeen: getDays(question.id)
    }))
    .sort((a, b) => {
      if (a.daysSinceLastSeen === undefined && b.daysSinceLastSeen !== undefined) {
        return -1;
      }
      if (a.daysSinceLastSeen !== undefined && b.daysSinceLastSeen === undefined) {
        return 1;
      }
      return (b.daysSinceLastSeen ?? 0) - (a.daysSinceLastSeen ?? 0) || questionOrder(a.question, b.question);
    })
    .slice(0, 6);
}

function SubjectStudyTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: SubjectChartItem }>;
}) {
  const item = payload?.[0]?.payload;

  if (!active || !item) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-soft dark:border-slate-700 dark:bg-slate-900">
      <p className="font-black text-slate-950 dark:text-slate-50">{item.subject}</p>
      <p className="mt-1 font-semibold text-slate-500 dark:text-slate-400">
        {item.abbreviation} · {item.minutes} min
      </p>
    </div>
  );
}

function QuestionStudyTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: QuestionChartItem }>;
}) {
  const item = payload?.[0]?.payload;

  if (!active || !item) {
    return null;
  }

  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-soft dark:border-slate-700 dark:bg-slate-900">
      <p className="font-black text-slate-950 dark:text-slate-50">{item.subject}</p>
      <p className="mt-1 font-semibold text-slate-500 dark:text-slate-400">
        {item.subjectAbbreviation} · Question {item.questionNumber}
      </p>
      <p className="mt-3 font-bold text-slate-900 dark:text-slate-100">
        Question {item.questionNumber}: {item.title}
      </p>
      <div className="mt-3 space-y-1 font-semibold text-slate-600 dark:text-slate-300">
        <p>Study time: {item.minutes} min</p>
        <p>Review count: {item.reviewCount}</p>
        <p>Last reviewed: {formatLastReviewed(item.lastSeen, item.daysSinceLastSeen)}</p>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { data, getDaysSinceLastSeen: daysSinceLastSeen, hydrated, resetDemoData } = useStudyStore();
  const { showToast } = useToast();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [questionLimit, setQuestionLimit] = useState<QuestionLimit>("8");
  const [questionView, setQuestionView] = useState<QuestionView>("chart");
  const totalMinutes = getTotalStudyMinutes(data.sessions);
  const averageDailyMinutes = getAverageStudyMinutesPerDay(data);
  const streaks = getStudyStreaks(data.sessions);

  const dailyData = getStudyTimeByDay(data.sessions);
  const questionOrder = compareQuestionsBySubjectAndNumber(data.subjects);
  const subjectData = data.subjects.map((subject) => {
    const questionIds = data.questions
      .filter((question) => question.subjectId === subject.id)
      .map((question) => question.id);
    const minutes = data.sessions
      .filter((session) => !session.needsReview && session.questionId && questionIds.includes(session.questionId))
      .reduce((sum, session) => sum + session.durationMinutes, 0);

    return {
      id: subject.id,
      subject: subject.name,
      abbreviation: subject.abbreviation,
      minutes,
      color: subject.color
    };
  });

  const allQuestionData = data.questions
    .map((question) => {
      const subject = data.subjects.find((item) => item.id === question.subjectId);
      const subjectAbbreviation = subject?.abbreviation ?? "SUB";
      return {
        id: question.id,
        label: `${subjectAbbreviation} ${question.number}`,
        title: question.title,
        questionNumber: parseQuestionNumber(question.number) ?? question.number,
        question,
        subject: subject?.name ?? "No subject",
        subjectAbbreviation,
        minutes: getTotalTimeForQuestion(data, question.id),
        reviewCount: getReviewCount(data, question.id),
        lastSeen: getLastSeen(data, question.id),
        daysSinceLastSeen: getDaysSinceLastSeen(data, question.id)
      };
    })
    .sort((a, b) => b.minutes - a.minutes || questionOrder(a.question, b.question));

  const questionData =
    questionLimit === "all"
      ? allQuestionData
      : allQuestionData.slice(0, Number(questionLimit));
  const questionChartWidth = Math.max(520, questionData.length * 72);

  const neglectedQuestions = getNeglectedQuestions(data.questions, data.subjects, daysSinceLastSeen);
  const hardestQuestions = [...data.questions]
    .sort((a, b) => {
      const difficultyRank = { hard: 3, medium: 2, easy: 1 };
      return (
        difficultyRank[b.difficulty] - difficultyRank[a.difficulty] ||
        getReviewCount(data, a.id) - getReviewCount(data, b.id) ||
        getTotalTimeForQuestion(data, a.id) - getTotalTimeForQuestion(data, b.id) ||
        questionOrder(a, b)
      );
    })
    .slice(0, 6);

  return (
    <AppShell>
      {!hydrated ? (
        <LoadingState />
      ) : (
        <>
      <PageHeader title="Reports" eyebrow="Progress readout">
        <button className="btn-secondary" onClick={() => setShowResetConfirm(true)}>
          Reset demo data
        </button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total study" value={`${totalMinutes} min`} detail={`${data.sessions.length} sessions logged`} />
        <MetricCard label="Daily average" value={`${averageDailyMinutes} min`} detail="Across your preparation history" />
        <MetricCard label="Current streak" value={`${streaks.current} days`} detail={`Longest streak: ${streaks.longest} days`} />
        <MetricCard label="Studied questions" value={`${getStudiedQuestionCount(data)}/${data.questions.length}`} detail="Questions with at least one review" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <ReportCard title="Study time by day" detail="Last 14 days" className="min-h-[340px]">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="dailyStudyGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartGridColor} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: chartTextColor, fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: chartTextColor, fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="minutes" stroke="#2563eb" strokeWidth={3} fill="url(#dailyStudyGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>

        <ReportCard title="Study streaks" detail="Momentum from logged study days">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Current</p>
              <p className="mt-2 text-3xl font-black text-slate-950 dark:text-slate-50">{streaks.current}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">days</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Longest</p>
              <p className="mt-2 text-3xl font-black text-slate-950 dark:text-slate-50">{streaks.longest}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">days</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm font-semibold text-blue-900 dark:bg-blue-500/15 dark:text-blue-100">
            Average daily study time is {averageDailyMinutes} minutes.
          </div>
        </ReportCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ReportCard title="Study time by subject" detail="Minutes grouped by subject">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData} layout="vertical" margin={{ left: 0, right: 42, top: 4, bottom: 4 }}>
                <CartesianGrid stroke={chartGridColor} horizontal={false} />
                <XAxis type="number" tick={{ fill: chartTextColor, fontSize: 13 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="abbreviation" type="category" width={54} tick={{ fill: chartTextColor, fontSize: 14, fontWeight: 800 }} tickLine={false} axisLine={false} />
                <Tooltip content={<SubjectStudyTooltip />} />
                <Bar dataKey="minutes" radius={[0, 8, 8, 0]}>
                  <LabelList dataKey="minutes" position="right" formatter={(value) => `${value ?? 0} min`} fill={chartTextColor} fontSize={13} fontWeight={800} />
                  {subjectData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>

        <ReportCard title="Study time by question" detail="Most practiced questions">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 text-sm font-bold dark:border-slate-700 dark:bg-slate-950">
              <button
                className={`rounded-md px-3 py-1.5 transition ${
                  questionView === "chart"
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "text-slate-600 dark:text-slate-300"
                }`}
                onClick={() => setQuestionView("chart")}
              >
                Chart view
              </button>
              <button
                className={`rounded-md px-3 py-1.5 transition ${
                  questionView === "table"
                    ? "bg-blue-600 text-white dark:bg-blue-500"
                    : "text-slate-600 dark:text-slate-300"
                }`}
                onClick={() => setQuestionView("table")}
              >
                Table view
              </button>
            </div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Show
              <select
                className="field ml-2 w-auto py-1.5"
                value={questionLimit}
                onChange={(event) => setQuestionLimit(event.target.value as QuestionLimit)}
              >
                <option value="8">Top 8</option>
                <option value="15">Top 15</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>

          {questionView === "chart" ? (
            <div className="overflow-x-auto pb-2">
              <div className="h-[340px]" style={{ minWidth: questionChartWidth }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={questionData} margin={{ left: -8, right: 18, top: 28, bottom: 24 }}>
                    <CartesianGrid stroke={chartGridColor} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: chartTextColor, fontSize: 13, fontWeight: 800 }}
                      tickLine={false}
                      axisLine={false}
                      angle={questionData.length > 10 ? -25 : 0}
                      textAnchor={questionData.length > 10 ? "end" : "middle"}
                      height={questionData.length > 10 ? 58 : 38}
                    />
                    <YAxis tick={{ fill: chartTextColor, fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<QuestionStudyTooltip />} />
                    <Bar dataKey="minutes" fill="#2563eb" radius={[8, 8, 0, 0]}>
                      <LabelList
                        dataKey="minutes"
                        position="top"
                        formatter={(value) => `${value ?? 0} min`}
                        fill={chartTextColor}
                        fontSize={12}
                        fontWeight={800}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-3 pr-3">Label</th>
                    <th className="py-3 pr-3">Question</th>
                    <th className="py-3 pr-3">Subject</th>
                    <th className="py-3 pr-3">Study time</th>
                    <th className="py-3 pr-3">Reviews</th>
                    <th className="py-3">Last reviewed</th>
                  </tr>
                </thead>
                <tbody>
                  {questionData.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3 pr-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-black text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                          {item.label}
                        </span>
                      </td>
                      <td className="max-w-[280px] py-3 pr-3 font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </td>
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">
                        {item.subject}
                      </td>
                      <td className="py-3 pr-3 font-black text-slate-950 dark:text-slate-50">
                        {item.minutes} min
                      </td>
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">
                        {item.reviewCount}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">
                        {formatLastReviewed(item.lastSeen, item.daysSinceLastSeen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ReportCard title="Most neglected questions" detail="Never studied or longest since last review">
          <div className="space-y-3">
            {neglectedQuestions.map(({ question, daysSinceLastSeen }) => {
              const subject = data.subjects.find((item) => item.id === question.subjectId);
              return (
                <article key={question.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <SubjectPill subject={subject} />
                  <h3 className="mt-2 text-sm font-black text-slate-950 dark:text-slate-50">
                    {question.number}. {question.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="badge bg-amber-100 text-amber-800">
                      {daysSinceLastSeen === undefined ? "Never studied" : `${daysSinceLastSeen} days since review`}
                    </span>
                    <span className="badge bg-slate-100 text-slate-700">{getReviewCount(data, question.id)} reviews</span>
                  </div>
                </article>
              );
            })}
          </div>
        </ReportCard>

        <ReportCard title="Hardest questions" detail="Highest estimated difficulty with low practice first">
          <div className="space-y-3">
            {hardestQuestions.map((question) => {
              const subject = data.subjects.find((item) => item.id === question.subjectId);
              const lastSeen = getDaysSinceLastSeen(data, question.id);
              return (
                <article key={question.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <SubjectPill subject={subject} />
                    <span className="badge bg-rose-100 text-rose-800">{difficultyLabels[question.difficulty]}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-black text-slate-950 dark:text-slate-50">
                    {question.number}. {question.title}
                  </h3>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-white p-2 dark:bg-slate-950">
                      <p className="font-black text-slate-950 dark:text-slate-50">{getTotalTimeForQuestion(data, question.id)}</p>
                      <p className="font-semibold text-slate-500 dark:text-slate-400">min</p>
                    </div>
                    <div className="rounded-md bg-white p-2 dark:bg-slate-950">
                      <p className="font-black text-slate-950 dark:text-slate-50">{getReviewCount(data, question.id)}</p>
                      <p className="font-semibold text-slate-500 dark:text-slate-400">reviews</p>
                    </div>
                    <div className="rounded-md bg-white p-2 dark:bg-slate-950">
                      <p className="font-black text-slate-950 dark:text-slate-50">{lastSeen ?? "Never"}</p>
                      <p className="font-semibold text-slate-500 dark:text-slate-400">{lastSeen === undefined ? "seen" : "days"}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </ReportCard>
      </div>
      <ConfirmDialog
        open={showResetConfirm}
        title="Reset demo data?"
        message="This will replace your current local study data with the sample dataset."
        confirmLabel="Reset"
        destructive
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          resetDemoData();
          setShowResetConfirm(false);
          showToast("Demo data reset", "warning");
        }}
      />
      </>
      )}
    </AppShell>
  );
}
