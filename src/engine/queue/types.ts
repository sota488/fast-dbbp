import type { FastFoldQueueEvent } from '../betting/types';
import type { HandId, PlayerId, TableId } from '../table-state/types';

export type QueuePlayerType = 'human' | 'bot';
export type QueuePlayerStatus = 'WAITING' | 'IN_HAND' | 'EXCLUDED';

export interface PlayerPoolEntry {
  playerId: PlayerId;
  playerType: QueuePlayerType;
  status: QueuePlayerStatus;
  currentTableId: TableId | null;
  currentHandId: HandId | null;
  participatedHandIds: Set<HandId>;
  joinedAt: number;
  lastActivityAt: number;
  balance: number;
}

export interface ActiveTable {
  tableId: TableId;
  handId: HandId;
  seatPlayerIds: PlayerId[];
  startedAt: number;
}

export interface HandRecord {
  handId: HandId;
  tableId: TableId;
  participantPlayerIds: PlayerId[];
  startedAt: number;
  endedAt: number;
}

export interface TransitionLogEntry {
  at: number;
  type:
    | 'QUEUE_CREATED'
    | 'PLAYER_JOINED'
    | 'PLAYER_ENQUEUED_FROM_FOLD'
    | 'TABLE_ASSIGNED'
    | 'HAND_COMPLETED'
    | 'PLAYER_EXCLUDED';
  playerId?: PlayerId;
  tableId?: TableId;
  handId?: HandId;
  reason?: string;
}

export interface QueueState {
  queueId: string;
  botAutofill: boolean;
  playerPool: Map<PlayerId, PlayerPoolEntry>;
  waitingQueue: PlayerId[];
  activeTableIds: Set<TableId>;
  activeTables: Map<TableId, ActiveTable>;
  handRegistry: Map<HandId, HandRecord>;
  processedDedupeKeys: Set<string>;
  transitionLog: TransitionLogEntry[];
  nextTableSeq: number;
  nextHandSeq: number;
  nextBotSeq: number;
}

export interface CreateQueueOptions {
  queueId?: string;
  initialBots?: number;
  botAutofill?: boolean;
  now?: number;
}

export interface JoinQueueInput {
  playerId: PlayerId;
  playerType: QueuePlayerType;
  now?: number;
  balance?: number;
}

export interface JoinQueueResult {
  queue: QueueState;
  joined: boolean;
  reason?: string;
}

export interface EnqueueFromBettingEventResult {
  queue: QueueState;
  enqueued: boolean;
  reason?: string;
}

export interface AssignNextTableOptions {
  tableId?: TableId;
  handId?: HandId;
  now?: number;
}

export interface AssignNextTableResult {
  queue: QueueState;
  table?: ActiveTable;
  assignedPlayerIds: PlayerId[];
  reason?: string;
}

export interface CompleteHandInput {
  tableId: TableId;
  handId: HandId;
  endedAt?: number;
}

export interface CompleteHandResult {
  queue: QueueState;
  completed: boolean;
  reason?: string;
}

export interface ExcludePlayerInput {
  playerId: PlayerId;
  now?: number;
  reason?: string;
}

export interface ExcludePlayerResult {
  queue: QueueState;
  excluded: boolean;
  reason?: string;
}

export interface QueueValidationResult {
  isValid: boolean;
  errors: string[];
}

export type QueueEvent = FastFoldQueueEvent;
