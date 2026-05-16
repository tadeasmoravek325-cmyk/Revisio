"use client";

import { emptyAppState, initialData } from "@/data/studyData";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  AppState,
  Difficulty,
  Importance,
  Question,
  QuestionStatus,
  Settings,
  StudySession,
  StudySessionType,
  StudyWorkspace,
  Subject
} from "@/types/study";
import { getDateOnlyValue } from "@/utils/date";
import { getSubjectAbbreviationFallback } from "@/utils/subjects";

type WorkspaceRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  exam_date: string | null;
  color: string | null;
  settings: Partial<Settings> | null;
  created_at: string;
};

type SubjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  abbreviation: string | null;
  color: string | null;
};

type QuestionRow = {
  id: string;
  subject_id: string;
  number: number | null;
  title: string;
  content: string | null;
  completed: boolean | null;
  tags: string[] | null;
  difficulty: string | null;
  importance: string | null;
  status: string | null;
  total_study_time: number | null;
  review_count: number | null;
  created_at: string;
};

type StudySessionRow = {
  id: string;
  workspace_id: string;
  question_id: string | null;
  session_date: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number | null;
  type: string | null;
  note: string | null;
  needs_review: boolean | null;
};

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const importances: Importance[] = ["low", "medium", "high"];
const statuses: QuestionStatus[] = ["unknown", "partial", "known"];
const sessionTypes: StudySessionType[] = ["reading", "active_recall", "revision", "test", "summary"];

function getSupabaseErrorMessage(error: unknown) {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeError = error as { message?: string; details?: string; hint?: string; code?: string };
    return [maybeError.message, maybeError.details, maybeError.hint, maybeError.code].filter(Boolean).join(" ");
  }

  return String(error);
}

function isMissingColumnError(error: unknown) {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  return (
    message.includes("could not find") ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

function logSupabaseStudy(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[Revisio supabase study] ${message}`, details);
  }
}

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  throw new Error("This browser cannot create secure UUIDs.");
}

function ensureUuid(id: string, idMap: Map<string, string>) {
  if (uuidPattern.test(id)) {
    return id;
  }

  const existing = idMap.get(id);
  if (existing) {
    return existing;
  }

  const nextId = createUuid();
  idMap.set(id, nextId);
  return nextId;
}

export function createCloudEntityId() {
  return createUuid();
}

export function normalizeStateForCloud(state: AppState): AppState {
  const workspaceIds = new Map<string, string>();
  const subjectIds = new Map<string, string>();
  const questionIds = new Map<string, string>();
  const sessionIds = new Map<string, string>();

  const workspaces = state.workspaces.map((workspace) => {
    const workspaceId = ensureUuid(workspace.id, workspaceIds);

    const subjects = workspace.subjects.map((subject) => ({
      ...subject,
      id: ensureUuid(subject.id, subjectIds)
    }));

    const questions = workspace.questions.map((question) => ({
      ...question,
      id: ensureUuid(question.id, questionIds),
      subjectId: ensureUuid(question.subjectId, subjectIds)
    }));

    const sessions = workspace.sessions.map((session) => ({
      ...session,
      id: ensureUuid(session.id, sessionIds),
      date: getDateOnlyValue(session.date) || getDateOnlyValue(session.startedAt),
      questionId: session.questionId ? ensureUuid(session.questionId, questionIds) : undefined
    }));

    return {
      ...workspace,
      id: workspaceId,
      subjects,
      questions,
      sessions
    };
  });

  return {
    activeWorkspaceId: state.activeWorkspaceId
      ? ensureUuid(state.activeWorkspaceId, workspaceIds)
      : workspaces[0]?.id ?? "",
    workspaces
  };
}

function isDifficulty(value: string | null): value is Difficulty {
  return difficulties.includes(value as Difficulty);
}

function isImportance(value: string | null): value is Importance {
  return importances.includes(value as Importance);
}

function isStatus(value: string | null): value is QuestionStatus {
  return statuses.includes(value as QuestionStatus);
}

function isSessionType(value: string | null): value is StudySessionType {
  return sessionTypes.includes(value as StudySessionType);
}

async function getCurrentUserId() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user?.id as string | undefined;
}

function buildWorkspace(
  workspace: WorkspaceRow,
  subjects: Subject[],
  questions: Question[],
  sessions: StudySession[]
): StudyWorkspace {
  const settings = {
    ...initialData.settings,
    ...(workspace.settings ?? {}),
    examDate: workspace.exam_date ?? workspace.settings?.examDate ?? initialData.settings.examDate
  };

  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description ?? "",
    examDate: workspace.exam_date ?? settings.examDate,
    createdAt: workspace.created_at,
    color: workspace.color ?? "#2563eb",
    subjects,
    questions,
    sessions,
    settings
  };
}

async function deleteMissingRows(supabase: any, table: string, existingIds: string[], nextIds: string[]) {
  const nextIdSet = new Set(nextIds);
  const idsToDelete = existingIds.filter((id) => !nextIdSet.has(id));

  if (!idsToDelete.length) {
    return;
  }

  const { error } = await supabase.from(table).delete().in("id", idsToDelete);
  if (error) {
    throw error;
  }
}

async function selectWithFallback<T>(
  queryFactory: (columns: string) => Promise<SupabaseResult<T>>,
  fullColumns: string,
  fallbackColumns: string,
  context: Record<string, unknown>
) {
  const fullResult = await queryFactory(fullColumns);

  if (!fullResult.error) {
    return fullResult.data ?? ([] as T);
  }

  if (!isMissingColumnError(fullResult.error)) {
    throw fullResult.error;
  }

  logSupabaseStudy("Falling back to minimal select", {
    ...context,
    error: getSupabaseErrorMessage(fullResult.error)
  });

  const fallbackResult = await queryFactory(fallbackColumns);
  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return fallbackResult.data ?? ([] as T);
}

async function upsertWithFallback(
  supabase: any,
  table: string,
  fullRows: Array<Record<string, unknown>>,
  fallbackRows: Array<Record<string, unknown>>,
  context: Record<string, unknown>
) {
  if (!fullRows.length) {
    return;
  }

  const fullResult = await supabase.from(table).upsert(fullRows, { onConflict: "id" });
  if (!fullResult.error) {
    return;
  }

  if (!isMissingColumnError(fullResult.error)) {
    throw fullResult.error;
  }

  logSupabaseStudy("Falling back to minimal upsert", {
    ...context,
    table,
    error: getSupabaseErrorMessage(fullResult.error)
  });

  const fallbackResult = await supabase.from(table).upsert(fallbackRows, { onConflict: "id" });
  if (fallbackResult.error) {
    throw fallbackResult.error;
  }
}

export const supabaseStudyRepository = {
  async load(): Promise<AppState> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return emptyAppState;
    }

    const supabase = await getSupabaseClient();
    const workspaces = (await selectWithFallback<WorkspaceRow[]>(
      (columns) =>
        supabase
          .from("workspaces")
          .select(columns)
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
      "id,user_id,name,description,exam_date,color,settings,created_at",
      "id,user_id,name,description,exam_date,created_at",
      { table: "workspaces", userId }
    )) as WorkspaceRow[];

    if (!workspaces.length) {
      return emptyAppState;
    }

    const workspaceIds = workspaces.map((workspace) => workspace.id);

    const subjects = (await selectWithFallback<SubjectRow[]>(
      (columns) => supabase.from("subjects").select(columns).in("workspace_id", workspaceIds),
      "id,workspace_id,name,abbreviation,color",
      "id,workspace_id,name,color",
      { table: "subjects", userId, workspaceCount: workspaceIds.length }
    )) as SubjectRow[];
    const subjectIds = subjects.map((subject) => subject.id);

    const questionRows = subjectIds.length
      ? await selectWithFallback<QuestionRow[]>(
          (columns) => supabase.from("questions").select(columns).in("subject_id", subjectIds),
          "id,subject_id,number,title,content,completed,tags,difficulty,importance,status,total_study_time,review_count,created_at",
          "id,subject_id,title,content,completed,created_at",
          { table: "questions", userId, subjectCount: subjectIds.length }
        )
      : [];

    const sessionRows = (await selectWithFallback<StudySessionRow[]>(
      (columns) => supabase.from("study_sessions").select(columns).in("workspace_id", workspaceIds),
      "id,workspace_id,question_id,session_date,started_at,ended_at,duration_minutes,type,note,needs_review",
      "id,workspace_id,question_id,started_at,ended_at,duration_minutes,type",
      { table: "study_sessions", userId, workspaceCount: workspaceIds.length }
    )) as StudySessionRow[];

    const questions = (questionRows ?? []) as QuestionRow[];
    const sessions = (sessionRows ?? []) as StudySessionRow[];

    const appWorkspaces = workspaces.map((workspace) => {
      const workspaceSubjects = subjects
        .filter((subject) => subject.workspace_id === workspace.id)
        .map<Subject>((subject) => ({
          id: subject.id,
          name: subject.name,
          abbreviation: subject.abbreviation ?? getSubjectAbbreviationFallback(subject),
          color: subject.color ?? "#2563eb"
        }));

      const workspaceSubjectIds = new Set(workspaceSubjects.map((subject) => subject.id));
      const workspaceQuestions = questions
        .filter((question) => workspaceSubjectIds.has(question.subject_id))
        .map<Question>((question) => ({
          id: question.id,
          subjectId: question.subject_id,
          number: question.number ?? 1,
          title: question.title,
          notes: question.content ?? "",
          tags: question.tags ?? [],
          difficulty: isDifficulty(question.difficulty) ? question.difficulty : "medium",
          importance: isImportance(question.importance) ? question.importance : "medium",
          status: isStatus(question.status)
            ? question.status
            : question.completed
              ? "known"
              : "unknown",
          totalStudyTime: question.total_study_time ?? 0,
          reviewCount: question.review_count ?? 0,
          createdAt: question.created_at
        }));

      const workspaceSessions = sessions
        .filter((session) => session.workspace_id === workspace.id)
        .map<StudySession>((session) => ({
          id: session.id,
          questionId: session.question_id ?? undefined,
          date: getDateOnlyValue(session.session_date ?? undefined) || getDateOnlyValue(session.started_at),
          startedAt: session.started_at,
          endedAt: session.ended_at,
          durationMinutes: session.duration_minutes ?? 0,
          type: isSessionType(session.type) ? session.type : "active_recall",
          note: session.note ?? "",
          needsReview: session.needs_review ?? false
        }));

      return buildWorkspace(workspace, workspaceSubjects, workspaceQuestions, workspaceSessions);
    });

    return {
      activeWorkspaceId: appWorkspaces[0]?.id ?? "",
      workspaces: appWorkspaces
    };
  },

  async save(state: AppState): Promise<AppState> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return emptyAppState;
    }

    const supabase = await getSupabaseClient();
    const normalizedState = normalizeStateForCloud(state);
    const counts = normalizedState.workspaces.reduce(
      (sum, workspace) => ({
        workspaces: sum.workspaces + 1,
        subjects: sum.subjects + workspace.subjects.length,
        questions: sum.questions + workspace.questions.length,
        sessions: sum.sessions + workspace.sessions.length
      }),
      { workspaces: 0, subjects: 0, questions: 0, sessions: 0 }
    );

    logSupabaseStudy("save started", {
      userId,
      ...counts
    });

    const { data: existingWorkspaceRows, error: existingWorkspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", userId);

    if (existingWorkspaceError) {
      throw existingWorkspaceError;
    }

    await deleteMissingRows(
      supabase,
      "workspaces",
      ((existingWorkspaceRows ?? []) as Array<{ id: string }>).map((row) => row.id),
      normalizedState.workspaces.map((workspace) => workspace.id)
    );

    for (const workspace of normalizedState.workspaces) {
      await upsertWithFallback(
        supabase,
        "workspaces",
        [{
          id: workspace.id,
          user_id: userId,
          name: workspace.name,
          description: workspace.description,
          exam_date: workspace.examDate || null,
          color: workspace.color ?? "#2563eb",
          settings: workspace.settings,
          created_at: workspace.createdAt || new Date().toISOString()
        }],
        [{
          id: workspace.id,
          user_id: userId,
          name: workspace.name,
          description: workspace.description,
          exam_date: workspace.examDate || null,
          created_at: workspace.createdAt || new Date().toISOString()
        }],
        { table: "workspaces", userId, workspaceId: workspace.id }
      );

      const { data: existingSubjects, error: existingSubjectsError } = await supabase
        .from("subjects")
        .select("id")
        .eq("workspace_id", workspace.id);

      if (existingSubjectsError) {
        throw existingSubjectsError;
      }

      await deleteMissingRows(
        supabase,
        "subjects",
        ((existingSubjects ?? []) as Array<{ id: string }>).map((row) => row.id),
        workspace.subjects.map((subject) => subject.id)
      );

      if (workspace.subjects.length) {
        await upsertWithFallback(
          supabase,
          "subjects",
          workspace.subjects.map((subject) => ({
            id: subject.id,
            workspace_id: workspace.id,
            name: subject.name,
            abbreviation: subject.abbreviation,
            color: subject.color
          })),
          workspace.subjects.map((subject) => ({
            id: subject.id,
            workspace_id: workspace.id,
            name: subject.name,
            color: subject.color
          })),
          { table: "subjects", userId, workspaceId: workspace.id, subjectCount: workspace.subjects.length }
        );
      }

      const subjectIds = workspace.subjects.map((subject) => subject.id);
      const { data: existingQuestions, error: existingQuestionsError } = subjectIds.length
        ? await supabase.from("questions").select("id").in("subject_id", subjectIds)
        : { data: [], error: null };

      if (existingQuestionsError) {
        throw existingQuestionsError;
      }

      await deleteMissingRows(
        supabase,
        "questions",
        ((existingQuestions ?? []) as Array<{ id: string }>).map((row) => row.id),
        workspace.questions.map((question) => question.id)
      );

      if (workspace.questions.length) {
        await upsertWithFallback(
          supabase,
          "questions",
          workspace.questions.map((question) => ({
            id: question.id,
            subject_id: question.subjectId,
            number: question.number,
            title: question.title,
            content: question.notes ?? "",
            completed: question.status === "known",
            tags: question.tags,
            difficulty: question.difficulty,
            importance: question.importance,
            status: question.status,
            total_study_time: question.totalStudyTime,
            review_count: question.reviewCount,
            created_at: question.createdAt
          })),
          workspace.questions.map((question) => ({
            id: question.id,
            subject_id: question.subjectId,
            title: question.title,
            content: question.notes ?? "",
            completed: question.status === "known",
            created_at: question.createdAt
          })),
          { table: "questions", userId, workspaceId: workspace.id, questionCount: workspace.questions.length }
        );
      }

      const { data: existingSessions, error: existingSessionsError } = await supabase
        .from("study_sessions")
        .select("id")
        .eq("workspace_id", workspace.id);

      if (existingSessionsError) {
        throw existingSessionsError;
      }

      await deleteMissingRows(
        supabase,
        "study_sessions",
        ((existingSessions ?? []) as Array<{ id: string }>).map((row) => row.id),
        workspace.sessions.map((session) => session.id)
      );

      if (workspace.sessions.length) {
        await upsertWithFallback(
          supabase,
          "study_sessions",
          workspace.sessions.map((session) => ({
            id: session.id,
            workspace_id: workspace.id,
            question_id: session.questionId ?? null,
            session_date: getDateOnlyValue(session.date) || getDateOnlyValue(session.startedAt),
            started_at: session.startedAt,
            ended_at: session.endedAt,
            duration_minutes: session.durationMinutes,
            type: session.type,
            note: session.note ?? "",
            needs_review: session.needsReview ?? false
          })),
          workspace.sessions.map((session) => ({
            id: session.id,
            workspace_id: workspace.id,
            question_id: session.questionId ?? null,
            started_at: session.startedAt,
            ended_at: session.endedAt,
            duration_minutes: session.durationMinutes,
            type: session.type
          })),
          { table: "study_sessions", userId, workspaceId: workspace.id, sessionCount: workspace.sessions.length }
        );
      }
    }

    logSupabaseStudy("save succeeded", {
      userId,
      ...counts
    });

    // TODO: Replace whole-state saves with realtime-aware row mutations when cloud sync becomes collaborative.
    return normalizedState;
  },

  async clear(): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return;
    }

    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("workspaces").delete().eq("user_id", userId);

    if (error) {
      throw error;
    }
  }
};
