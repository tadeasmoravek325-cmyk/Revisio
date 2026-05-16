export function toDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + days);
  return nextDate;
}

export function getDateOnlyValue(value?: string) {
  if (!value) {
    return "";
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : toDateInputValue(parsed);
}

export function createLocalDateTime(dateValue: string, hours = 12, minutes = 0) {
  return new Date(
    `${dateValue}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`
  );
}

export function getDaysUntil(dateValue: string) {
  const target = createLocalDateTime(dateValue);

  return Math.max(
    0,
    Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
}
