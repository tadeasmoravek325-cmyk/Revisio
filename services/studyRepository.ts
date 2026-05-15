import { AppData } from "@/types/study";
import { studyStorageService } from "./studyStorageService";

export type StudyRepository = {
  load(): AppData;
  save(data: AppData): void;
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

// Future Supabase integration can implement StudyRepository with async API calls,
// then the hook can swap repositories without changing page components.
