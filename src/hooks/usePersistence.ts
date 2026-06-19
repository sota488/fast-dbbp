import { useCallback, useMemo } from 'react';
import type { CoordinatorContext, PersistenceNotification } from '../engine/game/types';
import { createPersistenceEngine } from '../engine/persistence/index';
import type {
  ClearAllResult,
  PersistenceEngine,
  PersistedEnvelope,
  StateValidators,
  StorageAdapter,
} from '../engine/persistence/types';
import { validateQueueState } from '../engine/queue/index';
import type { TableState } from '../engine/table-state/types';

export interface RestoreGameResult {
  ok: boolean;
  envelope?: PersistedEnvelope;
  context?: CoordinatorContext;
  errorCode?: string;
  reason?: string;
}

export interface UsePersistenceOptions {
  storage?: StorageAdapter;
  validators?: StateValidators;
  keyPrefix?: string;
  supportedSchemaVersion?: number;
}

function createDefaultStorage(): StorageAdapter {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return {
    get length() {
      return 0;
    },
    getItem(): string | null {
      throw new Error('localStorage unavailable');
    },
    setItem(): void {
      throw new Error('localStorage unavailable');
    },
    removeItem(): void {
      throw new Error('localStorage unavailable');
    },
    key(): string | null {
      return null;
    },
  };
}

function validateTableState(tableState: TableState): { isValid: boolean; errors: string[] } {
  if (!tableState.tableId || tableState.tableId.length === 0) {
    return { isValid: false, errors: ['TABLE_ID_EMPTY'] };
  }
  return { isValid: true, errors: [] };
}

export interface UsePersistenceApi {
  save: (notification: PersistenceNotification, context: CoordinatorContext, now: number) => { ok: boolean; reason?: string };
  restore: (tableId: string) => RestoreGameResult;
  clear: () => ClearAllResult;
  engine: PersistenceEngine;
}

export function usePersistence(options: UsePersistenceOptions = {}): UsePersistenceApi {
  const engine = useMemo(() => {
    const validators: StateValidators =
      options.validators ?? {
        validateQueueState: (queueState) => validateQueueState(queueState),
        validateTableState,
      };

    return createPersistenceEngine({
      storage: options.storage ?? createDefaultStorage(),
      validators,
      options: {
        supportedSchemaVersion: options.supportedSchemaVersion ?? 1,
        keyPrefix: options.keyPrefix ?? 'ffo:persistence',
      },
    });
  }, [options.keyPrefix, options.storage, options.supportedSchemaVersion, options.validators]);

  const save = useCallback(
    (notification: PersistenceNotification, context: CoordinatorContext, now: number) => {
      const result = engine.saveCheckpoint({ notification, context, now });
      return { ok: result.ok, reason: result.reason };
    },
    [engine],
  );

  const restore = useCallback(
    (tableId: string): RestoreGameResult => {
      const loaded = engine.loadLatest({ tableId });
      if (!loaded.ok || !loaded.envelope) {
        return {
          ok: false,
          errorCode: loaded.errorCode,
          reason: loaded.reason,
        };
      }

      const context: CoordinatorContext = {
        ...loaded.envelope.context,
        queueState: engine.deserializeQueueState(loaded.envelope.context.queueState),
      };

      return {
        ok: true,
        envelope: loaded.envelope,
        context,
      };
    },
    [engine],
  );

  const clear = useCallback(() => engine.clearAll(), [engine]);

  return {
    save,
    restore,
    clear,
    engine,
  };
}
