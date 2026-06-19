import type { SessionSummary } from './sessionSummaryStorage';

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function getDayDiff(today: Date, key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((current.getTime() - target.getTime()) / 86400000);
}

export function calculateStreak(sessions: SessionSummary[]): number {
  if (sessions.length === 0) {
    return 0;
  }

  const today = new Date(Date.now());
  const uniqueDateKeys = Array.from(new Set(sessions.map((session) => toDateKey(session.completedAt))));
  const dayDiffSet = new Set<number>();

  for (const key of uniqueDateKeys) {
    const dayDiff = getDayDiff(today, key);
    if (dayDiff >= 0) {
      dayDiffSet.add(dayDiff);
    }
  }

  const hasToday = dayDiffSet.has(0);
  const hasYesterday = dayDiffSet.has(1);

  if (!hasToday && !hasYesterday) {
    return 0;
  }

  const startDayDiff = hasToday ? 0 : 1;
  let streak = 0;
  while (dayDiffSet.has(startDayDiff + streak)) {
    streak += 1;
  }
  return streak;
}

export function streakLabel(streak: number): string {
  if (streak === 0) {
    return '連続達成を始めよう。';
  }
  if (streak === 1) {
    return '1日継続中';
  }
  return `${streak}日継続中`;
}

export function hasSessionOnToday(sessions: SessionSummary[]): boolean {
  const today = new Date(Date.now()).toISOString().slice(0, 10);
  return sessions.some((session) => session.completedAt.slice(0, 10) === today);
}
