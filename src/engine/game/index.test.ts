import { TableStatus, type TableState } from '../table-state/types';
import type { QueueState } from '../queue/types';
import { createGameCoordinator } from './index';
import type {
  ApplyActionInput,
  CoordinatorContext,
  DistributePotInput,
  GameShowdownResult,
  PersistenceHook,
  QueuePort,
  BettingPort,
  ShowdownPort,
  PotDistributionPort,
} from './types';

function createQueueState(): QueueState {
  return {
    queueId: 'queue-1',
    botAutofill: true,
    playerPool: new Map(),
    waitingQueue: [],
    activeTableIds: new Set(),
    activeTables: new Map(),
    handRegistry: new Map(),
    processedDedupeKeys: new Set(),
    transitionLog: [],
    nextTableSeq: 1,
    nextHandSeq: 1,
    nextBotSeq: 1,
  };
}

function createTableState(overrides: Partial<TableState> = {}): TableState {
  return {
    tableId: 'table-1',
    handId: 'hand-1',
    status: TableStatus.FlopBetting,
    players: [],
    playerStates: {},
    totalPot: 120,
    potA: 60,
    potB: 60,
    boardA: ['As', 'Kd', 'Qc', 'Jh', 'Ts'],
    boardB: ['2s', '3d', '4c', '5h', '6s'],
    currentStreet: 'SHOWDOWN' as never,
    actingPlayerId: 'H1',
    actionOrder: ['H1', 'B1'],
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

function createContext(overrides: Partial<CoordinatorContext> = {}): CoordinatorContext {
  return {
    tableState: createTableState(),
    playerStates: {},
    queueState: createQueueState(),
    ...overrides,
  };
}

describe('game coordinator (stateless TDD)', () => {
  function createDeps() {
    const queue: jest.Mocked<QueuePort> = {
      assignNextTable: jest.fn(),
      enqueueFromBettingEvent: jest.fn(),
      completeHand: jest.fn(),
      validateQueueState: jest.fn(),
    };

    const betting: jest.Mocked<BettingPort> = {
      validateAction: jest.fn(),
      applyAction: jest.fn(),
    };

    const showdown: jest.Mocked<ShowdownPort> = {
      evaluateBoardA: jest.fn(),
      evaluateBoardB: jest.fn(),
    };

    const pot: jest.Mocked<PotDistributionPort> = {
      distribute: jest.fn(),
    };

    const persistenceHook: jest.Mocked<PersistenceHook> = {
      onPersist: jest.fn(),
    };

    return { queue, betting, showdown, pot, persistenceHook };
  }

  it('startHand: queue validation failed returns QUEUE_STATE_INVALID', () => {
    const deps = createDeps();
    deps.queue.validateQueueState.mockReturnValue({ isValid: false, errors: ['x'] });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.startHand({ context: createContext(), tableId: 'table-1', now: 10 });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('QUEUE_STATE_INVALID');
    expect(deps.queue.assignNextTable).not.toHaveBeenCalled();
  });

  it('startHand: no players returns NO_PLAYERS_AVAILABLE', () => {
    const deps = createDeps();
    deps.queue.validateQueueState.mockReturnValue({ isValid: true, errors: [] });
    deps.queue.assignNextTable.mockReturnValue({
      queue: createQueueState(),
      assignedPlayerIds: [],
      reason: 'NO_PLAYERS_AVAILABLE',
    });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.startHand({ context: createContext(), tableId: 'table-1', now: 10 });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_PLAYERS_AVAILABLE');
  });

  it('startHand: insufficient players maps to INSUFFICIENT_PLAYERS', () => {
    const deps = createDeps();
    deps.queue.validateQueueState.mockReturnValue({ isValid: true, errors: [] });
    deps.queue.assignNextTable.mockReturnValue({
      queue: createQueueState(),
      assignedPlayerIds: [],
      reason: 'INSUFFICIENT_PLAYERS',
    });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.startHand({ context: createContext(), tableId: 'table-1', now: 10 });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_PLAYERS');
  });

  it('startHand: unknown queue reason maps to UNKNOWN_ERROR', () => {
    const deps = createDeps();
    deps.queue.validateQueueState.mockReturnValue({ isValid: true, errors: [] });
    deps.queue.assignNextTable.mockReturnValue({
      queue: createQueueState(),
      assignedPlayerIds: [],
      reason: 'SOMETHING_ELSE',
    });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.startHand({ context: createContext(), tableId: 'table-1', now: 10 });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UNKNOWN_ERROR');
  });

  it('startHand: success emits AFTER_START_HAND persistence point', () => {
    const deps = createDeps();
    deps.queue.validateQueueState.mockReturnValue({ isValid: true, errors: [] });
    deps.queue.assignNextTable.mockReturnValue({
      queue: createQueueState(),
      assignedPlayerIds: ['H1', 'B1', 'B2', 'B3', 'B4', 'B5'],
      table: { tableId: 'table-1', handId: 'hand-2', seatPlayerIds: ['H1', 'B1', 'B2', 'B3', 'B4', 'B5'], startedAt: 10 },
    });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.startHand({ context: createContext(), tableId: 'table-1', now: 10 });

    expect(result.ok).toBe(true);
    expect(result.persistence?.point).toBe('AFTER_START_HAND');
    expect(deps.persistenceHook.onPersist).toHaveBeenCalledTimes(1);
  });

  it('applyAction: tableId mismatch returns TABLE_ID_MISMATCH', () => {
    const deps = createDeps();
    const coordinator = createGameCoordinator(deps);
    const input: ApplyActionInput = {
      context: createContext(),
      action: {
        tableId: 'other',
        handId: 'hand-1',
        street: 'FLOP' as never,
        playerId: 'H1',
        type: 'CHECK',
        actedAt: 11,
      },
    };

    const result = coordinator.applyAction(input);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('TABLE_ID_MISMATCH');
  });

  it('applyAction: handId mismatch returns HAND_ID_MISMATCH', () => {
    const deps = createDeps();
    const coordinator = createGameCoordinator(deps);
    const input: ApplyActionInput = {
      context: createContext(),
      action: {
        tableId: 'table-1',
        handId: 'other-hand',
        street: 'FLOP' as never,
        playerId: 'H1',
        type: 'CHECK',
        actedAt: 11,
      },
    };

    const result = coordinator.applyAction(input);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('HAND_ID_MISMATCH');
  });

  it('applyAction: validation fail returns BETTING_VALIDATION_FAILED and does not call applyAction', () => {
    const deps = createDeps();
    deps.betting.validateAction.mockReturnValue({ isValid: false, code: 'X', reason: 'invalid' });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.applyAction({
      context: createContext(),
      action: {
        tableId: 'table-1',
        handId: 'hand-1',
        street: 'FLOP' as never,
        playerId: 'H1',
        type: 'CALL',
        actedAt: 11,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('BETTING_VALIDATION_FAILED');
    expect(deps.betting.applyAction).not.toHaveBeenCalled();
  });

  it('applyAction: fold enqueue failure returns QUEUE_ENQUEUE_FAILED', () => {
    const deps = createDeps();
    deps.betting.validateAction.mockReturnValue({ isValid: true, code: 'VALID', reason: 'ok' });
    deps.betting.applyAction.mockReturnValue({
      tableState: createTableState(),
      queueEvent: {
        type: 'QUEUE_ENQUEUE_REQUEST',
        trigger: 'AFTER_FOLD_CONFIRMED',
        dedupeKey: 'hand-1:H1',
        tableId: 'table-1',
        handId: 'hand-1',
        playerId: 'H1',
        at: 11,
      },
      validation: { isValid: true, code: 'VALID', reason: 'ok' },
    });
    deps.queue.enqueueFromBettingEvent.mockReturnValue({ queue: createQueueState(), enqueued: false, reason: 'DUPLICATE_DEDUPE_KEY' });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.applyAction({
      context: createContext(),
      action: {
        tableId: 'table-1',
        handId: 'hand-1',
        street: 'FLOP' as never,
        playerId: 'H1',
        type: 'FOLD',
        actedAt: 11,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('QUEUE_ENQUEUE_FAILED');
  });

  it('applyAction: success emits AFTER_APPLY_ACTION persistence point', () => {
    const deps = createDeps();
    deps.betting.validateAction.mockReturnValue({ isValid: true, code: 'VALID', reason: 'ok' });
    deps.betting.applyAction.mockReturnValue({
      tableState: createTableState(),
      validation: { isValid: true, code: 'VALID', reason: 'ok' },
    });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.applyAction({
      context: createContext(),
      action: {
        tableId: 'table-1',
        handId: 'hand-1',
        street: 'FLOP' as never,
        playerId: 'H1',
        type: 'CHECK',
        actedAt: 11,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.persistence?.point).toBe('AFTER_APPLY_ACTION');
    expect(deps.persistenceHook.onPersist).toHaveBeenCalled();
  });

  it('resolveShowdown: invalid board returns INVALID_BOARD_STATE', () => {
    const deps = createDeps();
    const coordinator = createGameCoordinator(deps);
    const context = createContext({ tableState: createTableState({ boardA: ['As'], boardB: ['2s'] }) });

    const result = coordinator.resolveShowdown({ context, tableId: 'table-1', handId: 'hand-1', now: 30 });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('INVALID_BOARD_STATE');
  });

  it('resolveShowdown: tableId mismatch returns TABLE_ID_MISMATCH', () => {
    const deps = createDeps();
    const coordinator = createGameCoordinator(deps);

    const result = coordinator.resolveShowdown({ context: createContext(), tableId: 'other', handId: 'hand-1', now: 30 });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('TABLE_ID_MISMATCH');
  });

  it('resolveShowdown: handId mismatch returns HAND_ID_MISMATCH', () => {
    const deps = createDeps();
    const coordinator = createGameCoordinator(deps);

    const result = coordinator.resolveShowdown({ context: createContext(), tableId: 'table-1', handId: 'other-hand', now: 30 });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('HAND_ID_MISMATCH');
  });

  it('resolveShowdown: no active players returns NO_ACTIVE_PLAYERS', () => {
    const deps = createDeps();
    const coordinator = createGameCoordinator(deps);
    const context = createContext({ tableState: createTableState({ actionOrder: [] }) });

    const result = coordinator.resolveShowdown({ context, tableId: 'table-1', handId: 'hand-1', now: 30 });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_ACTIVE_PLAYERS');
  });

  it('resolveShowdown: success calls evaluator and emits persistence point', () => {
    const deps = createDeps();
    deps.showdown.evaluateBoardA.mockReturnValue(['H1']);
    deps.showdown.evaluateBoardB.mockReturnValue(['B1']);

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.resolveShowdown({ context: createContext(), tableId: 'table-1', handId: 'hand-1', now: 30 });

    expect(result.ok).toBe(true);
    expect(result.showdownResult?.boardAWinners).toEqual(['H1']);
    expect(result.showdownResult?.boardBWinners).toEqual(['B1']);
    expect(result.persistence?.point).toBe('AFTER_RESOLVE_SHOWDOWN');
  });

  it('distributePot: inconsistent payout returns POT_DISTRIBUTION_FAILED', () => {
    const deps = createDeps();
    deps.pot.distribute.mockReturnValue([{ playerId: 'H1', amount: 10 }]);

    const coordinator = createGameCoordinator(deps);
    const showdownResult: GameShowdownResult = {
      tableId: 'table-1',
      handId: 'hand-1',
      boardAWinners: ['H1'],
      boardBWinners: ['H1'],
      evaluatedAt: 10,
    };

    const input: DistributePotInput = {
      context: createContext({ tableState: createTableState({ totalPot: 120 }) }),
      tableId: 'table-1',
      handId: 'hand-1',
      showdownResult,
      now: 40,
    };

    const result = coordinator.distributePot(input);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('POT_DISTRIBUTION_FAILED');
  });

  it('distributePot: tableId mismatch returns TABLE_ID_MISMATCH', () => {
    const deps = createDeps();
    const coordinator = createGameCoordinator(deps);

    const result = coordinator.distributePot({
      context: createContext(),
      tableId: 'other',
      handId: 'hand-1',
      showdownResult: {
        tableId: 'table-1',
        handId: 'hand-1',
        boardAWinners: ['H1'],
        boardBWinners: ['H1'],
        evaluatedAt: 10,
      },
      now: 40,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('TABLE_ID_MISMATCH');
  });

  it('distributePot: handId mismatch returns HAND_ID_MISMATCH', () => {
    const deps = createDeps();
    const coordinator = createGameCoordinator(deps);

    const result = coordinator.distributePot({
      context: createContext(),
      tableId: 'table-1',
      handId: 'other-hand',
      showdownResult: {
        tableId: 'table-1',
        handId: 'hand-1',
        boardAWinners: ['H1'],
        boardBWinners: ['H1'],
        evaluatedAt: 10,
      },
      now: 40,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('HAND_ID_MISMATCH');
  });

  it('distributePot: success emits AFTER_DISTRIBUTE_POT', () => {
    const deps = createDeps();
    deps.pot.distribute.mockReturnValue([{ playerId: 'H1', amount: 120 }]);

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.distributePot({
      context: createContext({ tableState: createTableState({ totalPot: 120 }) }),
      tableId: 'table-1',
      handId: 'hand-1',
      showdownResult: {
        tableId: 'table-1',
        handId: 'hand-1',
        boardAWinners: ['H1'],
        boardBWinners: ['H1'],
        evaluatedAt: 10,
      },
      now: 40,
    });

    expect(result.ok).toBe(true);
    expect(result.persistence?.point).toBe('AFTER_DISTRIBUTE_POT');
  });

  it('completeHand: success delegates queue and emits AFTER_COMPLETE_HAND', () => {
    const deps = createDeps();
    deps.queue.completeHand.mockReturnValue({ queue: createQueueState(), completed: true });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.completeHand({ context: createContext(), tableId: 'table-1', handId: 'hand-1', now: 50 });

    expect(result.ok).toBe(true);
    expect(result.persistence?.point).toBe('AFTER_COMPLETE_HAND');
  });

  it('completeHand: failure maps queue reason', () => {
    const deps = createDeps();
    deps.queue.completeHand.mockReturnValue({ queue: createQueueState(), completed: false, reason: 'TABLE_NOT_ACTIVE' });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.completeHand({ context: createContext(), tableId: 'table-1', handId: 'hand-1', now: 50 });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('TABLE_NOT_ACTIVE');
  });

  it('completeHand: hand mismatch reason maps to HAND_ID_MISMATCH', () => {
    const deps = createDeps();
    deps.queue.completeHand.mockReturnValue({ queue: createQueueState(), completed: false, reason: 'HAND_ID_MISMATCH' });

    const coordinator = createGameCoordinator(deps);
    const result = coordinator.completeHand({ context: createContext(), tableId: 'table-1', handId: 'hand-1', now: 50 });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('HAND_ID_MISMATCH');
  });

  it('coordinator: works without persistence hook', () => {
    const deps = createDeps();
    deps.queue.validateQueueState.mockReturnValue({ isValid: true, errors: [] });
    deps.queue.assignNextTable.mockReturnValue({
      queue: createQueueState(),
      assignedPlayerIds: ['H1', 'B1', 'B2', 'B3', 'B4', 'B5'],
      table: { tableId: 'table-1', handId: 'hand-2', seatPlayerIds: ['H1', 'B1', 'B2', 'B3', 'B4', 'B5'], startedAt: 10 },
    });

    const coordinator = createGameCoordinator({
      queue: deps.queue,
      betting: deps.betting,
      showdown: deps.showdown,
      pot: deps.pot,
    });

    const result = coordinator.startHand({ context: createContext(), tableId: 'table-1', now: 10 });
    expect(result.ok).toBe(true);
    expect(result.persistence?.point).toBe('AFTER_START_HAND');
  });
});
