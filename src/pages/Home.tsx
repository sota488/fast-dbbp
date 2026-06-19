import React from 'react';
import type { SessionSummary } from '../app/sessionSummaryStorage';
import { calculateStreak, streakLabel } from '../app/streak';
import { SessionHistoryCard } from './SessionHistoryCard';

export interface HomePageProps {
  queueCount: number;
  handsPlayed: number;
  allSessions: SessionSummary[];
  recentSessions: SessionSummary[];
  onPlay: () => void;
  onSave: () => void;
  onRestore: () => void;
  onReset: () => void;
  message: string;
}

function goalMessage(handsPlayed: number): string {
  if (handsPlayed >= 100) {
    return 'Goal completed 🎉';
  }
  if (handsPlayed >= 75) {
    return 'Almost done.';
  }
  if (handsPlayed >= 50) {
    return 'Halfway there.';
  }
  if (handsPlayed >= 25) {
    return 'Nice pace.';
  }
  return 'Let\'s get started.';
}

export function HomePage(props: HomePageProps): React.JSX.Element {
  const { queueCount, handsPlayed, allSessions, recentSessions, onPlay, onSave, onRestore, onReset, message } = props;
  const normalizedHands = Math.max(0, Math.min(100, Math.round(handsPlayed)));
  const goalPercent = normalizedHands;
  const goalCopy = goalMessage(normalizedHands);
  const streak = calculateStreak(allSessions);
  const streakText = streakLabel(streak);

  return (
    <main className="app-shell">
      <div className="stack">
        <section className="hero-card">
          <h1 className="hero-title">Fast DBBP</h1>
          <p className="hero-subtitle">Practice 100 hands a day.\nBuild your DBBP instincts.</p>
          <p className="hero-caption">A daily DBBP training habit.</p>
          <div className="button-stack">
            <button type="button" className="btn btn-primary" onClick={onPlay}>
              Play Now
            </button>
          </div>
        </section>

        <section className="ui-card" aria-label="Daily Goal Card">
          <h2 className="card-title">Today&apos;s Goal</h2>
          <p className="daily-goal-value">{normalizedHands} / 100 Hands</p>
          <div className="metric-progress-wrap" style={{ marginBottom: 10 }}>
            <div className="metric-progress-head">
              <p className="metric-label">Progress</p>
              <p className="metric-progress-text">{goalPercent}%</p>
            </div>
            <div className="metric-progress-track" aria-label="Daily Goal Progress Bar">
              <div className="metric-progress-fill" style={{ width: `${goalPercent}%` }} />
            </div>
          </div>
          <p className="daily-goal-copy">{goalCopy}</p>
        </section>

        <section className="ui-card" aria-label="Streak Card">
          <h2 className="card-title">🔥 Streak</h2>
          <p className="streak-value">{streak}日</p>
          <p className="streak-copy">{streakText}</p>
        </section>

        <section className="value-grid" aria-label="Value Cards">
          <article className="value-card">
            <p className="value-title">⚡ Fast Practice</p>
            <p className="value-body">Jump into the next hand instantly.</p>
          </article>
          <article className="value-card">
            <p className="value-title">📈 Track Progress</p>
            <p className="value-body">Measure your speed and consistency.</p>
          </article>
          <article className="value-card">
            <p className="value-title">🎯 Build Habits</p>
            <p className="value-body">100 hands a day keeps the rust away.</p>
          </article>
        </section>

        <section className="ui-card">
          <h2 className="card-title">Today</h2>
          <p className="card-subtext">Players waiting: {queueCount}</p>
        </section>

        <SessionHistoryCard sessions={recentSessions} allSessions={allSessions} onPlay={onPlay} />

        <section className="ui-card" aria-label="How It Works Card">
          <h2 className="card-title">How It Works</h2>
          <ol className="how-list">
            <li className="how-item">1. Start a hand</li>
            <li className="how-item">2. Fold instantly</li>
            <li className="how-item">3. Repeat until 100 hands</li>
            <li className="how-item">4. Review your progress</li>
          </ol>
        </section>

        <section className="ui-card">
          <h2 className="card-title">Utility Actions</h2>
          <p className="status-message" style={{ marginBottom: '12px' }}>{message}</p>
          <div className="button-stack">
            <button type="button" className="btn btn-tertiary" onClick={onRestore}>
              Restore
            </button>
            <button type="button" className="btn btn-tertiary" onClick={onSave}>
              Save
            </button>
            <button type="button" className="btn btn-tertiary" onClick={onReset}>
              Reset
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
