import { Street } from '../table-state/types';
import {
  BettingActionType,
  BettingValidationCode,
  type AllowedActionSet,
  type BettingActionInput,
  type BettingActionRecord,
  type BettingEngineView,
  type BettingRoundState,
  type BettingValidationResult,
  type FoldResolution,
  type RaiseReopenResult,
  type StreetCompletionResult,
} from './types';

export interface ApplyActionResult {
  view: BettingEngineView;
  validation: BettingValidationResult;
  record?: BettingActionRecord;
  foldResolution?: FoldResolution;
  raiseReopen?: RaiseReopenResult;
}

export function initializeBettingRound(bbSize: number): BettingRoundState {
  return {
    bbSize,
    currentBet: 0,
    minRaise: bbSize,
    lastAggressor: null,
    playersActed: [],
  };
}

function addUnique(items: string[], value: string): string[] {
  return items.includes(value) ? items : [...items, value];
}

function applyChipCommit(nextView: BettingEngineView, playerId: string, addStreetAmount: number): void {
  nextView.playerCommittedThisStreet[playerId] += addStreetAmount;
  nextView.playerCommittedThisHand[playerId] += addStreetAmount;
  nextView.playerBalances[playerId] -= addStreetAmount;
}

function toCall(view: BettingEngineView, playerId: string): number {
  const committed = view.playerCommittedThisStreet[playerId] ?? 0;
  return Math.max(0, view.round.currentBet - committed);
}

function minRaiseTo(view: BettingEngineView): number {
  return view.round.currentBet + view.round.minRaise;
}

function maxRaiseTo(view: BettingEngineView, playerId: string): number {
  const committed = view.playerCommittedThisStreet[playerId] ?? 0;
  const potLikeCap = Object.values(view.playerCommittedThisHand).reduce((sum, amount) => sum + amount, 0);
  const minimumCap = view.round.currentBet + view.round.minRaise;
  return committed + Math.max(potLikeCap, minimumCap);
}

export function computeAllowedActions(view: BettingEngineView, playerId: string): AllowedActionSet {
  const inOrder = view.turn.actionOrder.includes(playerId);
  const folded = view.foldedPlayerIds.includes(playerId);
  const call = toCall(view, playerId);
  const raiseMin = minRaiseTo(view);
  const raiseMax = maxRaiseTo(view, playerId);
  const balance = view.playerBalances[playerId] ?? 0;

  const canAct = inOrder && !folded && view.street !== Street.Showdown;

  return {
    canCheck: canAct && call === 0,
    canCall: canAct && call > 0,
    canRaise: canAct && raiseMax >= raiseMin && balance > call,
    canFold: canAct,
    callAmount: call,
    minRaiseTo: raiseMin,
    maxRaiseTo: raiseMax,
  };
}

export function validateAction(view: BettingEngineView, input: BettingActionInput): BettingValidationResult {
  const allowed = computeAllowedActions(view, input.playerId);

  if (input.tableId !== view.tableId) {
    return {
      isValid: false,
      code: BettingValidationCode.TableIdMismatch,
      reason: 'Input tableId does not match current view',
      allowed,
    };
  }

  if (input.handId !== view.handId) {
    return {
      isValid: false,
      code: BettingValidationCode.HandIdMismatch,
      reason: 'Input handId does not match current view',
      allowed,
    };
  }

  if (view.turn.actionOrder.length === 0 && view.turn.actingPlayerId !== null) {
    return {
      isValid: false,
      code: BettingValidationCode.InvalidTurnState,
      reason: 'Invalid turn state: actionOrder is empty while actingPlayerId exists',
      allowed,
    };
  }

  if (view.round.minRaise <= 0) {
    return {
      isValid: false,
      code: BettingValidationCode.InvalidRoundState,
      reason: 'Invalid round state: minRaise must be > 0',
      allowed,
    };
  }

  if (view.round.currentBet < (view.playerCommittedThisStreet[input.playerId] ?? 0)) {
    return {
      isValid: false,
      code: BettingValidationCode.InvalidRoundState,
      reason: 'Invalid round state: currentBet is lower than committed amount',
      allowed,
    };
  }

  if (input.street === Street.Showdown || view.street === Street.Showdown) {
    return { isValid: false, code: BettingValidationCode.InvalidStreet, reason: 'SHOWDOWN street is closed', allowed };
  }

  if (view.turn.actingPlayerId !== input.playerId) {
    return { isValid: false, code: BettingValidationCode.NotActingPlayer, reason: 'Not acting player', allowed };
  }

  if (!view.turn.actionOrder.includes(input.playerId)) {
    return {
      isValid: false,
      code: BettingValidationCode.PlayerNotInActionOrder,
      reason: 'Player is not in action order',
      allowed,
    };
  }

  if (view.foldedPlayerIds.includes(input.playerId)) {
    return {
      isValid: false,
      code: BettingValidationCode.PlayerAlreadyFolded,
      reason: 'Player already folded',
      allowed,
    };
  }

  if (typeof input.amount === 'number' && input.amount < 0) {
    return { isValid: false, code: BettingValidationCode.InvalidAmount, reason: 'Amount must be >= 0', allowed };
  }

  if (input.type === BettingActionType.Check && !allowed.canCheck) {
    return { isValid: false, code: BettingValidationCode.CheckNotAllowed, reason: 'Check not allowed', allowed };
  }

  if (input.type === BettingActionType.Call) {
    if (!allowed.canCall) {
      return { isValid: false, code: BettingValidationCode.CallNotAllowed, reason: 'Call not allowed', allowed };
    }

    if ((view.playerBalances[input.playerId] ?? 0) < allowed.callAmount) {
      return {
        isValid: false,
        code: BettingValidationCode.InsufficientBalance,
        reason: 'Insufficient balance for call',
        allowed,
      };
    }
  }

  if (input.type === BettingActionType.Raise) {
    if (!allowed.canRaise) {
      return { isValid: false, code: BettingValidationCode.RaiseNotAllowed, reason: 'Raise not allowed', allowed };
    }

    if (typeof input.amount !== 'number') {
      return { isValid: false, code: BettingValidationCode.InvalidAmount, reason: 'Raise amount is required', allowed };
    }

    if (input.amount < allowed.minRaiseTo) {
      return {
        isValid: false,
        code: BettingValidationCode.RaiseBelowMinimum,
        reason: 'Raise below minimum',
        allowed,
      };
    }

    if (input.amount > allowed.maxRaiseTo) {
      return {
        isValid: false,
        code: BettingValidationCode.RaiseAboveMaximum,
        reason: 'Raise above maximum',
        allowed,
      };
    }

    const committed = view.playerCommittedThisStreet[input.playerId] ?? 0;
    const delta = input.amount - committed;
    if ((view.playerBalances[input.playerId] ?? 0) < delta) {
      return {
        isValid: false,
        code: BettingValidationCode.InsufficientBalance,
        reason: 'Insufficient balance for raise',
        allowed,
      };
    }
  }

  if (input.type === BettingActionType.PostBombPot) {
    return {
      isValid: false,
      code: BettingValidationCode.BombPotNotAllowedNow,
      reason: 'PostBombPot is out of scope for this step',
      allowed,
    };
  }

  return { isValid: true, code: BettingValidationCode.Valid, reason: 'Valid action', allowed };
}

function nextStreet(street: Street): Street | null {
  if (street === Street.Flop) return Street.Turn;
  if (street === Street.Turn) return Street.River;
  if (street === Street.River) return Street.Showdown;
  return null;
}

export function isStreetComplete(view: BettingEngineView): StreetCompletionResult {
  const active = view.turn.actionOrder.filter((id) => !view.foldedPlayerIds.includes(id));

  if (active.length <= 1) {
    return {
      isComplete: true,
      nextStreet: nextStreet(view.street),
      reason: active.length === 0 ? 'NO_ACTIVE_PLAYERS' : 'ONLY_ONE_ACTIVE_PLAYER',
    };
  }

  const allActed = active.every((id) => view.round.playersActed.includes(id));
  const allMatched = active.every((id) => (view.playerCommittedThisStreet[id] ?? 0) >= view.round.currentBet);

  if (allActed && allMatched) {
    return {
      isComplete: true,
      nextStreet: nextStreet(view.street),
      reason: 'ALL_ACTIVE_PLAYERS_ACTED',
    };
  }

  return { isComplete: false, nextStreet: null, reason: 'BETTING_CONTINUES' };
}

export function getNextActingPlayer(
  actionOrder: string[],
  currentActingPlayerId: string | null,
  foldedPlayerIds: string[],
): string | null {
  if (actionOrder.length === 0) {
    return null;
  }

  const currentIndex = currentActingPlayerId ? actionOrder.indexOf(currentActingPlayerId) : -1;

  for (let i = 1; i <= actionOrder.length; i += 1) {
    const candidate = actionOrder[(currentIndex + i) % actionOrder.length];
    if (!foldedPlayerIds.includes(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function applyAction(
  view: BettingEngineView,
  input: BettingActionInput,
  dedupe: Set<string> = new Set<string>(),
): ApplyActionResult {
  const validation = validateAction(view, input);
  if (!validation.isValid) {
    return { view, validation };
  }

  const nextView: BettingEngineView = {
    ...view,
    round: { ...view.round, playersActed: [...view.round.playersActed] },
    turn: { ...view.turn, actionOrder: [...view.turn.actionOrder] },
    foldedPlayerIds: [...view.foldedPlayerIds],
    playerBalances: { ...view.playerBalances },
    playerCommittedThisStreet: { ...view.playerCommittedThisStreet },
    playerCommittedThisHand: { ...view.playerCommittedThisHand },
  };

  nextView.round.playersActed = addUnique(nextView.round.playersActed, input.playerId);

  let foldResolution: FoldResolution | undefined;
  let raiseReopen: RaiseReopenResult | undefined;

  if (input.type === BettingActionType.Call) {
    const amount = validation.allowed.callAmount;
    applyChipCommit(nextView, input.playerId, amount);
    nextView.turn.actingPlayerId = getNextActingPlayer(nextView.turn.actionOrder, input.playerId, nextView.foldedPlayerIds);
  }

  if (input.type === BettingActionType.Check) {
    nextView.turn.actingPlayerId = getNextActingPlayer(nextView.turn.actionOrder, input.playerId, nextView.foldedPlayerIds);
  }

  if (input.type === BettingActionType.Raise) {
    const raiseTo = input.amount ?? 0;
    const current = nextView.playerCommittedThisStreet[input.playerId] ?? 0;
    const delta = raiseTo - current;

    applyChipCommit(nextView, input.playerId, delta);
    nextView.playerCommittedThisStreet[input.playerId] = raiseTo;
    nextView.round.currentBet = raiseTo;
    nextView.round.lastAggressor = input.playerId;

    const activeExcludingRaiser = nextView.turn.actionOrder.filter(
      (id) => id !== input.playerId && !nextView.foldedPlayerIds.includes(id),
    );
    nextView.round.playersActed = [input.playerId];

    raiseReopen = {
      raiserPlayerId: input.playerId,
      playersActedAfterReopen: [input.playerId],
      playersRequiredToAct: activeExcludingRaiser,
    };

    nextView.turn.actingPlayerId = getNextActingPlayer(nextView.turn.actionOrder, input.playerId, nextView.foldedPlayerIds);
  }

  if (input.type === BettingActionType.Fold) {
    nextView.turn.actionOrder = nextView.turn.actionOrder.filter((id) => id !== input.playerId);
    if (!nextView.foldedPlayerIds.includes(input.playerId)) {
      nextView.foldedPlayerIds.push(input.playerId);
    }

    nextView.round.playersActed = nextView.round.playersActed.filter((id) => id !== input.playerId);
    const nextActing = getNextActingPlayer(nextView.turn.actionOrder, input.playerId, nextView.foldedPlayerIds);
    nextView.turn.actingPlayerId = nextActing;

    const dedupeKey = `${input.handId}:${input.playerId}`;
    const queueEventEmitted = !dedupe.has(dedupeKey);
    if (queueEventEmitted) {
      dedupe.add(dedupeKey);
    }

    foldResolution = {
      removedFromActionOrder: true,
      nextActingPlayerId: nextActing,
      queueEventEmitted,
      queueEvent: {
        type: 'QUEUE_ENQUEUE_REQUEST',
        trigger: 'AFTER_FOLD_CONFIRMED',
        dedupeKey,
        tableId: input.tableId,
        handId: input.handId,
        playerId: input.playerId,
        at: input.actedAt,
      },
    };
  }

  const record: BettingActionRecord = {
    id: `${input.tableId}:${input.handId}:${input.playerId}:${input.actedAt}`,
    tableId: input.tableId,
    handId: input.handId,
    street: input.street,
    playerId: input.playerId,
    type: input.type,
    amount: input.amount ?? 0,
    toCallBefore: validation.allowed.callAmount,
    currentBetBefore: view.round.currentBet,
    currentBetAfter: nextView.round.currentBet,
    actingPlayerBefore: view.turn.actingPlayerId,
    actingPlayerAfter: nextView.turn.actingPlayerId,
    createdAt: input.actedAt,
  };

  return {
    view: nextView,
    validation,
    record,
    foldResolution,
    raiseReopen,
  };
}
