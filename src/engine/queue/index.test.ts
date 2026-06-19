import { type FastFoldQueueEvent } from '../betting/types';
import {
  assignNextTable,
  completeHand,
  createQueue,
  enqueueFromBettingEvent,
  excludePlayer,
  joinQueue,
  validateQueueState,
} from './index';

describe('queue engine (TDD)', () => {
  it('createQueue: initializes with default 5 bots', () => {
    const queue = createQueue();
    expect(queue.waitingQueue.length).toBe(5);
    expect(Array.from(queue.playerPool.values()).filter((p) => p.playerType === 'bot')).toHaveLength(5);
  });

  it('createQueue: supports custom bot count', () => {
    const queue = createQueue({ initialBots: 2, now: 1 });
    expect(queue.waitingQueue.length).toBe(2);
    expect(queue.transitionLog[0].type).toBe('QUEUE_CREATED');
  });

  it('joinQueue: adds a human player to waiting queue', () => {
    const queue = createQueue({ initialBots: 0 });
    const result = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 100 });

    expect(result.joined).toBe(true);
    expect(result.queue.waitingQueue).toEqual(['H1']);
    expect(result.queue.playerPool.get('H1')?.status).toBe('WAITING');
  });

  it('joinQueue: supports now default when omitted', () => {
    const queue = createQueue({ initialBots: 0 });
    const result = joinQueue(queue, { playerId: 'H2', playerType: 'human' });
    expect(result.joined).toBe(true);
  });

  it('joinQueue: rejects duplicate active player', () => {
    const queue = createQueue({ initialBots: 0 });
    const first = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 100 });
    const second = joinQueue(first.queue, { playerId: 'H1', playerType: 'human', now: 200 });

    expect(second.joined).toBe(false);
    expect(second.reason).toBe('PLAYER_ALREADY_ACTIVE');
  });

  it('joinQueue: allows excluded player to re-join', () => {
    const queue = createQueue({ initialBots: 0 });
    const joined = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const excluded = excludePlayer(joined, { playerId: 'H1', now: 2 }).queue;
    const rejoin = joinQueue(excluded, { playerId: 'H1', playerType: 'human', now: 3 });

    expect(rejoin.joined).toBe(true);
    expect(rejoin.queue.playerPool.get('H1')?.status).toBe('WAITING');
    expect(rejoin.queue.waitingQueue.includes('H1')).toBe(true);
  });

  it('enqueueFromBettingEvent: rejects duplicate dedupeKey', () => {
    const queue = createQueue({ initialBots: 0 });
    const withPlayer = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;

    const event: FastFoldQueueEvent = {
      type: 'QUEUE_ENQUEUE_REQUEST',
      trigger: 'AFTER_FOLD_CONFIRMED',
      dedupeKey: 'hand-1:H1',
      tableId: 'table-1',
      handId: 'hand-1',
      playerId: 'H1',
      at: 100,
    };

    const first = enqueueFromBettingEvent(withPlayer, event);
    const second = enqueueFromBettingEvent(first.queue, event);

    expect(first.enqueued).toBe(true);
    expect(second.enqueued).toBe(false);
    expect(second.reason).toBe('DUPLICATE_DEDUPE_KEY');
  });

  it('enqueueFromBettingEvent: rejects unknown player', () => {
    const queue = createQueue({ initialBots: 0 });
    const event: FastFoldQueueEvent = {
      type: 'QUEUE_ENQUEUE_REQUEST',
      trigger: 'AFTER_FOLD_CONFIRMED',
      dedupeKey: 'hand-1:unknown',
      tableId: 'table-1',
      handId: 'hand-1',
      playerId: 'unknown',
      at: 100,
    };

    const result = enqueueFromBettingEvent(queue, event);
    expect(result.enqueued).toBe(false);
    expect(result.reason).toBe('PLAYER_NOT_FOUND');
  });

  it('enqueueFromBettingEvent: rejects invalid event payload', () => {
    const queue = createQueue({ initialBots: 0 });
    const result = enqueueFromBettingEvent(queue, {
      type: 'QUEUE_ENQUEUE_REQUEST',
      trigger: 'INVALID_TRIGGER',
      dedupeKey: 'x',
      tableId: 't',
      handId: 'h',
      playerId: 'p',
      at: 1,
    } as unknown as FastFoldQueueEvent);

    expect(result.enqueued).toBe(false);
    expect(result.reason).toBe('INVALID_EVENT');
  });

  it('assignNextTable: confirms IN_HAND directly', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;

    const assigned = assignNextTable(q1, { tableId: 'table-x', handId: 'hand-x', now: 10 });

    expect(assigned.table?.seatPlayerIds).toHaveLength(6);
    expect(assigned.queue.playerPool.get('H1')?.status).toBe('IN_HAND');
    expect(assigned.queue.playerPool.get('H1')?.currentHandId).toBe('hand-x');
  });

  it('assignNextTable: consumes waiting queue in FIFO order', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const q2 = joinQueue(q1, { playerId: 'H2', playerType: 'human', now: 2 }).queue;
    const q3 = joinQueue(q2, { playerId: 'H3', playerType: 'human', now: 3 }).queue;

    const assigned = assignNextTable(q3, { tableId: 'table-fifo', handId: 'hand-fifo', now: 20 });
    expect(assigned.table?.seatPlayerIds.slice(0, 3)).toEqual(['H1', 'H2', 'H3']);
  });

  it('assignNextTable: returns no table when queue is empty and bot creation disabled', () => {
    const queue = createQueue({ initialBots: 0, botAutofill: false });
    const assigned = assignNextTable(queue, { now: 1 });
    expect(assigned.table).toBeUndefined();
    expect(assigned.reason).toBe('NO_PLAYERS_AVAILABLE');
  });

  it('assignNextTable: returns insufficient players when bot autofill is disabled', () => {
    const queue = createQueue({ initialBots: 0, botAutofill: false });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;

    const assigned = assignNextTable(q1, { now: 2 });
    expect(assigned.table).toBeUndefined();
    expect(assigned.reason).toBe('INSUFFICIENT_PLAYERS');
  });

  it('assignNextTable: uses default ids and handles >6 waiting players with ghost id', () => {
    const queue = createQueue({ initialBots: 0, botAutofill: false });
    let q = queue;
    for (let i = 1; i <= 7; i += 1) {
      q = joinQueue(q, { playerId: `H${i}`, playerType: 'human', now: i }).queue;
    }
    q.waitingQueue.unshift('ghost');

    const assigned = assignNextTable(q);
    expect(assigned.table?.seatPlayerIds).toHaveLength(6);
    expect(assigned.table?.tableId.startsWith('table-')).toBe(true);
    expect(assigned.table?.handId.startsWith('hand-')).toBe(true);
  });

  it('FastFold: prevents same hand re-entry after fold enqueue', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;

    const firstAssign = assignNextTable(q1, { tableId: 'table-a', handId: 'hand-1', now: 10 });
    const foldEvent: FastFoldQueueEvent = {
      type: 'QUEUE_ENQUEUE_REQUEST',
      trigger: 'AFTER_FOLD_CONFIRMED',
      dedupeKey: 'hand-1:H1',
      tableId: 'table-a',
      handId: 'hand-1',
      playerId: 'H1',
      at: 11,
    };

    const enqueued = enqueueFromBettingEvent(firstAssign.queue, foldEvent);
    const sameHandAssign = assignNextTable(enqueued.queue, { tableId: 'table-b', handId: 'hand-1', now: 12 });

    expect(sameHandAssign.table?.seatPlayerIds.includes('H1')).toBe(false);
  });

  it('enqueueFromBettingEvent: handles active table where folded player is not seated', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const q2 = joinQueue(q1, { playerId: 'H2', playerType: 'human', now: 2 }).queue;
    const assigned = assignNextTable(q2, { tableId: 'table-x', handId: 'hand-x', now: 3 });

    const event: FastFoldQueueEvent = {
      type: 'QUEUE_ENQUEUE_REQUEST',
      trigger: 'AFTER_FOLD_CONFIRMED',
      dedupeKey: 'hand-x:H2',
      tableId: 'table-x',
      handId: 'hand-x',
      playerId: 'H2',
      at: 4,
    };

    const result = enqueueFromBettingEvent(assigned.queue, event);
    expect(result.enqueued).toBe(true);
  });

  it('enqueueFromBettingEvent: replaces seat using existing waiting bot first', () => {
    const queue = createQueue({ initialBots: 10 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-y', handId: 'hand-y', now: 2 });

    const event: FastFoldQueueEvent = {
      type: 'QUEUE_ENQUEUE_REQUEST',
      trigger: 'AFTER_FOLD_CONFIRMED',
      dedupeKey: 'hand-y:H1',
      tableId: 'table-y',
      handId: 'hand-y',
      playerId: 'H1',
      at: 3,
    };

    const result = enqueueFromBettingEvent(assigned.queue, event);
    expect(result.enqueued).toBe(true);
    const table = result.queue.activeTables.get('table-y');
    if (!table) {
      throw new Error('table-y not found');
    }
    expect(table.seatPlayerIds.includes('H1')).toBe(false);
  });

  it('completeHand: records hand and requeues non-excluded players', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-c', handId: 'hand-c', now: 2 });

    const completed = completeHand(assigned.queue, { tableId: 'table-c', handId: 'hand-c', endedAt: 99 });

    expect(completed.completed).toBe(true);
    expect(completed.queue.handRegistry.has('hand-c')).toBe(true);
    expect(completed.queue.playerPool.get('H1')?.status).toBe('WAITING');
    expect(completed.queue.activeTableIds.has('table-c')).toBe(false);
  });

  it('completeHand: does not requeue excluded players', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-d', handId: 'hand-d', now: 2 });
    const excluded = excludePlayer(assigned.queue, { playerId: 'H1', now: 3 });

    const completed = completeHand(excluded.queue, { tableId: 'table-d', handId: 'hand-d', endedAt: 10 });

    expect(completed.completed).toBe(true);
    expect(completed.queue.playerPool.get('H1')?.status).toBe('EXCLUDED');
    expect(completed.queue.waitingQueue.includes('H1')).toBe(false);
  });

  it('completeHand: rejects unknown table', () => {
    const queue = createQueue({ initialBots: 0 });
    const result = completeHand(queue, { tableId: 'missing', handId: 'hand-x', endedAt: 1 });

    expect(result.completed).toBe(false);
    expect(result.reason).toBe('TABLE_NOT_ACTIVE');
  });

  it('completeHand: rejects handId mismatch against active table', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-e', handId: 'hand-e', now: 2 });

    const result = completeHand(assigned.queue, { tableId: 'table-e', handId: 'hand-other', endedAt: 3 });
    expect(result.completed).toBe(false);
    expect(result.reason).toBe('HAND_ID_MISMATCH');
  });

  it('completeHand: tolerates missing player entry in seats', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-g', handId: 'hand-g', now: 2 });
    const table = assigned.queue.activeTables.get('table-g');
    if (!table) {
      throw new Error('table-g not found');
    }
    table.seatPlayerIds[0] = 'ghost';

    const result = completeHand(assigned.queue, { tableId: 'table-g', handId: 'hand-g' });
    expect(result.completed).toBe(true);
  });

  it('excludePlayer: removes waiting player from queue and marks excluded', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;

    const excluded = excludePlayer(q1, { playerId: 'H1', now: 2 });

    expect(excluded.excluded).toBe(true);
    expect(excluded.queue.playerPool.get('H1')?.status).toBe('EXCLUDED');
    expect(excluded.queue.waitingQueue.includes('H1')).toBe(false);
  });

  it('excludePlayer: returns false when player does not exist', () => {
    const queue = createQueue({ initialBots: 0 });
    const excluded = excludePlayer(queue, { playerId: 'missing', now: 2 });

    expect(excluded.excluded).toBe(false);
    expect(excluded.reason).toBe('PLAYER_NOT_FOUND');
  });

  it('excludePlayer: replaces in-hand seat with a bot', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-r', handId: 'hand-r', now: 2 });

    const excluded = excludePlayer(assigned.queue, { playerId: 'H1', now: 3 });
    const table = excluded.queue.activeTables.get('table-r');
    if (!table) {
      throw new Error('table-r not found');
    }

    expect(table.seatPlayerIds.includes('H1')).toBe(false);
    expect(table.seatPlayerIds.some((id) => id.startsWith('BOT-'))).toBe(true);
  });

  it('validateQueueState: passes for normal queue', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-v', handId: 'hand-v', now: 2 });

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validateQueueState: detects waiting queue duplication', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    q1.waitingQueue.push('H1');

    const result = validateQueueState(q1);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('DUPLICATE_WAITING_PLAYER'))).toBe(true);
  });

  it('validateQueueState: detects duplicate seat players in a table', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-z', handId: 'hand-z', now: 2 });

    const table = assigned.queue.activeTables.get('table-z');
    if (!table) {
      throw new Error('table-z not found');
    }
    table.seatPlayerIds[1] = table.seatPlayerIds[0];

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('DUPLICATE_SEAT_PLAYER'))).toBe(true);
  });

  it('validateQueueState: detects waiting player not found', () => {
    const queue = createQueue({ initialBots: 0 });
    queue.waitingQueue.push('ghost');

    const result = validateQueueState(queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('WAITING_PLAYER_NOT_FOUND'))).toBe(true);
  });

  it('validateQueueState: detects waiting status mismatch', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const entry = q1.playerPool.get('H1');
    if (!entry) {
      throw new Error('H1 not found');
    }
    entry.status = 'IN_HAND';

    const result = validateQueueState(q1);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('WAITING_PLAYER_STATUS_MISMATCH'))).toBe(true);
  });

  it('validateQueueState: detects activeTableIds mismatch', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-m', handId: 'hand-m', now: 2 });
    assigned.queue.activeTableIds.delete('table-m');

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('ACTIVE_TABLE_SET_MISMATCH'))).toBe(true);
  });

  it('validateQueueState: detects invalid seat count', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-n', handId: 'hand-n', now: 2 });
    const table = assigned.queue.activeTables.get('table-n');
    if (!table) {
      throw new Error('table-n not found');
    }
    table.seatPlayerIds.pop();

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('INVALID_SEAT_COUNT'))).toBe(true);
  });

  it('validateQueueState: detects seat player not found', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-o', handId: 'hand-o', now: 2 });
    const table = assigned.queue.activeTables.get('table-o');
    if (!table) {
      throw new Error('table-o not found');
    }
    table.seatPlayerIds[0] = 'ghost';

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('SEAT_PLAYER_NOT_FOUND'))).toBe(true);
  });

  it('validateQueueState: detects in-hand pointer and seating mismatches', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-p', handId: 'hand-p', now: 2 });
    const entry = assigned.queue.playerPool.get('H1');
    if (!entry) {
      throw new Error('H1 not found');
    }

    entry.currentTableId = null;
    entry.currentHandId = null;
    const table = assigned.queue.activeTables.get('table-p');
    if (!table) {
      throw new Error('table-p not found');
    }
    table.seatPlayerIds = table.seatPlayerIds.filter((id) => id !== 'H1');

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('IN_HAND_POINTER_MISSING'))).toBe(true);
  });

  it('validateQueueState: detects missing participated hand marker for seated player', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-q', handId: 'hand-q', now: 2 });
    const entry = assigned.queue.playerPool.get('H1');
    if (!entry) {
      throw new Error('H1 not found');
    }
    entry.participatedHandIds.delete('hand-q');

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('SEAT_PLAYER_HAND_REGISTRY_MISMATCH'))).toBe(true);
  });

  it('validateQueueState: detects waiting pointer not null', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const entry = q1.playerPool.get('H1');
    if (!entry) {
      throw new Error('H1 not found');
    }
    entry.currentTableId = 'table-x';
    entry.currentHandId = 'hand-x';

    const result = validateQueueState(q1);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('WAITING_POINTER_NOT_NULL'))).toBe(true);
  });

  it('validateQueueState: detects seat player status mismatch', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-s', handId: 'hand-s', now: 2 });
    const entry = assigned.queue.playerPool.get('H1');
    if (!entry) {
      throw new Error('H1 not found');
    }
    entry.status = 'WAITING';

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('SEAT_PLAYER_STATUS_MISMATCH'))).toBe(true);
  });

  it('validateQueueState: detects seat player pointer mismatch', () => {
    const queue = createQueue({ initialBots: 0 });
    const q1 = joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 }).queue;
    const assigned = assignNextTable(q1, { tableId: 'table-t', handId: 'hand-t', now: 2 });
    const entry = assigned.queue.playerPool.get('H1');
    if (!entry) {
      throw new Error('H1 not found');
    }
    entry.currentTableId = 'table-other';

    const result = validateQueueState(assigned.queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('SEAT_PLAYER_POINTER_MISMATCH'))).toBe(true);
  });

  it('validateQueueState: detects in-hand table not found', () => {
    const queue = createQueue({ initialBots: 0 });
    joinQueue(queue, { playerId: 'H1', playerType: 'human', now: 1 });
    const entry = queue.playerPool.get('H1');
    if (!entry) {
      throw new Error('H1 not found');
    }
    entry.status = 'IN_HAND';
    entry.currentTableId = 'table-missing';
    entry.currentHandId = 'hand-missing';
    removeFromWaiting(queue, 'H1');

    const result = validateQueueState(queue);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('IN_HAND_TABLE_NOT_FOUND'))).toBe(true);
  });
});

function removeFromWaiting(queue: ReturnType<typeof createQueue>, playerId: string): void {
  const idx = queue.waitingQueue.indexOf(playerId);
  if (idx >= 0) {
    queue.waitingQueue.splice(idx, 1);
  }
}
