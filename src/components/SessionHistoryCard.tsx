import React from 'react';
import type { SessionSummary } from '../app/sessionSummaryStorage';
import { calculateStreak } from '../app/streak';

export interface SessionHistoryCardProps {
  sessions: SessionSummary[];
  allSessions: SessionSummary[];
  onPlay: () => void;
}

type DeltaKind = 'up' | 'down' | 'same';

interface DeltaResult {
  kind: DeltaKind;
  label: string;
}

function toDayLabel(iso: string): string {
  const completed = new Date(iso);
  const now = new Date();

  const completedDay = new Date(completed.getFullYear(), completed.getMonth(), completed.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDiff = Math.round((today - completedDay) / 86400000);

  if (dayDiff === 0) {
    return 'Today';
  }
  if (dayDiff === 1) {
    return 'Yesterday';
  }

  return completed.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  });
}

function compareCount(currentValue: number, previousValue: number, suffix: string): DeltaResult {
  const delta = Math.abs(currentValue - previousValue);

  if (currentValue > previousValue) {
    return {
      kind: 'up',
      label: `+${delta} ${suffix}`,
    };
  }

  if (currentValue < previousValue) {
    return {
      kind: 'down',
      label: `-${delta} ${suffix}`,
    };
  }

  return {
    kind: 'same',
    label: 'No change',
  };
}

function streakContext(sessions: SessionSummary[], index: number): string {
  const current = sessions[index];
  const previous = sessions[index + 1];

  if (!current) {
    return 'Start point';
  }

  if (!previous) {
    return 'Start point';
  }

  const currentDay = new Date(current.completedAt);
  const previousDay = new Date(previous.completedAt);
  const currentDate = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate()).getTime();
  const previousDate = new Date(previousDay.getFullYear(), previousDay.getMonth(), previousDay.getDate()).getTime();
  const diff = Math.round((currentDate - previousDate) / 86400000);

  if (diff === 1) {
    return 'Streak chain';
  }

  return 'Streak reset point';
}

export function SessionHistoryCard(props: SessionHistoryCardProps): React.JSX.Element {
  const { sessions, allSessions, onPlay } = props;
  const current = sessions[0] ?? null;
  const previous = sessions[1] ?? null;
  const currentStreak = calculateStreak(allSessions);
  const previousStreak = calculateStreak(allSessions.slice(1));
  const sessionsComparison = sessions.length > 1 ? compareCount(allSessions.length, Math.max(0, allSessions.length - 1), 'session') : null;
  const handsComparison = current && previous ? compareCount(current.handsPlayed, previous.handsPlayed, 'hands') : null;
  const streakComparison = sessions.length > 1 ? compareCount(currentStreak, previousStreak, 'day') : null;

  return (
    <section className="ui-card">
      <h2 className="card-title">Session History</h2>

      {sessions.length > 0 ? (
        <section className="session-progress-card" aria-label="Your Progress Card">
          <h3 className="session-progress-title">Your Progress</h3>
          {sessions.length === 1 || !handsComparison || !streakComparison || !sessionsComparison ? (
            <p className="session-progress-wait">Play one more session to compare.</p>
          ) : (
            <div className="session-progress-grid">
              <article className="session-progress-item">
                <p className="session-progress-metric-label">Sessions Completed</p>
                <p className="session-progress-metric-value">{allSessions.length}</p>
                <p className={`session-progress-diff is-${sessionsComparison.kind}`}>{sessionsComparison.label}</p>
              </article>
              <article className="session-progress-item">
                <p className="session-progress-metric-label">Hands Played</p>
                <p className="session-progress-metric-value">{current?.handsPlayed ?? 0}</p>
                <p className={`session-progress-diff is-${handsComparison.kind}`}>{handsComparison.label}</p>
              </article>
              <article className="session-progress-item">
                <p className="session-progress-metric-label">Current Streak</p>
                <p className="session-progress-metric-value">{currentStreak} Day Streak</p>
                <p className={`session-progress-diff is-${streakComparison.kind}`}>{streakComparison.label}</p>
              </article>
            </div>
          )}
        </section>
      ) : null}

      {sessions.length === 0 ? (
        <div className="session-history-empty">
          <p className="session-history-empty-title">Start your first session</p>
          <p className="session-history-empty-subcopy">Play 100 hands on Fast DBBP and your progress will appear here.</p>
          <button type="button" className="btn btn-primary session-history-empty-cta" onClick={onPlay}>
            Play Now
          </button>
        </div>
      ) : (
        <div className="session-history-list" aria-label="Session History List">
          {sessions.map((session, index) => (
            <article key={`${session.id}:${session.completedAt}`} className="session-history-item" aria-label="Session History Item">
              <p className="session-history-date">{toDayLabel(session.completedAt)}</p>
              <div className="session-history-metrics">
                <p className="session-history-metric">{session.handsPlayed} Hands</p>
                <p className="session-history-metric">Streak Context: {streakContext(sessions, index)}</p>
              </div>
              <details className="metric-details" style={{ marginTop: 8 }}>
                <summary>Speed details</summary>
                <div className="metric-details-grid">
                  <div className="metric-item"><p className="metric-label">Avg DBBP</p><p className="metric-value">{session.avgFastFoldMs.toFixed(0)}ms</p></div>
                  <div className="metric-item"><p className="metric-label">Best DBBP</p><p className="metric-value">{session.bestFastFoldMs.toFixed(0)}ms</p></div>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
