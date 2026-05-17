import { AppData, Question, QuestionStatus, StudySession, Subject } from "@/types/study";
import { createLocalDateTime, getDateOnlyValue, toDateInputValue } from "@/utils/date";

const statusRank: Record<QuestionStatus, number> = {
  unknown: 0,
  partial: 1,
  known: 2
};

const difficultyWeight: Record<Question["difficulty"], number> = {
  easy: 1,
  medium: 2,
  hard: 3
};

const importanceWeight: Record<Question["importance"], number> = {
  low: 1,
  medium: 2,
  high: 3
};

export function getSessionsForQuestion(data: AppData, questionId: string) {
  return data.sessions.filter((session) => !session.needsReview && session.questionId === questionId);
}

export function getLastSeen(data: AppData, questionId: string) {
  const sessions = getSessionsForQuestion(data, questionId);
  if (!sessions.length) {
    return undefined;
  }

  const latestSession = [...sessions].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  )[0];

  return getSessionDate(latestSession);
}

export function getDaysSinceLastSeen(data: AppData, questionId: string) {
  const lastSeen = getLastSeen(data, questionId);
  if (!lastSeen) {
    return undefined;
  }

  const diff = Date.now() - createLocalDateTime(lastSeen).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function getTotalTimeForQuestion(data: AppData, questionId: string) {
  return getSessionsForQuestion(data, questionId).reduce(
    (sum, session) => sum + session.durationMinutes,
    0
  );
}

export function getReviewCount(data: AppData, questionId: string) {
  return getSessionsForQuestion(data, questionId).length;
}

export function getQuestionRecommendationScore(data: AppData, question: Question) {
  const daysSinceLastSeen = getDaysSinceLastSeen(data, question.id);
  const reviewCount = getReviewCount(data, question.id);
  const neverStudiedBoost = reviewCount === 0 ? 1_000_000 : 0;
  const recencyBoost = (daysSinceLastSeen ?? 0) * 1_000;
  const difficultyBoost = difficultyWeight[question.difficulty] * 200;
  const lowReviewBoost = Math.max(0, 20 - reviewCount) * 50;
  const statusBoost = (2 - statusRank[question.status]) * 150;
  const importanceBoost = importanceWeight[question.importance] * 25;

  return neverStudiedBoost + recencyBoost + difficultyBoost + lowReviewBoost + statusBoost + importanceBoost;
}

export function getRecommendedQuestions(data: AppData, limit = 5) {
  return [...data.questions]
    .sort(
      (a, b) =>
        getQuestionRecommendationScore(data, b) - getQuestionRecommendationScore(data, a)
    )
    .slice(0, limit);
}

export function getSessionDate(session: StudySession) {
  // Regression check: selecting 2026-05-04 must render on 2026-05-04.
  return getDateOnlyValue(session.date) || getDateOnlyValue(session.startedAt);
}

export function getTotalStudyMinutes(sessions: StudySession[]) {
  return sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
}

export function getTotalTrackedStudyMinutes(data: AppData) {
  return getTotalStudyMinutes(data.sessions);
}

export function getTodayStudyMinutes(sessions: StudySession[]) {
  const today = toDateInputValue(new Date());

  return sessions
    .filter((session) => getSessionDate(session) === today)
    .reduce((sum, session) => sum + session.durationMinutes, 0);
}

export function getStudiedQuestionCount(data: AppData) {
  return data.questions.filter((question) => getSessionsForQuestion(data, question.id).length > 0)
    .length;
}

type StudySessionWithQuestionIds = StudySession & {
  questionIds?: unknown;
};

function getSessionQuestionIds(session: StudySession) {
  const sessionWithQuestionIds = session as StudySessionWithQuestionIds;
  const ids = new Set<string>();

  if (session.questionId) {
    ids.add(session.questionId);
  }

  if (Array.isArray(sessionWithQuestionIds.questionIds)) {
    sessionWithQuestionIds.questionIds.forEach((questionId) => {
      if (typeof questionId === "string" && questionId.trim()) {
        ids.add(questionId);
      }
    });
  }

  return [...ids];
}

export function getSubjectProgressDetails({
  questions,
  sessions,
  subject
}: {
  questions: Question[];
  sessions: StudySession[];
  subject: Subject;
}) {
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const subjectQuestionIds = new Set(
    questions.filter((question) => question.subjectId === subject.id).map((question) => question.id)
  );
  const studiedQuestionIds = new Set<string>();
  const sessionsUsed = new Set<string>();
  const ignoredInvalidQuestionIds = new Set<string>();

  sessions.forEach((session) => {
    if (session.needsReview) {
      return;
    }

    let sessionUsed = false;
    getSessionQuestionIds(session).forEach((questionId) => {
      const question = questionsById.get(questionId);

      if (!question || question.subjectId !== subject.id) {
        ignoredInvalidQuestionIds.add(questionId);
        return;
      }

      if (subjectQuestionIds.has(questionId)) {
        studiedQuestionIds.add(questionId);
        sessionUsed = true;
      }
    });

    if (sessionUsed) {
      sessionsUsed.add(session.id);
    }
  });

  return {
    totalQuestions: subjectQuestionIds.size,
    studiedQuestionIds: [...studiedQuestionIds],
    sessionsUsed: [...sessionsUsed],
    ignoredInvalidQuestionIds: [...ignoredInvalidQuestionIds]
  };
}

export function getAverageStudyMinutesPerDay(data: AppData) {
  const dates = [
    ...data.questions.map((question) => question.createdAt),
    ...data.sessions.map((session) => getSessionDate(session))
  ];
  const firstDate = dates
    .map((date) => createLocalDateTime(getDateOnlyValue(date)).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)[0];

  if (!firstDate) {
    return 0;
  }

  const days = Math.max(1, Math.ceil((Date.now() - firstDate) / (1000 * 60 * 60 * 24)));
  return Math.round(getTotalTrackedStudyMinutes(data) / days);
}

export function getMinutesThisWeek(sessions: StudySession[]) {
  const weekAgo = toDateInputValue(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  return sessions
    .filter((session) => getSessionDate(session) >= weekAgo)
    .reduce((sum, session) => sum + session.durationMinutes, 0);
}
