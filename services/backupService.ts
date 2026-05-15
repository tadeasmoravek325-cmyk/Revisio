import { AppState } from "@/types/study";
import { localStorageService, StorageService } from "./localStorageService";
import { migrateStudyState } from "./studyStorageService";

const BACKUP_SETTINGS_KEY = "revisio-backup-settings-v1";
const BACKUP_SNAPSHOTS_KEY = "revisio-auto-backup-snapshots-v1";
const LEGACY_THEME_KEY = "statnice-tracker-theme";
const STUDY_DATA_KEY = "statnice-tracker-data-v3";
const backupVersion = 1;
const maxSnapshots = 10;
const minSnapshotIntervalMs = 10 * 60 * 1000;

export type RevisioBackup = {
  app: "Revisio";
  version: number;
  exportedAt: string;
  data: AppState;
};

export type BackupSnapshot = {
  id: string;
  createdAt: string;
  data: AppState;
};

type BackupSettings = {
  automaticBackupsEnabled: boolean;
};

function readJson<T>(storage: StorageService, key: string, fallback: T): T {
  const value = storage.getItem(key);
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createBackupEnvelope(data: AppState): RevisioBackup {
  return {
    app: "Revisio",
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    data
  };
}

function validateAppState(data: AppState) {
  data.workspaces.forEach((workspace) => {
    if (!workspace.id || !workspace.name) {
      throw new Error("Backup contains an invalid workspace.");
    }
    if (
      !Array.isArray(workspace.subjects) ||
      !Array.isArray(workspace.questions) ||
      !Array.isArray(workspace.sessions) ||
      !workspace.settings
    ) {
      throw new Error("Backup workspace data is incomplete.");
    }
  });
}

export function createBackupService(storage: StorageService = localStorageService) {
  return {
    createExport(data: AppState) {
      return JSON.stringify(createBackupEnvelope(data), null, 2);
    },
    parseImport(rawJson: string) {
      const parsed = JSON.parse(rawJson) as unknown;
      const data =
        typeof parsed === "object" &&
        parsed !== null &&
        "app" in parsed &&
        "data" in parsed
          ? migrateStudyState((parsed as RevisioBackup).data)
          : migrateStudyState(parsed);

      validateAppState(data);
      return data;
    },
    getAutomaticBackupsEnabled() {
      return readJson<BackupSettings>(storage, BACKUP_SETTINGS_KEY, {
        automaticBackupsEnabled: false
      }).automaticBackupsEnabled;
    },
    setAutomaticBackupsEnabled(enabled: boolean) {
      storage.setItem(
        BACKUP_SETTINGS_KEY,
        JSON.stringify({ automaticBackupsEnabled: enabled } satisfies BackupSettings)
      );
    },
    listSnapshots() {
      return readJson<BackupSnapshot[]>(storage, BACKUP_SNAPSHOTS_KEY, []);
    },
    createSnapshot(data: AppState, force = false) {
      if (!force && !this.getAutomaticBackupsEnabled()) {
        return this.listSnapshots();
      }

      const snapshots = this.listSnapshots();
      const latest = snapshots[0];
      if (!force && latest && Date.now() - new Date(latest.createdAt).getTime() < minSnapshotIntervalMs) {
        return snapshots;
      }

      const createdAt = new Date().toISOString();
      const nextSnapshots = [
        {
          id: `snapshot-${createdAt}`,
          createdAt,
          data
        },
        ...snapshots
      ].slice(0, maxSnapshots);

      storage.setItem(BACKUP_SNAPSHOTS_KEY, JSON.stringify(nextSnapshots));
      return nextSnapshots;
    },
    clearSnapshots() {
      storage.removeItem(BACKUP_SNAPSHOTS_KEY);
    },
    clearAllBackupData() {
      storage.removeItem(STUDY_DATA_KEY);
      storage.removeItem(BACKUP_SETTINGS_KEY);
      storage.removeItem(BACKUP_SNAPSHOTS_KEY);
      storage.removeItem(LEGACY_THEME_KEY);
    }
  };
}

export const backupService = createBackupService();
