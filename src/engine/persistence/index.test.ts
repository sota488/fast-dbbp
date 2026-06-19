import { TableStatus, type TableState } from '../table-state/types';
import type { QueueState } from '../queue/types';
import type { CoordinatorContext, PersistenceNotification } from '../game/types';
import { createPersistenceEngine } from './index';
import type { PersistenceEngine, PersistenceErrorCode, StateValidators, StorageAdapter } from './types';

function createQueueState(): QueueState {
  return {
    queueId: 'queue-1',
    botAutofill: true,
    playerPool: new Map([
      [
        'H1',
        {
          playerId: 'H1',
          playerType: 'human',
          status: 'WAITING',
          currentTableId: null,
          currentHandId: null,
          participatedHandIds: new Set(['hand-1']),
          joinedAt: 1,
          lastActivityAt: 1,
          balance: 1000,
        },
      ],
    ]),
    waitingQueue: ['H1'],
    activeTableIds: new Set(['table-1']),
    activeTables: new Map([
      [
        'table-1',
        { tableId: 'table-1', handId: 'hand-1', seatPlayerIds: ['H1', 'B1', 'B2', 'B3', 'B4', 'B5'], startedAt: 1 },
      ],
    ]),
    handRegistry: new Map([
      [
        'hand-1',
        {
          handId: 'hand-1',
          tableId: 'table-1',
          participantPlayerIds: ['H1', 'B1', 'B2', 'B3', 'B4', 'B5'],
          startedAt: 1,
          endedAt: 2,
        },
      ],
    ]),
    processedDedupeKeys: new Set(['hand-1:H1']),
    transitionLog: [{ at: 1, type: 'QUEUE_CREATED' }],
    nextTableSeq: 2,
    nextHandSeq: 2,
    nextBotSeq: 6,
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

function createNotification(point: PersistenceNotification['point']): PersistenceNotification {
  return {
    point,
    tableId: 'table-1',
    handId: 'hand-1',
    at: 100,
  };
}

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
      const keys = Array.from(map.keys());
      return keys[index] ?? null;
    },
  };
}

function createValidators(overrides?: Partial<StateValidators>): StateValidators {
  return {
    validateQueueState: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    validateTableState: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    ...overrides,
  };
}

describe('persistence engine (TDD)', () => {
  function createEngine(storage?: StorageAdapter, validators?: StateValidators): PersistenceEngine {
    return createPersistenceEngine({
      storage: storage ?? createMemoryStorage(),
      validators: validators ?? createValidators(),
      options: { supportedSchemaVersion: 1, keyPrefix: 'ffo:persistence' },
    });
  }

  function createEngineWithDefaultPrefix(storage?: StorageAdapter, validators?: StateValidators): PersistenceEngine {
    return createPersistenceEngine({
      storage: storage ?? createMemoryStorage(),
      validators: validators ?? createValidators(),
      options: { supportedSchemaVersion: 1 },
    });
  }

  it('serializeQueueState: Map/Set are converted to arrays', () => {
    const engine = createEngine();
    const queueState = createQueueState();

    const snapshot = engine.serializeQueueState(queueState);

    expect(Array.isArray(snapshot.playerPool)).toBe(true);
    expect(Array.isArray(snapshot.activeTableIds)).toBe(true);
    expect(Array.isArray(snapshot.activeTables)).toBe(true);
    expect(Array.isArray(snapshot.handRegistry)).toBe(true);
    expect(Array.isArray(snapshot.processedDedupeKeys)).toBe(true);
    expect(Array.isArray(snapshot.playerPool[0][1].participatedHandIds)).toBe(true);
  });

  it('serializeQueueState: empty Map/Set stay empty arrays', () => {
    const engine = createEngine();
    const queueState = createQueueState();
    queueState.playerPool = new Map();
    queueState.activeTableIds = new Set();
    queueState.activeTables = new Map();
    queueState.handRegistry = new Map();
    queueState.processedDedupeKeys = new Set();

    const snapshot = engine.serializeQueueState(queueState);

    expect(snapshot.playerPool).toEqual([]);
    expect(snapshot.activeTableIds).toEqual([]);
    expect(snapshot.activeTables).toEqual([]);
    expect(snapshot.handRegistry).toEqual([]);
    expect(snapshot.processedDedupeKeys).toEqual([]);
  });

  it('deserializeQueueState: arrays are restored to Map/Set', () => {
    const engine = createEngine();
    const snapshot = engine.serializeQueueState(createQueueState());

    const restored = engine.deserializeQueueState(snapshot);

    expect(restored.playerPool).toBeInstanceOf(Map);
    expect(restored.activeTableIds).toBeInstanceOf(Set);
    expect(restored.activeTables).toBeInstanceOf(Map);
    expect(restored.handRegistry).toBeInstanceOf(Map);
    expect(restored.processedDedupeKeys).toBeInstanceOf(Set);
    expect(restored.playerPool.get('H1')?.participatedHandIds).toBeInstanceOf(Set);
  });

  it('deserializeQueueState: empty arrays become empty Map/Set', () => {
    const engine = createEngine();
    const snapshot = engine.serializeQueueState(createQueueState());
    snapshot.playerPool = [];
    snapshot.activeTableIds = [];
    snapshot.activeTables = [];
    snapshot.handRegistry = [];
    snapshot.processedDedupeKeys = [];

    const restored = engine.deserializeQueueState(snapshot);

    expect(restored.playerPool.size).toBe(0);
    expect(restored.activeTableIds.size).toBe(0);
    expect(restored.activeTables.size).toBe(0);
    expect(restored.handRegistry.size).toBe(0);
    expect(restored.processedDedupeKeys.size).toBe(0);
  });

  it('deserializeQueueState: duplicate keys keep last entry semantics', () => {
    const engine = createEngine();
    const snapshot = engine.serializeQueueState(createQueueState());
    snapshot.playerPool = [
      [
        'H1',
        {
          playerId: 'H1',
          playerType: 'human',
          status: 'WAITING',
          currentTableId: null,
          currentHandId: null,
          participatedHandIds: ['hand-1'],
          joinedAt: 1,
          lastActivityAt: 1,
          balance: 100,
        },
      ],
      [
        'H1',
        {
          playerId: 'H1',
          playerType: 'human',
          status: 'WAITING',
          currentTableId: null,
          currentHandId: null,
          participatedHandIds: ['hand-2'],
          joinedAt: 2,
          lastActivityAt: 2,
          balance: 200,
        },
      ],
    ];

    const restored = engine.deserializeQueueState(snapshot);
    expect(restored.playerPool.size).toBe(1);
    expect(Array.from(restored.playerPool.get('H1')!.participatedHandIds)).toEqual(['hand-2']);
    expect(restored.playerPool.get('H1')!.balance).toBe(200);
  });

  it('deserializeQueueState: invalid snapshot structure degrades safely', () => {
    const engine = createEngine();
    const snapshot = engine.serializeQueueState(createQueueState()) as any;
    snapshot.playerPool = [['H1', { playerId: 'H1' }]];

    const restored = engine.deserializeQueueState(snapshot);
    expect(restored.playerPool.get('H1')?.participatedHandIds).toBeInstanceOf(Set);
    expect(Array.from(restored.playerPool.get('H1')!.participatedHandIds)).toEqual([]);
  });

  it('serialize -> deserialize: queue semantics are preserved', () => {
    const engine = createEngine();
    const original = createQueueState();

    const restored = engine.deserializeQueueState(engine.serializeQueueState(original));

    expect(Array.from(restored.playerPool.keys())).toEqual(Array.from(original.playerPool.keys()));
    expect(Array.from(restored.activeTableIds.values())).toEqual(Array.from(original.activeTableIds.values()));
    expect(Array.from(restored.activeTables.keys())).toEqual(Array.from(original.activeTables.keys()));
    expect(Array.from(restored.handRegistry.keys())).toEqual(Array.from(original.handRegistry.keys()));
    expect(Array.from(restored.processedDedupeKeys.values())).toEqual(Array.from(original.processedDedupeKeys.values()));
    expect(Array.from(restored.playerPool.get('H1')!.participatedHandIds.values())).toEqual(['hand-1']);
  });

  it('saveCheckpoint: writes latest key only (MVP)', () => {
    const storage = createMemoryStorage();
    const setItemSpy = jest.spyOn(storage, 'setItem');
    const engine = createEngine(storage);

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: createContext(),
      now: 101,
    });

    expect(result.ok).toBe(true);
    expect(result.latestKey).toBe('ffo:persistence:table:table-1:latest');
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy.mock.calls[0][0]).toBe('ffo:persistence:table:table-1:latest');
  });

  it('saveCheckpoint: uses default key prefix when keyPrefix is omitted', () => {
    const storage = createMemoryStorage();
    const setItemSpy = jest.spyOn(storage, 'setItem');
    const engine = createEngineWithDefaultPrefix(storage);

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: createContext(),
      now: 101,
    });

    expect(result.ok).toBe(true);
    expect(setItemSpy).toHaveBeenCalledWith('ffo:persistence:table:table-1:latest', expect.any(String));
  });

  it('saveCheckpoint: persists QueueState as JSON-safe snapshot', () => {
    const storage = createMemoryStorage();
    const engine = createEngine(storage);

    const save = engine.saveCheckpoint({
      notification: createNotification('AFTER_APPLY_ACTION'),
      context: createContext(),
      now: 102,
    });

    expect(save.ok).toBe(true);
    const raw = storage.getItem('ffo:persistence:table:table-1:latest');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);

    expect(Array.isArray(parsed.context.queueState.playerPool)).toBe(true);
    expect(Array.isArray(parsed.context.queueState.activeTableIds)).toBe(true);
    expect(Array.isArray(parsed.context.queueState.processedDedupeKeys)).toBe(true);
  });

  it('saveCheckpoint: quota errors map to QUOTA_EXCEEDED', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(() => {
        throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      }),
      removeItem: jest.fn(),
      key: jest.fn().mockReturnValue(null),
      length: 0,
    };
    const engine = createEngine(storage);

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: createContext(),
      now: 101,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('QUOTA_EXCEEDED');
  });

  it('saveCheckpoint: quota by NS_ERROR_DOM_QUOTA_REACHED is handled', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(() => {
        throw Object.assign(new Error('quota'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' });
      }),
      removeItem: jest.fn(),
      key: jest.fn().mockReturnValue(null),
      length: 0,
    };
    const engine = createEngine(storage);

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: createContext(),
      now: 101,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('QUOTA_EXCEEDED');
  });

  it('saveCheckpoint: non-quota storage error maps to STORAGE_UNAVAILABLE', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(() => {
        throw new Error('disk down');
      }),
      removeItem: jest.fn(),
      key: jest.fn().mockReturnValue(null),
      length: 0,
    };
    const engine = createEngine(storage);

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: createContext(),
      now: 101,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STORAGE_UNAVAILABLE');
    expect(result.reason).toContain('disk down');
  });

  it('saveCheckpoint: non-Error storage throw falls back to STORAGE_UNAVAILABLE literal reason', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(() => {
        throw 'boom';
      }),
      removeItem: jest.fn(),
      key: jest.fn().mockReturnValue(null),
      length: 0,
    };
    const engine = createEngine(storage);

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: createContext(),
      now: 101,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STORAGE_UNAVAILABLE');
    expect(result.reason).toBe('storage unavailable');
  });

  it('saveCheckpoint: serialization failure maps to SERIALIZE_FAILED', () => {
    const engine = createEngine();
    const badContext = createContext() as any;
    badContext.playerStates = { H1: BigInt(1) };

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: badContext,
      now: 101,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('SERIALIZE_FAILED');
  });

  it('saveCheckpoint: non-Error serialize throw falls back to literal reason', () => {
    const engine = createEngine();
    const spy = jest.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw 'bad-serialize';
    });

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: createContext(),
      now: 101,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('SERIALIZE_FAILED');
    expect(result.reason).toBe('serialize failed');
    spy.mockRestore();
  });

  it('loadLatest: returns NOT_FOUND when latest key is missing', () => {
    const engine = createEngine(createMemoryStorage());

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NOT_FOUND');
  });

  it('loadLatest: returns DESERIALIZE_FAILED on invalid JSON', () => {
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': '{invalid' });
    const engine = createEngine(storage);

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('DESERIALIZE_FAILED');
  });

  it('loadLatest: getItem failure maps to STORAGE_UNAVAILABLE', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn(() => {
        throw new Error('storage down');
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      key: jest.fn().mockReturnValue(null),
      length: 0,
    };

    const engine = createEngine(storage);
    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STORAGE_UNAVAILABLE');
    expect(result.reason).toContain('storage down');
  });

  it('loadLatest: non-Error getItem throw falls back to literal reason', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn(() => {
        throw 'storage down';
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      key: jest.fn().mockReturnValue(null),
      length: 0,
    };

    const engine = createEngine(storage);
    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STORAGE_UNAVAILABLE');
    expect(result.reason).toBe('storage unavailable');
  });

  it('loadLatest: non-Error JSON.parse throw falls back to invalid json reason', () => {
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': '{"ok":true}' });
    const engine = createEngine(storage);
    const spy = jest.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'broken-json';
    });

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('DESERIALIZE_FAILED');
    expect(result.reason).toBe('invalid json');
    spy.mockRestore();
  });

  it('loadLatest: returns SCHEMA_VERSION_MISMATCH when schema differs', () => {
    const envelope = {
      schemaVersion: 2,
      savedAt: 1,
      tableId: 'table-1',
      handId: 'hand-1',
      point: 'AFTER_START_HAND',
      context: {
        tableState: createTableState(),
        playerStates: {},
        queueState: createEngine().serializeQueueState(createQueueState()),
      },
    };
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': JSON.stringify(envelope) });
    const engine = createEngine(storage);

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('SCHEMA_VERSION_MISMATCH');
  });

  it('loadLatest: restore order is validateEnvelope -> deserialize -> validateQueueState -> validateTableState', () => {
    const callOrder: string[] = [];
    const validators = createValidators({
      validateQueueState: jest.fn().mockImplementation(() => {
        callOrder.push('validateQueueState');
        return { isValid: true, errors: [] };
      }),
      validateTableState: jest.fn().mockImplementation(() => {
        callOrder.push('validateTableState');
        return { isValid: true, errors: [] };
      }),
    });

    const tempEngine = createEngine();
    const envelope = {
      schemaVersion: 1,
      savedAt: 1,
      tableId: 'table-1',
      handId: 'hand-1',
      point: 'AFTER_START_HAND',
      context: {
        tableState: createTableState(),
        playerStates: {},
        queueState: tempEngine.serializeQueueState(createQueueState()),
      },
    };

    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': JSON.stringify(envelope) });
    const engine = createEngine(storage, validators);

    const validateSpy = jest.spyOn(engine, 'validateEnvelope').mockImplementation((value) => {
      callOrder.push('validateEnvelope');
      return validateSpy.getMockImplementation() ? { isValid: true } : { isValid: true };
    });

    const deserializeSpy = jest.spyOn(engine, 'deserializeQueueState').mockImplementation((snapshot) => {
      callOrder.push('deserializeQueueState');
      return tempEngine.deserializeQueueState(snapshot);
    });

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(true);
    expect(callOrder).toEqual(['validateEnvelope', 'deserializeQueueState', 'validateQueueState', 'validateTableState']);
    expect(validateSpy).toHaveBeenCalled();
    expect(deserializeSpy).toHaveBeenCalled();
  });

  it('validateEnvelope: returns INVALID_ENVELOPE for non-object', () => {
    const engine = createEngine();
    expect(engine.validateEnvelope(null).isValid).toBe(false);
  });

  it('validateEnvelope: returns INVALID_ENVELOPE when schemaVersion is missing', () => {
    const engine = createEngine();
    const result = engine.validateEnvelope({ tableId: 'table-1', point: 'AFTER_START_HAND', context: {} });
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('INVALID_ENVELOPE');
  });

  it('validateEnvelope: returns INVALID_ENVELOPE when tableId is empty', () => {
    const engine = createEngine();
    const result = engine.validateEnvelope({ schemaVersion: 1, tableId: '', point: 'AFTER_START_HAND', context: {} });
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('INVALID_ENVELOPE');
  });

  it('validateEnvelope: returns INVALID_ENVELOPE when point is missing', () => {
    const engine = createEngine();
    const result = engine.validateEnvelope({ schemaVersion: 1, tableId: 'table-1', context: {} });
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('INVALID_ENVELOPE');
  });

  it('validateEnvelope: returns INVALID_ENVELOPE when context is missing', () => {
    const engine = createEngine();
    const result = engine.validateEnvelope({ schemaVersion: 1, tableId: 'table-1', point: 'AFTER_START_HAND' });
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('INVALID_ENVELOPE');
  });

  it('loadLatest: validateEnvelope failure without code falls back to INVALID_ENVELOPE', () => {
    const tempEngine = createEngine();
    const envelope = {
      schemaVersion: 1,
      savedAt: 1,
      tableId: 'table-1',
      handId: 'hand-1',
      point: 'AFTER_START_HAND',
      context: {
        tableState: createTableState(),
        playerStates: {},
        queueState: tempEngine.serializeQueueState(createQueueState()),
      },
    };
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': JSON.stringify(envelope) });
    const engine = createEngine(storage);
    jest.spyOn(engine, 'validateEnvelope').mockReturnValue({ isValid: false });

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('INVALID_ENVELOPE');
  });

  it('loadLatest: deserializeQueueState failure maps to DESERIALIZE_FAILED', () => {
    const tempEngine = createEngine();
    const envelope = {
      schemaVersion: 1,
      savedAt: 1,
      tableId: 'table-1',
      handId: 'hand-1',
      point: 'AFTER_START_HAND',
      context: {
        tableState: createTableState(),
        playerStates: {},
        queueState: tempEngine.serializeQueueState(createQueueState()),
      },
    };
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': JSON.stringify(envelope) });
    const engine = createEngine(storage);
    jest.spyOn(engine, 'deserializeQueueState').mockImplementation(() => {
      throw new Error('bad queue snapshot');
    });

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('DESERIALIZE_FAILED');
    expect(result.reason).toContain('bad queue snapshot');
  });

  it('loadLatest: non-Error deserializeQueueState throw falls back to queue deserialize failed reason', () => {
    const tempEngine = createEngine();
    const envelope = {
      schemaVersion: 1,
      savedAt: 1,
      tableId: 'table-1',
      handId: 'hand-1',
      point: 'AFTER_START_HAND',
      context: {
        tableState: createTableState(),
        playerStates: {},
        queueState: tempEngine.serializeQueueState(createQueueState()),
      },
    };
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': JSON.stringify(envelope) });
    const engine = createEngine(storage);
    jest.spyOn(engine, 'deserializeQueueState').mockImplementation(() => {
      throw 'bad queue snapshot';
    });

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('DESERIALIZE_FAILED');
    expect(result.reason).toBe('queue deserialize failed');
  });

  it('loadLatest: returns INVALID_QUEUE_STATE when queue validation fails', () => {
    const validators = createValidators({
      validateQueueState: jest.fn().mockReturnValue({ isValid: false, errors: ['bad queue'] }),
    });
    const tempEngine = createEngine();
    const envelope = {
      schemaVersion: 1,
      savedAt: 1,
      tableId: 'table-1',
      handId: 'hand-1',
      point: 'AFTER_START_HAND',
      context: {
        tableState: createTableState(),
        playerStates: {},
        queueState: tempEngine.serializeQueueState(createQueueState()),
      },
    };
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': JSON.stringify(envelope) });
    const engine = createEngine(storage, validators);

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('INVALID_QUEUE_STATE');
  });

  it('loadLatest: returns INVALID_TABLE_STATE when table validation fails', () => {
    const validators = createValidators({
      validateTableState: jest.fn().mockReturnValue({ isValid: false, errors: ['bad table'] }),
    });
    const tempEngine = createEngine();
    const envelope = {
      schemaVersion: 1,
      savedAt: 1,
      tableId: 'table-1',
      handId: 'hand-1',
      point: 'AFTER_START_HAND',
      context: {
        tableState: createTableState(),
        playerStates: {},
        queueState: tempEngine.serializeQueueState(createQueueState()),
      },
    };
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': JSON.stringify(envelope) });
    const engine = createEngine(storage, validators);

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('INVALID_TABLE_STATE');
  });

  it('clearAll: removes only persistence-prefixed keys', () => {
    const storage = createMemoryStorage({
      'ffo:persistence:table:table-1:latest': 'A',
      'ffo:persistence:table:table-2:latest': 'B',
      'other:key': 'C',
    });
    const engine = createEngine(storage);

    const result = engine.clearAll();

    expect(result.ok).toBe(true);
    expect(result.removedCount).toBe(2);
    expect(storage.getItem('ffo:persistence:table:table-1:latest')).toBeNull();
    expect(storage.getItem('ffo:persistence:table:table-2:latest')).toBeNull();
    expect(storage.getItem('other:key')).toBe('C');
  });

  it('clearAll: returns STORAGE_UNAVAILABLE when storage throws', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
      removeItem: jest.fn(() => {
        throw new Error('storage down');
      }),
      key: jest.fn().mockReturnValue('ffo:persistence:table:table-1:latest'),
      length: 1,
    };

    const engine = createEngine(storage);
    const result = engine.clearAll();

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STORAGE_UNAVAILABLE');
  });

  it('clearAll: returns STORAGE_UNAVAILABLE for non-Error throw', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      key: jest.fn(() => {
        throw 'broken';
      }),
      length: 1,
    };
    const engine = createEngine(storage);

    const result = engine.clearAll();

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STORAGE_UNAVAILABLE');
    expect(result.reason).toBe('storage unavailable');
  });

  it('clearAll: handles null keys without removing non-matching entries', () => {
    const storage = createMemoryStorage({
      'ffo:persistence:table:table-1:latest': 'A',
      'other:key': 'B',
    });
    const keySpy = jest.spyOn(storage, 'key').mockImplementation((index: number) => {
      if (index === 0) return null;
      return index === 1 ? 'other:key' : null;
    });
    const removeSpy = jest.spyOn(storage, 'removeItem');
    const engine = createEngine(storage);

    const result = engine.clearAll();

    expect(result.ok).toBe(true);
    expect(result.removedCount).toBe(0);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(keySpy).toHaveBeenCalled();
  });

  it('clearTable: removes existing latest key', () => {
    const storage = createMemoryStorage({
      'ffo:persistence:table:table-1:latest': 'A',
      'other:key': 'B',
    });
    const engine = createEngine(storage);

    const result = engine.clearTable({ tableId: 'table-1' });

    expect(result.ok).toBe(true);
    expect(result.removedCount).toBe(1);
    expect(storage.getItem('ffo:persistence:table:table-1:latest')).toBeNull();
    expect(storage.getItem('other:key')).toBe('B');
  });

  it('clearTable: returns 0 when latest key does not exist', () => {
    const storage = createMemoryStorage({ 'other:key': 'B' });
    const engine = createEngine(storage);

    const result = engine.clearTable({ tableId: 'table-1' });

    expect(result.ok).toBe(true);
    expect(result.removedCount).toBe(0);
    expect(storage.getItem('other:key')).toBe('B');
  });

  it('clearTable: storage failure maps to STORAGE_UNAVAILABLE', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn(() => {
        throw new Error('cannot read');
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      key: jest.fn().mockReturnValue(null),
      length: 0,
    };
    const engine = createEngine(storage);

    const result = engine.clearTable({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STORAGE_UNAVAILABLE');
    expect(result.reason).toContain('cannot read');
  });

  it('clearTable: non-Error storage failure falls back to literal reason', () => {
    const storage: StorageAdapter = {
      getItem: jest.fn(() => {
        throw 'cannot read';
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      key: jest.fn().mockReturnValue(null),
      length: 0,
    };
    const engine = createEngine(storage);

    const result = engine.clearTable({ tableId: 'table-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STORAGE_UNAVAILABLE');
    expect(result.reason).toBe('storage unavailable');
  });

  it('loadLatest: success returns restored context that can be handed to GameEngine', () => {
    const tempEngine = createEngine();
    const envelope = {
      schemaVersion: 1,
      savedAt: 1,
      tableId: 'table-1',
      handId: 'hand-1',
      point: 'AFTER_COMPLETE_HAND',
      context: {
        tableState: createTableState(),
        playerStates: {},
        queueState: tempEngine.serializeQueueState(createQueueState()),
      },
    };
    const storage = createMemoryStorage({ 'ffo:persistence:table:table-1:latest': JSON.stringify(envelope) });
    const engine = createEngine(storage);

    const result = engine.loadLatest({ tableId: 'table-1' });

    expect(result.ok).toBe(true);
    const restoredQueue = engine.deserializeQueueState(result.envelope!.context.queueState);
    expect(result.envelope?.context.tableState.tableId).toBe('table-1');
    expect(restoredQueue.playerPool).toBeInstanceOf(Map);
  });

  it.each<[PersistenceNotification['point']]>([
    ['AFTER_START_HAND'],
    ['AFTER_APPLY_ACTION'],
    ['AFTER_RESOLVE_SHOWDOWN'],
    ['AFTER_DISTRIBUTE_POT'],
    ['AFTER_COMPLETE_HAND'],
  ])('saveCheckpoint: accepts %s', (point) => {
    const engine = createEngine();

    const result = engine.saveCheckpoint({
      notification: createNotification(point),
      context: createContext(),
      now: 200,
    });

    expect(result.ok).toBe(true);
  });

  it('saveCheckpoint: does not reference global localStorage directly', () => {
    const storage = createMemoryStorage();
    const getSpy = jest.spyOn(storage, 'getItem');
    const setSpy = jest.spyOn(storage, 'setItem');
    const engine = createEngine(storage);

    const result = engine.saveCheckpoint({
      notification: createNotification('AFTER_START_HAND'),
      context: createContext(),
      now: 101,
    });

    expect(result.ok).toBe(true);
    expect(setSpy).toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('error codes: all expected literals are representable', () => {
    const codes: PersistenceErrorCode[] = [
      'STORAGE_UNAVAILABLE',
      'SERIALIZE_FAILED',
      'DESERIALIZE_FAILED',
      'INVALID_ENVELOPE',
      'SCHEMA_VERSION_MISMATCH',
      'NOT_FOUND',
      'QUOTA_EXCEEDED',
      'INVALID_QUEUE_STATE',
      'INVALID_TABLE_STATE',
      'UNKNOWN_ERROR',
    ];

    expect(codes.length).toBe(10);
  });
});
