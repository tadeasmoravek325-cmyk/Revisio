export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + days);
  return nextDate;
}

export function getDaysUntil(dateValue: string) {
  return Math.max(
    0,
    Math.ceil((new Date(dateValue).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
}
