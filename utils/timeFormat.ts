export function formatStudyTime(minutes?: number | null) {
  const resolvedMinutes = typeof minutes === "number" && Number.isFinite(minutes) ? minutes : 0;
  const roundedMinutes = Math.max(0, Math.round(resolvedMinutes));

  if (roundedMinutes < 60) {
    return `${roundedMinutes} min`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;

  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}
