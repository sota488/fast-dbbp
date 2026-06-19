'use client';

import { useEffect, useState } from 'react';
import type { GameActionType, PersistenceNotification } from '../engine/game/types';
import type { QueueState } from '../engine/queue/types';
import { Street } from '../engine/table-state/types';
import { useGameEngine } from '../hooks/useGameEngine';
import { usePersistence } from '../hooks/usePersistence';
import { HomePage } from '../components/Home';
import { TablePage } from '../components/Table';
import { loadSessionSummaries, saveSessionSummary, type SessionSummary } from './sessionSummaryStorage';
import { calculateStreak, hasSessionOnToday } from './streak';

type Screen = 'home' | 'table';
type PlayingState = 'PLAYING' | 'FAST_FOLDING' | 'WAITING_FOR_ASSIGNMENT' | 'HAND_LOADING';
type MetricSource = 'measured';

interface ToastState {
  title: string;
  value?: string;
}

interface MeasuredFastFoldMetric {
  metricSource: MetricSource;
  foldTappedAt: number;
  queueAssignedAt: number;
  handStartedAt: number;
  actionableAt: number;
  foldToNextHandMs: number;
}

interface FastFoldMetricSummary {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

interface MeasuredFastFoldSession {
  metrics: MeasuredFastFoldMetric[];
  summary: FastFoldMetricSummary | null;
}

const HERO_ID = 'hero-1';
const TABLE_ID = 'table-1';
const HERO_HAND = ['Ah', 'As', 'Kd', 'Kc'];

function normalizeQueueStateForSave(queueState: QueueState): QueueState {
  const copiedPlayerPool = new Map(
    Array.from(queueState.playerPool.entries()).map(([playerId, entry]) => [
      playerId,
      {
        ...entry,
        participatedHandIds: new Set(entry.participatedHandIds),
      },
    ]),
  );

  const normalized: QueueState = {
    ...queueState,
    playerPool: copiedPlayerPool,
    waitingQueue: [],
    activeTableIds: new Set(),
    activeTables: new Map(),
    handRegistry: new Map(),
  };

  for (const entry of normalized.playerPool.values()) {
    entry.status = 'WAITING';
    entry.currentTableId = null;
    entry.currentHandId = null;
    normalized.waitingQueue.push(entry.playerId);
  }

  return normalized;
}

function summarize(values: number[]): FastFoldMetricSummary | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (ratio: number): number => {
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index];
  };

  const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;

  return {
    avg,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted[sorted.length - 1],
  };
}

export default function Page() {
  const { state, joinQueue, startHand, applyAction, enqueueFromBettingEvent, assignNextTable, restoreGame, resetGame } = useGameEngine();
  const persistence = usePersistence({ keyPrefix: 'ffo:persistence', supportedSchemaVersion: 1 });
  const [screen, setScreen] = useState<Screen>('home');
  const [message, setMessage] = useState('準備完了');
  const [playingState, setPlayingState] = useState<PlayingState>('PLAYING');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionCompleteModalOpen, setSessionCompleteModalOpen] = useState(false);
  const [sessionCompleteShown, setSessionCompleteShown] = useState(false);
  const [sessionSummarySaved, setSessionSummarySaved] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [measuredSession, setMeasuredSession] = useState<MeasuredFastFoldSession>({
    metrics: [],
    summary: null,
  });

  const queueCount = state.queueState.waitingQueue.length;
  const allSessions = loadSessionSummaries()
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime())
  ;
  const recentSessions = allSessions.slice(0, 5);
  const activePlayers = state.queueState.activeTables.get(state.tableState.tableId)?.seatPlayerIds ?? state.tableState.actionOrder;
  const handsPlayed = measuredSession.metrics.length;
  const progressPercent = Math.max(0, Math.min(100, handsPlayed));
  const bestFastFold = measuredSession.metrics.length > 0
    ? Math.min(...measuredSession.metrics.map((metric) => metric.foldToNextHandMs))
    : null;
  const liveSessions = handsPlayed > 0 && !hasSessionOnToday(allSessions)
    ? [
      {
        id: 'live-session',
        completedAt: new Date(Date.now()).toISOString(),
        handsPlayed,
        avgFastFoldMs: 0,
        bestFastFoldMs: 0,
        p50FastFoldMs: 0,
        p95FastFoldMs: 0,
        p99FastFoldMs: 0,
        maxFastFoldMs: 0,
      } as SessionSummary,
      ...allSessions,
    ]
    : allSessions;
  const currentStreak = calculateStreak(liveSessions);

  useEffect(() => {
    if (!sessionCompleteShown && handsPlayed >= 100) {
      setSessionCompleteModalOpen(true);
      setSessionCompleteShown(true);
    }
  }, [handsPlayed, sessionCompleteShown]);

  useEffect(() => {
    if (!sessionCompleteModalOpen || sessionSummarySaved || !measuredSession.summary || bestFastFold === null) {
      return;
    }

    const summary: SessionSummary = {
      id: sessionId,
      completedAt: new Date().toISOString(),
      handsPlayed,
      avgFastFoldMs: measuredSession.summary.avg,
      bestFastFoldMs: bestFastFold,
      p50FastFoldMs: measuredSession.summary.p50,
      p95FastFoldMs: measuredSession.summary.p95,
      p99FastFoldMs: measuredSession.summary.p99,
      maxFastFoldMs: measuredSession.summary.max,
    };

    saveSessionSummary(summary);
    setSessionSummarySaved(true);
  }, [bestFastFold, handsPlayed, measuredSession.summary, sessionCompleteModalOpen, sessionId, sessionSummarySaved]);

  function runAction(type: GameActionType): void {
    if (!state.tableState.handId || !state.tableState.currentStreet) {
      setMessage('アクション失敗: ハンド未開始');
      return;
    }

    const foldTappedAt = type === 'FOLD' ? performance.now() : undefined;

    const queueActingCandidate = state.queueState.activeTables.get(state.tableState.tableId)?.seatPlayerIds[0] ?? null;
    const actionPlayerId =
      state.tableState.actingPlayerId ??
      state.tableState.actionOrder[0] ??
      queueActingCandidate ??
      activePlayers[0] ??
      HERO_ID;

    const result = applyAction({
      tableId: state.tableState.tableId,
      handId: state.tableState.handId,
      street: state.tableState.currentStreet ?? Street.Flop,
      playerId: actionPlayerId,
      type,
      amount: type === 'RAISE' ? 40 : undefined,
      actedAt: Date.now(),
    });

    if (!result.ok) {
      setMessage(`Action failed: ${result.reason ?? 'unknown'}`);
      return;
    }

    setMessage(`アクション実行: ${type}`);

    if (type === 'FOLD') {
      // ===== Fast Fold Engine Flow =====
      if (foldTappedAt === undefined) {
          setMessage('Fast DBBP失敗: フォールド時刻が取得できません');
        return;
      }

      // 1. FAST_FOLDING 状態に遷移 + foldTappedAt を記録
      setPlayingState('FAST_FOLDING');
      setToast({ title: 'フォールド中...' });

      if (!result.queueEvent) {
        setMessage('Fast DBBP失敗: キューイベント未発行');
        setPlayingState('PLAYING');
        setToast(null);
        return;
      }

      // 2. Queue assignment completed
      const queueAssignedAt = performance.now();
      setPlayingState('WAITING_FOR_ASSIGNMENT');

      // 3. 新しいテーブルを割り当て（既存テーブルを上書きしない）
      const assignResult = assignNextTable();

      if (!assignResult.ok) {
        setMessage(`テーブル割り当て失敗: ${assignResult.reason}`);
        setPlayingState('PLAYING');
        setToast(null);
        return;
      }

      const tableAssignedAt = performance.now();
      const newTableId = assignResult.table?.tableId ?? TABLE_ID;
      const newHandId = assignResult.table?.handId;

      // 4. HAND_LOADING へ遷移
      setPlayingState('HAND_LOADING');

      // 5. 新しいハンドを開始
      const handStartedAt = performance.now();
      const startResult = startHand(newTableId);

      if (!startResult.ok) {
        setMessage(`ハンド開始失敗: ${startResult.reason}`);
        setPlayingState('PLAYING');
        setToast(null);
        return;
      }

      const actionableAt = performance.now();
      const foldToNextHandMs = actionableAt - foldTappedAt;

      const measuredMetric: MeasuredFastFoldMetric = {
        metricSource: 'measured',
        foldTappedAt,
        queueAssignedAt,
        handStartedAt,
        actionableAt,
        foldToNextHandMs,
      };

      setMeasuredSession((prev) => {
        const metrics = [...prev.metrics, measuredMetric].slice(-100);
        return {
          metrics,
          summary: summarize(metrics.map((metric) => metric.foldToNextHandMs)),
        };
      });

      // 6. PLAYING に戻る + 実測値を確定
      setPlayingState('PLAYING');
      setMessage('✨ 次のハンド準備完了');
      setToast({
        title: '✨ 次のハンド準備完了',
        value: `${foldToNextHandMs.toFixed(1)}ms`,
      });
    }
  }

  function handleSave(): void {
    const normalizedQueueState = normalizeQueueStateForSave(state.queueState);
    const notification: PersistenceNotification = {
      point: 'AFTER_APPLY_ACTION',
      tableId: state.tableState.tableId,
      handId: state.tableState.handId,
      at: Date.now(),
    };

    const result = persistence.save(
      notification,
      {
        tableState: state.tableState,
        queueState: normalizedQueueState,
        playerStates: {},
      },
      Date.now(),
    );

    setMessage(result.ok ? '保存しました' : `保存失敗: ${result.reason ?? '不明なエラー'}`);
  }

  function handleRestore(): void {
    const result = restoreGame(TABLE_ID);
    if (!result.ok) {
      setMessage(`復元失敗: ${result.reason ?? '不明なエラー'}`);
      return;
    }

    setScreen('table');
    setMessage('ローカル保存から復元しました');
  }

  function handleStartHand(): void {
    const result = startHand(TABLE_ID);
    if (!result.ok) {
      setMessage(`開始失敗: ${result.reason ?? '不明なエラー'}`);
      return;
    }
    setScreen('table');
    setMessage('ハンド開始');
  }

  if (screen === 'table') {
    return (
      <div className="app-shell" style={{ padding: 0, background: 'none', minHeight: 'auto' }}>
        <TablePage
          boardA={state.tableState.boardA}
          boardB={state.tableState.boardB}
          pot={state.tableState.totalPot}
          players={activePlayers}
          heroId={HERO_ID}
          heroHand={HERO_HAND}
          actingPlayerId={state.tableState.actingPlayerId}
          onFold={() => runAction('FOLD')}
          isFoldAnimating={playingState === 'FAST_FOLDING'}
          onCheck={() => runAction('CHECK')}
          onCall={() => runAction('CALL')}
          onRaise={() => runAction('RAISE')}
          onBackHome={() => setScreen('home')}
          message={message}
        />
        {toast && (
          <div className="toast">
            <p className="toast-title">{toast.title}</p>
            {toast.value && <p className="toast-value">{toast.value}</p>}
          </div>
        )}
        <div className="app-shell" style={{ paddingTop: 0 }}>
          <section className="ui-card">
            <div className="state-row">
              <h2 className="card-title" style={{ marginBottom: 0 }}>状態</h2>
              <span className="state-chip">{playingState}</span>
            </div>
          </section>

          <section className="ui-card" style={{ marginTop: '16px' }}>
            <h2 className="card-title">プレイKPI</h2>
            <div className="metric-main-grid">
              <div className="metric-item">
                <p className="metric-label">今日のハンド数</p>
                <p className="metric-value metric-value-lg">{handsPlayed}</p>
              </div>
              <div className="metric-item">
                <p className="metric-label">本日の目標</p>
                <p className="metric-value metric-value-lg">{handsPlayed} / 100</p>
              </div>
              <div className="metric-item">
                <p className="metric-label">達成率</p>
                <p className="metric-value metric-value-lg">{progressPercent}%</p>
              </div>
            </div>

            <div className="metric-progress-wrap">
              <div className="metric-progress-head">
                <p className="metric-label">進捗</p>
                <p className="metric-progress-text">{progressPercent}%</p>
              </div>
              <div className="metric-progress-track" aria-label="進捗バー">
                <div className="metric-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {measuredSession.summary && (
              <details className="metric-details">
                <summary>詳細を見る</summary>
                <div className="metric-details-grid">
                  <div className="metric-item"><p className="metric-label">平均DBBP</p><p className="metric-value">{measuredSession.summary.avg.toFixed(0)}ms</p></div>
                  <div className="metric-item"><p className="metric-label">最速DBBP</p><p className="metric-value">{bestFastFold !== null ? `${bestFastFold.toFixed(0)}ms` : '-'}</p></div>
                  <div className="metric-item"><p className="metric-label">p50</p><p className="metric-value">{measuredSession.summary.p50.toFixed(1)}ms</p></div>
                  <div className="metric-item"><p className="metric-label">p95</p><p className="metric-value">{measuredSession.summary.p95.toFixed(1)}ms</p></div>
                  <div className="metric-item"><p className="metric-label">p99</p><p className="metric-value">{measuredSession.summary.p99.toFixed(1)}ms</p></div>
                  <div className="metric-item"><p className="metric-label">max</p><p className="metric-value">{measuredSession.summary.max.toFixed(1)}ms</p></div>
                </div>
              </details>
            )}
          </section>
        </div>

        {sessionCompleteModalOpen && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Session Complete Modal">
            <section className="modal-card">
              <p className="modal-kicker">🎉 100ハンド達成！</p>
              <h2 className="modal-title">本日のチャレンジを完了しました。</h2>
              <div className="modal-metrics">
                <div className="modal-metric-item">
                  <p className="modal-metric-label">プレイハンド数</p>
                  <p className="modal-metric-value">{handsPlayed}</p>
                </div>
                <div className="modal-metric-item">
                  <p className="modal-metric-label">本日の目標達成率</p>
                  <p className="modal-metric-value">{progressPercent}%</p>
                </div>
                <div className="modal-metric-item">
                  <p className="modal-metric-label">連続達成日数</p>
                  <p className="modal-metric-value">{currentStreak}日</p>
                </div>
              </div>
              <p className="modal-footer">明日もFast DBBPで続けましょう。</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSessionCompleteModalOpen(false)}
              >
                閉じる
              </button>
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <HomePage
      queueCount={queueCount}
      handsPlayed={handsPlayed}
      allSessions={allSessions}
      recentSessions={recentSessions}
      onPlay={() => {
        joinQueue(HERO_ID, 'human', 1000);
        const result = startHand(TABLE_ID);
        if (!result.ok) {
          setMessage(`開始失敗: ${result.reason ?? '不明なエラー'}`);
          return;
        }
        setScreen('table');
        setMessage('ハンド開始');
      }}
      onSave={handleSave}
      onRestore={handleRestore}
      onReset={() => {
        resetGame();
        setScreen('home');
        setMessage('リセットしました');
      }}
      message={message}
    />
  );
}
