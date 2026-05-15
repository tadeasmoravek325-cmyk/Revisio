export function ProgressBar({
  value,
  color = "#2f9e8f"
}: {
  value: number;
  color?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${safeValue}%`, backgroundColor: color }}
      />
    </div>
  );
}
