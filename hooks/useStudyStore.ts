"use client";

import { useEffect, useMemo, useState } from "react";
import { initialData } from "@/data/studyData";
import {
  getDaysSinceLastSeen as getDaysSinceLastSeenFromData,
  getLastSeen as getLastSeenFromData,
  getMinutesThisWeek,
  getRecommendedQuestions as getRecommendedQuestionsFromData,
  getReviewCount as getReviewCountFromData,
  getTotalTimeForQuestion as getTotalTimeForQuestionFromData
} from "@/utils/studyMetrics";
import { localStudyRepository } from "@/services/studyRepository";
import { AppData, Question, StudySession, Subject } from "@/types/study";
import { createId } from "@/utils/id";

export function useStudyStore() {
  const [data, setData] = useState<AppData>(initialData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(localStudyRepository.load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStudyRepository.save(data);
    }
  }, [data, hydrated]);

  const actions = useMemo(
    () => ({
      addSubject(input: Omit<Subject, "id">) {
        setData((current) => ({
          ...current,
          subjects: [
            ...current.subjects,
            {
              ...input,
              name: input.name.trim(),
              abbreviation: input.abbreviation.trim(),
              id: createId("subject")
            }
          ]
        }));
      },
      updateSubject(id: string, patch: Partial<Subject>) {
        setData((current) => ({
          ...current,
          subjects: current.subjects.map((subject) =>
            subject.id === id
              ? {
                  ...subject,
                  ...patch,
                  name: patch.name?.trim() ?? subject.name,
                  abbreviation: patch.abbreviation?.trim() ?? subject.abbreviation
                }
              : subject
          )
        }));
      },
      addQuestion(input: Omit<Question, "id" | "createdAt" | "totalStudyTime" | "reviewCount">) {
        setData((current) => ({
          ...current,
          questions: [
            ...current.questions,
            {
              ...input,
              id: createId("question"),
              totalStudyTime: 0,
              reviewCount: 0,
              createdAt: new Date().toISOString()
            }
          ]
        }));
      },
      updateQuestion(id: string, patch: Partial<Question>) {
        setData((current) => ({
          ...current,
          questions: current.questions.map((question) =>
            question.id === id ? { ...question, ...patch } : question
          )
        }));
      },
      deleteQuestion(id: string) {
        setData((current) => ({
          ...current,
          questions: current.questions.filter((question) => question.id !== id),
          sessions: current.sessions.filter((session) => session.questionId !== id)
        }));
      },
      logSession(input: Omit<StudySession, "id">) {
        setData((current) => ({
          ...current,
          sessions: [{ ...input, id: createId("session") }, ...current.sessions],
          questions: current.questions.map((question) =>
            question.id === input.questionId
              ? {
                  ...question,
                  totalStudyTime: question.totalStudyTime + input.durationMinutes,
                  reviewCount: question.reviewCount + 1
                }
              : question
          )
        }));
      },
      updateSettings(settings: AppData["settings"]) {
        setData((current) => ({ ...current, settings }));
      },
      resetDemoData() {
        setData(initialData);
      }
    }),
    []
  );

  const helpers = useMemo(
    () => ({
      getLastSeen(questionId: string) {
        return getLastSeenFromData(data, questionId);
      },
      getDaysSinceLastSeen(questionId: string) {
        return getDaysSinceLastSeenFromData(data, questionId);
      },
      getTotalTimeForQuestion(questionId: string) {
        return getTotalTimeForQuestionFromData(data, questionId);
      },
      getReviewCount(questionId: string) {
        return getReviewCountFromData(data, questionId);
      },
      getRecommendedQuestions(limit?: number) {
        return getRecommendedQuestionsFromData(data, limit);
      },
      getMinutesThisWeek() {
        return getMinutesThisWeek(data.sessions);
      }
    }),
    [data]
  );

  return { data, hydrated, ...actions, ...helpers };
}
