import type { CoordinatorContext, PersistenceNotification, PersistencePoint } from '../game/types';
import type { QueueState, ActiveTable, HandRecord, PlayerPoolEntry, TransitionLogEntry } from '../queue/types';
import type { HandId, PlayerId, TableId, TableState } from '../table-state/types';

export type PersistenceErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'SERIALIZE_FAILED'
  | 'DESERIALIZE_FAILED'
  | 'INVALID_ENVELOPE'
  | 'SCHEMA_VERSION_MISMATCH'
  | 'NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_QUEUE_STATE'
  | 'INVALID_TABLE_STATE'
  | 'UNKNOWN_ERROR';

export interface PlayerPoolEntrySnapshot extends Omit<PlayerPoolEntry, 'participatedHandIds'> {
  participatedHandIds: HandId[];
}

export interface QueueStateSnapshot extends Omit<QueueState, 'playerPool' | 'activeTableIds' | 'activeTables' | 'handRegistry' | 'processedDedupeKeys'> {
  playerPool: Array<[PlayerId, PlayerPoolEntrySnapshot]>;
  activeTableIds: TableId[];
  activeTables: Array<[TableId, ActiveTable]>;
  handRegistry: Array<[HandId, HandRecord]>;
  processedDedupeKeys: string[];
}

export interface CoordinatorContextSnapshot<TPlayerState = unknown>
  extends Omit<CoordinatorContext<TPlayerState>, 'queueState'> {
  queueState: QueueStateSnapshot;
}

export interface PersistedEnvelope {
  schemaVersion: number;
  savedAt: number;
  tableId: TableId;
  handId: HandId | null;
  point: PersistencePoint;
  context: CoordinatorContextSnapshot;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  length: number;
}

export interface SaveCheckpointInput {
  notification: PersistenceNotification;
  context: CoordinatorContext;
  now: number;
}

export interface SaveCheckpointResult {
  ok: boolean;
  latestKey?: string;
  bytes?: number;
  errorCode?: PersistenceErrorCode;
  reason?: string;
}

export interface LoadLatestInput {
  tableId: TableId;
}

export interface LoadLatestResult {
  ok: boolean;
  envelope?: PersistedEnvelope;
  errorCode?: PersistenceErrorCode;
  reason?: string;
}

export interface ClearTableInput {
  tableId: TableId;
}

export interface ClearTableResult {
  ok: boolean;
  removedCount: number;
  errorCode?: PersistenceErrorCode;
  reason?: string;
}

export interface ClearAllResult {
  ok: boolean;
  removedCount: number;
  errorCode?: PersistenceErrorCode;
  reason?: string;
}

export interface ValidateEnvelopeResult {
  isValid: boolean;
  errorCode?: PersistenceErrorCode;
  reason?: string;
}

export interface PersistenceEngine {
  saveCheckpoint(input: SaveCheckpointInput): SaveCheckpointResult;
  loadLatest(input: LoadLatestInput): LoadLatestResult;
  clearTable(input: ClearTableInput): ClearTableResult;
  clearAll(): ClearAllResult;
  validateEnvelope(value: unknown): ValidateEnvelopeResult;
  serializeQueueState(queueState: QueueState): QueueStateSnapshot;
  deserializeQueueState(snapshot: QueueStateSnapshot): QueueState;
}

export interface PersistenceEngineOptions {
  supportedSchemaVersion: number;
  keyPrefix?: string;
}

export interface PersistenceKeyFactory {
  latest(tableId: TableId): string;
}

export interface StateValidators {
  validateQueueState(queueState: QueueState): { isValid: boolean; errors: string[] };
  validateTableState(tableState: TableState): { isValid: boolean; errors: string[] };
}
