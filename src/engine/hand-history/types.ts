/**
 * Hand History Engine の型定義
 * 設計: HandRecord/ActionEvent/ShowdownResult/HandResult/PlayerSnapshot
 */

export type Position = 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'BTN';
export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
export type ActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'HAND_STARTED' | 'STREET_CHANGED' | 'SHOWDOWN_RESOLVED' | 'POT_DISTRIBUTED';
export type TerminalReason = 'FOLDED' | 'SHOWDOWN' | 'WALK' | 'ABORTED';
export type PlayerType = 'human' | 'bot';

/**
 * PlayerSnapshot: ハンド開始時のプレイヤー状態
 */
export interface PlayerSnapshot {
  playerId: string;
  playerType: PlayerType;
  seatIndex: number;           // 0..5
  position: Position;
  stackAtHandStart: number;
  effectiveStackAtStart: number;
  participated: boolean;        // VPIP判定基準
  foldedPreflop: boolean;       // Preflop Fold判定
}

/**
 * ActionEvent: イベントログの単位
 * Append-only, immutable after creation
 */
export interface ActionEvent {
  // イベント識別
  eventId: string;              // UUID or hash
  handId: string;
  sessionId: string;

  // 時系列・順序
  seq: number;                  // ハンド内単調増加（0-based）
  timestamp: number;            // milliseconds

  // アクション実行者
  playerId: string;             // SYSTEM の場合もある
  position?: Position;

  // アクション内容
  street?: Street;
  action: ActionType;
  amount: number;               // CHECK/FOLDは0
  raiseTo?: number;             // RAISE時のみ

  // ポット・スタック状態
  potBefore?: number;
  potAfter?: number;
  stackBefore?: number;
  stackAfter?: number;
  toCall?: number;

  // 3Bet等を後段計算するため
  preflopRaiseCountBeforeAction?: number;
  preflopRaiseAmountBeforeAction?: number;

  // Stats opportunity フラグ
  isOpportunityVpip?: boolean;
  isOpportunityPfr?: boolean;
  isOpportunity3Bet?: boolean;
  isOpportunityWtsd?: boolean;

  // 検証用
  isAutoAction?: boolean;       // タイムアウト/オートフォルド等

  // Fast Fold specific
  foldToNextHandMs?: number;    // FAST_FOLD_CONFIRMED時のみ

  // Showdown specific
  reached?: boolean;
  participants?: string[];
  winners?: string[];
  boardAWinners?: string[];
  boardBWinners?: string[];

  // Pot distribution specific
  totalPot?: number;
  potA?: number;
  potB?: number;
  rakeAmount?: number;
  payoutByPlayer?: Record<string, number>;

  // Street change specific
  boardA?: string[];            // 5枚
  boardB?: string[];            // 5枚
  potAtStreetStart?: number;
  actionOrder?: string[];
}

/**
 * ShowdownResult: ショーダウン結果
 */
export interface ShowdownResult {
  reached: boolean;
  reachedAt?: number;           // milliseconds
  participants?: string[];
  winners?: string[];
  boardAWinners?: string[];
  boardBWinners?: string[];
  evaluationDetails?: Record<string, unknown>;
}

/**
 * HandResult: ハンド終了結果
 */
export interface HandResult {
  terminalReason: TerminalReason;
  showdown: ShowdownResult;
  totalPot: number;
  potA?: number;
  potB?: number;
  rakeAmount?: number;
  payoutByPlayer: Record<string, number>;
  wonAtShowdownByPlayer?: Record<string, boolean>;
  playerOutcomeByPlayerId?: Record<
    string,
    {
      stackBefore: number;
      stackAfter: number;
      gainLoss: number;
      wonAtShowdown: boolean;
      position: Position;
    }
  >;
  completedAt: number;
}

/**
 * HandRecord: 1ハンド確定版
 * finalize後はimmutable
 */
export interface HandRecord {
  // スキーマ管理
  schemaVersion: number;        // 現在は 1

  // ハンド識別
  handId: string;
  sessionId: string;
  sessionHandNumber: number;    // セッション内の第N手目

  // テーブル・座席
  tableId: string;
  tableSeq: number;             // 同一テーブルでの通番

  // プレイヤー情報
  heroPlayerId: string;
  players: PlayerSnapshot[];

  // ボード
  boardA: string[];             // 5枚
  boardB: string[];             // 5枚

  // 盲注情報
  format: 'PLO6MAX';
  blindSize: {
    sb: number;
    bb: number;
  };

  // タイミング計測
  startedAt: number;            // ハンド開始（ディール）
  actionableAt: number;         // 最初のアクション可能時点
  handStartToActionableMs: number;

  foldToNextHandMs?: number;    // 最後のFold時刻 → 次ハンドactionable時刻

  endedAt: number;              // ハンド完了（ポット分配完了）
  durationMs: number;           // startedAt → endedAt

  // アクション記録
  actions: ActionEvent[];       // append-only

  // 結果
  result: HandResult;

  // 計測・監視用
  metrics: {
    actionCount: number;
    participantCountAtStart: number;
    heroOutcomeAmount: number;
    wasHeroInvolved: boolean;
    wasHeroAtShowdown: boolean;
  };

  // 検証用フラグ
  isFinalized: boolean;         // 確定フラグ（重複保存防止）
  finalizedAt: number;
}

/**
 * Hand History Engine input events
 */
export interface HandStartedEvent {
  handId: string;
  sessionId: string;
  sessionHandNumber: number;
  tableId: string;
  tableSeq: number;
  heroPlayerId: string;
  players: PlayerSnapshot[];
  boardA: string[];
  boardB: string[];
  blindSize: { sb: number; bb: number };
  format: 'PLO6MAX';
  startedAt: number;
  actionableAt: number;
}

export interface ActionAppliedEvent {
  handId: string;
  sessionId: string;
  playerId: string;
  position: Position;
  street: Street;
  action: ActionType;
  amount: number;
  raiseTo?: number;
  potBefore: number;
  potAfter: number;
  stackBefore: number;
  stackAfter: number;
  toCall: number;
  seq: number;
  timestamp: number;
  preflopRaiseCountBeforeAction: number;
  preflopRaiseAmountBeforeAction: number;
  isOpportunityVpip: boolean;
  isOpportunityPfr: boolean;
  isOpportunity3Bet: boolean;
  isOpportunityWtsd: boolean;
  isAutoAction: boolean;
}

export interface FastFoldConfirmedEvent {
  handId: string;
  sessionId: string;
  playerId: string;
  foldedAt: number;
  dequeuedAt: number;
  tableId: string;
  nextTableId?: string;
}

export interface StreetChangedEvent {
  handId: string;
  sessionId: string;
  fromStreet: Street;
  toStreet: Street;
  boardA?: string[];
  boardB?: string[];
  potAtStreetStart: number;
  actionOrder: string[];
  timestamp: number;
}

export interface ShowdownResolvedEvent {
  handId: string;
  sessionId: string;
  reached: boolean;
  participants: string[];
  winners: string[];
  boardAWinners?: string[];
  boardBWinners?: string[];
  reachedAt: number;
  evaluatedAt: number;
}

export interface PotDistributedEvent {
  handId: string;
  sessionId: string;
  totalPot: number;
  potA?: number;
  potB?: number;
  rakeAmount?: number;
  payoutByPlayer: Record<string, number>;
  payoutByPlayerId: Array<{
    playerId: string;
    payout: number;
    gainLoss: number;
  }>;
  distributedAt: number;
}

export interface HandCompletedEvent {
  handId: string;
  sessionId: string;
  terminalReason: TerminalReason;
  startedAt: number;
  actionableAt: number;
  endedAt: number;
  durationMs: number;
  handStartToActionableMs: number;
  heroPlayerId: string;
  heroOutcomeAmount: number;
}

/**
 * Hand History Engine output events
 */
export interface ActionRecordedEvent {
  handId: string;
  sessionId: string;
  actionEvent: ActionEvent;
  handContext?: {
    sessionHandNumber: number;
    heroPlayerId: string;
    handStartToActionableMs: number;
  };
  actionContext?: {
    street: Street;
    playerId: string;
    position: Position;
    action: ActionType;
    potAfter: number;
  };
  fastFoldMetrics?: {
    playerId: string;
    foldToNextHandMs: number;
  };
}

export interface HandRecordFinalizedEvent {
  handId: string;
  sessionId: string;
  handRecord: HandRecord;
  finalizeContext: {
    sessionHandNumber: number;
    terminalReason: TerminalReason;
    heroOutcomeAmount: number;
    foldToNextHandMs?: number;
  };
}

/**
 * Hand History Engine interface
 */
export type DomainEvent =
  | HandStartedEvent
  | ActionAppliedEvent
  | FastFoldConfirmedEvent
  | StreetChangedEvent
  | ShowdownResolvedEvent
  | PotDistributedEvent
  | HandCompletedEvent;

export type AnalyticsEvent = ActionRecordedEvent | HandRecordFinalizedEvent;

export interface HandHistoryEngineListener {
  onActionRecorded(event: ActionRecordedEvent): void;
  onHandRecordFinalized(event: HandRecordFinalizedEvent): void;
}
