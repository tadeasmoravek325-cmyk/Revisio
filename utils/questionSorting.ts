import { Question, Subject } from "@/types/study";

function getSubjectName(subjects: Subject[], subjectId: string) {
  return subjects.find((subject) => subject.id === subjectId)?.name ?? "";
}

export function parseQuestionNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function compareQuestionsBySubjectAndNumber(subjects: Subject[]) {
  return (a: Question, b: Question) => {
    const subjectCompare = getSubjectName(subjects, a.subjectId).localeCompare(
      getSubjectName(subjects, b.subjectId),
      undefined,
      { sensitivity: "base" }
    );

    if (subjectCompare !== 0) {
      return subjectCompare;
    }

    const aNumber = parseQuestionNumber(a.number);
    const bNumber = parseQuestionNumber(b.number);

    if (aNumber !== undefined && bNumber !== undefined && aNumber !== bNumber) {
      return aNumber - bNumber;
    }

    if (aNumber !== undefined && bNumber === undefined) {
      return -1;
    }

    if (aNumber === undefined && bNumber !== undefined) {
      return 1;
    }

    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  };
}

export function sortQuestionsBySubjectAndNumber(questions: Question[], subjects: Subject[]) {
  return [...questions].sort(compareQuestionsBySubjectAndNumber(subjects));
}
