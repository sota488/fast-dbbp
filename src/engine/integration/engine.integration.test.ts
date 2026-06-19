import {
  assignNextTable,
  completeHand as queueCompleteHand,
  createQueue,
  enqueueFromBettingEvent,
  joinQueue,
  validateQueueState,
} from '../queue/index';
import type { QueueState } from '../queue/types';
import { createGameCoordinator } from '../game/index';
import type { BettingPort, CoordinatorContext, PersistenceNotification, PotDistributionPort, QueuePort, ShowdownPort } from '../game/types';
import { applyAction as bettingApplyAction, initializeBettingRound, validateAction as bettingValidateAction } from '../betting/index';
import type { BettingActionInput, BettingEngineView } from '../betting/types';
import { BettingActionType } from '../betting/types';
import { HandRank, compareHands, evaluateOmahaHand } from '../hand-evaluator/index';
import { distributePot } from '../pot-distribution/index';
import { createPersistenceEngine } from '../persistence/index';
import type { StateValidators, StorageAdapter } from '../persistence/types';
import { Street, TableStatus, type TableState } from '../table-state/types';

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
    const k = key(tableState.tableId, handId);
    const existing = views.get(k);
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

    views.set(k, created);
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
      totalPot: Object.values(next.playerCommittedThisHand).reduce((sum, n) => sum + n, base.totalPot),
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

function createShowdownPort(holeCardsByPlayer: Record<string, string[]>): ShowdownPort {
  function boardWinners(tableState: TableState, board: string[]): string[] {
    const active = tableState.actionOrder;
    let best: ReturnType<typeof evaluateOmahaHand> | null = null;
    let winners: string[] = [];

    for (const playerId of active) {
      const hole = holeCardsByPlayer[playerId];
      if (!hole) {
        continue;
      }
      const evaluated = evaluateOmahaHand(hole, board);
      if (!best || compareHands(evaluated, best) === 1) {
        best = evaluated;
        winners = [playerId];
      } else if (best && compareHands(evaluated, best) === 0) {
        winners.push(playerId);
      }
    }

    return winners;
  }

  return {
    evaluateBoardA(tableState) {
      return boardWinners(tableState, tableState.boardA);
    },
    evaluateBoardB(tableState) {
      return boardWinners(tableState, tableState.boardB);
    },
  };
}

function createPotPort(): PotDistributionPort {
  return {
    distribute(totalPot, boardAWinners, boardBWinners) {
      const result = distributePot(totalPot, boardAWinners, boardBWinners);
      return Object.entries(result.payouts).map(([playerId, amount]) => ({ playerId, amount }));
    },
  };
}

describe('engine integration flows', () => {
  function bootstrap() {
    const queue = createQueue({ initialBots: 5, botAutofill: true, now: 1 });
    joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1, balance: 1000 });

    const queueRef = { current: queue };

    const validators: StateValidators = {
      validateQueueState: (q) => validateQueueState(q),
      validateTableState: (table) => ({ isValid: table.tableId.length > 0, errors: table.tableId.length > 0 ? [] : ['tableId empty'] }),
    };
    const storage = createMemoryStorage();
    const persistence = createPersistenceEngine({
      storage,
      validators,
      options: { supportedSchemaVersion: 1, keyPrefix: 'ffo:persistence' },
    });

    const notifications: PersistenceNotification[] = [];
    const persistenceHook = {
      onPersist(notification: PersistenceNotification, context: CoordinatorContext) {
        notifications.push(notification);
        persistence.saveCheckpoint({ notification, context, now: notification.at });
      },
    };

    const queuePort = createQueuePort();
    const bettingPort = createBettingPort(queueRef);

    const holeCards: Record<string, string[]> = {
      H1: ['As', 'Ad', 'Kh', 'Kd'],
      'BOT-1': ['2s', '3s', '4h', '5h'],
      'BOT-2': ['6s', '7s', '8h', '9h'],
      'BOT-3': ['Ts', 'Js', 'Qh', 'Kh'],
      'BOT-4': ['2d', '3d', '4c', '5c'],
      'BOT-5': ['6d', '7d', '8c', '9c'],
    };

    const showdownPort = createShowdownPort(holeCards);
    const potPort = createPotPort();

    const game = createGameCoordinator({
      queue: queuePort,
      betting: bettingPort,
      showdown: showdownPort,
      pot: potPort,
      persistenceHook,
    });

    let context = createContext(queue, createTableState({ tableId: 'table-1', handId: null, actionOrder: [], actingPlayerId: null }));

    return {
      game,
      queueRef,
      persistence,
      storage,
      notifications,
      get context() {
        return context;
      },
      set context(next: CoordinatorContext) {
        context = next;
        queueRef.current = next.queueState;
      },
    };
  }

  it('Scenario-01: 6 seats -> folds until one -> hand complete -> queue reinsertion -> persistence save', () => {
    const rt = bootstrap();

    const started = rt.game.startHand({ context: rt.context, tableId: 'table-1', now: 10 });
    expect(started.ok).toBe(true);
    rt.context = started.context;

    const seats = rt.context.queueState.activeTables.get('table-1')?.seatPlayerIds ?? [];
    expect(seats.length).toBe(6);

    const folders = seats.slice(0, 5);
    let now = 20;
    for (const playerId of folders) {
      const applied = rt.game.applyAction({
        context: rt.context,
        action: {
          tableId: 'table-1',
          handId: rt.context.tableState.handId!,
          street: Street.Flop,
          playerId,
          type: 'FOLD',
          actedAt: now,
        },
      });
      expect(applied.ok).toBe(true);
      rt.context = applied.context;
      now += 1;
    }

    const completed = rt.game.completeHand({
      context: rt.context,
      tableId: 'table-1',
      handId: rt.context.tableState.handId!,
      now: 100,
    });
    expect(completed.ok).toBe(true);
    rt.context = completed.context;

    for (const playerId of folders) {
      const entry = rt.context.queueState.playerPool.get(playerId);
      expect(entry?.status).toBe('WAITING');
      expect(rt.context.queueState.waitingQueue.includes(playerId)).toBe(true);
    }

    const saved = rt.persistence.loadLatest({ tableId: 'table-1' });
    expect(saved.ok).toBe(true);
    expect(rt.notifications.some((n) => n.point === 'AFTER_COMPLETE_HAND')).toBe(true);
  });

  it('Scenario-02: river -> showdown -> pot distribution -> hand complete -> persistence save', () => {
    const rt = bootstrap();

    const started = rt.game.startHand({ context: rt.context, tableId: 'table-1', now: 10 });
    expect(started.ok).toBe(true);
    rt.context = started.context;

    const active = rt.context.queueState.activeTables.get('table-1')!.seatPlayerIds.slice(0, 2);
    rt.context = {
      ...rt.context,
      tableState: {
        ...rt.context.tableState,
        currentStreet: Street.River,
        actionOrder: active,
        actingPlayerId: active[0],
        totalPot: 200,
      },
    };

    const showdown = rt.game.resolveShowdown({
      context: rt.context,
      tableId: 'table-1',
      handId: rt.context.tableState.handId!,
      now: 200,
    });
    expect(showdown.ok).toBe(true);

    const distributed = rt.game.distributePot({
      context: rt.context,
      tableId: 'table-1',
      handId: rt.context.tableState.handId!,
      showdownResult: showdown.showdownResult!,
      now: 210,
    });
    expect(distributed.ok).toBe(true);
    expect(distributed.distributionResult?.totalPot).toBe(200);

    const completed = rt.game.completeHand({
      context: rt.context,
      tableId: 'table-1',
      handId: rt.context.tableState.handId!,
      now: 220,
    });
    expect(completed.ok).toBe(true);

    const saved = rt.persistence.loadLatest({ tableId: 'table-1' });
    expect(saved.ok).toBe(true);
    expect(rt.notifications.some((n) => n.point === 'AFTER_RESOLVE_SHOWDOWN')).toBe(true);
    expect(rt.notifications.some((n) => n.point === 'AFTER_DISTRIBUTE_POT')).toBe(true);
  });

  it('Scenario-03: fast fold -> queue enqueue request -> queue rejoin -> same hand rejoin rejected', () => {
    const rt = bootstrap();

    const started = rt.game.startHand({ context: rt.context, tableId: 'table-1', now: 10 });
    expect(started.ok).toBe(true);
    rt.context = started.context;

    const playerId = rt.context.queueState.activeTables.get('table-1')!.seatPlayerIds[0];
    const handId = rt.context.tableState.handId!;

    const applied = rt.game.applyAction({
      context: rt.context,
      action: {
        tableId: 'table-1',
        handId,
        street: Street.Flop,
        playerId,
        type: 'FOLD',
        actedAt: 20,
      },
    });

    expect(applied.ok).toBe(true);
    expect(applied.queueEvent?.type).toBe('QUEUE_ENQUEUE_REQUEST');
    rt.context = applied.context;

    const duplicate = enqueueFromBettingEvent(rt.context.queueState, applied.queueEvent!);
    expect(duplicate.enqueued).toBe(false);
    expect(duplicate.reason).toBe('DUPLICATE_DEDUPE_KEY');

    const sameHandAssign = assignNextTable(rt.context.queueState, {
      tableId: 'table-2',
      handId,
      now: 21,
    });
    expect(sameHandAssign.assignedPlayerIds.includes(playerId)).toBe(false);
  });

  it('Scenario-04: persistence restore -> snapshot load -> queue/table restore -> continue play', () => {
    const rt = bootstrap();

    const started = rt.game.startHand({ context: rt.context, tableId: 'table-1', now: 10 });
    expect(started.ok).toBe(true);
    rt.context = started.context;

    const saved = rt.persistence.loadLatest({ tableId: 'table-1' });
    expect(saved.ok).toBe(true);

    const restoredQueue = rt.persistence.deserializeQueueState(saved.envelope!.context.queueState);
    const restoredContext: CoordinatorContext = {
      ...saved.envelope!.context,
      queueState: restoredQueue,
    };

    const continued = rt.game.startHand({
      context: {
        ...restoredContext,
        tableState: {
          ...restoredContext.tableState,
          tableId: 'table-2',
          handId: null,
          status: TableStatus.WaitingForPlayers,
        },
      },
      tableId: 'table-2',
      now: 30,
    });

    expect(continued.ok).toBe(true);
    expect(continued.context.tableState.handId).not.toBeNull();
  });

  it('Scenario-02b: persistence latest snapshot point should be AFTER_COMPLETE_HAND', () => {
    const rt = bootstrap();

    const started = rt.game.startHand({ context: rt.context, tableId: 'table-1', now: 10 });
    expect(started.ok).toBe(true);
    rt.context = started.context;

    const completed = rt.game.completeHand({
      context: rt.context,
      tableId: 'table-1',
      handId: rt.context.tableState.handId!,
      now: 99,
    });
    expect(completed.ok).toBe(true);

    const latest = rt.persistence.loadLatest({ tableId: 'table-1' });
    expect(latest.ok).toBe(true);
    expect(latest.envelope?.point).toBe('AFTER_COMPLETE_HAND');
  });
});
