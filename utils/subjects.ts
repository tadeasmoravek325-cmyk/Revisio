import { Subject } from "@/types/study";

const defaultSubjectAbbreviations: Record<string, string> = {
  "nauka-o-podniku": "NP",
  "finance-podniku": "FP",
  "male-a-stredni-podnikani": "MSPO",
  "ucetnictvi-1": "UČ1",
  "ucetnictvi-2": "UČ2",
  "uvod-do-managementu": "UM",
  "personalni-management": "PM",
  "marketing": "M",
  "strategicky-marketing": "SM",
  "podnikove-procesy": "PP",
  "podnikova-logistika": "PL"
};

function normalizeAbbreviation(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function generateSubjectAbbreviation(name: string, fallback: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const generated = words
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase();

  return (generated || fallback).slice(0, 6);
}

export function ensureUniqueSubjectAbbreviation(
  abbreviation: string,
  existingSubjects: Subject[],
  subjectId: string
) {
  let candidate = abbreviation.trim();
  let index = 2;
  const isTaken = (value: string) =>
    existingSubjects.some(
      (subject) =>
        subject.id !== subjectId &&
        normalizeAbbreviation(subject.abbreviation ?? "") === normalizeAbbreviation(value)
    );

  while (isTaken(candidate)) {
    candidate = `${abbreviation.trim()}${index}`;
    index += 1;
  }

  return candidate;
}

export function getSubjectAbbreviationFallback(subject: Pick<Subject, "id" | "name">) {
  return defaultSubjectAbbreviations[subject.id] ?? generateSubjectAbbreviation(subject.name, "SUB");
}

export function isSubjectAbbreviationDuplicate(
  subjects: Subject[],
  abbreviation: string,
  subjectIdToIgnore?: string
) {
  const normalized = normalizeAbbreviation(abbreviation);
  return subjects.some(
    (subject) =>
      subject.id !== subjectIdToIgnore &&
      normalizeAbbreviation(subject.abbreviation ?? "") === normalized
  );
}
