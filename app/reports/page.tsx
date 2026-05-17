"use client";

import { useEffect, useState } from "react";
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
import { LoadingState } from "@/components/ui/LoadingState";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { difficultyLabels } from "@/data/studyData";
import { useStudyStore } from "@/hooks/useStudyStore";
import { Question, StudySession, Subject } from "@/types/study";
import { addDays, createLocalDateTime, toDateInputValue } from "@/utils/date";
import { compareQuestionsBySubjectAndNumber, parseQuestionNumber } from "@/utils/questionSorting";
import { formatStudyTime } from "@/utils/timeFormat";
import {
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
type ReportPeriod = "today" | "7" | "14" | "30" | "all";

const reportPeriodStorageKey = "revisio-report-period";
const reportPeriodOptions: Array<{ value: ReportPeriod; label: string; days?: number }> = [
  { value: "today", label: "Today", days: 1 },
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "14", label: "Last 14 days", days: 14 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "all", label: "All time" }
];

function getInitialReportPeriod(): ReportPeriod {
  if (typeof window === "undefined") {
    return "14";
  }

  const saved = window.sessionStorage.getItem(reportPeriodStorageKey);
  return reportPeriodOptions.some((option) => option.value === saved) ? (saved as ReportPeriod) : "14";
}

function getReportPeriodLabel(period: ReportPeriod) {
  return reportPeriodOptions.find((option) => option.value === period)?.label ?? "Last 14 days";
}

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

function getReportPeriodStart(period: ReportPeriod) {
  const option = reportPeriodOptions.find((item) => item.value === period);
  if (!option?.days) {
    return undefined;
  }

  return toDateInputValue(addDays(new Date(), 1 - option.days));
}

function getFilteredSessionsByPeriod(sessions: StudySession[], period: ReportPeriod) {
  const start = getReportPeriodStart(period);
  if (!start) {
    return sessions;
  }

  return sessions.filter((session) => getSessionDate(session) >= start);
}

function getReportPeriodDayCount(sessions: StudySession[], period: ReportPeriod) {
  const option = reportPeriodOptions.find((item) => item.value === period);
  if (option?.days) {
    return option.days;
  }

  const firstSessionDate = sessions
    .map((session) => getSessionDate(session))
    .filter(Boolean)
    .sort()[0];

  if (!firstSessionDate) {
    return 1;
  }

  const firstDate = createLocalDateTime(firstSessionDate).getTime();
  return Math.max(1, Math.ceil((Date.now() - firstDate) / (1000 * 60 * 60 * 24)));
}

function getStudyTimeByDay(sessions: StudySession[], period: ReportPeriod) {
  const today = new Date();
  const dayCount = getReportPeriodDayCount(sessions, period);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = toDateInputValue(addDays(today, index - dayCount + 1));
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
        {item.abbreviation} · {formatStudyTime(item.minutes)}
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
        <p>Study time: {formatStudyTime(item.minutes)}</p>
        <p>Review count: {item.reviewCount}</p>
        <p>Last reviewed: {formatLastReviewed(item.lastSeen, item.daysSinceLastSeen)}</p>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { data, hydrated } = useStudyStore();
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>(getInitialReportPeriod);
  const [questionLimit, setQuestionLimit] = useState<QuestionLimit>("8");
  const [questionView, setQuestionView] = useState<QuestionView>("chart");
  const periodLabel = getReportPeriodLabel(reportPeriod);
  const filteredSessions = getFilteredSessionsByPeriod(data.sessions, reportPeriod);
  const filteredData = { ...data, sessions: filteredSessions };
  const totalMinutes = getTotalStudyMinutes(filteredSessions);
  const averageDailyMinutes = Math.round(totalMinutes / getReportPeriodDayCount(data.sessions, reportPeriod));
  const streaks = getStudyStreaks(data.sessions);

  useEffect(() => {
    window.sessionStorage.setItem(reportPeriodStorageKey, reportPeriod);
  }, [reportPeriod]);

  const dailyData = getStudyTimeByDay(filteredSessions, reportPeriod);
  const questionOrder = compareQuestionsBySubjectAndNumber(data.subjects);
  const subjectData = data.subjects.map((subject) => {
    const questionIds = data.questions
      .filter((question) => question.subjectId === subject.id)
      .map((question) => question.id);
    const minutes = filteredSessions
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
        minutes: getTotalTimeForQuestion(filteredData, question.id),
        reviewCount: getReviewCount(filteredData, question.id),
        lastSeen: getLastSeen(filteredData, question.id),
        daysSinceLastSeen: getDaysSinceLastSeen(filteredData, question.id)
      };
    })
    .sort((a, b) => b.minutes - a.minutes || questionOrder(a.question, b.question));

  const questionData =
    questionLimit === "all"
      ? allQuestionData
      : allQuestionData.slice(0, Number(questionLimit));
  const questionChartWidth = Math.max(520, questionData.length * 72);

  const neglectedQuestions = getNeglectedQuestions(data.questions, data.subjects, (questionId) =>
    getDaysSinceLastSeen(filteredData, questionId)
  );
  const hardestQuestions = [...data.questions]
    .sort((a, b) => {
      const difficultyRank = { hard: 3, medium: 2, easy: 1 };
      return (
        difficultyRank[b.difficulty] - difficultyRank[a.difficulty] ||
        getReviewCount(filteredData, a.id) - getReviewCount(filteredData, b.id) ||
        getTotalTimeForQuestion(filteredData, a.id) - getTotalTimeForQuestion(filteredData, b.id) ||
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
        <label className="relative inline-flex items-center">
          <span className="sr-only">Report period</span>
          <select
            className="btn-secondary cursor-pointer appearance-none pr-9"
            value={reportPeriod}
            onChange={(event) => setReportPeriod(event.target.value as ReportPeriod)}
          >
            {reportPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 text-xs font-black text-slate-500 dark:text-slate-300">
            ▼
          </span>
        </label>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total study" value={formatStudyTime(totalMinutes)} detail={`${filteredSessions.length} sessions logged`} />
        <MetricCard label="Daily average" value={formatStudyTime(averageDailyMinutes)} detail={periodLabel} />
        <MetricCard label="Current streak" value={`${streaks.current} days`} detail={`Longest streak: ${streaks.longest} days`} />
        <MetricCard label="Studied questions" value={`${getStudiedQuestionCount(filteredData)}/${data.questions.length}`} detail={`With reviews in ${periodLabel.toLowerCase()}`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <ReportCard title="Study time by day" detail={periodLabel} className="min-h-[340px]">
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
                <YAxis tick={{ fill: chartTextColor, fontSize: 12 }} tickFormatter={(value) => formatStudyTime(Number(value))} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatStudyTime(Number(value))} />
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
            Average daily study time is {formatStudyTime(averageDailyMinutes)}.
          </div>
        </ReportCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ReportCard title="Study time by subject" detail="Minutes grouped by subject">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData} layout="vertical" margin={{ left: 0, right: 42, top: 4, bottom: 4 }}>
                <CartesianGrid stroke={chartGridColor} horizontal={false} />
                <XAxis type="number" tick={{ fill: chartTextColor, fontSize: 13 }} tickFormatter={(value) => formatStudyTime(Number(value))} tickLine={false} axisLine={false} />
                <YAxis dataKey="abbreviation" type="category" width={54} tick={{ fill: chartTextColor, fontSize: 14, fontWeight: 800 }} tickLine={false} axisLine={false} />
                <Tooltip content={<SubjectStudyTooltip />} />
                <Bar dataKey="minutes" radius={[0, 8, 8, 0]}>
                  <LabelList dataKey="minutes" position="right" formatter={(value) => formatStudyTime(Number(value))} fill={chartTextColor} fontSize={13} fontWeight={800} />
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
                    <YAxis tick={{ fill: chartTextColor, fontSize: 12 }} tickFormatter={(value) => formatStudyTime(Number(value))} tickLine={false} axisLine={false} />
                    <Tooltip content={<QuestionStudyTooltip />} />
                    <Bar dataKey="minutes" fill="#2563eb" radius={[8, 8, 0, 0]}>
                      <LabelList
                        dataKey="minutes"
                        position="top"
                        formatter={(value) => formatStudyTime(Number(value))}
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
                        {formatStudyTime(item.minutes)}
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
                    <span className="badge bg-slate-100 text-slate-700">{getReviewCount(filteredData, question.id)} reviews</span>
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
              const lastSeen = getDaysSinceLastSeen(filteredData, question.id);
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
                      <p className="font-black text-slate-950 dark:text-slate-50">
                        {formatStudyTime(getTotalTimeForQuestion(filteredData, question.id))}
                      </p>
                      <p className="font-semibold text-slate-500 dark:text-slate-400">studied</p>
                    </div>
                    <div className="rounded-md bg-white p-2 dark:bg-slate-950">
                      <p className="font-black text-slate-950 dark:text-slate-50">{getReviewCount(filteredData, question.id)}</p>
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
      </>
      )}
    </AppShell>
  );
}
