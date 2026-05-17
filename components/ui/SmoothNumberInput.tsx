"use client";

type SmoothNumberInputProps = {
  label?: string;
  value: string;
  suffix?: string;
  disabled?: boolean;
  min?: number;
  fallback?: number;
  className?: string;
  inputClassName?: string;
  onValueChange: (value: string) => void;
  onCommit: (value: number) => void;
};

export function normalizeIntegerDraft(value: string) {
  if (value === "") return "";
  return value.replace(/^0+(?=\d)/, "");
}

export function parsePositiveIntegerDraft(value: string, fallback: number, min = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    return Math.max(min, Math.round(fallback));
  }

  return Math.max(min, Math.round(parsed));
}

export function SmoothNumberInput({
  label,
  value,
  suffix,
  disabled = false,
  min = 1,
  fallback = min,
  className,
  inputClassName,
  onValueChange,
  onCommit
}: SmoothNumberInputProps) {
  function commit() {
    const next = parsePositiveIntegerDraft(value, fallback, min);
    onValueChange(String(next));
    onCommit(next);
  }

  const input = (
    <div className={suffix ? "mt-1 flex items-center gap-2" : "mt-1"}>
      <input
        className={inputClassName ?? "field"}
        disabled={disabled}
        min={min}
        step={1}
        type="number"
        value={value}
        onBlur={commit}
        onChange={(event) => onValueChange(normalizeIntegerDraft(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
      {suffix ? <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{suffix}</span> : null}
    </div>
  );

  if (!label) {
    return input;
  }

  return (
    <label className={className ?? "block text-sm font-semibold text-slate-700 dark:text-slate-200"}>
      {label}
      {input}
    </label>
  );
}
