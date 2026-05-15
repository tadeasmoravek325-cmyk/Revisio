import { Subject } from "@/types/study";

export function SubjectPill({ subject }: { subject?: Subject }) {
  if (!subject) {
    return <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">No subject</span>;
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
      <span>{subject.abbreviation}</span>
      <span className="hidden sm:inline">{subject.name}</span>
    </span>
  );
}
