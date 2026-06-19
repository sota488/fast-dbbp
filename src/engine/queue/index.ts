import type { FastFoldQueueEvent } from '../betting/types';
import type { HandId, PlayerId, TableId } from '../table-state/types';
import type {
  ActiveTable,
  AssignNextTableOptions,
  AssignNextTableResult,
  CompleteHandInput,
  CompleteHandResult,
  CreateQueueOptions,
  EnqueueFromBettingEventResult,
  ExcludePlayerInput,
  ExcludePlayerResult,
  JoinQueueInput,
  JoinQueueResult,
  PlayerPoolEntry,
  QueueState,
  QueueValidationResult,
} from './types';

const MAX_SEATS = 6;

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function removeValue(list: string[], value: string): void {
  const idx = list.indexOf(value);
  if (idx >= 0) {
    list.splice(idx, 1);
  }
}

function createBotEntry(playerId: PlayerId, now: number): PlayerPoolEntry {
  return {
    playerId,
    playerType: 'bot',
    status: 'WAITING',
    currentTableId: null,
    currentHandId: null,
    participatedHandIds: new Set<HandId>(),
    joinedAt: now,
    lastActivityAt: now,
    balance: 1000,
  };
}

function isEligibleForHand(entry: PlayerPoolEntry, handId: HandId): boolean {
  return entry.status === 'WAITING' && !entry.participatedHandIds.has(handId);
}

function ensureBot(queue: QueueState, now: number): PlayerPoolEntry {
  const botId = `BOT-${queue.nextBotSeq}`;
  queue.nextBotSeq += 1;
  const bot = createBotEntry(botId, now);
  queue.playerPool.set(botId, bot);
  pushUnique(queue.waitingQueue, botId);
  return bot;
}

function generateTableId(queue: QueueState): TableId {
  const id = `table-${queue.nextTableSeq}`;
  queue.nextTableSeq += 1;
  return id;
}

function generateHandId(queue: QueueState): HandId {
  const id = `hand-${queue.nextHandSeq}`;
  queue.nextHandSeq += 1;
  return id;
}

function replaceSeatWithBot(queue: QueueState, table: ActiveTable, playerId: PlayerId, now: number): void {
  const seatIndex = table.seatPlayerIds.indexOf(playerId);
  if (seatIndex < 0) {
    return;
  }

  let botEntry: PlayerPoolEntry | undefined;
  for (const candidateId of queue.waitingQueue) {
    const candidate = queue.playerPool.get(candidateId);
    if (candidate && candidate.playerType === 'bot' && isEligibleForHand(candidate, table.handId)) {
      botEntry = candidate;
      removeValue(queue.waitingQueue, candidate.playerId);
      break;
    }
  }

  if (!botEntry) {
    botEntry = ensureBot(queue, now);
    removeValue(queue.waitingQueue, botEntry.playerId);
  }

  botEntry.status = 'IN_HAND';
  botEntry.currentTableId = table.tableId;
  botEntry.currentHandId = table.handId;
  botEntry.participatedHandIds.add(table.handId);
  botEntry.lastActivityAt = now;

  table.seatPlayerIds[seatIndex] = botEntry.playerId;
}

export function createQueue(options: CreateQueueOptions = {}): QueueState {
  const now = options.now ?? Date.now();
  const queue: QueueState = {
    queueId: options.queueId ?? 'queue-main',
    botAutofill: options.botAutofill ?? true,
    playerPool: new Map<PlayerId, PlayerPoolEntry>(),
    waitingQueue: [],
    activeTableIds: new Set<TableId>(),
    activeTables: new Map<TableId, ActiveTable>(),
    handRegistry: new Map(),
    processedDedupeKeys: new Set<string>(),
    transitionLog: [{ at: now, type: 'QUEUE_CREATED' }],
    nextTableSeq: 1,
    nextHandSeq: 1,
    nextBotSeq: 1,
  };

  const initialBots = options.initialBots ?? 5;
  for (let i = 0; i < initialBots; i += 1) {
    const bot = ensureBot(queue, now);
    pushUnique(queue.waitingQueue, bot.playerId);
  }

  return queue;
}

export function joinQueue(queue: QueueState, input: JoinQueueInput): JoinQueueResult {
  const now = input.now ?? Date.now();
  const existing = queue.playerPool.get(input.playerId);

  if (existing && existing.status !== 'EXCLUDED') {
    return { queue, joined: false, reason: 'PLAYER_ALREADY_ACTIVE' };
  }

  if (existing && existing.status === 'EXCLUDED') {
    existing.status = 'WAITING';
    existing.currentTableId = null;
    existing.currentHandId = null;
    existing.lastActivityAt = now;
    pushUnique(queue.waitingQueue, existing.playerId);
    queue.transitionLog.push({ at: now, type: 'PLAYER_JOINED', playerId: existing.playerId });
    return { queue, joined: true };
  }

  const entry: PlayerPoolEntry = {
    playerId: input.playerId,
    playerType: input.playerType,
    status: 'WAITING',
    currentTableId: null,
    currentHandId: null,
    participatedHandIds: new Set<HandId>(),
    joinedAt: now,
    lastActivityAt: now,
    balance: input.balance ?? 1000,
  };

  queue.playerPool.set(input.playerId, entry);
  pushUnique(queue.waitingQueue, input.playerId);
  queue.transitionLog.push({ at: now, type: 'PLAYER_JOINED', playerId: input.playerId });
  return { queue, joined: true };
}

export function enqueueFromBettingEvent(
  queue: QueueState,
  event: FastFoldQueueEvent,
): EnqueueFromBettingEventResult {
  if (event.type !== 'QUEUE_ENQUEUE_REQUEST' || event.trigger !== 'AFTER_FOLD_CONFIRMED') {
    return { queue, enqueued: false, reason: 'INVALID_EVENT' };
  }

  if (queue.processedDedupeKeys.has(event.dedupeKey)) {
    return { queue, enqueued: false, reason: 'DUPLICATE_DEDUPE_KEY' };
  }

  const entry = queue.playerPool.get(event.playerId);
  if (!entry) {
    return { queue, enqueued: false, reason: 'PLAYER_NOT_FOUND' };
  }

  queue.processedDedupeKeys.add(event.dedupeKey);
  entry.participatedHandIds.add(event.handId);
  entry.currentHandId = null;
  entry.currentTableId = null;
  entry.lastActivityAt = event.at;

  if (entry.status !== 'EXCLUDED') {
    entry.status = 'WAITING';
    pushUnique(queue.waitingQueue, event.playerId);
  }

  const table = queue.activeTables.get(event.tableId);
  if (table) {
    replaceSeatWithBot(queue, table, event.playerId, event.at);
  }

  queue.transitionLog.push({
    at: event.at,
    type: 'PLAYER_ENQUEUED_FROM_FOLD',
    playerId: event.playerId,
    tableId: event.tableId,
    handId: event.handId,
  });

  return { queue, enqueued: true };
}

export function assignNextTable(queue: QueueState, options: AssignNextTableOptions = {}): AssignNextTableResult {
  const now = options.now ?? Date.now();
  const handId = options.handId ?? generateHandId(queue);
  const tableId = options.tableId ?? generateTableId(queue);
  const selected: PlayerPoolEntry[] = [];

  const waitingSnapshot = [...queue.waitingQueue];
  for (const playerId of waitingSnapshot) {
    if (selected.length >= MAX_SEATS) {
      break;
    }

    const entry = queue.playerPool.get(playerId);
    if (!entry) {
      continue;
    }

    if (!isEligibleForHand(entry, handId)) {
      continue;
    }

    selected.push(entry);
    removeValue(queue.waitingQueue, playerId);
  }

  while (selected.length < MAX_SEATS && queue.botAutofill) {
    const bot = ensureBot(queue, now);
    if (!isEligibleForHand(bot, handId)) {
      continue;
    }
    selected.push(bot);
    removeValue(queue.waitingQueue, bot.playerId);
  }

  if (selected.length === 0) {
    return { queue, assignedPlayerIds: [], reason: 'NO_PLAYERS_AVAILABLE' };
  }

  if (selected.length < MAX_SEATS) {
    return { queue, assignedPlayerIds: [], reason: 'INSUFFICIENT_PLAYERS' };
  }

  const seatPlayerIds = selected.map((entry) => entry.playerId);
  for (const entry of selected) {
    entry.status = 'IN_HAND';
    entry.currentTableId = tableId;
    entry.currentHandId = handId;
    entry.participatedHandIds.add(handId);
    entry.lastActivityAt = now;
  }

  const table: ActiveTable = {
    tableId,
    handId,
    seatPlayerIds,
    startedAt: now,
  };

  queue.activeTables.set(tableId, table);
  queue.activeTableIds.add(tableId);
  queue.transitionLog.push({ at: now, type: 'TABLE_ASSIGNED', tableId, handId });

  return {
    queue,
    table,
    assignedPlayerIds: seatPlayerIds,
  };
}

export function completeHand(queue: QueueState, input: CompleteHandInput): CompleteHandResult {
  const endedAt = input.endedAt ?? Date.now();
  const table = queue.activeTables.get(input.tableId);
  if (!table) {
    return { queue, completed: false, reason: 'TABLE_NOT_ACTIVE' };
  }

  if (table.handId !== input.handId) {
    return { queue, completed: false, reason: 'HAND_ID_MISMATCH' };
  }

  queue.handRegistry.set(input.handId, {
    handId: input.handId,
    tableId: input.tableId,
    participantPlayerIds: [...table.seatPlayerIds],
    startedAt: table.startedAt,
    endedAt,
  });

  for (const playerId of table.seatPlayerIds) {
    const entry = queue.playerPool.get(playerId);
    if (!entry) {
      continue;
    }

    entry.currentTableId = null;
    entry.currentHandId = null;
    entry.lastActivityAt = endedAt;

    if (entry.status !== 'EXCLUDED') {
      entry.status = 'WAITING';
      pushUnique(queue.waitingQueue, playerId);
    }
  }

  queue.activeTables.delete(input.tableId);
  queue.activeTableIds.delete(input.tableId);
  queue.transitionLog.push({ at: endedAt, type: 'HAND_COMPLETED', tableId: input.tableId, handId: input.handId });

  return { queue, completed: true };
}

export function excludePlayer(queue: QueueState, input: ExcludePlayerInput): ExcludePlayerResult {
  const now = input.now ?? Date.now();
  const entry = queue.playerPool.get(input.playerId);
  if (!entry) {
    return { queue, excluded: false, reason: 'PLAYER_NOT_FOUND' };
  }

  removeValue(queue.waitingQueue, input.playerId);

  const tableId = entry.currentTableId;
  if (tableId) {
    const table = queue.activeTables.get(tableId);
    if (table) {
      replaceSeatWithBot(queue, table, input.playerId, now);
    }
  }

  entry.status = 'EXCLUDED';
  entry.currentHandId = null;
  entry.currentTableId = null;
  entry.lastActivityAt = now;

  queue.transitionLog.push({ at: now, type: 'PLAYER_EXCLUDED', playerId: input.playerId, reason: input.reason });
  return { queue, excluded: true };
}

export function validateQueueState(queue: QueueState): QueueValidationResult {
  const errors: string[] = [];
  const waitingSeen = new Set<PlayerId>();

  for (const playerId of queue.waitingQueue) {
    if (waitingSeen.has(playerId)) {
      errors.push(`DUPLICATE_WAITING_PLAYER:${playerId}`);
      continue;
    }
    waitingSeen.add(playerId);

    const entry = queue.playerPool.get(playerId);
    if (!entry) {
      errors.push(`WAITING_PLAYER_NOT_FOUND:${playerId}`);
      continue;
    }

    if (entry.status !== 'WAITING') {
      errors.push(`WAITING_PLAYER_STATUS_MISMATCH:${playerId}`);
    }
  }

  for (const [tableId, table] of queue.activeTables.entries()) {
    if (!queue.activeTableIds.has(tableId)) {
      errors.push(`ACTIVE_TABLE_SET_MISMATCH:${tableId}`);
    }

    if (table.seatPlayerIds.length !== MAX_SEATS) {
      errors.push(`INVALID_SEAT_COUNT:${tableId}`);
    }

    const seatSeen = new Set<PlayerId>();
    for (const playerId of table.seatPlayerIds) {
      if (seatSeen.has(playerId)) {
        errors.push(`DUPLICATE_SEAT_PLAYER:${tableId}:${playerId}`);
      }
      seatSeen.add(playerId);

      const entry = queue.playerPool.get(playerId);
      if (!entry) {
        errors.push(`SEAT_PLAYER_NOT_FOUND:${tableId}:${playerId}`);
        continue;
      }

      if (entry.status !== 'IN_HAND') {
        errors.push(`SEAT_PLAYER_STATUS_MISMATCH:${tableId}:${playerId}`);
      }

      if (entry.currentTableId !== tableId || entry.currentHandId !== table.handId) {
        errors.push(`SEAT_PLAYER_POINTER_MISMATCH:${tableId}:${playerId}`);
      }

      if (!entry.participatedHandIds.has(table.handId)) {
        errors.push(`SEAT_PLAYER_HAND_REGISTRY_MISMATCH:${tableId}:${playerId}`);
      }
    }
  }

  for (const [playerId, entry] of queue.playerPool.entries()) {
    if (entry.status === 'IN_HAND') {
      if (!entry.currentTableId || !entry.currentHandId) {
        errors.push(`IN_HAND_POINTER_MISSING:${playerId}`);
        continue;
      }

      const table = queue.activeTables.get(entry.currentTableId);
      if (!table) {
        errors.push(`IN_HAND_TABLE_NOT_FOUND:${playerId}`);
        continue;
      }

      if (!table.seatPlayerIds.includes(playerId)) {
        errors.push(`IN_HAND_NOT_SEATED:${playerId}`);
      }
    }

    if (entry.status === 'WAITING') {
      if (entry.currentTableId !== null || entry.currentHandId !== null) {
        errors.push(`WAITING_POINTER_NOT_NULL:${playerId}`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}
