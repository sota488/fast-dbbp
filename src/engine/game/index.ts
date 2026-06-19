import { Street, TableStatus } from '../table-state/types';
import type {
  ApplyActionInput,
  ApplyActionResult,
  CompleteHandInput,
  CompleteHandResult,
  CoordinatorContext,
  DistributePotInput,
  DistributePotResult,
  GameCoordinator,
  GameEngineErrorCode,
  PersistenceHook,
  PersistenceNotification,
  ResolveShowdownInput,
  ResolveShowdownResult,
  StartHandInput,
  StartHandResult,
  BettingPort,
  PotDistributionPort,
  QueuePort,
  ShowdownPort,
} from './types';

export interface GameCoordinatorDeps {
  queue: QueuePort;
  betting: BettingPort;
  showdown: ShowdownPort;
  pot: PotDistributionPort;
  persistenceHook?: PersistenceHook;
}

function mapError(reason?: string): GameEngineErrorCode {
  if (reason === 'NO_PLAYERS_AVAILABLE') return 'NO_PLAYERS_AVAILABLE';
  if (reason === 'INSUFFICIENT_PLAYERS') return 'INSUFFICIENT_PLAYERS';
  if (reason === 'TABLE_NOT_ACTIVE') return 'TABLE_NOT_ACTIVE';
  if (reason === 'HAND_ID_MISMATCH') return 'HAND_ID_MISMATCH';
  return 'UNKNOWN_ERROR';
}

function notify(
  hook: PersistenceHook | undefined,
  point: PersistenceNotification['point'],
  context: CoordinatorContext,
  at: number,
): PersistenceNotification {
  const notification: PersistenceNotification = {
    point,
    tableId: context.tableState.tableId,
    handId: context.tableState.handId,
    at,
  };

  if (hook) {
    hook.onPersist(notification, context);
  }

  return notification;
}

export function createGameCoordinator(deps: GameCoordinatorDeps): GameCoordinator {
  return {
    startHand(input: StartHandInput): StartHandResult {
      const validation = deps.queue.validateQueueState(input.context.queueState);
      if (!validation.isValid) {
        return {
          ok: false,
          context: input.context,
          errorCode: 'QUEUE_STATE_INVALID',
          reason: validation.errors.join(','),
        };
      }

      const assigned = deps.queue.assignNextTable(input.context.queueState, {
        tableId: input.tableId,
        handId: input.requestedHandId,
        now: input.now,
      });

      if (!assigned.table) {
        return {
          ok: false,
          context: { ...input.context, queueState: assigned.queue },
          errorCode: mapError(assigned.reason),
          reason: assigned.reason,
        };
      }

      const nextContext: CoordinatorContext = {
        ...input.context,
        queueState: assigned.queue,
        tableState: {
          ...input.context.tableState,
          tableId: assigned.table.tableId,
          handId: assigned.table.handId,
          status: TableStatus.FlopBetting,
          currentStreet: Street.Flop,
          actionOrder: [...assigned.table.seatPlayerIds],
          actingPlayerId: assigned.table.seatPlayerIds[0] ?? null,
          handStartAt: input.now,
          handEndAt: null,
        },
      };

      return {
        ok: true,
        context: nextContext,
        persistence: notify(deps.persistenceHook, 'AFTER_START_HAND', nextContext, input.now),
      };
    },

    applyAction(input: ApplyActionInput): ApplyActionResult {
      if (input.action.tableId !== input.context.tableState.tableId) {
        return {
          ok: false,
          context: input.context,
          errorCode: 'TABLE_ID_MISMATCH',
          reason: 'tableId mismatch',
        };
      }

      if (input.action.handId !== input.context.tableState.handId) {
        return {
          ok: false,
          context: input.context,
          errorCode: 'HAND_ID_MISMATCH',
          reason: 'handId mismatch',
        };
      }

      const validation = deps.betting.validateAction(input.context.tableState, input.action);
      if (!validation.isValid) {
        return {
          ok: false,
          context: input.context,
          errorCode: 'BETTING_VALIDATION_FAILED',
          reason: validation.reason,
        };
      }

      const applied = deps.betting.applyAction(input.context.tableState, input.action);
      let queueState = input.context.queueState;

      if (applied.queueEvent) {
        const enqueued = deps.queue.enqueueFromBettingEvent(input.context.queueState, applied.queueEvent);
        queueState = enqueued.queue;
        if (!enqueued.enqueued) {
          return {
            ok: false,
            context: { ...input.context, queueState, tableState: applied.tableState },
            queueEvent: applied.queueEvent,
            errorCode: 'QUEUE_ENQUEUE_FAILED',
            reason: enqueued.reason,
          };
        }
      }

      const nextContext: CoordinatorContext = {
        ...input.context,
        queueState,
        tableState: applied.tableState,
      };

      return {
        ok: true,
        context: nextContext,
        queueEvent: applied.queueEvent,
        persistence: notify(deps.persistenceHook, 'AFTER_APPLY_ACTION', nextContext, input.action.actedAt),
      };
    },

    resolveShowdown(input: ResolveShowdownInput): ResolveShowdownResult {
      if (input.tableId !== input.context.tableState.tableId) {
        return { ok: false, context: input.context, errorCode: 'TABLE_ID_MISMATCH', reason: 'tableId mismatch' };
      }

      if (input.handId !== input.context.tableState.handId) {
        return { ok: false, context: input.context, errorCode: 'HAND_ID_MISMATCH', reason: 'handId mismatch' };
      }

      if (input.context.tableState.boardA.length !== 5 || input.context.tableState.boardB.length !== 5) {
        return { ok: false, context: input.context, errorCode: 'INVALID_BOARD_STATE', reason: 'invalid board count' };
      }

      if (input.context.tableState.actionOrder.length === 0) {
        return { ok: false, context: input.context, errorCode: 'NO_ACTIVE_PLAYERS', reason: 'no active players' };
      }

      const boardAWinners = deps.showdown.evaluateBoardA(input.context.tableState);
      const boardBWinners = deps.showdown.evaluateBoardB(input.context.tableState);

      const showdownResult = {
        tableId: input.tableId,
        handId: input.handId,
        boardAWinners,
        boardBWinners,
        evaluatedAt: input.now,
      };

      return {
        ok: true,
        context: input.context,
        showdownResult,
        persistence: notify(deps.persistenceHook, 'AFTER_RESOLVE_SHOWDOWN', input.context, input.now),
      };
    },

    distributePot(input: DistributePotInput): DistributePotResult {
      if (input.tableId !== input.context.tableState.tableId) {
        return { ok: false, context: input.context, errorCode: 'TABLE_ID_MISMATCH', reason: 'tableId mismatch' };
      }

      if (input.handId !== input.context.tableState.handId) {
        return { ok: false, context: input.context, errorCode: 'HAND_ID_MISMATCH', reason: 'handId mismatch' };
      }

      const payouts = deps.pot.distribute(
        input.context.tableState.totalPot,
        input.showdownResult.boardAWinners,
        input.showdownResult.boardBWinners,
      );

      const totalPayout = payouts.reduce((sum, payout) => sum + payout.amount, 0);
      if (totalPayout !== input.context.tableState.totalPot) {
        return {
          ok: false,
          context: input.context,
          errorCode: 'POT_DISTRIBUTION_FAILED',
          reason: 'payout total mismatch',
        };
      }

      const distributionResult = {
        tableId: input.tableId,
        handId: input.handId,
        totalPot: input.context.tableState.totalPot,
        payouts,
        distributedAt: input.now,
      };

      return {
        ok: true,
        context: input.context,
        distributionResult,
        persistence: notify(deps.persistenceHook, 'AFTER_DISTRIBUTE_POT', input.context, input.now),
      };
    },

    completeHand(input: CompleteHandInput): CompleteHandResult {
      const completed = deps.queue.completeHand(input.context.queueState, {
        tableId: input.tableId,
        handId: input.handId,
        endedAt: input.now,
      });

      const nextContext: CoordinatorContext = {
        ...input.context,
        queueState: completed.queue,
      };

      if (!completed.completed) {
        return {
          ok: false,
          context: nextContext,
          errorCode: mapError(completed.reason),
          reason: completed.reason,
        };
      }

      return {
        ok: true,
        context: nextContext,
        persistence: notify(deps.persistenceHook, 'AFTER_COMPLETE_HAND', nextContext, input.now),
      };
    },
  };
}
