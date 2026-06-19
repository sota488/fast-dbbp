import { createGameCoordinator } from '../game/index';
import type {
  BettingPort,
  CoordinatorContext,
  PersistenceHook,
  PotDistributionPort,
  QueuePort,
  ShowdownPort,
} from '../game/types';
import { applyAction as bettingApplyAction, initializeBettingRound, validateAction as bettingValidateAction } from '../betting/index';
import type { BettingActionInput, BettingEngineView } from '../betting/types';
import { BettingActionType } from '../betting/types';
import { createPersistenceEngine } from '../persistence/index';
import type { StateValidators, StorageAdapter } from '../persistence/types';
import { createQueue, joinQueue, completeHand as queueCompleteHand, validateQueueState, assignNextTable, enqueueFromBettingEvent } from '../queue/index';
import type { QueueState } from '../queue/types';
import { Street, TableStatus, type TableState } from '../table-state/types';
import { HandHistoryEngine } from '../hand-history';
import type {
  ActionAppliedEvent,
  FastFoldConfirmedEvent,
  HandCompletedEvent,
  HandRecord,
  HandRecordFinalizedEvent,
  HandStartedEvent,
  PlayerSnapshot,
} from '../hand-history/types';
import { createDurabilityReport, type FastFoldDurabilityReport } from './simulation';

export type MetricSource = 'synthetic' | 'measured';

export interface FastFoldRealEngineSimulationResult {
  handRecords: HandRecord[];
  report: FastFoldDurabilityReport;
  metricSource: {
    foldToNextHandMs: MetricSource;
    handStartToActionableMs: MetricSource;
  };
  summaryText: string;
  segmentSummaries: Array<{
    rangeLabel: string;
    avgFoldToNextHandMs: number;
    avgHandStartToActionableMs: number;
  }>;
  executionPath: {
    queueEngine: boolean;
    tableAssignment: boolean;
    gameCoordinator: boolean;
    persistence: boolean;
    handHistory: boolean;
  };
}

function createMemoryStorage(seed?: Record<string, string>): StorageAdapter {
  const map = new Map<string, string>(Object.entries(seed ?? {}));

  return {
    get length() {
      return map.size;
    },
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    key(index: number): string | null {
      const keys = Array.from(map.keys());
      return keys[index] ?? null;
    },
  };
}

function createTableState(overrides: Partial<TableState> = {}): TableState {
  return {
    tableId: 'table-1',
    handId: null,
    status: TableStatus.WaitingForPlayers,
    players: [],
    playerStates: {},
    totalPot: 120,
    potA: 60,
    potB: 60,
    boardA: ['As', 'Kd', 'Qc', 'Jh', 'Ts'],
    boardB: ['2s', '3d', '4c', '5h', '6s'],
    currentStreet: Street.Flop,
    actingPlayerId: null,
    actionOrder: [],
    queuedPlayers: [],
    completedPlayers: [],
    handStartAt: 1,
    handEndAt: null,
    streetBetState: null,
    audit: {
      handStartAt: 1,
      handEndAt: null,
      lastTransitionAt: 1,
      lastTransitionEvent: null,
    },
    persistence: {
      storageKey: 'k',
      version: 1,
      updatedAt: 1,
    },
    ...overrides,
  };
}

function createContext(queueState: QueueState, tableState?: TableState): CoordinatorContext {
  return {
    tableState: tableState ?? createTableState(),
    playerStates: {},
    queueState,
  };
}

function createQueuePort(): QueuePort {
  return {
    assignNextTable: (queue, options) => assignNextTable(queue, options),
    enqueueFromBettingEvent: (queue, event) => enqueueFromBettingEvent(queue, event),
    completeHand: (queue, input) => queueCompleteHand(queue, input),
    validateQueueState: (queue) => validateQueueState(queue),
  };
}

function createBettingPort(queueRef: { current: QueueState }): BettingPort {
  const views = new Map<string, BettingEngineView>();
  const dedupe = new Set<string>();

  function key(tableId: string, handId: string): string {
    return `${tableId}:${handId}`;
  }

  function seatOrder(tableId: string): string[] {
    return queueRef.current.activeTables.get(tableId)?.seatPlayerIds ?? [];
  }

  function ensureView(tableState: TableState): BettingEngineView {
    const handId = tableState.handId ?? 'hand-unknown';
    const viewKey = key(tableState.tableId, handId);
    const existing = views.get(viewKey);
    if (existing) {
      return existing;
    }

    const order = tableState.actionOrder.length > 0 ? [...tableState.actionOrder] : [...seatOrder(tableState.tableId)];
    const balances: Record<string, number> = {};
    const committedStreet: Record<string, number> = {};
    const committedHand: Record<string, number> = {};

    order.forEach((id) => {
      balances[id] = 1000;
      committedStreet[id] = 0;
      committedHand[id] = 0;
    });

    const created: BettingEngineView = {
      tableId: tableState.tableId,
      handId,
      street: tableState.currentStreet ?? Street.Flop,
      streetFirstActorOrder: [...order],
      round: initializeBettingRound(20),
      turn: {
        actingPlayerId: tableState.actingPlayerId ?? order[0] ?? null,
        actionOrder: [...order],
      },
      foldedPlayerIds: [],
      playerBalances: balances,
      playerCommittedThisStreet: committedStreet,
      playerCommittedThisHand: committedHand,
      bombPotPostedPlayerIds: [],
    };

    views.set(viewKey, created);
    return created;
  }

  function toTableState(base: TableState, next: BettingEngineView): TableState {
    return {
      ...base,
      handId: next.handId,
      tableId: next.tableId,
      currentStreet: next.street,
      actingPlayerId: next.turn.actingPlayerId,
      actionOrder: [...next.turn.actionOrder],
      totalPot: Object.values(next.playerCommittedThisHand).reduce((sum, amount) => sum + amount, base.totalPot),
      status: base.status,
    };
  }

  return {
    validateAction(tableState, input) {
      const view = ensureView(tableState);
      const result = bettingValidateAction(view, {
        tableId: input.tableId,
        handId: input.handId,
        street: input.street,
        playerId: input.playerId,
        type: input.type as BettingActionType,
        amount: input.amount,
        actedAt: input.actedAt,
      } satisfies BettingActionInput);

      return {
        isValid: result.isValid,
        code: result.code,
        reason: result.reason,
      };
    },

    applyAction(tableState, input) {
      const view = ensureView(tableState);
      const result = bettingApplyAction(
        view,
        {
          tableId: input.tableId,
          handId: input.handId,
          street: input.street,
          playerId: input.playerId,
          type: input.type as BettingActionType,
          amount: input.amount,
          actedAt: input.actedAt,
        },
        dedupe,
      );

      views.set(key(result.view.tableId, result.view.handId), result.view);

      return {
        tableState: toTableState(tableState, result.view),
        queueEvent: result.foldResolution?.queueEventEmitted ? result.foldResolution.queueEvent : undefined,
        validation: {
          isValid: result.validation.isValid,
          code: result.validation.code,
          reason: result.validation.reason,
        },
      };
    },
  };
}

function createNoopShowdownPort(): ShowdownPort {
  return {
    evaluateBoardA: () => [],
    evaluateBoardB: () => [],
  };
}

function createNoopPotPort(): PotDistributionPort {
  return {
    distribute: () => [],
  };
}

function createPlayers(): PlayerSnapshot[] {
  return [
    { playerId: 'hero', playerType: 'human', seatIndex: 0, position: 'BTN', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-1', playerType: 'bot', seatIndex: 1, position: 'SB', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-2', playerType: 'bot', seatIndex: 2, position: 'BB', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-3', playerType: 'bot', seatIndex: 3, position: 'UTG', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-4', playerType: 'bot', seatIndex: 4, position: 'HJ', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-5', playerType: 'bot', seatIndex: 5, position: 'CO', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
  ];
}

function createBoard(seed: number): string[] {
  const base = ['Ah', 'Kd', 'Qc', 'Js', 'Tc', '9h', '8d', '7c', '6s', '5h'];
  const offset = seed % base.length;
  return Array.from({ length: 5 }, (_, index) => base[(offset + index) % base.length]);
}

function summarizeAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetricSummary(metricName: string, metric: FastFoldDurabilityReport['foldToNextHandMs']): string {
  return [
    `${metricName} (Synthetic Metrics):`,
    `avg: ${metric.avg.toFixed(3)}`,
    `median: ${metric.median.toFixed(3)}`,
    `p50: ${metric.p50.toFixed(3)}`,
    `p95: ${metric.p95.toFixed(3)}`,
    `p99: ${metric.p99.toFixed(3)}`,
    `max: ${metric.max.toFixed(3)}`,
  ].join('\n');
}

function buildSegmentSummaries(handRecords: HandRecord[]): Array<{
  rangeLabel: string;
  avgFoldToNextHandMs: number;
  avgHandStartToActionableMs: number;
}> {
  const ranges: Array<[number, number]> = [
    [1, 20],
    [21, 40],
    [41, 60],
    [61, 80],
    [81, 100],
  ];

  return ranges.map(([start, end]) => {
    const records = handRecords.filter((record) => record.sessionHandNumber >= start && record.sessionHandNumber <= end);
    return {
      rangeLabel: `${start}-${end}`,
      avgFoldToNextHandMs: summarizeAverage(records.map((record) => record.foldToNextHandMs ?? 0)),
      avgHandStartToActionableMs: summarizeAverage(records.map((record) => record.handStartToActionableMs ?? 0)),
    };
  });
}

function formatSegmentSummaries(segmentSummaries: FastFoldRealEngineSimulationResult['segmentSummaries']): string {
  return segmentSummaries
    .map((segment) => [
      `${segment.rangeLabel}:`,
      `avg foldToNextHandMs: ${segment.avgFoldToNextHandMs.toFixed(3)}`,
      `avg handStartToActionableMs: ${segment.avgHandStartToActionableMs.toFixed(3)}`,
    ].join('\n'))
    .join('\n\n');
}

export function simulateFastFold100HandsThroughEngine(): FastFoldRealEngineSimulationResult {
  const queue = createQueue({ initialBots: 0, botAutofill: true, now: 1 });
  joinQueue(queue, { playerId: 'hero', playerType: 'human', now: 1, balance: 1000 });

  const queueRef = { current: queue };
  const notifications: Array<{ tableId: string; handId: string | null }> = [];
  const storage = createMemoryStorage();

  const validators: StateValidators = {
    validateQueueState: (q) => validateQueueState(q),
    validateTableState: (table) => ({ isValid: table.tableId.length > 0, errors: table.tableId.length > 0 ? [] : ['tableId empty'] }),
  };

  const persistence = createPersistenceEngine({
    storage,
    validators,
    options: { supportedSchemaVersion: 1, keyPrefix: 'ffo:persistence' },
  });

  const persistenceHook: PersistenceHook = {
    onPersist(notification, context) {
      notifications.push({ tableId: notification.tableId, handId: notification.handId });
      persistence.saveCheckpoint({ notification, context, now: notification.at });
    },
  };

  const game = createGameCoordinator({
    queue: createQueuePort(),
    betting: createBettingPort(queueRef),
    showdown: createNoopShowdownPort(),
    pot: createNoopPotPort(),
    persistenceHook,
  });

  let context = createContext(queue, createTableState({ tableId: 'table-1', handId: null, actionOrder: [], actingPlayerId: null }));

  const history = new HandHistoryEngine();
  const handRecords: HandRecord[] = [];
  history.subscribe({
    onActionRecorded: () => undefined,
    onHandRecordFinalized: (event: HandRecordFinalizedEvent) => {
      handRecords.push(event.handRecord);
    },
  });

  let queueEngineUsed = false;
  let tableAssignmentUsed = false;
  let gameCoordinatorUsed = false;

  let now = 1_000_000;

  for (let handNumber = 1; handNumber <= 100; handNumber += 1) {
    const handId = `hand-${handNumber}`;
    const startedAt = now;
    const handStartToActionableMs = 20 + (handNumber % 7);
    const actionableAt = startedAt + handStartToActionableMs;
    const foldedAt = actionableAt + 5;
    const foldToNextHandMs = 120 + (handNumber % 13);
    const dequeuedAt = foldedAt + foldToNextHandMs;
    const completedAt = dequeuedAt + 1;

    const started = game.startHand({
      context,
      tableId: 'table-1',
      now: startedAt,
      requestedHandId: handId,
    });

    if (!started.ok) {
      throw new Error(`startHand failed at hand ${handNumber}: ${started.reason ?? 'unknown'}`);
    }

    gameCoordinatorUsed = true;
    queueEngineUsed = true;
    tableAssignmentUsed = started.context.queueState.activeTables.has('table-1');

    context = started.context;

    const handStartedEvent: HandStartedEvent = {
      handId,
      sessionId: 'fast-fold-real-engine-session',
      sessionHandNumber: handNumber,
      tableId: context.tableState.tableId,
      tableSeq: handNumber,
      heroPlayerId: 'hero',
      players: createPlayers(),
      boardA: createBoard(handNumber),
      boardB: createBoard(handNumber + 1),
      blindSize: { sb: 10, bb: 20 },
      format: 'PLO6MAX',
      startedAt,
      actionableAt,
    };

    history.onHandStarted(handStartedEvent);

    const actingPlayerId = context.tableState.actingPlayerId ?? context.tableState.actionOrder[0] ?? 'hero';
    const applied = game.applyAction({
      context,
      action: {
        tableId: context.tableState.tableId,
        handId,
        street: Street.Flop,
        playerId: actingPlayerId,
        type: 'FOLD',
        actedAt: foldedAt,
      },
    });

    if (!applied.ok) {
      throw new Error(`applyAction failed at hand ${handNumber}: ${applied.reason ?? 'unknown'}`);
    }

    gameCoordinatorUsed = true;
    queueEngineUsed = queueEngineUsed || applied.queueEvent !== undefined;
    context = applied.context;

    const actionAppliedEvent: ActionAppliedEvent = {
      handId,
      sessionId: 'fast-fold-real-engine-session',
      playerId: actingPlayerId,
      position: 'BTN',
      street: Street.Flop,
      action: 'FOLD',
      amount: 0,
      potBefore: 30,
      potAfter: 30,
      stackBefore: 1000,
      stackAfter: 1000,
      toCall: 0,
      seq: 1,
      timestamp: foldedAt,
      preflopRaiseCountBeforeAction: 0,
      preflopRaiseAmountBeforeAction: 0,
      isOpportunityVpip: true,
      isOpportunityPfr: true,
      isOpportunity3Bet: false,
      isOpportunityWtsd: false,
      isAutoAction: false,
    };

    history.onActionApplied(actionAppliedEvent);

    if (applied.queueEvent) {
      history.onFastFoldConfirmed({
        handId,
        sessionId: 'fast-fold-real-engine-session',
        playerId: actingPlayerId,
        foldedAt,
        dequeuedAt,
        tableId: context.tableState.tableId,
        nextTableId: context.tableState.tableId,
      } satisfies FastFoldConfirmedEvent);
    }

    const completed = game.completeHand({
      context,
      tableId: context.tableState.tableId,
      handId,
      now: completedAt,
    });

    if (!completed.ok) {
      throw new Error(`completeHand failed at hand ${handNumber}: ${completed.reason ?? 'unknown'}`);
    }

    gameCoordinatorUsed = true;
    context = completed.context;

    const handCompletedEvent: HandCompletedEvent = {
      handId,
      sessionId: 'fast-fold-real-engine-session',
      terminalReason: 'FOLDED',
      startedAt,
      actionableAt,
      endedAt: completedAt,
      durationMs: completedAt - startedAt,
      handStartToActionableMs,
      heroPlayerId: 'hero',
      heroOutcomeAmount: 0,
    };

    history.onHandCompleted(handCompletedEvent);

    const loadLatest = persistence.loadLatest({ tableId: 'table-1' });
    if (!loadLatest.ok) {
      throw new Error(`persistence loadLatest failed at hand ${handNumber}: ${loadLatest.reason ?? 'unknown'}`);
    }

    now = completedAt + 5;
  }

  const report = createDurabilityReport(handRecords);
  const segmentSummaries = buildSegmentSummaries(handRecords);
  const summaryText = [
    '# Test Result',
    'MetricSource: synthetic',
    `Hands Played: ${report.sessionHandsPlayed}`,
    `Completion Rate: ${report.completionRate.toFixed(2)}%`,
    `History Missing: ${report.historyMissingCount}`,
    `Error Count: ${report.errorCount}`,
    `Crash Count: ${report.crashCount}`,
    '',
    formatMetricSummary('foldToNextHandMs', report.foldToNextHandMs),
    '',
    formatMetricSummary('handStartToActionableMs', report.handStartToActionableMs),
    '',
    formatSegmentSummaries(segmentSummaries),
    '',
    `Pass/Fail: ${report.passFail}`,
  ].join('\n');

  return {
    handRecords,
    report,
    metricSource: {
      foldToNextHandMs: 'synthetic',
      handStartToActionableMs: 'synthetic',
    },
    summaryText,
    segmentSummaries,
    executionPath: {
      queueEngine: queueEngineUsed,
      tableAssignment: tableAssignmentUsed,
      gameCoordinator: gameCoordinatorUsed,
      persistence: notifications.length > 0,
      handHistory: handRecords.length === 100,
    },
  };
}