import type {
  ClearAllResult,
  ClearTableInput,
  ClearTableResult,
  CoordinatorContextSnapshot,
  LoadLatestInput,
  LoadLatestResult,
  PersistedEnvelope,
  PersistenceEngine,
  PersistenceEngineOptions,
  QueueStateSnapshot,
  SaveCheckpointInput,
  SaveCheckpointResult,
  StateValidators,
  StorageAdapter,
  ValidateEnvelopeResult,
} from './types';

interface CreatePersistenceEngineDeps {
  storage: StorageAdapter;
  validators: StateValidators;
  options: PersistenceEngineOptions;
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function latestKey(prefix: string, tableId: string): string {
  return `${prefix}:table:${tableId}:latest`;
}

function serializeContext(context: any, queueState: QueueStateSnapshot): CoordinatorContextSnapshot {
  return {
    ...context,
    queueState,
  };
}

export function createPersistenceEngine(deps: CreatePersistenceEngineDeps): PersistenceEngine {
  const prefix = deps.options.keyPrefix ?? 'ffo:persistence';

  const engine: PersistenceEngine = {
    serializeQueueState(queueState) {
      return {
        ...queueState,
        playerPool: Array.from(queueState.playerPool.entries()).map(([playerId, entry]) => [
          playerId,
          {
            ...entry,
            participatedHandIds: Array.from(entry.participatedHandIds.values()),
          },
        ]),
        activeTableIds: Array.from(queueState.activeTableIds.values()),
        activeTables: Array.from(queueState.activeTables.entries()),
        handRegistry: Array.from(queueState.handRegistry.entries()),
        processedDedupeKeys: Array.from(queueState.processedDedupeKeys.values()),
      };
    },

    deserializeQueueState(snapshot) {
      return {
        ...snapshot,
        playerPool: new Map(
          snapshot.playerPool.map(([playerId, entry]) => [
            playerId,
            {
              ...entry,
              participatedHandIds: new Set(entry.participatedHandIds),
            },
          ]),
        ),
        activeTableIds: new Set(snapshot.activeTableIds),
        activeTables: new Map(snapshot.activeTables),
        handRegistry: new Map(snapshot.handRegistry),
        processedDedupeKeys: new Set(snapshot.processedDedupeKeys),
      };
    },

    validateEnvelope(value: unknown): ValidateEnvelopeResult {
      const obj = toObject(value);
      if (!obj) {
        return { isValid: false, errorCode: 'INVALID_ENVELOPE', reason: 'Envelope must be object' };
      }

      if (typeof obj.schemaVersion !== 'number') {
        return { isValid: false, errorCode: 'INVALID_ENVELOPE', reason: 'schemaVersion missing' };
      }

      if (typeof obj.tableId !== 'string' || obj.tableId.length === 0) {
        return { isValid: false, errorCode: 'INVALID_ENVELOPE', reason: 'tableId missing' };
      }

      if (typeof obj.point !== 'string') {
        return { isValid: false, errorCode: 'INVALID_ENVELOPE', reason: 'point missing' };
      }

      if (!('context' in obj)) {
        return { isValid: false, errorCode: 'INVALID_ENVELOPE', reason: 'context missing' };
      }

      return { isValid: true };
    },

    saveCheckpoint(input: SaveCheckpointInput): SaveCheckpointResult {
      const key = latestKey(prefix, input.notification.tableId);
      let raw: string;

      try {
        const context = serializeContext(input.context, engine.serializeQueueState(input.context.queueState));
        const envelope: PersistedEnvelope = {
          schemaVersion: deps.options.supportedSchemaVersion,
          savedAt: input.now,
          tableId: input.notification.tableId,
          handId: input.notification.handId,
          point: input.notification.point,
          context,
        };
        raw = JSON.stringify(envelope);
      } catch (error) {
        return { ok: false, errorCode: 'SERIALIZE_FAILED', reason: error instanceof Error ? error.message : 'serialize failed' };
      }

      try {
        deps.storage.setItem(key, raw);
      } catch (error) {
        if (isQuotaError(error)) {
          return { ok: false, errorCode: 'QUOTA_EXCEEDED', reason: 'storage quota exceeded' };
        }
        return { ok: false, errorCode: 'STORAGE_UNAVAILABLE', reason: error instanceof Error ? error.message : 'storage unavailable' };
      }

      return {
        ok: true,
        latestKey: key,
        bytes: raw.length,
      };
    },

    loadLatest(input: LoadLatestInput): LoadLatestResult {
      const key = latestKey(prefix, input.tableId);
      let raw: string | null;

      try {
        raw = deps.storage.getItem(key);
      } catch (error) {
        return { ok: false, errorCode: 'STORAGE_UNAVAILABLE', reason: error instanceof Error ? error.message : 'storage unavailable' };
      }

      if (raw === null) {
        return { ok: false, errorCode: 'NOT_FOUND', reason: 'latest snapshot not found' };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        return { ok: false, errorCode: 'DESERIALIZE_FAILED', reason: error instanceof Error ? error.message : 'invalid json' };
      }

      const validity = engine.validateEnvelope(parsed);
      if (!validity.isValid) {
        return { ok: false, errorCode: validity.errorCode ?? 'INVALID_ENVELOPE', reason: validity.reason };
      }

      const envelope = parsed as PersistedEnvelope;

      if (envelope.schemaVersion !== deps.options.supportedSchemaVersion) {
        return {
          ok: false,
          errorCode: 'SCHEMA_VERSION_MISMATCH',
          reason: `Unsupported schema version: ${envelope.schemaVersion}`,
        };
      }

      let deserializedQueue;
      try {
        deserializedQueue = engine.deserializeQueueState(envelope.context.queueState);
      } catch (error) {
        return { ok: false, errorCode: 'DESERIALIZE_FAILED', reason: error instanceof Error ? error.message : 'queue deserialize failed' };
      }

      const queueValidation = deps.validators.validateQueueState(deserializedQueue);
      if (!queueValidation.isValid) {
        return {
          ok: false,
          errorCode: 'INVALID_QUEUE_STATE',
          reason: queueValidation.errors.join(','),
        };
      }

      const tableValidation = deps.validators.validateTableState(envelope.context.tableState);
      if (!tableValidation.isValid) {
        return {
          ok: false,
          errorCode: 'INVALID_TABLE_STATE',
          reason: tableValidation.errors.join(','),
        };
      }

      const restoredEnvelope: PersistedEnvelope = {
        ...envelope,
        context: {
          ...envelope.context,
          queueState: engine.serializeQueueState(deserializedQueue),
        },
      };

      return {
        ok: true,
        envelope: restoredEnvelope,
      };
    },

    clearTable(input: ClearTableInput): ClearTableResult {
      const key = latestKey(prefix, input.tableId);

      try {
        const existed = deps.storage.getItem(key) !== null;
        deps.storage.removeItem(key);
        return { ok: true, removedCount: existed ? 1 : 0 };
      } catch (error) {
        return {
          ok: false,
          removedCount: 0,
          errorCode: 'STORAGE_UNAVAILABLE',
          reason: error instanceof Error ? error.message : 'storage unavailable',
        };
      }
    },

    clearAll(): ClearAllResult {
      try {
        const keys: string[] = [];
        for (let i = 0; i < deps.storage.length; i += 1) {
          const key = deps.storage.key(i);
          if (typeof key === 'string' && key.startsWith(`${prefix}:`)) {
            keys.push(key);
          }
        }

        keys.forEach((key) => deps.storage.removeItem(key));

        return {
          ok: true,
          removedCount: keys.length,
        };
      } catch (error) {
        return {
          ok: false,
          removedCount: 0,
          errorCode: 'STORAGE_UNAVAILABLE',
          reason: error instanceof Error ? error.message : 'storage unavailable',
        };
      }
    },
  };

  return engine;
}
