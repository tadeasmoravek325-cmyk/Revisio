import { ReactNode } from "react";
import Image from "next/image";

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="panel animate-enter p-6 text-center">
      <Image src="/revisio-icon.svg" alt="Revisio" width={48} height={48} className="mx-auto h-12 w-12 rounded-lg" />
      <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-slate-50">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
