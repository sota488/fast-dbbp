import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { createQueue } from '../engine/queue/index';
import { TableStatus, type TableState } from '../engine/table-state/types';
import type { CoordinatorContext, PersistenceNotification } from '../engine/game/types';
import type { StateValidators, StorageAdapter } from '../engine/persistence/types';
import { usePersistence } from './usePersistence';

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
      return Array.from(map.keys())[index] ?? null;
    },
  };
}

function createTableState(): TableState {
  return {
    tableId: 'table-1',
    handId: 'hand-1',
    status: TableStatus.FlopBetting,
    players: [],
    playerStates: {},
    totalPot: 100,
    potA: 50,
    potB: 50,
    boardA: ['As', 'Kd', 'Qc', 'Jh', 'Ts'],
    boardB: ['2s', '3d', '4c', '5h', '6s'],
    currentStreet: null,
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
  };
}

function createContext(): CoordinatorContext {
  return {
    tableState: createTableState(),
    playerStates: {},
    queueState: createQueue({ initialBots: 5, botAutofill: true, now: 1 }),
  };
}

function createNotification(point: PersistenceNotification['point']): PersistenceNotification {
  return {
    point,
    tableId: 'table-1',
    handId: 'hand-1',
    at: 10,
  };
}

function createValidators(): StateValidators {
  return {
    validateQueueState: () => ({ isValid: true, errors: [] }),
    validateTableState: () => ({ isValid: true, errors: [] }),
  };
}

function renderHook<T>(useHook: () => T): { getValue: () => T; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let value!: T;

  function TestComponent() {
    value = useHook();
    return null;
  }

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    getValue: () => value,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('usePersistence', () => {
  it('save -> restore -> clear flow works via wrapper API', () => {
    const storage = createMemoryStorage();
    const context = createContext();
    const hook = renderHook(() =>
      usePersistence({
        storage,
        validators: createValidators(),
        keyPrefix: 'ffo:persistence',
        supportedSchemaVersion: 1,
      }),
    );

    let saveResult;
    act(() => {
      saveResult = hook.getValue().save(createNotification('AFTER_START_HAND'), context, 11);
    });

    expect(saveResult!.ok).toBe(true);

    const restoreResult = hook.getValue().restore('table-1');
    expect(restoreResult.ok).toBe(true);
    expect(restoreResult.context?.tableState.tableId).toBe('table-1');

    const clearResult = hook.getValue().clear();
    expect(clearResult.ok).toBe(true);

    const notFound = hook.getValue().restore('table-1');
    expect(notFound.ok).toBe(false);

    hook.unmount();
  });
});
