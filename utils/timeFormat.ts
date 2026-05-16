export function formatStudyTime(minutes?: number | null) {
  const roundedMinutes = Math.max(0, Math.round(minutes ?? 0));

  if (roundedMinutes < 60) {
    return `${roundedMinutes} min`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;

  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}
