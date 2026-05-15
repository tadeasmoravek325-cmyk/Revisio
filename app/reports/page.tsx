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
import { Question, StudySession } from "@/types/study";
import { addDays, toDateInputValue } from "@/utils/date";
import {
  getAverageStudyMinutesPerDay,
  getDaysSinceLastSeen,
  getReviewCount,
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

function formatShortDate(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function getStudyTimeByDay(sessions: StudySession[]) {
  const today = new Date();

  return Array.from({ length: 14 }, (_, index) => {
    const date = toDateInputValue(addDays(today, index - 13));
    const minutes = sessions
      .filter((session) => session.startedAt.slice(0, 10) === date)
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
      .map((session) => session.startedAt.slice(0, 10))
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

function getNeglectedQuestions(questions: Question[], getDays: (questionId: string) => number | undefined) {
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
      return (b.daysSinceLastSeen ?? 0) - (a.daysSinceLastSeen ?? 0);
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

export default function ReportsPage() {
  const { data, getDaysSinceLastSeen: daysSinceLastSeen, hydrated, resetDemoData } = useStudyStore();
  const { showToast } = useToast();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const totalMinutes = getTotalStudyMinutes(data.sessions);
  const averageDailyMinutes = getAverageStudyMinutesPerDay(data);
  const streaks = getStudyStreaks(data.sessions);

  const dailyData = getStudyTimeByDay(data.sessions);
  const subjectData = data.subjects.map((subject) => {
    const questionIds = data.questions
      .filter((question) => question.subjectId === subject.id)
      .map((question) => question.id);
    const minutes = data.sessions
      .filter((session) => questionIds.includes(session.questionId))
      .reduce((sum, session) => sum + session.durationMinutes, 0);

    return {
      id: subject.id,
      subject: subject.name,
      abbreviation: subject.abbreviation,
      minutes,
      color: subject.color
    };
  });

  const questionData = data.questions
    .map((question) => ({
      id: question.id,
      name: `${question.number}. ${question.title}`,
      shortName: `${question.number}. ${question.title.slice(0, 22)}${question.title.length > 22 ? "..." : ""}`,
      minutes: getTotalTimeForQuestion(data, question.id)
    }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 8);

  const neglectedQuestions = getNeglectedQuestions(data.questions, daysSinceLastSeen);
  const hardestQuestions = [...data.questions]
    .sort((a, b) => {
      const difficultyRank = { hard: 3, medium: 2, easy: 1 };
      return (
        difficultyRank[b.difficulty] - difficultyRank[a.difficulty] ||
        getReviewCount(data, a.id) - getReviewCount(data, b.id) ||
        getTotalTimeForQuestion(data, a.id) - getTotalTimeForQuestion(data, b.id)
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
        <MetricCard label="Studied questions" value={`${data.questions.filter((question) => question.reviewCount > 0).length}/${data.questions.length}`} detail="Questions with at least one review" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <ReportCard title="Study time by day" detail="Last 14 days" className="min-h-[340px]">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="dailyStudyGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartGridColor} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: chartTextColor, fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: chartTextColor, fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="minutes" stroke="#0f766e" strokeWidth={3} fill="url(#dailyStudyGradient)" />
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
          <div className="mt-4 rounded-lg bg-teal-50 p-4 text-sm font-semibold text-teal-900 dark:bg-teal-500/15 dark:text-teal-100">
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
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={questionData} margin={{ left: -16, right: 8, top: 4, bottom: 32 }}>
                <CartesianGrid stroke={chartGridColor} vertical={false} />
                <XAxis dataKey="shortName" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={58} />
                <YAxis tick={{ fill: chartTextColor, fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="minutes" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
