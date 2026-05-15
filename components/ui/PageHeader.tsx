import { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  children
}: {
  title: string;
  eyebrow: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-slate-50 sm:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
