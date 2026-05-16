import { AppState } from "@/types/study";
import { studyStorageService } from "./studyStorageService";

export type StudyRepository = {
  load(): AppState;
  save(data: AppState): void;
  clear(): void;
};

export const localStudyRepository: StudyRepository = {
  load() {
    return studyStorageService.read();
  },
  save(data) {
    studyStorageService.write(data);
  },
  clear() {
    studyStorageService.clear();
  }
};

// Local storage is now only an optional cache and backup import/export source.
// Supabase cloud storage is implemented in supabaseStudyRepository.
