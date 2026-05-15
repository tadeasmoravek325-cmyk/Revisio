import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="panel animate-enter p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        R
      </div>
      <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-slate-50">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
