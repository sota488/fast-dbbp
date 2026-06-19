import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import type { StorageAdapter } from '../engine/persistence/types';
import { Street } from '../engine/table-state/types';
import { useGameEngine } from './useGameEngine';

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

describe('useGameEngine', () => {
  it('joinQueue -> startHand -> applyAction(FOLD) updates facade state', () => {
    const storage = createMemoryStorage();
    const hook = renderHook(() => useGameEngine({ storage, now: () => 100 }));

    act(() => {
      hook.getValue().joinQueue('H1', 'human', 1000);
    });

    expect(hook.getValue().state.queueState.playerPool.has('H1')).toBe(true);

    let started;
    act(() => {
      started = hook.getValue().startHand('table-1');
    });

    expect(started!.ok).toBe(true);
    expect(hook.getValue().state.tableState.handId).not.toBeNull();

    const activeTable = hook.getValue().state.queueState.activeTables.get('table-1');
    expect(activeTable).toBeDefined();

    const foldPlayer = activeTable!.seatPlayerIds[0];
    let applied;
    act(() => {
      applied = hook.getValue().applyAction({
        tableId: 'table-1',
        handId: hook.getValue().state.tableState.handId!,
        street: Street.Flop,
        playerId: foldPlayer,
        type: 'FOLD',
        actedAt: 101,
      });
    });

    expect(applied!.ok).toBe(true);
    expect(hook.getValue().state.bettingState.lastActionType).toBe('FOLD');
    expect(hook.getValue().state.queueState.waitingQueue.includes(foldPlayer)).toBe(true);

    hook.unmount();
  });

  it('restoreGame restores snapshot and resetGame clears to initial state', () => {
    const storage = createMemoryStorage();
    const hook = renderHook(() => useGameEngine({ storage, now: () => 200 }));

    act(() => {
      hook.getValue().joinQueue('H1', 'human', 1000);
      hook.getValue().startHand('table-1');
    });

    const restored = hook.getValue().restoreGame('table-1');
    expect(restored.ok).toBe(true);
    expect(hook.getValue().state.tableState.tableId).toBe('table-1');

    act(() => {
      hook.getValue().resetGame();
    });

    expect(hook.getValue().state.tableState.handId).toBeNull();
    expect(hook.getValue().state.bettingState.lastActionType).toBeNull();

    hook.unmount();
  });
});
