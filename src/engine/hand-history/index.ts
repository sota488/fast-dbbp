/**
 * Hand History Engine 実装
 * イベント受信 → ActionEvent append → HandRecord finalize
 */

import {
  ActionEvent,
  HandRecord,
  HandResult,
  ShowdownResult,
  TerminalReason,
  HandHistoryEngineListener,
  HandStartedEvent,
  ActionAppliedEvent,
  FastFoldConfirmedEvent,
  StreetChangedEvent,
  ShowdownResolvedEvent,
  PotDistributedEvent,
  HandCompletedEvent,
  ActionRecordedEvent,
  HandRecordFinalizedEvent,
} from './types';

/**
 * Hand History Engine
 * GameCoordinator からのイベントを受け取り、
 * ActionEvent を append-only で記録し、
 * HandRecord を確定させる
 */
export class HandHistoryEngine {
  private currentHandBuffer: ActionEvent[] = [];
  private currentHandMeta: {
    handId: string;
    sessionId: string;
    sessionHandNumber: number;
    tableId: string;
    tableSeq: number;
    heroPlayerId: string;
    players: any[];
    boardA: string[];
    boardB: string[];
    blindSize: { sb: number; bb: number };
    format: string;
    startedAt: number;
    actionableAt: number;
    handStartToActionableMs: number;
  } | null = null;

  private currentHandShowdown: ShowdownResult | null = null;
  private currentHandPayout: {
    totalPot: number;
    potA?: number;
    potB?: number;
    rakeAmount?: number;
    payoutByPlayer: Record<string, number>;
  } | null = null;

  private lastFoldTimestamp: number = 0;
  private lastFastFoldDequeuedAt: number = 0;

  private listeners: HandHistoryEngineListener[] = [];

  subscribe(listener: HandHistoryEngineListener): void {
    this.listeners.push(listener);
  }

  unsubscribe(listener: HandHistoryEngineListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private emitActionRecorded(event: ActionRecordedEvent): void {
    for (const listener of this.listeners) {
      listener.onActionRecorded(event);
    }
  }

  private emitHandRecordFinalized(event: HandRecordFinalizedEvent): void {
    for (const listener of this.listeners) {
      listener.onHandRecordFinalized(event);
    }
  }

  /**
   * HAND_STARTED イベント処理
   */
  onHandStarted(event: HandStartedEvent): void {
    // 前のハンドをリセット
    this.currentHandBuffer = [];
    this.currentHandShowdown = null;
    this.currentHandPayout = null;
    this.lastFoldTimestamp = 0;
    this.lastFastFoldDequeuedAt = 0;

    // メタ情報を記録
    const handStartToActionableMs = event.actionableAt - event.startedAt;
    this.currentHandMeta = {
      handId: event.handId,
      sessionId: event.sessionId,
      sessionHandNumber: event.sessionHandNumber,
      tableId: event.tableId,
      tableSeq: event.tableSeq,
      heroPlayerId: event.heroPlayerId,
      players: event.players,
      boardA: event.boardA,
      boardB: event.boardB,
      blindSize: event.blindSize,
      format: event.format,
      startedAt: event.startedAt,
      actionableAt: event.actionableAt,
      handStartToActionableMs,
    };

    // HAND_STARTED ActionEvent を作成
    const handStartedEvent: ActionEvent = {
  eventId: `${event.handId}-HAND_STARTED`,
  handId: event.handId,
  sessionId: event.sessionId,
  seq: 0,
  timestamp: event.startedAt,
  playerId: 'SYSTEM',
  action: 'HAND_STARTED',
  amount: 0,
};
    this.currentHandBuffer.push(handStartedEvent);

    // emit
    this.emitActionRecorded({
      handId: event.handId,
      sessionId: event.sessionId,
      actionEvent: handStartedEvent,
      handContext: {
        sessionHandNumber: event.sessionHandNumber,
        heroPlayerId: event.heroPlayerId,
        handStartToActionableMs,
      },
    });
  }

  /**
   * ACTION_APPLIED イベント処理
   */
  onActionApplied(event: ActionAppliedEvent): void {
    if (!this.currentHandMeta || this.currentHandMeta.handId !== event.handId) {
      return;
    }

    const actionEvent: ActionEvent = {
      eventId: `${event.handId}-${event.seq}-${event.playerId}`,
      handId: event.handId,
      sessionId: event.sessionId,
      seq: event.seq,
      timestamp: event.timestamp,
      playerId: event.playerId,
      position: event.position,
      street: event.street,
      action: event.action,
      amount: event.amount,
      raiseTo: event.raiseTo,
      potBefore: event.potBefore,
      potAfter: event.potAfter,
      stackBefore: event.stackBefore,
      stackAfter: event.stackAfter,
      toCall: event.toCall,
      preflopRaiseCountBeforeAction: event.preflopRaiseCountBeforeAction,
      preflopRaiseAmountBeforeAction: event.preflopRaiseAmountBeforeAction,
      isOpportunityVpip: event.isOpportunityVpip,
      isOpportunityPfr: event.isOpportunityPfr,
      isOpportunity3Bet: event.isOpportunity3Bet,
      isOpportunityWtsd: event.isOpportunityWtsd,
      isAutoAction: event.isAutoAction,
    };

    this.currentHandBuffer.push(actionEvent);

    // Track FOLD timestamp for Fast Fold metrics
    if (event.action === 'FOLD') {
      this.lastFoldTimestamp = event.timestamp;
    }

    // emit
    this.emitActionRecorded({
      handId: event.handId,
      sessionId: event.sessionId,
      actionEvent,
      actionContext: {
        street: event.street,
        playerId: event.playerId,
        position: event.position,
        action: event.action,
        potAfter: event.potAfter,
      },
    });
  }

  /**
   * FAST_FOLD_CONFIRMED イベント処理
   */
  onFastFoldConfirmed(event: FastFoldConfirmedEvent): void {
    if (!this.currentHandMeta || this.currentHandMeta.handId !== event.handId) {
      return;
    }

const foldToNextHandMs = event.dequeuedAt - event.foldedAt;

const fastFoldEvent: ActionEvent = {
  eventId: `${event.handId}-FAST_FOLD_CONFIRMED-${event.playerId}`,
  handId: event.handId,
  sessionId: event.sessionId,
  seq: this.currentHandBuffer.length,
  timestamp: event.dequeuedAt,
  playerId: event.playerId,
  action: 'HAND_STARTED', // placeholder
  amount: 0,
  foldToNextHandMs,
};

    this.currentHandBuffer.push(fastFoldEvent);

    // emit
    this.emitActionRecorded({
      handId: event.handId,
      sessionId: event.sessionId,
      actionEvent: fastFoldEvent,
      fastFoldMetrics: {
        playerId: event.playerId,
        foldToNextHandMs,
      },
    });
  }

  /**
   * STREET_CHANGED イベント処理
   */
  onStreetChanged(event: StreetChangedEvent): void {
    if (!this.currentHandMeta || this.currentHandMeta.handId !== event.handId) {
      return;
    }

    const streetEvent: ActionEvent = {
      eventId: `${event.handId}-STREET_CHANGED-${event.toStreet}`,
      handId: event.handId,
      sessionId: event.sessionId,
      seq: this.currentHandBuffer.length,
      timestamp: event.timestamp,
      playerId: 'SYSTEM',
      street: event.toStreet,
      action: 'STREET_CHANGED',
      amount: 0,
      boardA: event.boardA,
      boardB: event.boardB,
      potAtStreetStart: event.potAtStreetStart,
      actionOrder: event.actionOrder,
    };

    this.currentHandBuffer.push(streetEvent);

    // emit
    this.emitActionRecorded({
      handId: event.handId,
      sessionId: event.sessionId,
      actionEvent: streetEvent,
    });
  }

  /**
   * SHOWDOWN_RESOLVED イベント処理
   */
  onShowdownResolved(event: ShowdownResolvedEvent): void {
    if (!this.currentHandMeta || this.currentHandMeta.handId !== event.handId) {
      return;
    }

    // Store for finalize
    this.currentHandShowdown = {
      reached: event.reached,
      reachedAt: event.reachedAt,
      participants: event.participants,
      winners: event.winners,
      boardAWinners: event.boardAWinners,
      boardBWinners: event.boardBWinners,
    };

    const showdownEvent: ActionEvent = {
      eventId: `${event.handId}-SHOWDOWN_RESOLVED`,
      handId: event.handId,
      sessionId: event.sessionId,
      seq: this.currentHandBuffer.length,
      timestamp: event.evaluatedAt,
      playerId: 'SYSTEM',
      action: 'SHOWDOWN_RESOLVED',
      amount: 0,
      reached: event.reached,
      participants: event.participants,
      winners: event.winners,
      boardAWinners: event.boardAWinners,
      boardBWinners: event.boardBWinners,
    };

    this.currentHandBuffer.push(showdownEvent);

    // emit
    this.emitActionRecorded({
      handId: event.handId,
      sessionId: event.sessionId,
      actionEvent: showdownEvent,
    });
  }

  /**
   * POT_DISTRIBUTED イベント処理
   */
  onPotDistributed(event: PotDistributedEvent): void {
    if (!this.currentHandMeta || this.currentHandMeta.handId !== event.handId) {
      return;
    }

    // Store for finalize
    this.currentHandPayout = {
      totalPot: event.totalPot,
      potA: event.potA,
      potB: event.potB,
      rakeAmount: event.rakeAmount,
      payoutByPlayer: event.payoutByPlayer,
    };

    const potEvent: ActionEvent = {
      eventId: `${event.handId}-POT_DISTRIBUTED`,
      handId: event.handId,
      sessionId: event.sessionId,
      seq: this.currentHandBuffer.length,
      timestamp: event.distributedAt,
      playerId: 'SYSTEM',
      action: 'POT_DISTRIBUTED',
      amount: 0,
      totalPot: event.totalPot,
      potA: event.potA,
      potB: event.potB,
      rakeAmount: event.rakeAmount,
      payoutByPlayer: event.payoutByPlayer,
    };

    this.currentHandBuffer.push(potEvent);

    // emit
    this.emitActionRecorded({
      handId: event.handId,
      sessionId: event.sessionId,
      actionEvent: potEvent,
    });
  }

  /**
   * HAND_COMPLETED イベント処理
   * → HandRecord をfinalizeして emit
   */
  onHandCompleted(event: HandCompletedEvent): void {
    if (!this.currentHandMeta || this.currentHandMeta.handId !== event.handId) {
      return;
    }

    const handRecord: HandRecord = {
      schemaVersion: 1,
      handId: event.handId,
      sessionId: event.sessionId,
      sessionHandNumber: this.currentHandMeta.sessionHandNumber,
      tableId: this.currentHandMeta.tableId,
      tableSeq: this.currentHandMeta.tableSeq,
      heroPlayerId: this.currentHandMeta.heroPlayerId,
      players: this.currentHandMeta.players,
      boardA: this.currentHandMeta.boardA,
      boardB: this.currentHandMeta.boardB,
      format: this.currentHandMeta.format as 'PLO6MAX',
      blindSize: this.currentHandMeta.blindSize,
      startedAt: this.currentHandMeta.startedAt,
      actionableAt: this.currentHandMeta.actionableAt,
      handStartToActionableMs: this.currentHandMeta.handStartToActionableMs,
      foldToNextHandMs:
        this.lastFastFoldDequeuedAt > 0
          ? this.lastFastFoldDequeuedAt - this.lastFoldTimestamp
          : undefined,
      endedAt: event.endedAt,
      durationMs: event.durationMs,
      actions: [...this.currentHandBuffer],
      result: {
        terminalReason: event.terminalReason,
        showdown: this.currentHandShowdown || {
          reached: false,
          participants: [],
          winners: [],
        },
        totalPot: this.currentHandPayout?.totalPot || 0,
        potA: this.currentHandPayout?.potA,
        potB: this.currentHandPayout?.potB,
        rakeAmount: this.currentHandPayout?.rakeAmount,
        payoutByPlayer: this.currentHandPayout?.payoutByPlayer || {},
        completedAt: event.endedAt,
      },
      metrics: {
        actionCount: this.currentHandBuffer.length,
        participantCountAtStart: this.currentHandMeta.players.length,
        heroOutcomeAmount: event.heroOutcomeAmount,
        wasHeroInvolved: this.computeWasHeroInvolved(
          event.heroPlayerId,
          this.currentHandBuffer
        ),
        wasHeroAtShowdown: this.computeWasHeroAtShowdown(
          event.heroPlayerId,
          this.currentHandShowdown
        ),
      },
      isFinalized: true,
      finalizedAt: Date.now(),
    };

    // emit
    this.emitHandRecordFinalized({
      handId: event.handId,
      sessionId: event.sessionId,
      handRecord,
      finalizeContext: {
        sessionHandNumber: this.currentHandMeta.sessionHandNumber,
        terminalReason: event.terminalReason,
        heroOutcomeAmount: event.heroOutcomeAmount,
        foldToNextHandMs:
          this.lastFastFoldDequeuedAt > 0
            ? this.lastFastFoldDequeuedAt - this.lastFoldTimestamp
            : undefined,
      },
    });

    // Reset for next hand
    this.currentHandBuffer = [];
    this.currentHandMeta = null;
    this.currentHandShowdown = null;
    this.currentHandPayout = null;
    this.lastFoldTimestamp = 0;
    this.lastFastFoldDequeuedAt = 0;
  }

  /**
   * Hero が参加したかどうかを計算
   */
  private computeWasHeroInvolved(
    heroPlayerId: string,
    actions: ActionEvent[]
  ): boolean {
    return actions.some(
      (a) =>
        a.playerId === heroPlayerId &&
        (a.action === 'CALL' ||
          a.action === 'BET' ||
          a.action === 'RAISE' ||
          a.action === 'FOLD' ||
          a.action === 'CHECK')
    );
  }

  /**
   * Hero が showdown に reach したかどうかを計算
   */
  private computeWasHeroAtShowdown(
    heroPlayerId: string,
    showdown: ShowdownResult | null
  ): boolean {
    if (!showdown || !showdown.reached) {
      return false;
    }
    return (
      showdown.participants?.includes(heroPlayerId) || false
    );
  }
}
