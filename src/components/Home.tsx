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
    return '目標達成！🎉';
  }
  if (handsPlayed >= 75) {
    return 'あと少し！';
  }
  if (handsPlayed >= 50) {
    return '半分達成！';
  }
  if (handsPlayed >= 25) {
    return '良いペースです。';
  }
  return 'ここからスタート。';
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
          <p className="hero-subtitle">毎日100ハンドを高速反復。\n実戦感覚でDBBPを鍛える。</p>
          <p className="hero-caption">習慣ではなく、プレイ感のあるトレーニングへ。</p>
          <div className="button-stack">
            <button type="button" className="btn btn-primary" onClick={onPlay}>
              ハンド開始
            </button>
          </div>
        </section>

        <section className="ui-card" aria-label="Daily Goal Card">
          <h2 className="card-title">今日の目標</h2>
          <p className="daily-goal-value">{normalizedHands} / 100 ハンド</p>
          <div className="metric-progress-wrap" style={{ marginBottom: 10 }}>
            <div className="metric-progress-head">
              <p className="metric-label">進捗</p>
              <p className="metric-progress-text">{goalPercent}%</p>
            </div>
            <div className="metric-progress-track" aria-label="Daily Goal Progress Bar">
              <div className="metric-progress-fill" style={{ width: `${goalPercent}%` }} />
            </div>
          </div>
          <p className="daily-goal-copy">{goalCopy}</p>
        </section>

        <section className="ui-card" aria-label="Streak Card">
          <h2 className="card-title">🔥 連続達成日数</h2>
          <p className="streak-value">{streak}日</p>
          <p className="streak-copy">{streakText}</p>
        </section>

        <section className="value-grid" aria-label="Value Cards">
          <article className="value-card">
            <p className="value-title">⚡ 高速練習</p>
            <p className="value-body">フォールド後すぐ次の局面へ。</p>
          </article>
          <article className="value-card">
            <p className="value-title">📈 進捗の可視化</p>
            <p className="value-body">手数、達成率、継続日数を追跡。</p>
          </article>
          <article className="value-card">
            <p className="value-title">🎯 実戦感トレーニング</p>
            <p className="value-body">短時間で判断を磨く反復練習。</p>
          </article>
        </section>

        <section className="ui-card">
          <h2 className="card-title">本日の待機状況</h2>
          <p className="card-subtext">待機プレイヤー: {queueCount}</p>
        </section>

        <SessionHistoryCard sessions={recentSessions} allSessions={allSessions} onPlay={onPlay} />

        <section className="ui-card" aria-label="How It Works Card">
          <h2 className="card-title">使い方</h2>
          <ol className="how-list">
            <li className="how-item">1. ハンド開始</li>
            <li className="how-item">2. Heroハンドを見て判断</li>
            <li className="how-item">3. 100ハンドまで反復</li>
            <li className="how-item">4. 進捗と連続達成を確認</li>
          </ol>
        </section>

        <section className="ui-card">
          <h2 className="card-title">ユーティリティ</h2>
          <p className="status-message" style={{ marginBottom: '12px' }}>{message}</p>
          <div className="button-stack">
            <button type="button" className="btn btn-tertiary" onClick={onRestore}>
              復元
            </button>
            <button type="button" className="btn btn-tertiary" onClick={onSave}>
              保存
            </button>
            <button type="button" className="btn btn-tertiary" onClick={onReset}>
              リセット
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
