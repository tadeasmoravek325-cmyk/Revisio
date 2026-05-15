export type Difficulty = "easy" | "medium" | "hard";
export type Importance = "low" | "medium" | "high";
export type QuestionStatus = "unknown" | "partial" | "known";
export type StudySessionType = "reading" | "active_recall" | "revision" | "test";

export type Subject = {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
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
  questionId: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  type: StudySessionType;
  note?: string;
};

export type Settings = {
  examDate: string;
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  soundEnabled: boolean;
};

export type AppData = {
  subjects: Subject[];
  questions: Question[];
  sessions: StudySession[];
  settings: Settings;
};
