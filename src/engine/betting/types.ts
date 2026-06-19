import type { HandId, PlayerId, Street, TableId } from '../table-state/types';

export enum BettingActionType {
  PostBombPot = 'POST_BOMB_POT',
  Check = 'CHECK',
  Call = 'CALL',
  Raise = 'RAISE',
  Fold = 'FOLD',
}

export enum BettingValidationCode {
  Valid = 'VALID',
  TableIdMismatch = 'TABLE_ID_MISMATCH',
  HandIdMismatch = 'HAND_ID_MISMATCH',
  InvalidTurnState = 'INVALID_TURN_STATE',
  InvalidRoundState = 'INVALID_ROUND_STATE',
  NotActingPlayer = 'NOT_ACTING_PLAYER',
  PlayerNotInActionOrder = 'PLAYER_NOT_IN_ACTION_ORDER',
  PlayerAlreadyFolded = 'PLAYER_ALREADY_FOLDED',
  InvalidStreet = 'INVALID_STREET',
  InvalidAmount = 'INVALID_AMOUNT',
  CheckNotAllowed = 'CHECK_NOT_ALLOWED',
  CallNotAllowed = 'CALL_NOT_ALLOWED',
  RaiseNotAllowed = 'RAISE_NOT_ALLOWED',
  FoldNotAllowed = 'FOLD_NOT_ALLOWED',
  BombPotAlreadyPosted = 'BOMB_POT_ALREADY_POSTED',
  BombPotNotAllowedNow = 'BOMB_POT_NOT_ALLOWED_NOW',
  RaiseBelowMinimum = 'RAISE_BELOW_MINIMUM',
  RaiseAboveMaximum = 'RAISE_ABOVE_MAXIMUM',
  InsufficientBalance = 'INSUFFICIENT_BALANCE',
  RoundAlreadyClosed = 'ROUND_ALREADY_CLOSED',
}

export interface BettingRoundState {
  bbSize: number;
  currentBet: number;
  minRaise: number;
  lastAggressor: PlayerId | null;
  playersActed: PlayerId[];
}

export interface BettingRoundDefaults {
  currentBet: 0;
  minRaise: number;
}

export interface BettingTurnState {
  actingPlayerId: PlayerId | null;
  actionOrder: PlayerId[];
}

export interface AllowedActionSet {
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  canFold: boolean;
  callAmount: number;
  minRaiseTo: number;
  maxRaiseTo: number;
}

export interface BettingActionInput {
  tableId: TableId;
  handId: HandId;
  street: Street;
  playerId: PlayerId;
  type: BettingActionType;
  amount?: number;
  actedAt: number;
}

export interface BettingValidationResult {
  isValid: boolean;
  code: BettingValidationCode;
  reason: string;
  allowed: AllowedActionSet;
}

export interface BettingActionRecord {
  id: string;
  tableId: TableId;
  handId: HandId;
  street: Street;
  playerId: PlayerId;
  type: BettingActionType;
  amount: number;
  toCallBefore: number;
  currentBetBefore: number;
  currentBetAfter: number;
  actingPlayerBefore: PlayerId | null;
  actingPlayerAfter: PlayerId | null;
  createdAt: number;
}

export interface StreetCompletionResult {
  isComplete: boolean;
  nextStreet: Street | null;
  reason:
    | 'ALL_ACTIVE_PLAYERS_ACTED'
    | 'NO_ACTIVE_PLAYERS'
    | 'ONLY_ONE_ACTIVE_PLAYER'
    | 'BETTING_CONTINUES';
}

export interface RaiseReopenResult {
  raiserPlayerId: PlayerId;
  playersActedAfterReopen: PlayerId[];
  playersRequiredToAct: PlayerId[];
}

export interface FastFoldQueueEvent {
  type: 'QUEUE_ENQUEUE_REQUEST';
  trigger: 'AFTER_FOLD_CONFIRMED';
  dedupeKey: string;
  tableId: TableId;
  handId: HandId;
  playerId: PlayerId;
  at: number;
}

export interface FoldResolution {
  removedFromActionOrder: boolean;
  nextActingPlayerId: PlayerId | null;
  queueEventEmitted: boolean;
  queueEvent: FastFoldQueueEvent;
}

export interface BettingEngineView {
  tableId: TableId;
  handId: HandId;
  street: Street;
  streetFirstActorOrder: PlayerId[];
  round: BettingRoundState;
  turn: BettingTurnState;
  foldedPlayerIds: PlayerId[];
  playerBalances: Record<PlayerId, number>;
  playerCommittedThisStreet: Record<PlayerId, number>;
  playerCommittedThisHand: Record<PlayerId, number>;
  bombPotPostedPlayerIds: PlayerId[];
}
