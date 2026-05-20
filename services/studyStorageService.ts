import { emptyAppState, initialData } from "@/data/studyData";
import { AppData, AppState, StudyWorkspace } from "@/types/study";
import {
  ensureUniqueSubjectAbbreviation,
  getSubjectAbbreviationFallback
} from "@/utils/subjects";
import { localStorageService, StorageService } from "./localStorageService";

export const STUDY_DATA_STORAGE_KEY = "statnice-tracker-data-v3";

export type StudyStorageService = {
  read(): AppState;
  write(data: AppState): void;
  clear(): void;
};

export function hasWorkspaceShape(value: unknown): value is AppState {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as AppState).workspaces) &&
    typeof (value as AppState).activeWorkspaceId === "string"
  );
}

function migrateSubjects(data: AppData): AppData {
  const migratedSubjects = data.subjects.reduce<AppData["subjects"]>((subjects, subject) => {
    const fallback = getSubjectAbbreviationFallback(subject);
    const abbreviation = ensureUniqueSubjectAbbreviation(
      (subject.abbreviation ?? fallback).trim() || fallback,
      subjects,
      subject.id
    );

    return [
      ...subjects,
      {
        ...subject,
        name: subject.name.trim(),
        abbreviation
      }
    ];
  }, []);

  return {
    ...data,
    subjects: migratedSubjects
  };
}

function createDefaultWorkspace(data: AppData): StudyWorkspace {
  const migratedData = migrateSubjects(data);

  return {
    id: "default-workspace",
    name: "Státnice Bc.",
    description: "Migrated study preparation",
    examDate: migratedData.settings.examDate,
    createdAt: new Date().toISOString(),
    color: "#2563eb",
    ...migratedData
  };
}

function migrateWorkspace(workspace: StudyWorkspace): StudyWorkspace {
  const migratedData = migrateSubjects(workspace);
  const examDate = workspace.examDate || migratedData.settings.examDate;
  const pomodoroShortBreakMinutes =
    migratedData.settings.pomodoroShortBreakMinutes ?? migratedData.settings.pomodoroBreakMinutes ?? 5;

  return {
    ...workspace,
    ...migratedData,
    name: workspace.name.trim() || "Untitled workspace",
    description: workspace.description ?? "",
    examDate,
    createdAt: workspace.createdAt || new Date().toISOString(),
    settings: {
      ...migratedData.settings,
      examDate,
      pomodoroShortBreakMinutes,
      pomodoroBreakMinutes: pomodoroShortBreakMinutes,
      pomodoroLongBreakMinutes: migratedData.settings.pomodoroLongBreakMinutes ?? 15,
      pomodoroLongBreakAfter: migratedData.settings.pomodoroLongBreakAfter ?? 4,
      dailyStudyTargetMinutes: migratedData.settings.dailyStudyTargetMinutes ?? 120,
      dailyPomodoroTargetIntervals: migratedData.settings.dailyPomodoroTargetIntervals ?? 6,
      notificationSound: migratedData.settings.notificationSound ?? "beep"
    }
  };
}

function hasLegacyStudyDataShape(value: unknown): value is AppData {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as AppData).subjects) &&
    Array.isArray((value as AppData).questions) &&
    Array.isArray((value as AppData).sessions) &&
    typeof (value as AppData).settings === "object" &&
    (value as AppData).settings !== null
  );
}

export function migrateStudyState(value: unknown): AppState {
  if (hasWorkspaceShape(value)) {
    if (!value.workspaces.length) {
      return emptyAppState;
    }

    const workspaces = value.workspaces.map(migrateWorkspace);
    const activeWorkspaceId = workspaces.some((workspace) => workspace.id === value.activeWorkspaceId)
      ? value.activeWorkspaceId
      : workspaces[0].id;

    return { activeWorkspaceId, workspaces };
  }

  if (hasLegacyStudyDataShape(value)) {
    return {
      activeWorkspaceId: "default-workspace",
      workspaces: [createDefaultWorkspace(value)]
    };
  }

  throw new Error("Invalid Revisio backup structure.");
}

export function createStudyStorageService(
  storage: StorageService = localStorageService
): StudyStorageService {
  return {
    read() {
      const saved = storage.getItem(STUDY_DATA_STORAGE_KEY);
      if (!saved) {
        return emptyAppState;
      }

      try {
        return migrateStudyState(JSON.parse(saved));
      } catch {
        return {
          activeWorkspaceId: "default-workspace",
          workspaces: [createDefaultWorkspace(initialData)]
        };
      }
    },
    write(data) {
      storage.setItem(STUDY_DATA_STORAGE_KEY, JSON.stringify(data));
    },
    clear() {
      storage.removeItem(STUDY_DATA_STORAGE_KEY);
    }
  };
}

export const studyStorageService = createStudyStorageService();
