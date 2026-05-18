"use client";

import { ChangeEvent, ReactNode, useMemo, useRef, useState } from "react";
import { useStudyStore } from "@/hooks/useStudyStore";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getExamTopicFileSupportMessage,
  parseExamTopics,
  ParsedExamTopic
} from "@/utils/examTopicImport";
import { extractExamTopicText, isSupportedExamTopicFileName } from "@/utils/examTopicFileText";

type ExamTopicsImportDialogProps = {
  triggerLabel?: string;
  triggerIcon?: ReactNode;
  className?: string;
  disabled?: boolean;
};

type ImportStep = "upload" | "extract" | "pdfPreview" | "review" | "summary";

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getConfidenceClass(confidence: ParsedExamTopic["confidence"]) {
  if (confidence === "high") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200";
  }

  if (confidence === "medium") {
    return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200";
  }

  return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200";
}

export function ExamTopicsImportDialog({
  triggerLabel = "Import exam topics",
  triggerIcon,
  className = "btn-secondary",
  disabled = false
}: ExamTopicsImportDialogProps) {
  const { data, hasWorkspaces, importExamTopics } = useStudyStore();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [topics, setTopics] = useState<ParsedExamTopic[]>([]);
  const [error, setError] = useState("");
  const [extractStatus, setExtractStatus] = useState("");
  const [pendingPdfText, setPendingPdfText] = useState("");
  const [extractedPdfPreview, setExtractedPdfPreview] = useState("");
  const [summary, setSummary] = useState({ subjectsCreated: 0, questionsCreated: 0, skipped: 0 });

  const duplicateInfo = useMemo(() => {
    const subjectNameToId = new Map(data.subjects.map((subject) => [normalize(subject.name), subject.id]));
    const subjectAbbreviationToName = new Map(
      data.subjects.map((subject) => [normalize(subject.abbreviation), subject.name])
    );
    const newSubjectAbbreviations = new Map<string, string>();
    const blockingRows = new Set<string>();
    const duplicateRows = new Set<string>();
    const warnings: Record<string, string> = {};

    topics.forEach((topic) => {
      const subjectName = topic.subjectName.trim();
      const abbreviation = topic.subjectAbbreviation.trim();
      const subjectKey = normalize(subjectName);
      const abbreviationKey = normalize(abbreviation);
      const existingSubjectName = subjectAbbreviationToName.get(abbreviationKey);

      if (!subjectName || !abbreviation || !topic.questionTitle.trim() || topic.questionNumber < 1) {
        blockingRows.add(topic.id);
        warnings[topic.id] = "Missing subject, abbreviation, number, or title.";
        return;
      }

      if (existingSubjectName && normalize(existingSubjectName) !== subjectKey) {
        blockingRows.add(topic.id);
        warnings[topic.id] = `Abbreviation already exists for ${existingSubjectName}.`;
        return;
      }

      const previousSubject = newSubjectAbbreviations.get(abbreviationKey);
      if (previousSubject && normalize(previousSubject) !== subjectKey) {
        blockingRows.add(topic.id);
        warnings[topic.id] = `Abbreviation conflicts with ${previousSubject} in this import.`;
        return;
      }
      newSubjectAbbreviations.set(abbreviationKey, subjectName);

      const existingSubjectId = subjectNameToId.get(subjectKey);
      if (!existingSubjectId) {
        return;
      }

      const normalizedTitle = normalize(topic.questionTitle);
      const duplicate = data.questions.some(
        (question) =>
          question.subjectId === existingSubjectId &&
          (question.number === topic.questionNumber || normalize(question.title) === normalizedTitle)
      );

      if (duplicate) {
        duplicateRows.add(topic.id);
        warnings[topic.id] = "Possible duplicate. This row will be skipped on import.";
      }
    });

    return {
      blockingRows,
      duplicateRows,
      warnings,
      hasBlockingRows: blockingRows.size > 0
    };
  }, [data.questions, data.subjects, topics]);

  function resetFlow() {
    setStep("upload");
    setFileName("");
    setTopics([]);
    setError("");
    setExtractStatus("");
    setPendingPdfText("");
    setExtractedPdfPreview("");
    setSummary({ subjectsCreated: 0, questionsCreated: 0, skipped: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function closeDialog() {
    setOpen(false);
    resetFlow();
  }

  function analyzeExtractedText(text: string, sourceFileName = fileName) {
    const parsed = parseExamTopics(sourceFileName, text, data.subjects);
    if (process.env.NODE_ENV === "development") {
      const detectedSubjects = new Set(parsed.map((topic) => topic.subjectName.trim()).filter(Boolean));
      const detectedPages = new Set(
        [...text.matchAll(/^---\s*Page\s+(\d+)\s*---$/gim)].map((match) => match[1])
      );
      console.debug("[Revisio import debug]", {
        fileName: sourceFileName,
        extractedTextLength: text.length,
        pages: detectedPages.size || undefined,
        first1000Characters: text.slice(0, 1000),
        detectedSubjectsCount: detectedSubjects.size,
        detectedQuestionsCount: parsed.length
      });
    }

    if (!parsed.length) {
      setError("No exam topics were detected. Try a file with subject headings and numbered questions.");
      setStep("upload");
      return;
    }

    setTopics(parsed);
    setStep("review");
  }

  async function processFiles(files: File[]) {
    setError("");

    if (!files.length) {
      return;
    }

    const unsupportedFile = files.find((file) => !isSupportedExamTopicFileName(file.name));
    if (unsupportedFile) {
      setError(`Unsupported file type: ${unsupportedFile.name}. Please upload PDF, DOCX, TXT, CSV, JPG, PNG, WEBP, or HEIC.`);
      return;
    }

    const selectedFileName = files.length === 1 ? files[0].name : `${files.length} files`;
    setFileName(selectedFileName);
    setStep("extract");
    setExtractStatus(files.length > 1 ? `Extracting text from ${files.length} files...` : "Extracting text from the file...");

    try {
      const extractedTexts: string[] = [];

      for (const [index, file] of files.entries()) {
        setExtractStatus(`Extracting text from ${file.name} (${index + 1}/${files.length})...`);
        const text = await extractExamTopicText(file);
        extractedTexts.push(`--- File: ${file.name} ---\n${text}`);
      }

      const text = extractedTexts.join("\n\n").trim();
      setExtractStatus("Analyzing subjects, sections, and numbered questions...");

      if (files.length === 1 && files[0].name.toLocaleLowerCase().endsWith(".pdf")) {
        setPendingPdfText(text);
        setExtractedPdfPreview(text.slice(0, 2000));
        setStep("pdfPreview");
        return;
      }

      analyzeExtractedText(text, selectedFileName);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Failed to parse this file.");
      setStep("upload");
    } finally {
      setExtractStatus("");
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await processFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function updateTopic(id: string, patch: Partial<ParsedExamTopic>) {
    setTopics((current) => current.map((topic) => (topic.id === id ? { ...topic, ...patch } : topic)));
  }

  function removeTopic(id: string) {
    setTopics((current) => current.filter((topic) => topic.id !== id));
  }

  function approveImport() {
    const rowsToCreate = topics.filter(
      (topic) => !duplicateInfo.blockingRows.has(topic.id) && !duplicateInfo.duplicateRows.has(topic.id)
    );

    if (!rowsToCreate.length) {
      setError("There are no valid new questions to import.");
      return;
    }

    const result = importExamTopics(
      rowsToCreate.map((topic) => ({
        subjectName: topic.subjectName,
        subjectAbbreviation: topic.subjectAbbreviation,
        questionNumber: topic.questionNumber,
        questionTitle: topic.questionTitle
      }))
    );

    setSummary({
      ...result,
      skipped: topics.length - rowsToCreate.length
    });
    setStep("summary");
    showToast("Exam topics imported");
  }

  return (
    <>
      <button
        className={className}
        disabled={disabled || !hasWorkspaces}
        type="button"
        onClick={() => {
          setOpen(true);
          resetFlow();
        }}
      >
        {triggerIcon}
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="animate-enter max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
                  Step {step === "upload" ? "1" : step === "extract" || step === "pdfPreview" ? "2" : step === "review" ? "3-4" : "5"} of 5
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-slate-50">Import exam topics</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {getExamTopicFileSupportMessage()}
                </p>
              </div>
              <button className="btn-secondary px-3" onClick={closeDialog}>
                Close
              </button>
            </div>

            <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-4 sm:p-5">
              {step === "upload" ? (
                <div
                  className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-5 text-center dark:border-blue-500/30 dark:bg-blue-500/10"
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    processFiles(Array.from(event.dataTransfer.files));
                  }}
                >
                  <h3 className="text-lg font-black text-slate-950 dark:text-slate-50">Upload exam topics</h3>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Drop PDFs, DOCX files, screenshots, or iPhone/iPad photos here. Files work best with subject
                    headings and numbered questions. Nothing is created until you approve the preview.
                  </p>
                  <button className="btn-primary mt-5" onClick={() => fileInputRef.current?.click()}>
                    Choose files
                  </button>
                  <input
                    ref={fileInputRef}
                    accept=".txt,.csv,.docx,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,text/plain,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="hidden"
                    multiple
                    type="file"
                    onChange={handleFileChange}
                  />
                  <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Supported formats: PDF, DOCX, TXT, CSV, JPG, PNG, WEBP, HEIC.
                  </p>
                </div>
              ) : null}

              {step === "extract" ? (
                <div className="rounded-lg bg-blue-50 p-5 text-center dark:bg-blue-500/10">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-500/20 dark:border-t-blue-300" />
                  <h3 className="mt-4 text-lg font-black text-slate-950 dark:text-slate-50">Extracting and analyzing</h3>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {extractStatus || `Preparing ${fileName}...`}
                  </p>
                </div>
              ) : null}

              {step === "pdfPreview" ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-950 dark:text-slate-50">Extracted PDF text</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Previewing the first 2000 characters from {fileName} before topic detection.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary" onClick={() => setStep("upload")}>
                        Back
                      </button>
                      <button className="btn-primary" onClick={() => analyzeExtractedText(pendingPdfText)}>
                        Analyze text
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-xs leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    {extractedPdfPreview}
                  </pre>
                </div>
              ) : null}

              {step === "review" ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-950 dark:text-slate-50">
                        Review detected structure
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {topics.length} rows detected from {fileName}. Edit, remove, or merge subjects before importing.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary" onClick={() => setStep("upload")}>
                        Back
                      </button>
                      <button
                        className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={duplicateInfo.hasBlockingRows || !topics.length}
                        onClick={approveImport}
                      >
                        Approve import
                      </button>
                    </div>
                  </div>

                  {duplicateInfo.hasBlockingRows ? (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                      Fix abbreviation conflicts or missing fields before importing.
                    </p>
                  ) : null}

                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="min-w-[920px] w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-3">Subject</th>
                          <th className="px-3 py-3">Abbr.</th>
                          <th className="px-3 py-3">No.</th>
                          <th className="px-3 py-3">Question title</th>
                          <th className="px-3 py-3">Confidence</th>
                          <th className="px-3 py-3">Source</th>
                          <th className="px-3 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {topics.map((topic) => (
                          <tr key={topic.id} className={duplicateInfo.blockingRows.has(topic.id) ? "bg-amber-50/60 dark:bg-amber-500/10" : ""}>
                            <td className="px-3 py-3">
                              <input
                                className="field min-w-40"
                                value={topic.subjectName}
                                onChange={(event) => updateTopic(topic.id, { subjectName: event.target.value })}
                              />
                              {duplicateInfo.warnings[topic.id] ? (
                                <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-200">
                                  {duplicateInfo.warnings[topic.id]}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              <input
                                className="field w-24"
                                value={topic.subjectAbbreviation}
                                onChange={(event) => updateTopic(topic.id, { subjectAbbreviation: event.target.value })}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                className="field w-20"
                                min={1}
                                type="number"
                                value={topic.questionNumber}
                                onChange={(event) => updateTopic(topic.id, { questionNumber: Number(event.target.value) })}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                className="field min-w-72"
                                value={topic.questionTitle}
                                onChange={(event) => updateTopic(topic.id, { questionTitle: event.target.value })}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <span className={`badge ${getConfidenceClass(topic.confidence)}`}>{topic.confidence}</span>
                            </td>
                            <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {topic.source}
                            </td>
                            <td className="px-3 py-3">
                              <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => removeTopic(topic.id)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {step === "summary" ? (
                <div className="rounded-lg bg-blue-50 p-5 dark:bg-blue-500/10">
                  <h3 className="text-lg font-black text-slate-950 dark:text-slate-50">Import summary</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-white p-4 dark:bg-slate-950">
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-200">{summary.subjectsCreated}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">subjects created</p>
                    </div>
                    <div className="rounded-lg bg-white p-4 dark:bg-slate-950">
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-200">{summary.questionsCreated}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">questions created</p>
                    </div>
                    <div className="rounded-lg bg-white p-4 dark:bg-slate-950">
                      <p className="text-2xl font-black text-slate-700 dark:text-slate-200">{summary.skipped}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">rows skipped</p>
                    </div>
                  </div>
                  <button className="btn-primary mt-5" onClick={closeDialog}>
                    Done
                  </button>
                </div>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
