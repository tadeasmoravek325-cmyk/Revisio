import { initialData } from "@/data/studyData";
import { AppData } from "@/types/study";
import {
  ensureUniqueSubjectAbbreviation,
  getSubjectAbbreviationFallback
} from "@/utils/subjects";
import { localStorageService, StorageService } from "./localStorageService";

export const STUDY_DATA_STORAGE_KEY = "statnice-tracker-data-v3";

export type StudyStorageService = {
  read(): AppData;
  write(data: AppData): void;
  clear(): void;
};

function migrateStudyData(data: AppData): AppData {
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

export function createStudyStorageService(
  storage: StorageService = localStorageService
): StudyStorageService {
  return {
    read() {
      const saved = storage.getItem(STUDY_DATA_STORAGE_KEY);
      if (!saved) {
        return initialData;
      }

      try {
        return migrateStudyData(JSON.parse(saved) as AppData);
      } catch {
        return initialData;
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
