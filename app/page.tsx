"use client";

import { useEffect, useState } from "react";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { RecommendedQuestionsWidget } from "@/components/dashboard/RecommendedQuestionsWidget";
import { SubjectProgressWidget } from "@/components/dashboard/SubjectProgressWidget";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyRevisioState } from "@/components/onboarding/EmptyRevisioState";
import { SessionForm } from "@/components/study/SessionForm";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SmoothNumberInput } from "@/components/ui/SmoothNumberInput";
import { useStudyStore } from "@/hooks/useStudyStore";
import { Settings } from "@/types/study";
import { getDaysUntil } from "@/utils/date";
import { formatStudyTime } from "@/utils/timeFormat";
import {
  getAverageStudyMinutesPerDay,
  getStudiedQuestionCount,
  getTodayStudyMinutes,
  getTotalTrackedStudyMinutes
} from "@/utils/studyMetrics";

function formatExamDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function DailyTargetWidget({
  settings,
  studiedToday,
  onSave
}: {
  settings: Settings;
  studiedToday: number;
  onSave: (settings: Settings) => void;
}) {
  const targetMinutes = Math.max(0, Math.round(settings.dailyStudyTargetMinutes ?? 0));
  const [isEditing, setIsEditing] = useState(false);
  const [hoursDraft, setHoursDraft] = useState(String(Math.floor(targetMinutes / 60)));
  const [minutesDraft, setMinutesDraft] = useState(String(targetMinutes % 60));
  const progress = targetMinutes > 0 ? Math.min(100, Math.round((studiedToday / targetMinutes) * 100)) : 0;

  useEffect(() => {
    setHoursDraft(String(Math.floor(targetMinutes / 60)));
    setMinutesDraft(String(targetMinutes % 60));
  }, [targetMinutes]);

  function saveTarget() {
    const hours = Math.max(0, Number(hoursDraft) || 0);
    const minutes = Math.max(0, Number(minutesDraft) || 0);
    const nextTarget = Math.round(hours) * 60 + Math.round(minutes);
    onSave({ ...settings, dailyStudyTargetMinutes: Math.max(1, nextTarget || targetMinutes || 120) });
    setIsEditing(false);
  }

  return (
    <section className="panel mb-5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
            Daily target
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-50">
            {formatStudyTime(studiedToday)} / {formatStudyTime(targetMinutes)}
          </h2>
          <div className="mt-3">
            <ProgressBar value={progress} />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {progress >= 100 ? "Target reached for today." : `${progress}% of today's plan completed.`}
          </p>
        </div>

        <div className="w-full sm:w-auto sm:min-w-[260px]">
          {isEditing ? (
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
              <div className="grid grid-cols-2 gap-2">
                <SmoothNumberInput
                  label="Hours"
                  value={hoursDraft}
                  min={0}
                  fallback={Math.floor(targetMinutes / 60)}
                  onValueChange={setHoursDraft}
                  onCommit={(value) => setHoursDraft(String(Math.max(0, value)))}
                />
                <SmoothNumberInput
                  label="Minutes"
                  value={minutesDraft}
                  min={0}
                  fallback={targetMinutes % 60}
                  onValueChange={setMinutesDraft}
                  onCommit={(value) => setMinutesDraft(String(Math.max(0, value)))}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-secondary" type="button" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button className="btn-primary" type="button" onClick={saveTarget}>
                  Save target
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-secondary w-full" type="button" onClick={() => setIsEditing(true)}>
              Edit target
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const {
    data,
    getDaysSinceLastSeen,
    getRecommendedQuestions,
    getReviewCount,
    getTotalTimeForQuestion,
    hasWorkspaces,
    hydrated,
    logSession,
    updateSettings
  } = useStudyStore();

  const examDays = data.settings.examDate ? getDaysUntil(data.settings.examDate) : 0;
  const totalStudyTime = getTotalTrackedStudyMinutes(data);
  const todayStudyTime = getTodayStudyMinutes(data.sessions);
  const totalQuestions = data.questions.length;
  const studiedQuestions = getStudiedQuestionCount(data);
  const averageStudyTimePerDay = getAverageStudyMinutesPerDay(data);
  const sessionsNeedingReview = data.sessions.filter((session) => session.needsReview || !session.questionId).length;
  const recommendedQuestions = getRecommendedQuestions(5).map((question) => ({
    question,
    daysSinceLastSeen: getDaysSinceLastSeen(question.id),
    reviewCount: getReviewCount(question.id),
    totalStudyTime: getTotalTimeForQuestion(question.id)
  }));

  if (!hydrated) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (!hasWorkspaces) {
    return (
      <AppShell>
        <EmptyRevisioState />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Dashboard" eyebrow="Study cockpit">
        <button
          className="btn-secondary"
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
        >
          Log session
        </button>
      </PageHeader>

      <div className="mb-5 flex items-center gap-3 rounded-lg border border-blue-100 bg-white/90 p-4 shadow-soft dark:border-blue-500/20 dark:bg-slate-900/75">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: data.color ?? "#2563eb" }} />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Active workspace
          </p>
          <h2 className="text-xl font-black text-slate-950 dark:text-slate-50">{data.name}</h2>
          {data.description ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.description}</p>
          ) : null}
        </div>
      </div>

      <section className="panel mb-5 overflow-hidden p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
              Next best move
            </p>
            <h2 className="mt-3 max-w-2xl text-2xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
              {recommendedQuestions[0]
                ? `Review ${recommendedQuestions[0].question.number}. ${recommendedQuestions[0].question.title}`
                : "Add your first question and start tracking"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              The dashboard weighs untouched questions, stale reviews, difficulty, and current status so the next session is easier to choose.
            </p>
          </div>
          <div className="grid gap-3 min-[420px]:grid-cols-2">
            <div className="rounded-lg bg-blue-600 p-4 text-white dark:bg-blue-500">
              <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">Progress</p>
              <p className="mt-2 text-3xl font-black">
                {Math.round((studiedQuestions / (totalQuestions || 1)) * 100)}%
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-blue-950 dark:bg-blue-500/10 dark:text-blue-100">
              <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">Today</p>
              <p className="mt-2 text-3xl font-black">{formatStudyTime(todayStudyTime)}</p>
            </div>
          </div>
        </div>
      </section>

      <DailyTargetWidget
        settings={data.settings}
        studiedToday={todayStudyTime}
        onSave={updateSettings}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Exam date"
          value={formatExamDate(data.settings.examDate)}
          detail="Final state exam"
        />
        <DashboardStatCard
          label="Countdown"
          value={`${examDays} days`}
          detail={examDays === 0 ? "Exam day" : "Until exam"}
        />
        <DashboardStatCard
          label="Total study time"
          value={formatStudyTime(totalStudyTime)}
          detail="Across all questions"
        />
        <DashboardStatCard
          label="Today study time"
          value={formatStudyTime(todayStudyTime)}
          detail="Logged today"
        />
        <DashboardStatCard
          label="Total questions"
          value={`${totalQuestions}`}
          detail={`${data.subjects.length} subjects`}
        />
        <DashboardStatCard
          label="Studied questions"
          value={`${studiedQuestions}/${totalQuestions}`}
          detail={`${Math.round((studiedQuestions / (totalQuestions || 1)) * 100)}% touched`}
        />
        <DashboardStatCard
          label="Average per day"
          value={formatStudyTime(averageStudyTimePerDay)}
          detail="Since first tracked question"
        />
        <DashboardStatCard
          label="Needs review"
          value={`${sessionsNeedingReview}`}
          detail="Sessions need review"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <SubjectProgressWidget subjects={data.subjects} questions={data.questions} sessions={data.sessions} />
        <RecommendedQuestionsWidget subjects={data.subjects} items={recommendedQuestions} />
      </div>

      <div className="mt-5">
        <SessionForm subjects={data.subjects} questions={data.questions} onSubmit={logSession} />
      </div>
    </AppShell>
  );
}
