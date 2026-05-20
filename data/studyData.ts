import {
  AppData,
  AppState,
  Difficulty,
  Importance,
  QuestionStatus,
  StudyWorkspace,
  StudySessionType
} from "@/types/study";
import { addDays, toDateInputValue } from "@/utils/date";

const today = new Date();
const iso = (offsetDays: number) => toDateInputValue(addDays(today, offsetDays));

export const statusLabels: Record<QuestionStatus, string> = {
  unknown: "Unknown",
  partial: "Partial",
  known: "Known"
};

export const statusStyles: Record<QuestionStatus, string> = {
  unknown: "bg-slate-100 text-slate-700",
  partial: "bg-amber-100 text-amber-800",
  known: "bg-emerald-100 text-emerald-800"
};

export const difficultyLabels: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard"
};

export const difficultyStyles: Record<Difficulty, string> = {
  easy: "bg-emerald-100 text-emerald-800",
  medium: "bg-sky-100 text-sky-800",
  hard: "bg-rose-100 text-rose-800"
};

export const importanceLabels: Record<Importance, string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority"
};

export const importanceStyles: Record<Importance, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-indigo-100 text-indigo-800",
  high: "bg-rose-100 text-rose-800"
};

export const sessionTypeLabels: Record<StudySessionType, string> = {
  reading: "Reading",
  active_recall: "Active recall",
  revision: "Revision",
  test: "Test",
  summary: "Summary"
};

const subjects = [
  { id: "nauka-o-podniku", name: "Nauka o podniku", abbreviation: "NP", color: "#2563eb" },
  { id: "finance-podniku", name: "Finance podniku", abbreviation: "FP", color: "#d97706" },
  { id: "male-a-stredni-podnikani", name: "Malé a střední podnikání", abbreviation: "MSPO", color: "#5b6ee1" },
  { id: "ucetnictvi-1", name: "Účetnictví 1", abbreviation: "UČ1", color: "#0ea5e9" },
  { id: "ucetnictvi-2", name: "Účetnictví 2", abbreviation: "UČ2", color: "#9333ea" },
  { id: "uvod-do-managementu", name: "Úvod do managementu", abbreviation: "UM", color: "#2563eb" },
  { id: "personalni-management", name: "Personální management", abbreviation: "PM", color: "#be123c" },
  { id: "marketing", name: "Marketing", abbreviation: "M", color: "#16a34a" },
  { id: "strategicky-marketing", name: "Strategický marketing", abbreviation: "SM", color: "#ca8a04" },
  { id: "podnikove-procesy", name: "Podnikové procesy", abbreviation: "PP", color: "#0891b2" },
  { id: "podnikova-logistika", name: "Podniková logistika", abbreviation: "PL", color: "#7c3aed" }
];

type QuestionSeed = {
  subjectId: string;
  number: number;
  title: string;
  notes: string;
  tags: string[];
  difficulty: Difficulty;
  importance: Importance;
  status: QuestionStatus;
  totalStudyTime?: number;
  reviewCount?: number;
  createdOffset: number;
};

const questionSeeds: QuestionSeed[] = [
  {
    subjectId: "nauka-o-podniku",
    number: 1,
    title: "Podnik jako ekonomický systém a jeho cíle",
    notes: "Vymezit vstupy, transformační proces, výstupy a vztah k okolí.",
    tags: ["podnik", "cíle", "systém"],
    difficulty: "medium",
    importance: "high",
    status: "partial",
    totalStudyTime: 55,
    reviewCount: 2,
    createdOffset: -30
  },
  {
    subjectId: "nauka-o-podniku",
    number: 2,
    title: "Životní cyklus podniku a krizové fáze",
    notes: "Doplnit příklady růstu, stabilizace, sanace a zániku.",
    tags: ["životní cyklus", "krize", "růst"],
    difficulty: "hard",
    importance: "medium",
    status: "unknown",
    createdOffset: -27
  },
  {
    subjectId: "finance-podniku",
    number: 1,
    title: "Finanční řízení podniku a časová hodnota peněz",
    notes: "Procvičit NPV, IRR a diskontování na krátkém příkladu.",
    tags: ["NPV", "IRR", "finanční řízení"],
    difficulty: "hard",
    importance: "high",
    status: "partial",
    totalStudyTime: 70,
    reviewCount: 3,
    createdOffset: -25
  },
  {
    subjectId: "finance-podniku",
    number: 2,
    title: "Kapitálová struktura a náklady kapitálu",
    notes: "Umět vysvětlit vlastní a cizí kapitál, WACC a finanční páku.",
    tags: ["WACC", "kapitál", "páka"],
    difficulty: "hard",
    importance: "high",
    status: "unknown",
    createdOffset: -22
  },
  {
    subjectId: "male-a-stredni-podnikani",
    number: 1,
    title: "Specifika malých a středních podniků v ekonomice",
    notes: "Připravit výhody, nevýhody a roli MSP na trhu práce.",
    tags: ["MSP", "podnikání", "ekonomika"],
    difficulty: "medium",
    importance: "high",
    status: "known",
    totalStudyTime: 40,
    reviewCount: 2,
    createdOffset: -24
  },
  {
    subjectId: "male-a-stredni-podnikani",
    number: 2,
    title: "Podnikatelský plán a zakladatelský rozpočet",
    notes: "Zopakovat strukturu plánu, analýzu trhu a cash-flow začátku podnikání.",
    tags: ["business plan", "rozpočet", "startup"],
    difficulty: "medium",
    importance: "medium",
    status: "partial",
    totalStudyTime: 25,
    reviewCount: 1,
    createdOffset: -20
  },
  {
    subjectId: "ucetnictvi-1",
    number: 1,
    title: "Rozvaha, aktiva, pasiva a bilanční princip",
    notes: "Umět rychle zařadit položky do aktiv a pasiv.",
    tags: ["rozvaha", "aktiva", "pasiva"],
    difficulty: "easy",
    importance: "high",
    status: "known",
    totalStudyTime: 45,
    reviewCount: 3,
    createdOffset: -28
  },
  {
    subjectId: "ucetnictvi-1",
    number: 2,
    title: "Účetní doklady, účetní knihy a účetní zápisy",
    notes: "Doplnit povinné náležitosti účetních dokladů.",
    tags: ["doklady", "deník", "hlavní kniha"],
    difficulty: "medium",
    importance: "medium",
    status: "partial",
    totalStudyTime: 30,
    reviewCount: 1,
    createdOffset: -23
  },
  {
    subjectId: "ucetnictvi-2",
    number: 1,
    title: "Náklady, výnosy a výsledek hospodaření",
    notes: "Rozlišit časové rozlišení a dopad na výsledek hospodaření.",
    tags: ["náklady", "výnosy", "výsledek"],
    difficulty: "medium",
    importance: "high",
    status: "partial",
    totalStudyTime: 35,
    reviewCount: 2,
    createdOffset: -21
  },
  {
    subjectId: "ucetnictvi-2",
    number: 2,
    title: "Účetní závěrka a její výkazy",
    notes: "Propojit rozvahu, výsledovku a přílohu.",
    tags: ["závěrka", "výkazy", "výsledovka"],
    difficulty: "hard",
    importance: "high",
    status: "unknown",
    createdOffset: -18
  },
  {
    subjectId: "uvod-do-managementu",
    number: 1,
    title: "Manažerské funkce a role manažera",
    notes: "Popsat plánování, organizování, vedení a kontrolu.",
    tags: ["management", "funkce", "role"],
    difficulty: "easy",
    importance: "high",
    status: "known",
    totalStudyTime: 30,
    reviewCount: 2,
    createdOffset: -19
  },
  {
    subjectId: "uvod-do-managementu",
    number: 2,
    title: "Rozhodování v managementu a rozhodovací proces",
    notes: "Zopakovat racionální model a riziko při rozhodování.",
    tags: ["rozhodování", "riziko", "proces"],
    difficulty: "medium",
    importance: "medium",
    status: "partial",
    totalStudyTime: 20,
    reviewCount: 1,
    createdOffset: -16
  },
  {
    subjectId: "personalni-management",
    number: 1,
    title: "Získávání a výběr zaměstnanců",
    notes: "Připravit metody výběru a kritéria hodnocení kandidátů.",
    tags: ["HR", "nábor", "výběr"],
    difficulty: "medium",
    importance: "high",
    status: "partial",
    totalStudyTime: 25,
    reviewCount: 1,
    createdOffset: -17
  },
  {
    subjectId: "personalni-management",
    number: 2,
    title: "Motivace, odměňování a hodnocení pracovníků",
    notes: "Propojit motivační teorie s praktickým systémem odměňování.",
    tags: ["motivace", "odměňování", "hodnocení"],
    difficulty: "hard",
    importance: "high",
    status: "unknown",
    createdOffset: -14
  },
  {
    subjectId: "marketing",
    number: 1,
    title: "Marketingový mix a segmentace trhu",
    notes: "Umět vysvětlit 4P a návaznost na cílový segment.",
    tags: ["4P", "segmentace", "trh"],
    difficulty: "easy",
    importance: "high",
    status: "known",
    totalStudyTime: 50,
    reviewCount: 3,
    createdOffset: -26
  },
  {
    subjectId: "marketing",
    number: 2,
    title: "Chování zákazníka a nákupní rozhodovací proces",
    notes: "Doplnit faktory ovlivňující spotřebitelské chování.",
    tags: ["zákazník", "nákup", "chování"],
    difficulty: "medium",
    importance: "medium",
    status: "partial",
    totalStudyTime: 20,
    reviewCount: 1,
    createdOffset: -13
  },
  {
    subjectId: "strategicky-marketing",
    number: 1,
    title: "Strategická situační analýza a marketingové cíle",
    notes: "Připravit SWOT, PEST a Porterův model pěti sil.",
    tags: ["SWOT", "PEST", "Porter"],
    difficulty: "hard",
    importance: "high",
    status: "partial",
    totalStudyTime: 60,
    reviewCount: 2,
    createdOffset: -15
  },
  {
    subjectId: "strategicky-marketing",
    number: 2,
    title: "Positioning, targeting a marketingová strategie",
    notes: "Vysvětlit vazbu STP na hodnotovou nabídku.",
    tags: ["STP", "positioning", "strategie"],
    difficulty: "hard",
    importance: "medium",
    status: "unknown",
    createdOffset: -12
  },
  {
    subjectId: "podnikove-procesy",
    number: 1,
    title: "Procesní řízení a modelování podnikových procesů",
    notes: "Zopakovat vstupy, výstupy, vlastníka procesu a KPI.",
    tags: ["procesy", "KPI", "modelování"],
    difficulty: "medium",
    importance: "high",
    status: "partial",
    totalStudyTime: 35,
    reviewCount: 1,
    createdOffset: -11
  },
  {
    subjectId: "podnikove-procesy",
    number: 2,
    title: "Optimalizace procesů a principy lean managementu",
    notes: "Umět uvést typy plýtvání a postup zlepšování procesu.",
    tags: ["lean", "optimalizace", "plýtvání"],
    difficulty: "hard",
    importance: "medium",
    status: "unknown",
    createdOffset: -9
  },
  {
    subjectId: "podnikova-logistika",
    number: 1,
    title: "Logistický řetězec a řízení zásob",
    notes: "Procvičit pojistnou zásobu, obrátku zásob a objednací hladinu.",
    tags: ["logistika", "zásoby", "řetězec"],
    difficulty: "medium",
    importance: "high",
    status: "partial",
    totalStudyTime: 45,
    reviewCount: 2,
    createdOffset: -10
  },
  {
    subjectId: "podnikova-logistika",
    number: 2,
    title: "Doprava, skladování a distribuční strategie",
    notes: "Porovnat druhy dopravy a základní skladovací náklady.",
    tags: ["doprava", "skladování", "distribuce"],
    difficulty: "medium",
    importance: "medium",
    status: "unknown",
    createdOffset: -7
  }
];

const questions = questionSeeds.map(({ createdOffset, ...question }, index) => ({
  id: `q-${index + 1}`,
  totalStudyTime: 0,
  reviewCount: 0,
  ...question,
  createdAt: iso(createdOffset)
}));

export const initialData: AppData = {
  subjects,
  questions,
  sessions: [
    {
      id: "s-1",
      questionId: "q-1",
      startedAt: `${iso(-6)}T08:30:00.000Z`,
      endedAt: `${iso(-6)}T09:05:00.000Z`,
      durationMinutes: 35,
      type: "active_recall",
      note: "Zopakovat definice a okolí podniku."
    },
    {
      id: "s-2",
      questionId: "q-3",
      startedAt: `${iso(-5)}T14:00:00.000Z`,
      endedAt: `${iso(-5)}T14:40:00.000Z`,
      durationMinutes: 40,
      type: "test",
      note: "Počítání investičního příkladu."
    },
    {
      id: "s-3",
      questionId: "q-7",
      startedAt: `${iso(-3)}T10:00:00.000Z`,
      endedAt: `${iso(-3)}T10:25:00.000Z`,
      durationMinutes: 25,
      type: "revision",
      note: "Rychlé třídění položek rozvahy."
    },
    {
      id: "s-4",
      questionId: "q-15",
      startedAt: `${iso(-1)}T16:10:00.000Z`,
      endedAt: `${iso(-1)}T16:35:00.000Z`,
      durationMinutes: 25,
      type: "active_recall",
      note: "Marketingový mix bez nápovědy."
    }
  ],
  settings: {
    examDate: iso(43),
    pomodoroWorkMinutes: 25,
    pomodoroShortBreakMinutes: 5,
    pomodoroLongBreakMinutes: 15,
    pomodoroLongBreakAfter: 4,
    pomodoroBreakMinutes: 5,
    dailyStudyTargetMinutes: 120,
    dailyPomodoroTargetIntervals: 6,
    soundEnabled: true,
    notificationSound: "bell"
  }
};

export const initialWorkspace: StudyWorkspace = {
  id: "default-workspace",
  name: "Státnice Bc.",
  description: "Default study preparation",
  examDate: initialData.settings.examDate,
  createdAt: today.toISOString(),
  color: "#2563eb",
  ...initialData
};

export const initialAppState: AppState = {
  activeWorkspaceId: initialWorkspace.id,
  workspaces: [initialWorkspace]
};

export const emptyAppState: AppState = {
  activeWorkspaceId: "",
  workspaces: []
};
