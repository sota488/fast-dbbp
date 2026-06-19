import { useCallback, useMemo, useRef, useState } from 'react';
import { applyAction as bettingApplyAction, initializeBettingRound, validateAction as bettingValidateAction } from '../engine/betting/index';
import { BettingActionType, type BettingActionInput, type BettingEngineView } from '../engine/betting/types';
import { createGameCoordinator } from '../engine/game/index';
import type { BettingPort, CoordinatorContext, GameActionInput, QueuePort, ShowdownPort } from '../engine/game/types';
import { distributePot } from '../engine/pot-distribution/index';
import { assignNextTable, completeHand as queueCompleteHand, createQueue, enqueueFromBettingEvent, joinQueue, validateQueueState } from '../engine/queue/index';
import type { QueueState } from '../engine/queue/types';
import { Street, TableStatus, type TableState } from '../engine/table-state/types';
import type { AppState, BettingState } from '../state/AppState';
import type { StorageAdapter } from '../engine/persistence/types';
import { usePersistence } from './usePersistence';

interface UseGameEngineOptions {
  storage?: StorageAdapter;
  now?: () => number;
}

interface UseGameEngineApi {
  state: AppState;
  joinQueue: (playerId: string, playerType?: 'human' | 'bot', balance?: number) => void;
  startHand: (tableId?: string) => { ok: boolean; reason?: string };
  applyAction: (action: GameActionInput) => { ok: boolean; reason?: string; queueEvent?: any };
  enqueueFromBettingEvent: (event: any) => { ok: boolean; reason?: string };
  assignNextTable: (options?: { tableId?: string; handId?: string }) => {
    ok: boolean;
    reason?: string;
    table?: { tableId: string; handId: string; seatPlayerIds: string[]; startedAt: number };
  };
  restoreGame: (tableId?: string) => { ok: boolean; reason?: string };
  resetGame: () => void;
}

function createInitialTableState(tableId = 'table-1'): TableState {
  return {
    tableId,
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
    handStartAt: null,
    handEndAt: null,
    streetBetState: null,
    audit: {
      handStartAt: null,
      handEndAt: null,
      lastTransitionAt: null,
      lastTransitionEvent: null,
    },
    persistence: {
      storageKey: 'game',
      version: 1,
      updatedAt: 0,
    },
  };
}

function createInitialBettingState(): BettingState {
  return {
    lastActionType: null,
    lastError: null,
  };
}

function toContext(state: AppState): CoordinatorContext {
  return {
    tableState: state.tableState,
    queueState: state.queueState,
    playerStates: {},
  };
}

export function useGameEngine(options: UseGameEngineOptions = {}): UseGameEngineApi {
  const now = options.now ?? (() => Date.now());

  const persistence = usePersistence({ storage: options.storage, keyPrefix: 'ffo:persistence', supportedSchemaVersion: 1 });

  const [state, setState] = useState<AppState>({
    queueState: createQueue({ initialBots: 5, botAutofill: true, now: now() }),
    tableState: createInitialTableState(),
    bettingState: createInitialBettingState(),
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const queueRef = useRef(state.queueState);
  queueRef.current = state.queueState;

  const bettingPort = useMemo<BettingPort>(() => {
    const views = new Map<string, BettingEngineView>();
    const dedupe = new Set<string>();

    function viewKey(tableId: string, handId: string): string {
      return `${tableId}:${handId}`;
    }

    function tableSeats(tableId: string): string[] {
      return queueRef.current.activeTables.get(tableId)?.seatPlayerIds ?? [];
    }

    function ensureView(tableState: TableState): BettingEngineView {
      const handId = tableState.handId ?? 'unknown-hand';
      const k = viewKey(tableState.tableId, handId);
      const existing = views.get(k);
      if (existing) {
        return existing;
      }

      const order = tableState.actionOrder.length > 0 ? [...tableState.actionOrder] : [...tableSeats(tableState.tableId)];
      const playerBalances: Record<string, number> = {};
      const committedStreet: Record<string, number> = {};
      const committedHand: Record<string, number> = {};
      order.forEach((id) => {
        playerBalances[id] = 1000;
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
        playerBalances,
        playerCommittedThisStreet: committedStreet,
        playerCommittedThisHand: committedHand,
        bombPotPostedPlayerIds: [],
      };

      views.set(k, created);
      return created;
    }

    function toTableState(base: TableState, view: BettingEngineView): TableState {
      return {
        ...base,
        handId: view.handId,
        currentStreet: view.street,
        actingPlayerId: view.turn.actingPlayerId,
        actionOrder: [...view.turn.actionOrder],
        totalPot: Object.values(view.playerCommittedThisHand).reduce((sum, n) => sum + n, base.totalPot),
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
        return { isValid: result.isValid, code: result.code, reason: result.reason };
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

        views.set(viewKey(result.view.tableId, result.view.handId), result.view);

        return {
          tableState: toTableState(tableState, result.view),
          queueEvent: result.foldResolution?.queueEventEmitted ? result.foldResolution.queueEvent : undefined,
          validation: { isValid: result.validation.isValid, code: result.validation.code, reason: result.validation.reason },
        };
      },
    };
  }, []);

  const queuePort = useMemo<QueuePort>(() => {
    return {
      assignNextTable(queue, options) {
        return assignNextTable(queue, options);
      },
      enqueueFromBettingEvent(queue, event) {
        return enqueueFromBettingEvent(queue, event);
      },
      completeHand(queue, input) {
        return queueCompleteHand(queue, input);
      },
      validateQueueState(queue) {
        return validateQueueState(queue);
      },
    };
  }, []);

  const showdownPort = useMemo<ShowdownPort>(() => {
    return {
      evaluateBoardA(tableState) {
        return tableState.actionOrder.length > 0 ? [tableState.actionOrder[0]] : [];
      },
      evaluateBoardB(tableState) {
        return tableState.actionOrder.length > 0 ? [tableState.actionOrder[0]] : [];
      },
    };
  }, []);

  const game = useMemo(() => {
    return createGameCoordinator({
      queue: queuePort,
      betting: bettingPort,
      showdown: showdownPort,
      pot: {
        distribute(totalPot, boardAWinners, boardBWinners) {
          const result = distributePot(totalPot, boardAWinners, boardBWinners);
          return Object.entries(result.payouts).map(([playerId, amount]) => ({ playerId, amount }));
        },
      },
      persistenceHook: {
        onPersist(notification, context) {
          persistence.save(notification, context, notification.at);
        },
      },
    });
  }, [bettingPort, persistence, queuePort, showdownPort]);

  const joinQueueAction = useCallback((playerId: string, playerType: 'human' | 'bot' = 'human', balance = 1000) => {
    const result = joinQueue(stateRef.current.queueState, {
      playerId,
      playerType,
      balance,
      now: now(),
    });

    setState((prev) => ({
      ...prev,
      queueState: result.queue,
    }));
  }, [now]);

  const startHand = useCallback((tableId = 'table-1') => {
    const existingTable = stateRef.current.queueState.activeTables.get(tableId);
    if (existingTable) {
      setState((prev) => ({
        ...prev,
        tableState: {
          ...prev.tableState,
          tableId: existingTable.tableId,
          handId: existingTable.handId,
          status: TableStatus.FlopBetting,
          currentStreet: Street.Flop,
          actionOrder: [...existingTable.seatPlayerIds],
          actingPlayerId: existingTable.seatPlayerIds[0] ?? null,
          handStartAt: existingTable.startedAt,
          handEndAt: null,
        },
        bettingState: {
          ...prev.bettingState,
          lastError: null,
        },
      }));

      return { ok: true };
    }

    const result = game.startHand({
      context: toContext(stateRef.current),
      tableId,
      now: now(),
    });

    if (!result.ok) {
      setState((prev) => ({
        ...prev,
        bettingState: {
          ...prev.bettingState,
          lastError: result.reason ?? 'start failed',
        },
      }));
      return { ok: false, reason: result.reason };
    }

    setState((prev) => ({
      ...prev,
      queueState: result.context.queueState,
      tableState: result.context.tableState,
      bettingState: {
        ...prev.bettingState,
        lastError: null,
      },
    }));

    return { ok: true };
  }, [game, now]);

  const applyAction = useCallback((action: GameActionInput) => {
    const result = game.applyAction({
      context: toContext(stateRef.current),
      action,
    });

    if (!result.ok) {
      setState((prev) => ({
        ...prev,
        bettingState: {
          ...prev.bettingState,
          lastActionType: action.type,
          lastError: result.reason ?? 'apply failed',
        },
      }));
      return { ok: false, reason: result.reason };
    }

    setState((prev) => ({
      ...prev,
      queueState: result.context.queueState,
      tableState: result.context.tableState,
      bettingState: {
        ...prev.bettingState,
        lastActionType: action.type,
        lastError: null,
      },
    }));

    return { ok: true, queueEvent: result.queueEvent };
  }, [game]);

  const restoreGame = useCallback((tableId = 'table-1') => {
    const restored = persistence.restore(tableId);
    if (!restored.ok || !restored.context) {
      return { ok: false, reason: restored.reason };
    }

    setState((prev) => ({
      ...prev,
      queueState: restored.context!.queueState,
      tableState: restored.context!.tableState,
      bettingState: {
        ...prev.bettingState,
        lastError: null,
      },
    }));

    return { ok: true };
  }, [persistence]);

  const resetGame = useCallback(() => {
    persistence.clear();
    setState({
      queueState: createQueue({ initialBots: 5, botAutofill: true, now: now() }),
      tableState: createInitialTableState(),
      bettingState: createInitialBettingState(),
    });
  }, [now, persistence]);

  const enqueueFromFold = useCallback((event: any) => {
    const result = enqueueFromBettingEvent(stateRef.current.queueState, event);
    if (!result.enqueued) {
      return { ok: false, reason: result.reason };
    }

    setState((prev) => ({
      ...prev,
      queueState: result.queue,
    }));

    return { ok: true };
  }, []);

  const assignNextTableAction = useCallback((options?: { tableId?: string; handId?: string }) => {
    const result = assignNextTable(stateRef.current.queueState, { now: now(), ...options });
    if (!result.table) {
      return { ok: false, reason: result.reason };
    }

    setState((prev) => ({
      ...prev,
      queueState: result.queue,
    }));

    return { ok: true, table: result.table };
  }, [now]);

  return {
    state,
    joinQueue: joinQueueAction,
    startHand,
    applyAction,
    enqueueFromBettingEvent: enqueueFromFold,
    assignNextTable: assignNextTableAction,
    restoreGame,
    resetGame,
  };
}
