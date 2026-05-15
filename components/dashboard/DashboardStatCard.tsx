import { ReactNode } from "react";

type DashboardStatCardProps = {
  label: string;
  value: string;
  detail?: string;
  accent?: ReactNode;
};

export function DashboardStatCard({ label, value, detail, accent }: DashboardStatCardProps) {
  return (
    <section className="panel overflow-hidden p-4 transition hover:-translate-y-0.5">
      <div className="flex h-full items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-50">{value}</p>
          {detail ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p> : null}
        </div>
        {accent ? <div className="shrink-0">{accent}</div> : null}
      </div>
    </section>
  );
}
