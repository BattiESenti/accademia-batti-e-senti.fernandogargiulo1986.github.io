export function getEventColor(classroomName: string | null | undefined): string {
  if (!classroomName) return '#4f46e5';
  const name = classroomName.toLowerCase();
  const colors: Record<string, string> = {
    rossa: '#ef4444', rosso: '#ef4444',
    gialla: '#f59e0b', giallo: '#f59e0b',
    verde: '#10b981',
    blu: '#3b82f6',
    azzurra: '#60a5fa', azzurro: '#60a5fa',
    viola: '#8b5cf6',
    arancione: '#f97316',
  };
  return colors[name] ?? '#6b7280';
}
