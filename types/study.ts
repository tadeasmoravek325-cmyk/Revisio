export type Difficulty = "easy" | "medium" | "hard";
export type Importance = "low" | "medium" | "high";
export type QuestionStatus = "unknown" | "partial" | "known";
export type StudySessionType = "reading" | "active_recall" | "revision" | "test" | "summary";

export type Subject = {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
};

export type Workspace = {
  id: string;
  name: string;
  description: string;
  examDate: string;
  createdAt: string;
  color?: string;
};

export type Question = {
  id: string;
  subjectId: string;
  number: number;
  title: string;
  notes?: string;
  tags: string[];
  difficulty: Difficulty;
  importance: Importance;
  status: QuestionStatus;
  totalStudyTime: number;
  reviewCount: number;
  createdAt: string;
};

export type StudySession = {
  id: string;
  questionId?: string;
  date?: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  type: StudySessionType;
  note?: string;
  needsReview?: boolean;
};

export type Settings = {
  examDate: string;
  pomodoroWorkMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroLongBreakAfter: number;
  pomodoroBreakMinutes: number;
  dailyStudyTargetMinutes: number;
  dailyPomodoroTargetIntervals: number;
  soundEnabled: boolean;
  notificationSound: "bell" | "chime" | "beep" | "alarm";
};

export type AppData = {
  subjects: Subject[];
  questions: Question[];
  sessions: StudySession[];
  settings: Settings;
};

export type StudyWorkspace = Workspace & AppData;

export type AppState = {
  activeWorkspaceId: string;
  workspaces: StudyWorkspace[];
};
