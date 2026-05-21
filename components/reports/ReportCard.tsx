import { ReactNode } from "react";

type ReportCardProps = {
  title: string;
  detail?: string;
  children: ReactNode;
  className?: string;
};

export function ReportCard({ title, detail, children, className = "" }: ReportCardProps) {
  return (
    <section className={`panel min-w-0 overflow-hidden p-4 sm:p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">{title}</h2>
        {detail ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p> : null}
      </div>
      {children}
    </section>
  );
}
