"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { emptyAppState, initialData } from "@/data/studyData";
import { backupService } from "@/services/backupService";
import { localStudyRepository } from "@/services/studyRepository";
import {
  createCloudEntityId,
  normalizeStateForCloud,
  supabaseStudyRepository
} from "@/services/supabaseStudyRepository";
import {
  AppData,
  AppState,
  Question,
  StudySession,
  StudyWorkspace,
  Subject,
  Workspace
} from "@/types/study";
import {
  getDaysSinceLastSeen as getDaysSinceLastSeenFromData,
  getLastSeen as getLastSeenFromData,
  getMinutesThisWeek,
  getRecommendedQuestions as getRecommendedQuestionsFromData,
  getReviewCount as getReviewCountFromData,
  getTotalTimeForQuestion as getTotalTimeForQuestionFromData
} from "@/utils/studyMetrics";
import { getDateOnlyValue } from "@/utils/date";

type WorkspaceInput = Pick<Workspace, "name" | "description" | "examDate" | "color">;
type ImportedExamQuestionInput = {
  subjectName: string;
  subjectAbbreviation: string;
  questionNumber: number;
  questionTitle: string;
};
type SyncStatus = "loading" | "synced" | "syncing" | "failed" | "offline_cache";

type StudyStoreValue = {
  data: StudyWorkspace;
  workspaces: StudyWorkspace[];
  activeWorkspaceId: string;
  activeWorkspace?: StudyWorkspace;
  hasWorkspaces: boolean;
  hydrated: boolean;
  storageError: string;
  syncStatus: SyncStatus;
  pendingLocalMigration: boolean;
  addWorkspace: (input: WorkspaceInput) => void;
  updateWorkspace: (id: string, patch: Partial<WorkspaceInput>) => void;
  deleteWorkspace: (id: string) => void;
  switchWorkspace: (id: string) => void;
  addSubject: (input: Omit<Subject, "id">) => void;
  updateSubject: (id: string, patch: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
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
  reloadFromCloud: () => void;
  migrateLocalDataToCloud: () => void;
  dismissLocalMigration: () => void;
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
const migrationDismissedKeyPrefix = "revisio-cloud-migration-dismissed";

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
    id: createCloudEntityId(),
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

function getStudyStateCounts(state: AppState) {
  return state.workspaces.reduce(
    (counts, workspace) => ({
      workspaces: counts.workspaces + 1,
      subjects: counts.subjects + workspace.subjects.length,
      questions: counts.questions + workspace.questions.length,
      sessions: counts.sessions + workspace.sessions.length
    }),
    { workspaces: 0, subjects: 0, questions: 0, sessions: 0 }
  );
}

function logStudySync(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[Revisio cloud sync] ${message}`, details);
  }
}

function getMigrationDismissedKey(userId: string) {
  return `${migrationDismissedKeyPrefix}:${userId}`;
}

export function StudyStoreProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, user } = useAuth();
  const [state, setState] = useState<AppState>(emptyAppState);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [pendingLocalMigration, setPendingLocalMigration] = useState(false);
  const [automaticBackupsEnabled, setAutomaticBackupsEnabledState] = useState(false);
  const loadRunRef = useRef(0);
  const stateRef = useRef<AppState>(emptyAppState);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let active = true;
    const runId = loadRunRef.current + 1;
    loadRunRef.current = runId;

    async function loadStudyData() {
      setHydrated(false);
      setStorageError("");
      setSyncStatus("loading");
      setPendingLocalMigration(false);
      setAutomaticBackupsEnabledState(backupService.getAutomaticBackupsEnabled());

      if (!user) {
        setState(emptyAppState);
        setSyncStatus("synced");
        setHydrated(true);
        return;
      }

      try {
        const cloudState = await supabaseStudyRepository.load();
        const cloudCounts = getStudyStateCounts(cloudState);
        const localState = localStudyRepository.load();
        const localCounts = getStudyStateCounts(localState);
        const migrationDismissed =
          typeof window !== "undefined" &&
          window.localStorage.getItem(getMigrationDismissedKey(user.id)) === "true";
        const shouldOfferLocalMigration =
          !cloudState.workspaces.length && localState.workspaces.length && !migrationDismissed;

        if (shouldOfferLocalMigration) {
          setPendingLocalMigration(true);
        }

        logStudySync("Loaded account data", {
          userId: user.id,
          source: "supabase",
          finalStateSource: "supabase",
          ...cloudCounts,
          localWorkspacesFound: localCounts.workspaces,
          cloudWorkspaceCount: cloudCounts.workspaces,
          localWorkspaceCount: localCounts.workspaces,
          localMigrationOffered: shouldOfferLocalMigration,
          localMigrationSkipped:
            cloudState.workspaces.length > 0 || !localState.workspaces.length || migrationDismissed
        });

        if (active && loadRunRef.current === runId) {
          setState(cloudState);
          if (!shouldOfferLocalMigration) {
            localStudyRepository.save(cloudState);
          }
          setSyncStatus("synced");
        }
      } catch (error) {
        if (active && loadRunRef.current === runId) {
          setStorageError(error instanceof Error ? error.message : "Cloud study data could not be loaded.");
          setState(emptyAppState);
          setSyncStatus("failed");
          logStudySync("Cloud load failed, localStorage ignored for authenticated user", {
            userId: user.id,
            finalStateSource: "empty_after_cloud_error",
            loadedDataSource: "none",
            cloudWorkspaceCount: 0,
            localWorkspacesDetected: getStudyStateCounts(localStudyRepository.load()).workspaces,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      } finally {
        if (active && loadRunRef.current === runId) {
          setHydrated(true);
        }
      }
    }

    loadStudyData();

    return () => {
      active = false;
    };
  }, [authLoading, user]);

  async function persistState(nextState: AppState) {
    if (!user) {
      return;
    }

    setSyncStatus("syncing");
    setStorageError("");
    logStudySync("save started", {
      userId: user.id,
      ...getStudyStateCounts(nextState)
    });

    try {
      const savedState = nextState.workspaces.length
        ? await supabaseStudyRepository.save(nextState)
        : (await supabaseStudyRepository.clear(), emptyAppState);
      setState(savedState);
      if (savedState.workspaces.length) {
        localStudyRepository.save(savedState);
        setPendingLocalMigration(false);
      } else {
        localStudyRepository.clear();
      }
      backupService.createSnapshot(savedState);
      setSyncStatus("synced");
      logStudySync("Saved to Supabase", {
        userId: user.id,
        ...getStudyStateCounts(savedState)
      });
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Cloud study data could not be saved.");
      setSyncStatus("failed");
      logStudySync("Supabase save failed", {
        userId: user.id,
        exactErrorMessage: error instanceof Error ? error.message : "Unknown error",
        error
      });
    }
  }

  function commitState(updater: (current: AppState) => AppState) {
    const nextState = updater(stateRef.current);
    persistState(nextState);
  }

  async function reloadFromCloud() {
    if (!user) {
      return;
    }

    setSyncStatus("loading");
    setStorageError("");

    try {
      const cloudState = await supabaseStudyRepository.load();
      setState(cloudState);
      localStudyRepository.save(cloudState);
      setPendingLocalMigration(false);
      setSyncStatus("synced");
      logStudySync("Manual reload from cloud", {
        userId: user.id,
        ...getStudyStateCounts(cloudState)
      });
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Cloud study data could not be loaded.");
      setSyncStatus("failed");
    }
  }

  async function migrateLocalDataToCloud() {
    if (!user) {
      return;
    }

    try {
      setSyncStatus("syncing");
      const localState = localStudyRepository.load();
      const savedState = await supabaseStudyRepository.save(localState);
      setState(savedState);
      localStudyRepository.save(savedState);
      setPendingLocalMigration(false);
      window.localStorage.setItem(getMigrationDismissedKey(user.id), "true");
      setSyncStatus("synced");
      logStudySync("Local data migrated to Supabase", {
        userId: user.id,
        finalStateSource: "manual_local_migration",
        cloudWorkspaceCount: getStudyStateCounts(savedState).workspaces,
        localWorkspaceCount: getStudyStateCounts(localState).workspaces,
        ...getStudyStateCounts(savedState)
      });
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Local data could not be imported to cloud.");
      setSyncStatus("failed");
    }
  }

  function dismissLocalMigration() {
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem(getMigrationDismissedKey(user.id), "true");
    }
    setPendingLocalMigration(false);
    logStudySync("Local migration dismissed", {
      userId: user?.id,
      ...getStudyStateCounts(stateRef.current)
    });
  }

  const activeWorkspace =
    state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ??
    state.workspaces[0] ??
    emptyWorkspacePlaceholder;

  const actions = useMemo(
    () => ({
      addWorkspace(input: WorkspaceInput) {
        const workspace = createEmptyWorkspace(input);
        commitState((current) => ({
          activeWorkspaceId: workspace.id,
          workspaces: [...current.workspaces, workspace]
        }));
      },
      updateWorkspace(id: string, patch: Partial<WorkspaceInput>) {
        commitState((current) => ({
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
        commitState((current) => {
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
        commitState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            subjects: [
              ...workspace.subjects,
              {
                ...input,
                name: input.name.trim(),
                abbreviation: input.abbreviation.trim(),
                id: createCloudEntityId()
              }
            ]
          }))
        );
      },
      updateSubject(id: string, patch: Partial<Subject>) {
        commitState((current) =>
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
      deleteSubject(id: string) {
        commitState((current) =>
          updateWorkspaceData(current, (workspace) => {
            const deletedQuestionIds = new Set(
              workspace.questions
                .filter((question) => question.subjectId === id)
                .map((question) => question.id)
            );

            return {
              ...workspace,
              subjects: workspace.subjects.filter((subject) => subject.id !== id),
              questions: workspace.questions.filter((question) => question.subjectId !== id),
              sessions: workspace.sessions.map((session) =>
                session.questionId && deletedQuestionIds.has(session.questionId)
                  ? { ...session, questionId: undefined, needsReview: true }
                  : session
              )
            };
          })
        );
      },
      importExamTopics(topics: ImportedExamQuestionInput[]) {
        let subjectsCreated = 0;
        let questionsCreated = 0;

        commitState((current) =>
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
                  id: createCloudEntityId(),
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
                id: createCloudEntityId(),
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
        commitState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            questions: [
              ...workspace.questions,
              {
                ...input,
                id: createCloudEntityId(),
                totalStudyTime: 0,
                reviewCount: 0,
                createdAt: new Date().toISOString()
              }
            ]
          }))
        );
      },
      updateQuestion(id: string, patch: Partial<Question>) {
        commitState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            questions: workspace.questions.map((question) =>
              question.id === id ? { ...question, ...patch } : question
            )
          }))
        );
      },
      deleteQuestion(id: string) {
        commitState((current) =>
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
        const sessionDate = getDateOnlyValue(input.date) || getDateOnlyValue(input.startedAt);
        commitState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            sessions: [{ ...input, date: sessionDate, id: createCloudEntityId() }, ...workspace.sessions],
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
        const normalizedDate = getDateOnlyValue(patch.date) || (patch.startedAt ? getDateOnlyValue(patch.startedAt) : "");
        const normalizedPatch = normalizedDate ? { ...patch, date: normalizedDate } : patch;
        commitState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            sessions: workspace.sessions.map((session) =>
              session.id === id ? { ...session, ...normalizedPatch } : session
            )
          }))
        );
      },
      deleteSession(id: string) {
        commitState((current) =>
          updateWorkspaceData(current, (workspace) => ({
            ...workspace,
            sessions: workspace.sessions.filter((session) => session.id !== id)
          }))
        );
      },
      updateSettings(settings: AppData["settings"]) {
        commitState((current) =>
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
      reloadFromCloud,
      migrateLocalDataToCloud,
      dismissLocalMigration,
      replaceStudyState(nextState: AppState) {
        persistState(normalizeStateForCloud(nextState));
      },
      resetAppData() {
        localStudyRepository.clear();
        backupService.clearAllBackupData();
        setAutomaticBackupsEnabledState(false);
        persistState(emptyAppState);
      },
      resetDemoData() {
        commitState((current) =>
          normalizeStateForCloud(
            updateWorkspaceData(current, (workspace) => ({
              ...workspace,
              ...initialData,
              examDate: initialData.settings.examDate
            }))
          )
        );
      }
    }),
    [user]
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
      storageError,
      syncStatus,
      pendingLocalMigration,
      ...actions,
      ...helpers
    }),
    [
      actions,
      activeWorkspace,
      automaticBackupsEnabled,
      helpers,
      hydrated,
      pendingLocalMigration,
      state.activeWorkspaceId,
      state.workspaces,
      storageError,
      syncStatus
    ]
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
