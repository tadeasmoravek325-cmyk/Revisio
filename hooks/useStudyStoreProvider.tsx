"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { emptyAppState, initialAppState, initialData } from "@/data/studyData";
import { backupService } from "@/services/backupService";
import { localStudyRepository } from "@/services/studyRepository";
import {
  AppData,
  AppState,
  Question,
  StudySession,
  StudyWorkspace,
  Subject,
  Workspace
} from "@/types/study";
import { createId } from "@/utils/id";
import {
  getDaysSinceLastSeen as getDaysSinceLastSeenFromData,
  getLastSeen as getLastSeenFromData,
  getMinutesThisWeek,
  getRecommendedQuestions as getRecommendedQuestionsFromData,
  getReviewCount as getReviewCountFromData,
  getTotalTimeForQuestion as getTotalTimeForQuestionFromData
} from "@/utils/studyMetrics";

type WorkspaceInput = Pick<Workspace, "name" | "description" | "examDate" | "color">;
type ImportedExamQuestionInput = {
  subjectName: string;
  subjectAbbreviation: string;
  questionNumber: number;
  questionTitle: string;
};

type StudyStoreValue = {
  data: StudyWorkspace;
  workspaces: StudyWorkspace[];
  activeWorkspaceId: string;
  activeWorkspace?: StudyWorkspace;
  hasWorkspaces: boolean;
  hydrated: boolean;
  addWorkspace: (input: WorkspaceInput) => void;
  updateWorkspace: (id: string, patch: Partial<WorkspaceInput>) => void;
  deleteWorkspace: (id: string) => void;
  switchWorkspace: (id: string) => void;
  addSubject: (input: Omit<Subject, "id">) => void;
  updateSubject: (id: string, patch: Partial<Subject>) => void;
  importExamTopics: (topics: ImportedExamQuestionInput[]) => { subjectsCreated: number; questionsCreated: number };
  addQuestion: (input: Omit<Question, "id" | "createdAt" | "totalStudyTime" | "reviewCount">) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  logSession: (input: Omit<StudySession, "id">) => void;
  updateSession: (id: string, patch: Partial<StudySession>) => void;
  deleteSession: (id: string) => void;
  updateSettings: (settings: AppData["settings"]) => void;
  automaticBackupsEnabled: boolean;
  setAutomaticBackupsEnabled: (enabled: boolean) => void;
  replaceStudyState: (nextState: AppState) => void;
  resetAppData: () => void;
  resetDemoData: () => void;
  getLastSeen: (questionId: string) => string | undefined;
  getDaysSinceLastSeen: (questionId: string) => number | undefined;
  getTotalTimeForQuestion: (questionId: string) => number;
  getReviewCount: (questionId: string) => number;
  getRecommendedQuestions: (limit?: number) => Question[];
  getMinutesThisWeek: () => number;
};

const StudyStoreContext = createContext<StudyStoreValue | undefined>(undefined);

const emptyWorkspacePlaceholder: StudyWorkspace = {
  id: "",
  name: "",
  description: "",
  examDate: "",
  createdAt: "",
  color: "#2563eb",
  subjects: [],
  questions: [],
  sessions: [],
  settings: initialData.settings
};

function createEmptyWorkspace(input: WorkspaceInput): StudyWorkspace {
  const examDate = input.examDate || initialData.settings.examDate;

  return {
    id: createId("workspace"),
    name: input.name.trim(),
    description: input.description.trim(),
    examDate,
    createdAt: new Date().toISOString(),
    color: input.color || "#2563eb",
    subjects: [],
    questions: [],
    sessions: [],
    settings: {
      ...initialData.settings,
      examDate
    }
  };
}

function updateWorkspaceData(
  state: AppState,
  updater: (workspace: StudyWorkspace) => StudyWorkspace
) {
  return {
    ...state,
    workspaces: state.workspaces.map((workspace) =>
      workspace.id === state.activeWorkspaceId ? updater(workspace) : workspace
    )
  };
}

export function StudyStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [hydrated, setHydrated] = useState(false);
  const [automaticBackupsEnabled, setAutomaticBackupsEnabledState] = useState(false);

  useEffect(() => {
    setState(localStudyRepository.load());
    setAutomaticBackupsEnabledState(backupService.getAutomaticBackupsEnabled());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      if (state.workspaces.length) {
        localStudyRepository.save(state);
        backupService.createSnapshot(state);
      } else {
        localStudyRepository.clear();
      }
    }
  }, [hydrated, state]);

  const activeWorkspace =
    state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ??
    state.workspaces[0] ??
    emptyWorkspacePlaceholder;

  const actions = useMemo(
    () => ({
      addWorkspace(input: WorkspaceInput) {
        const workspace = createEmptyWorkspace(input);
        setState((current) => ({
          activeWorkspaceId: workspace.id,
          workspaces: [...current.workspaces, workspace]
        }));
      },
      updateWorkspace(id: string, patch: Partial<WorkspaceInput>) {
        setState((current) => ({
          ...current,
          workspaces: current.workspaces.map((workspace) => {
            if (workspace.id !== id) {
              return workspace;
            }

            const examDate = patch.examDate?.trim() || workspace.examDate;

            return {
              ...workspace,
              ...patch,
              name: patch.name?.trim() ?? workspace.name,
              description: patch.description?.trim() ?? workspace.description,
              examDate,
              color: patch.color ?? workspace.color,
              settings: {
                ...workspace.settings,
                examDate
              }
            };
          })
        }));
      },
      deleteWorkspace(id: string) {
        setState((current) => {
          if (current.workspaces.length <= 1) {
            return current;
          }

          const workspaces = current.workspaces.filter((workspace) => workspace.id !== id);
          const activeWorkspaceId =
            current.activeWorkspaceId === id ? workspaces[0].id : current.activeWorkspaceId;

          return { activeWorkspaceId, workspaces };
        });
      },
      switchWorkspace(id: string) {
        setState((current) =>
          current.workspaces.some((workspace) => workspace.id === id)
            ? { ...current, activeWorkspaceId: id }
            : current
        );
      },
      addSubject(input: Omit<Subject, "id">) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            subjects: [
              ...workspace.subjects,
              {
                ...input,
                name: input.name.trim(),
                abbreviation: input.abbreviation.trim(),
                id: createId("subject")
              }
            ]
          }))
        );
      },
      updateSubject(id: string, patch: Partial<Subject>) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            subjects: workspace.subjects.map((subject) =>
              subject.id === id
                ? {
                    ...subject,
                    ...patch,
                    name: patch.name?.trim() ?? subject.name,
                    abbreviation: patch.abbreviation?.trim() ?? subject.abbreviation
                  }
                : subject
            )
          }))
        );
      },
      importExamTopics(topics: ImportedExamQuestionInput[]) {
        let subjectsCreated = 0;
        let questionsCreated = 0;

        setState((current) =>
          updateWorkspaceData(current, (workspace) => {
            const subjects = [...workspace.subjects];
            const questions = [...workspace.questions];
            const subjectByKey = new Map<string, Subject>();

            subjects.forEach((subject) => {
              subjectByKey.set(subject.name.trim().toLocaleLowerCase(), subject);
              subjectByKey.set(subject.abbreviation.trim().toLocaleLowerCase(), subject);
            });

            topics.forEach((topic) => {
              const subjectName = topic.subjectName.trim();
              const abbreviation = topic.subjectAbbreviation.trim();
              const subjectKey = subjectName.toLocaleLowerCase();
              const abbreviationKey = abbreviation.toLocaleLowerCase();
              let subject = subjectByKey.get(subjectKey) ?? subjectByKey.get(abbreviationKey);

              if (!subject) {
                subject = {
                  id: createId("subject"),
                  name: subjectName,
                  abbreviation,
                  color: "#2563eb"
                };
                subjects.push(subject);
                subjectByKey.set(subjectKey, subject);
                subjectByKey.set(abbreviationKey, subject);
                subjectsCreated += 1;
              }

              const normalizedTitle = topic.questionTitle.trim().toLocaleLowerCase();
              const alreadyExists = questions.some(
                (question) =>
                  question.subjectId === subject.id &&
                  (question.number === topic.questionNumber ||
                    question.title.trim().toLocaleLowerCase() === normalizedTitle)
              );

              if (alreadyExists) {
                return;
              }

              questions.push({
                id: createId("question"),
                subjectId: subject.id,
                number: topic.questionNumber,
                title: topic.questionTitle.trim(),
                notes: "",
                tags: [],
                difficulty: "medium",
                importance: "medium",
                status: "unknown",
                totalStudyTime: 0,
                reviewCount: 0,
                createdAt: new Date().toISOString()
              });
              questionsCreated += 1;
            });

            return {
              ...workspace,
              subjects,
              questions
            };
          })
        );

        return { subjectsCreated, questionsCreated };
      },
      addQuestion(input: Omit<Question, "id" | "createdAt" | "totalStudyTime" | "reviewCount">) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            questions: [
              ...workspace.questions,
              {
                ...input,
                id: createId("question"),
                totalStudyTime: 0,
                reviewCount: 0,
                createdAt: new Date().toISOString()
              }
            ]
          }))
        );
      },
      updateQuestion(id: string, patch: Partial<Question>) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            questions: workspace.questions.map((question) =>
              question.id === id ? { ...question, ...patch } : question
            )
          }))
        );
      },
      deleteQuestion(id: string) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            questions: workspace.questions.filter((question) => question.id !== id),
            sessions: workspace.sessions.map((session) =>
              session.questionId === id ? { ...session, questionId: undefined, needsReview: true } : session
            )
          }))
        );
      },
      logSession(input: Omit<StudySession, "id">) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            sessions: [{ ...input, id: createId("session") }, ...workspace.sessions],
            questions: workspace.questions.map((question) =>
              !input.needsReview && input.questionId && question.id === input.questionId
                ? {
                    ...question,
                    totalStudyTime: question.totalStudyTime + input.durationMinutes,
                    reviewCount: question.reviewCount + 1
                  }
                : question
            )
          }))
        );
      },
      updateSession(id: string, patch: Partial<StudySession>) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            sessions: workspace.sessions.map((session) =>
              session.id === id ? { ...session, ...patch } : session
            )
          }))
        );
      },
      deleteSession(id: string) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            sessions: workspace.sessions.filter((session) => session.id !== id)
          }))
        );
      },
      updateSettings(settings: AppData["settings"]) {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            examDate: settings.examDate,
            settings
          }))
        );
      },
      setAutomaticBackupsEnabled(enabled: boolean) {
        backupService.setAutomaticBackupsEnabled(enabled);
        setAutomaticBackupsEnabledState(enabled);
        if (enabled) {
          setState((current) => {
            backupService.createSnapshot(current, true);
            return current;
          });
        }
      },
      replaceStudyState(nextState: AppState) {
        setState(nextState);
      },
      resetAppData() {
        localStudyRepository.clear();
        backupService.clearAllBackupData();
        setAutomaticBackupsEnabledState(false);
        setState(emptyAppState);
      },
      resetDemoData() {
        setState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            ...initialData,
            examDate: initialData.settings.examDate
          }))
        );
      }
    }),
    []
  );

  const helpers = useMemo(
    () => ({
      getLastSeen(questionId: string) {
        return getLastSeenFromData(activeWorkspace, questionId);
      },
      getDaysSinceLastSeen(questionId: string) {
        return getDaysSinceLastSeenFromData(activeWorkspace, questionId);
      },
      getTotalTimeForQuestion(questionId: string) {
        return getTotalTimeForQuestionFromData(activeWorkspace, questionId);
      },
      getReviewCount(questionId: string) {
        return getReviewCountFromData(activeWorkspace, questionId);
      },
      getRecommendedQuestions(limit?: number) {
        return getRecommendedQuestionsFromData(activeWorkspace, limit);
      },
      getMinutesThisWeek() {
        return getMinutesThisWeek(activeWorkspace.sessions);
      }
    }),
    [activeWorkspace]
  );

  const value = useMemo(
    () => ({
      data: activeWorkspace,
      workspaces: state.workspaces,
      activeWorkspace,
      activeWorkspaceId: state.activeWorkspaceId,
      automaticBackupsEnabled,
      hasWorkspaces: state.workspaces.length > 0,
      hydrated,
      ...actions,
      ...helpers
    }),
    [actions, activeWorkspace, automaticBackupsEnabled, helpers, hydrated, state.activeWorkspaceId, state.workspaces]
  );

  return <StudyStoreContext.Provider value={value}>{children}</StudyStoreContext.Provider>;
}

export function useStudyStore() {
  const context = useContext(StudyStoreContext);
  if (!context) {
    throw new Error("useStudyStore must be used inside StudyStoreProvider");
  }

  return context;
}
