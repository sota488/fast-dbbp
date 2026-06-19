export const SESSION_SUMMARIES_STORAGE_KEY = 'fastfold.sessions';
const MAX_SESSION_SUMMARIES = 30;

export type SessionSummary = {
  id: string;
  completedAt: string;
  handsPlayed: number;
  avgFastFoldMs: number;
  bestFastFoldMs: number;
  p50FastFoldMs: number;
  p95FastFoldMs: number;
  p99FastFoldMs: number;
  maxFastFoldMs: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function isSameDay(leftIso: string, rightIso: string): boolean {
  return leftIso.slice(0, 10) === rightIso.slice(0, 10);
}

export function loadSessionSummaries(storage?: StorageLike): SessionSummary[] {
  const target = getStorage(storage);
  if (!target) {
    return [];
  }

  const raw = target.getItem(SESSION_SUMMARIES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SessionSummary[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveSessionSummary(summary: SessionSummary, storage?: StorageLike): SessionSummary[] {
  const target = getStorage(storage);
  if (!target) {
    return [];
  }

  const existing = loadSessionSummaries(target);
  const duplicated = existing.some((item) => item.id === summary.id && isSameDay(item.completedAt, summary.completedAt));
  if (duplicated) {
    return existing;
  }

  const next = [summary, ...existing].slice(0, MAX_SESSION_SUMMARIES);
  target.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify(next));
  return next;
}
