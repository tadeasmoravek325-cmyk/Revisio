import { Subject } from "@/types/study";

export type ParsedExamTopic = {
  id: string;
  subjectName: string;
  subjectAbbreviation: string;
  questionNumber: number;
  questionTitle: string;
  confidence: "high" | "medium" | "low";
  source: string;
};

const supportedTextExtensions = [".txt", ".csv", ".docx", ".pdf"];
const knownSubjectAbbreviations: Record<string, string> = {
  "nauka o podniku": "NP",
  "finance podniku": "FP",
  "malé a střední podnikání": "MSPO",
  "male a stredni podnikani": "MSPO",
  "účetnictví i": "UČ1",
  "ucetnictvi i": "UČ1",
  "účetnictví 1": "UČ1",
  "ucetnictvi 1": "UČ1",
  "účetnictví ii": "UČ2",
  "ucetnictvi ii": "UČ2",
  "účetnictví 2": "UČ2",
  "ucetnictvi 2": "UČ2",
  "úvod do managementu": "UM",
  "uvod do managementu": "UM",
  "personální management": "PM",
  "personalni management": "PM",
  marketing: "M",
  "strategický marketing": "SM",
  "strategicky marketing": "SM",
  "podnikové procesy": "PP",
  "podnikove procesy": "PP",
  "podniková logistika": "PL",
  "podnikova logistika": "PL"
};
const ignoredHeadingPatterns = [
  /okruhy pro szz/i,
  /studijn[ií] program podnikov[aá] ekonomika/i,
  /za[cč][aá]tek studia/i,
  /spole[cč]n[yý] z[aá]klad/i,
  /specializace:\s*management v[yý]roby/i,
  /specializace:\s*management slu[zž]eb/i
];

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function stripNumberPrefix(value: string) {
  return value.replace(/^\s*(?:ot[aá]zka\s*)?\d+\s*[.)\-:]\s*/i, "").trim();
}

function createImportId(index: number) {
  return `topic-${Date.now().toString(36)}-${index}`;
}

export function getExamTopicFileSupportMessage() {
  return "PDF, DOCX, TXT, CSV, JPG, PNG, WEBP, and HEIC are supported. Image imports use browser OCR before preview.";
}

export function isSupportedExamTopicFile(file: File) {
  const lowerName = file.name.toLocaleLowerCase();
  return supportedTextExtensions.some((extension) => lowerName.endsWith(extension));
}

export function generateImportAbbreviation(subjectName: string, fallbackIndex: number) {
  const known = knownSubjectAbbreviations[normalize(subjectName)];
  if (known) {
    return known;
  }

  const words = subjectName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const generated = words.map((word) => word[0]).join("").toLocaleUpperCase();
  return (generated || `S${fallbackIndex}`).slice(0, 8);
}

export function ensureUniqueImportAbbreviations(
  topics: ParsedExamTopic[],
  existingSubjects: Subject[]
) {
  const used = new Set(existingSubjects.map((subject) => normalize(subject.abbreviation)));
  const subjectToAbbreviation = new Map<string, string>();

  return topics.map((topic) => {
    const key = normalize(topic.subjectName);
    const existing = existingSubjects.find((subject) => normalize(subject.name) === key);

    if (existing) {
      subjectToAbbreviation.set(key, existing.abbreviation);
      return { ...topic, subjectAbbreviation: existing.abbreviation };
    }

    const current = subjectToAbbreviation.get(key);
    if (current) {
      return { ...topic, subjectAbbreviation: current };
    }

    const base = topic.subjectAbbreviation.trim() || generateImportAbbreviation(topic.subjectName, used.size + 1);
    let candidate = base;
    let suffix = 2;

    while (used.has(normalize(candidate))) {
      candidate = `${base}${suffix}`;
      suffix += 1;
    }

    used.add(normalize(candidate));
    subjectToAbbreviation.set(key, candidate);
    return { ...topic, subjectAbbreviation: candidate };
  });
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvTopics(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);

  if (!rows.length) {
    return [];
  }

  const header = rows[0].map((cell) => normalize(cell));
  const hasHeader = header.some((cell) => ["subject", "predmet", "předmět", "question", "otazka", "otázka", "title", "nazev", "název"].includes(cell));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const subjectIndex = hasHeader ? header.findIndex((cell) => ["subject", "predmet", "předmět", "section"].includes(cell)) : 0;
  const abbreviationIndex = hasHeader ? header.findIndex((cell) => ["abbreviation", "abbr", "zkratka"].includes(cell)) : 1;
  const numberIndex = hasHeader ? header.findIndex((cell) => ["number", "question number", "cislo", "číslo"].includes(cell)) : 2;
  const titleIndex = hasHeader ? header.findIndex((cell) => ["title", "question", "otazka", "otázka", "nazev", "název"].includes(cell)) : 3;

  return dataRows
    .map((row, index): ParsedExamTopic | null => {
      const subjectName = row[subjectIndex] || "Imported topics";
      const rawNumber = row[numberIndex] || row[1] || String(index + 1);
      const questionNumber = Number.parseInt(rawNumber.replace(/\D+/g, ""), 10) || index + 1;
      const questionTitle = stripNumberPrefix(row[titleIndex] || row[row.length - 1] || "");

      if (!questionTitle) {
        return null;
      }

      return {
        id: createImportId(index),
        subjectName,
        subjectAbbreviation: row[abbreviationIndex] || generateImportAbbreviation(subjectName, index + 1),
        questionNumber,
        questionTitle,
        confidence: hasHeader ? "high" : "medium",
        source: `CSV row ${hasHeader ? index + 2 : index + 1}`
      };
    })
    .filter(Boolean) as ParsedExamTopic[];
}

function looksLikeSubjectHeading(line: string) {
  if (/^\s*(?:ot[aá]zka\s*)?\d+\s*(?:[.)\-:]|\s+)/i.test(line)) {
    return false;
  }

  if (ignoredHeadingPatterns.some((pattern) => pattern.test(line))) {
    return false;
  }

  return Boolean(knownSubjectAbbreviations[normalize(line.replace(/:$/, ""))]) || line.endsWith(":");
}

function parseTxtTopics(text: string) {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines: Array<{ text: string; page?: number }> = [];
  let currentPage: number | undefined;

  rawLines.forEach((line) => {
    const pageMatch = line.match(/^---\s*Page\s+(\d+)\s*---$/i);
    if (pageMatch) {
      currentPage = Number.parseInt(pageMatch[1], 10);
      return;
    }

    lines.push({ text: line, page: currentPage });
  });

  const topics: ParsedExamTopic[] = [];
  let currentSubject = "Imported topics";
  let subjectIndex = 1;
  const subjectCounters = new Map<string, number>();
  let activeQuestion: ParsedExamTopic | null = null;

  function pushActiveQuestion() {
    if (activeQuestion) {
      topics.push(activeQuestion);
      activeQuestion = null;
    }
  }

  lines.forEach((lineInfo, index) => {
    const line = lineInfo.text;
    const questionMatch = line.match(/^\s*(?:ot[aá]zka\s*)?(\d+)\s*(?:[.)\-:]|\s+)\s*(.+)$/i);

    if (questionMatch) {
      pushActiveQuestion();
      const questionNumber = Number.parseInt(questionMatch[1], 10);
      activeQuestion = {
        id: createImportId(index),
        subjectName: currentSubject,
        subjectAbbreviation: generateImportAbbreviation(currentSubject, subjectIndex),
        questionNumber,
        questionTitle: questionMatch[2].trim(),
        confidence: "high",
        source: lineInfo.page ? `Page ${lineInfo.page}` : `Line ${index + 1}`
      };
      subjectCounters.set(currentSubject, Math.max(subjectCounters.get(currentSubject) ?? 0, questionNumber));
      return;
    }

    if (looksLikeSubjectHeading(line)) {
      pushActiveQuestion();
      currentSubject = line.replace(/:$/, "").trim();
      subjectIndex += 1;
      return;
    }

    if (ignoredHeadingPatterns.some((pattern) => pattern.test(line))) {
      return;
    }

    if (activeQuestion) {
      activeQuestion = {
        ...activeQuestion,
        questionTitle: `${activeQuestion.questionTitle} ${line}`.replace(/\s+/g, " ").trim()
      };
      return;
    }

    const nextNumber = (subjectCounters.get(currentSubject) ?? 0) + 1;
    activeQuestion = {
      id: createImportId(index),
      subjectName: currentSubject,
      subjectAbbreviation: generateImportAbbreviation(currentSubject, subjectIndex),
      questionNumber: nextNumber,
      questionTitle: line,
      confidence: "low",
      source: lineInfo.page ? `Page ${lineInfo.page}` : `Line ${index + 1}`
    };
    subjectCounters.set(currentSubject, nextNumber);
  });

  pushActiveQuestion();
  return topics;
}

export function parseExamTopics(fileName: string, text: string, existingSubjects: Subject[]) {
  const lowerName = fileName.toLocaleLowerCase();
  const parsed = lowerName.endsWith(".csv") ? parseCsvTopics(text) : parseTxtTopics(text);
  return ensureUniqueImportAbbreviations(parsed, existingSubjects);
}
