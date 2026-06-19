export const MAX_SEATS = 6 as const;
export const BOARD_CARD_COUNT = 5 as const;

export type TableId = string;
export type HandId = string;
export type PlayerId = string;

export enum Street {
  Flop = 'FLOP',
  Turn = 'TURN',
  River = 'RIVER',
  Showdown = 'SHOWDOWN',
}

export enum TableStatus {
  WaitingForPlayers = 'WAITING_FOR_PLAYERS',
  StartingHand = 'STARTING_HAND',
  FlopBetting = 'FLOP_BETTING',
  TurnBetting = 'TURN_BETTING',
  RiverBetting = 'RIVER_BETTING',
  Showdown = 'SHOWDOWN',
  PotDistribution = 'POT_DISTRIBUTION',
  HandCompleted = 'HAND_COMPLETED',
}

export enum TableTransitionEvent {
  PlayersReady = 'PLAYERS_READY',
  BombPotPosted = 'BOMB_POT_POSTED',
  FlopRoundClosed = 'FLOP_ROUND_CLOSED',
  TurnRoundClosed = 'TURN_ROUND_CLOSED',
  RiverRoundClosed = 'RIVER_ROUND_CLOSED',
  ShowdownResolved = 'SHOWDOWN_RESOLVED',
  PotDistributed = 'POT_DISTRIBUTED',
  HandArchived = 'HAND_ARCHIVED',
}

export interface StreetBetState {
  street: Street;
  toCall: number;
  minRaiseTo: number;
  lastAggressorPlayerId: PlayerId | null;
  actedPlayerIds: PlayerId[];
}

export interface TableAuditTrail {
  handStartAt: number | null;
  handEndAt: number | null;
  lastTransitionAt: number | null;
  lastTransitionEvent: TableTransitionEvent | null;
}

export interface TablePersistenceMeta {
  storageKey: string;
  version: number;
  updatedAt: number;
}

export interface TableState<TPlayer = unknown, TPlayerState = unknown> {
  tableId: TableId;
  handId: HandId | null;
  status: TableStatus;

  players: TPlayer[];
  playerStates: Record<PlayerId, TPlayerState>;

  totalPot: number;
  potA: number;
  potB: number;

  boardA: string[];
  boardB: string[];

  currentStreet: Street | null;

  actingPlayerId: PlayerId | null;
  actionOrder: PlayerId[];

  queuedPlayers: PlayerId[];
  completedPlayers: PlayerId[];

  handStartAt: number | null;
  handEndAt: number | null;

  streetBetState: StreetBetState | null;
  audit: TableAuditTrail;
  persistence: TablePersistenceMeta;
}

export interface TableStateSnapshot<TPlayer = unknown, TPlayerState = unknown> {
  tableId: TableId;
  handId: HandId | null;
  status: TableStatus;
  currentStreet: Street | null;
  totalPot: number;
  potA: number;
  potB: number;
  actingPlayerId: PlayerId | null;
  actionOrder: PlayerId[];
  boardA: string[];
  boardB: string[];
  queuedPlayers: PlayerId[];
  completedPlayers: PlayerId[];
  playerStates: Record<PlayerId, TPlayerState>;
  players: TPlayer[];
  handStartAt: number | null;
  handEndAt: number | null;
}
