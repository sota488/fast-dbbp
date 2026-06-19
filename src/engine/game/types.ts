import type { FastFoldQueueEvent } from '../betting/types';
import type { QueueState, QueueValidationResult } from '../queue/types';
import type { HandId, PlayerId, Street, TableId, TableState } from '../table-state/types';

export type GameEngineErrorCode =
  | 'NO_PLAYERS_AVAILABLE'
  | 'INSUFFICIENT_PLAYERS'
  | 'TABLE_NOT_ACTIVE'
  | 'TABLE_ID_MISMATCH'
  | 'HAND_ID_MISMATCH'
  | 'INVALID_STREET'
  | 'INVALID_BOARD_STATE'
  | 'NO_ACTIVE_PLAYERS'
  | 'QUEUE_ENQUEUE_FAILED'
  | 'QUEUE_STATE_INVALID'
  | 'BETTING_VALIDATION_FAILED'
  | 'POT_DISTRIBUTION_FAILED'
  | 'UNKNOWN_ERROR';

export type GameActionType = 'CHECK' | 'CALL' | 'RAISE' | 'FOLD';

export type PersistencePoint =
  | 'AFTER_START_HAND'
  | 'AFTER_APPLY_ACTION'
  | 'AFTER_RESOLVE_SHOWDOWN'
  | 'AFTER_DISTRIBUTE_POT'
  | 'AFTER_COMPLETE_HAND';

export interface PersistenceNotification {
  point: PersistencePoint;
  tableId: TableId;
  handId: HandId | null;
  at: number;
}

export interface CoordinatorContext<TPlayerState = unknown> {
  tableState: TableState<unknown, TPlayerState>;
  playerStates: Record<PlayerId, TPlayerState>;
  queueState: QueueState;
}

export interface GameActionInput {
  tableId: TableId;
  handId: HandId;
  street: Street;
  playerId: PlayerId;
  type: GameActionType;
  amount?: number;
  actedAt: number;
}

export interface GameShowdownResult {
  tableId: TableId;
  handId: HandId;
  boardAWinners: PlayerId[];
  boardBWinners: PlayerId[];
  evaluatedAt: number;
}

export interface GamePayout {
  playerId: PlayerId;
  amount: number;
}

export interface GameDistributionResult {
  tableId: TableId;
  handId: HandId;
  totalPot: number;
  payouts: GamePayout[];
  distributedAt: number;
}

export interface StartHandInput {
  context: CoordinatorContext;
  tableId: TableId;
  now: number;
  requestedHandId?: HandId;
}

export interface StartHandResult {
  ok: boolean;
  context: CoordinatorContext;
  persistence?: PersistenceNotification;
  errorCode?: GameEngineErrorCode;
  reason?: string;
}

export interface ApplyActionInput {
  context: CoordinatorContext;
  action: GameActionInput;
}

export interface ApplyActionResult {
  ok: boolean;
  context: CoordinatorContext;
  queueEvent?: FastFoldQueueEvent;
  persistence?: PersistenceNotification;
  errorCode?: GameEngineErrorCode;
  reason?: string;
}

export interface ResolveShowdownInput {
  context: CoordinatorContext;
  tableId: TableId;
  handId: HandId;
  now: number;
}

export interface ResolveShowdownResult {
  ok: boolean;
  context: CoordinatorContext;
  showdownResult?: GameShowdownResult;
  persistence?: PersistenceNotification;
  errorCode?: GameEngineErrorCode;
  reason?: string;
}

export interface DistributePotInput {
  context: CoordinatorContext;
  tableId: TableId;
  handId: HandId;
  showdownResult: GameShowdownResult;
  now: number;
}

export interface DistributePotResult {
  ok: boolean;
  context: CoordinatorContext;
  distributionResult?: GameDistributionResult;
  persistence?: PersistenceNotification;
  errorCode?: GameEngineErrorCode;
  reason?: string;
}

export interface CompleteHandInput {
  context: CoordinatorContext;
  tableId: TableId;
  handId: HandId;
  now: number;
}

export interface CompleteHandResult {
  ok: boolean;
  context: CoordinatorContext;
  persistence?: PersistenceNotification;
  errorCode?: GameEngineErrorCode;
  reason?: string;
}

export interface QueuePort {
  assignNextTable(queue: QueueState, options?: { tableId?: TableId; handId?: HandId; now?: number }): {
    queue: QueueState;
    table?: { tableId: TableId; handId: HandId; seatPlayerIds: PlayerId[]; startedAt: number };
    assignedPlayerIds: PlayerId[];
    reason?: string;
  };
  enqueueFromBettingEvent(queue: QueueState, event: FastFoldQueueEvent): {
    queue: QueueState;
    enqueued: boolean;
    reason?: string;
  };
  completeHand(queue: QueueState, input: { tableId: TableId; handId: HandId; endedAt?: number }): {
    queue: QueueState;
    completed: boolean;
    reason?: string;
  };
  validateQueueState(queue: QueueState): QueueValidationResult;
}

export interface BettingPort {
  validateAction(tableState: TableState, input: GameActionInput): { isValid: boolean; code: string; reason: string };
  applyAction(tableState: TableState, input: GameActionInput): {
    tableState: TableState;
    queueEvent?: FastFoldQueueEvent;
    validation: { isValid: boolean; code: string; reason: string };
  };
}

export interface ShowdownPort {
  evaluateBoardA(tableState: TableState): PlayerId[];
  evaluateBoardB(tableState: TableState): PlayerId[];
}

export interface PotDistributionPort {
  distribute(totalPot: number, boardAWinners: PlayerId[], boardBWinners: PlayerId[]): GamePayout[];
}

export interface PersistenceHook {
  onPersist(notification: PersistenceNotification, context: CoordinatorContext): void;
}

export interface GameCoordinator {
  startHand(input: StartHandInput): StartHandResult;
  applyAction(input: ApplyActionInput): ApplyActionResult;
  resolveShowdown(input: ResolveShowdownInput): ResolveShowdownResult;
  distributePot(input: DistributePotInput): DistributePotResult;
  completeHand(input: CompleteHandInput): CompleteHandResult;
}
