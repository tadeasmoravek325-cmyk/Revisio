export function LoadingState({ label = "Loading study data" }: { label?: string }) {
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-teal-700 dark:text-teal-300">{label}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton mt-4 h-7 w-20" />
              <div className="skeleton mt-3 h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-64" />
        <div className="skeleton h-64" />
      </div>
    </div>
  );
}
