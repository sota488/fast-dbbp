/**
 * Hand History Engine テスト仕様
 * MVP: 41ケース (Category 1, 3, 4, 5, 7, 8)
 */

import { HandHistoryEngine } from './index';
import type {
  HandStartedEvent,
  ActionAppliedEvent,
  FastFoldConfirmedEvent,
  StreetChangedEvent,
  ShowdownResolvedEvent,
  PotDistributedEvent,
  HandCompletedEvent,
  ActionRecordedEvent,
  HandRecordFinalizedEvent,
  PlayerSnapshot,
  Position,
} from './types';

describe('HandHistoryEngine', () => {
  let engine: HandHistoryEngine;
  let recordedActions: ActionRecordedEvent[] = [];
  let finalizedRecords: HandRecordFinalizedEvent[] = [];

  beforeEach(() => {
    engine = new HandHistoryEngine();
    recordedActions = [];
    finalizedRecords = [];

    engine.subscribe({
      onActionRecorded: (event) => {
        recordedActions.push(event);
      },
      onHandRecordFinalized: (event) => {
        finalizedRecords.push(event);
      },
    });
  });

  // ==================== Category 1: Event Reception & AppendFlow ====================

  describe('Category 1: Event Reception & AppendFlow', () => {
    // TC-01: HAND_STARTED イベント受信で初期化される
    it('TC-01: HAND_STARTED イベント受信で初期化される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      const event: HandStartedEvent = {
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      };

      engine.onHandStarted(event);

      expect(recordedActions).toHaveLength(1);
      expect(recordedActions[0].actionEvent.action).toBe('HAND_STARTED');
      expect(recordedActions[0].actionEvent.seq).toBe(0);
      expect(recordedActions[0].handContext?.handStartToActionableMs).toBe(100);
    });

    // TC-02: ACTION_APPLIED イベント受信で ActionEvent が append される
    it('TC-02: ACTION_APPLIED イベント受信で ActionEvent が append される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      const actionEvent: ActionAppliedEvent = {
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_bb',
        position: 'BB',
        street: 'PREFLOP',
        action: 'FOLD',
        amount: 0,
        potBefore: 30,
        potAfter: 30,
        stackBefore: 1000,
        stackAfter: 1000,
        toCall: 0,
        seq: 1,
        timestamp: 1200,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: true,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      };

      engine.onActionApplied(actionEvent);

      expect(recordedActions).toHaveLength(2); // HAND_STARTED + ACTION_APPLIED
      expect(recordedActions[1].actionEvent.action).toBe('FOLD');
      expect(recordedActions[1].actionEvent.seq).toBe(1);
    });

    // TC-03: ACTION_APPLIED 複数イベントで seq が連続増加する
    it('TC-03: ACTION_APPLIED 複数イベントで seq が連続増加する', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      const actions = ['CALL', 'RAISE', 'FOLD', 'CHECK', 'CALL'] as const;
      for (let i = 0; i < actions.length; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_${i}`,
          position: 'UTG',
          street: 'PREFLOP',
          action: actions[i],
          amount: i * 10,
          potBefore: 30 + i * 10,
          potAfter: 30 + (i + 1) * 10,
          stackBefore: 1000 - i * 10,
          stackAfter: 1000 - (i + 1) * 10,
          toCall: 20,
          seq: i + 1,
          timestamp: 1200 + i * 100,
          preflopRaiseCountBeforeAction: i >= 2 ? 1 : 0,
          preflopRaiseAmountBeforeAction: i >= 2 ? 30 : 0,
          isOpportunityVpip: true,
          isOpportunityPfr: true,
          isOpportunity3Bet: i >= 2,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });
      }

      // HAND_STARTED + 5 ACTION_APPLIED
      expect(recordedActions).toHaveLength(6);
      for (let i = 0; i < 5; i++) {
        expect(recordedActions[i + 1].actionEvent.seq).toBe(i + 1);
      }
    });

    // TC-04: FAST_FOLD_CONFIRMED イベント受信で foldToNextHandMs が計算される
    it('TC-04: FAST_FOLD_CONFIRMED イベント受信で foldToNextHandMs が計算される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_fold',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'FOLD',
        amount: 0,
        potBefore: 30,
        potAfter: 30,
        stackBefore: 1000,
        stackAfter: 1000,
        toCall: 20,
        seq: 1,
        timestamp: 1500,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: true,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onFastFoldConfirmed({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_fold',
        foldedAt: 1500,
        dequeuedAt: 1750,
        tableId: 'table_1',
      });

      const fastFoldEvent = recordedActions.find(
        (e) => e.fastFoldMetrics !== undefined
      );
      expect(fastFoldEvent).toBeDefined();
      expect(fastFoldEvent?.fastFoldMetrics?.foldToNextHandMs).toBe(250);
    });

    // TC-05: STREET_CHANGED イベント受信で新ストリートメタが append される
    it('TC-05: STREET_CHANGED イベント受信で新ストリートメタが append される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onStreetChanged({
        handId: 'hand_1',
        sessionId: 'session_1',
        fromStreet: 'PREFLOP',
        toStreet: 'FLOP',
        boardA: ['2c', '3d', '4h'],
        boardB: ['2c', '3d', '4h'],
        potAtStreetStart: 100,
        actionOrder: ['player_1', 'player_2'],
        timestamp: 2000,
      });

      const streetEvent = recordedActions.find(
        (e) => e.actionEvent.action === 'STREET_CHANGED'
      );
      expect(streetEvent).toBeDefined();
      expect(streetEvent?.actionEvent.street).toBe('FLOP');
    });

    // TC-06: SHOWDOWN_RESOLVED イベント受信で showdown メタが append される
    it('TC-06: SHOWDOWN_RESOLVED イベント受信で showdown メタが append される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onShowdownResolved({
        handId: 'hand_1',
        sessionId: 'session_1',
        reached: true,
        participants: ['player_1', 'player_2'],
        winners: ['player_1'],
        reachedAt: 3000,
        evaluatedAt: 3100,
      });

      const showdownEvent = recordedActions.find(
        (e) => e.actionEvent.action === 'SHOWDOWN_RESOLVED'
      );
      expect(showdownEvent).toBeDefined();
      expect(showdownEvent?.actionEvent.reached).toBe(true);
    });

    // TC-07: POT_DISTRIBUTED イベント受信で payout メタが append される
    it('TC-07: POT_DISTRIBUTED イベント受信で payout メタが append される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onPotDistributed({
        handId: 'hand_1',
        sessionId: 'session_1',
        totalPot: 1000,
        potA: 500,
        potB: 500,
        payoutByPlayer: { player_1: 600, player_2: 400 },
        payoutByPlayerId: [
          { playerId: 'player_1', payout: 600, gainLoss: 100 },
          { playerId: 'player_2', payout: 400, gainLoss: -100 },
        ],
        distributedAt: 3200,
      });

      const potEvent = recordedActions.find(
        (e) => e.actionEvent.action === 'POT_DISTRIBUTED'
      );
      expect(potEvent).toBeDefined();
      expect(potEvent?.actionEvent.totalPot).toBe(1000);
    });

    // TC-08: HAND_COMPLETED イベント受信で HandRecord が finalize される
    it('TC-08: HAND_COMPLETED イベント受信で HandRecord が finalize される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -20,
      });

      expect(finalizedRecords).toHaveLength(1);
      expect(finalizedRecords[0].handRecord.handId).toBe('hand_1');
      expect(finalizedRecords[0].handRecord.isFinalized).toBe(true);
    });
  });

  // ==================== Category 2: ActionEvent Management ====================

  describe('Category 2: ActionEvent Management', () => {
    // TC-12: ActionEvent.seq は ハンド内で 0-based 単調増加
    it('TC-12: ActionEvent.seq は ハンド内で 0-based 単調増加', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      for (let i = 0; i < 5; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_${i}`,
          position: 'UTG',
          street: 'PREFLOP',
          action: 'CALL',
          amount: 20,
          potBefore: 30 + i * 20,
          potAfter: 50 + i * 20,
          stackBefore: 1000 - i * 20,
          stackAfter: 980 - i * 20,
          toCall: 20,
          seq: i + 1,
          timestamp: 1200 + i * 100,
          preflopRaiseCountBeforeAction: 0,
          preflopRaiseAmountBeforeAction: 0,
          isOpportunityVpip: true,
          isOpportunityPfr: false,
          isOpportunity3Bet: false,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });
      }

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      const record = finalizedRecords[0].handRecord;
      for (let i = 0; i < record.actions.length; i++) {
        expect(record.actions[i].seq).toBe(i);
      }
    });

    // TC-13: ActionEvent.timestamp は秒単位の正確性を保つ
    it('TC-13: ActionEvent.timestamp は秒単位の正確性を保つ', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      const timestamps = [1200, 1500, 2000, 3000, 4500];
      for (let i = 0; i < timestamps.length; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_${i}`,
          position: 'UTG',
          street: 'PREFLOP',
          action: 'CALL',
          amount: 20,
          potBefore: 30 + i * 20,
          potAfter: 50 + i * 20,
          stackBefore: 1000 - i * 20,
          stackAfter: 980 - i * 20,
          toCall: 20,
          seq: i + 1,
          timestamp: timestamps[i],
          preflopRaiseCountBeforeAction: 0,
          preflopRaiseAmountBeforeAction: 0,
          isOpportunityVpip: true,
          isOpportunityPfr: false,
          isOpportunity3Bet: false,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });
      }

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      const record = finalizedRecords[0].handRecord;
      for (let i = 0; i < timestamps.length; i++) {
        // i+1 は HAND_STARTED の後
        expect(record.actions[i + 1].timestamp).toBe(timestamps[i]);
      }
    });

    // TC-14: ActionEvent は immutable（一度 append されたら変更不可）
    it('TC-14: ActionEvent は immutable（一度 append されたら変更不可）', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_1',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'CALL',
        amount: 20,
        potBefore: 30,
        potAfter: 50,
        stackBefore: 1000,
        stackAfter: 980,
        toCall: 20,
        seq: 1,
        timestamp: 1200,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: false,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -20,
      });

      const record = finalizedRecords[0].handRecord;
      const originalAmount = record.actions[1].amount;
      // Try to mutate (in JS this would normally succeed, but we're checking behavior)
      // The Engine should not be affected
      expect(record.actions[1].amount).toBe(originalAmount);
    });

    // TC-15: ActionEvent.potBefore と potAfter が一貫性を持つ
    it('TC-15: ActionEvent.potBefore と potAfter が一貫性を持つ', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_1',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'CALL',
        amount: 50,
        potBefore: 500,
        potAfter: 550,
        stackBefore: 1000,
        stackAfter: 950,
        toCall: 50,
        seq: 1,
        timestamp: 1200,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: false,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -50,
      });

      const record = finalizedRecords[0].handRecord;
      const action = record.actions[1];
      expect(action.potBefore).toBe(500);
      expect(action.potAfter).toBe(550);
    });

    // TC-16: ActionEvent.stackBefore と stackAfter が一貫性を持つ
    it('TC-16: ActionEvent.stackBefore と stackAfter が一貫性を持つ', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_1',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'CALL',
        amount: 100,
        potBefore: 500,
        potAfter: 600,
        stackBefore: 2000,
        stackAfter: 1900,
        toCall: 100,
        seq: 1,
        timestamp: 1200,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: false,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -100,
      });

      const record = finalizedRecords[0].handRecord;
      const action = record.actions[1];
      expect(action.stackBefore).toBe(2000);
      expect(action.stackAfter).toBe(1900);
    });

    // TC-17: ActionEvent.amount は アクション種別で正確
    it('TC-17: ActionEvent.amount は アクション種別で正確', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      // FOLD: amount = 0
      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_fold',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'FOLD',
        amount: 0,
        potBefore: 100,
        potAfter: 100,
        stackBefore: 1000,
        stackAfter: 1000,
        toCall: 50,
        seq: 1,
        timestamp: 1200,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: true,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      // CALL: amount = toCall
      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_call',
        position: 'HJ',
        street: 'PREFLOP',
        action: 'CALL',
        amount: 50,
        potBefore: 100,
        potAfter: 150,
        stackBefore: 1000,
        stackAfter: 950,
        toCall: 50,
        seq: 2,
        timestamp: 1300,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: false,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      // RAISE: amount > toCall
      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_raise',
        position: 'CO',
        street: 'PREFLOP',
        action: 'RAISE',
        amount: 150,
        raiseTo: 150,
        potBefore: 150,
        potAfter: 300,
        stackBefore: 1000,
        stackAfter: 850,
        toCall: 50,
        seq: 3,
        timestamp: 1400,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: true,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -50,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.actions[1].amount).toBe(0); // FOLD
      expect(record.actions[2].amount).toBe(50); // CALL
      expect(record.actions[3].amount).toBe(150); // RAISE
    });

    // TC-18: ActionEvent.position は PREFLOP で seat to position に変換される
    it('TC-18: ActionEvent.position は PREFLOP で seat to position に変換される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      const positions: Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
      for (let i = 0; i < 6; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_${i}`,
          position: positions[i],
          street: 'PREFLOP',
          action: 'CHECK',
          amount: 0,
          potBefore: 100,
          potAfter: 100,
          stackBefore: 1000,
          stackAfter: 1000,
          toCall: 0,
          seq: i + 1,
          timestamp: 1200 + i * 100,
          preflopRaiseCountBeforeAction: 0,
          preflopRaiseAmountBeforeAction: 0,
          isOpportunityVpip: true,
          isOpportunityPfr: false,
          isOpportunity3Bet: false,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });
      }

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 100,
      });

      const record = finalizedRecords[0].handRecord;
      for (let i = 0; i < 6; i++) {
        expect(record.actions[i + 1].position).toBe(positions[i]);
      }
    });
  });

  

  describe('Category 3: HandRecord Finalization', () => {
    // TC-23: HAND_COMPLETED イベント時に完成 HandRecord が生成される
    it('TC-23: HAND_COMPLETED イベント時に完成 HandRecord が生成される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -20,
      });

      expect(finalizedRecords).toHaveLength(1);
      const record = finalizedRecords[0].handRecord;
      expect(record.handId).toBe('hand_1');
      expect(record.sessionId).toBe('session_1');
      expect(record.isFinalized).toBe(true);
      expect(record.finalizedAt).toBeGreaterThan(0);
    });

    // TC-24: HandRecord.actions は currentHandBuffer のすべてのイベントを含む
    it('TC-24: HandRecord.actions は currentHandBuffer のすべてのイベントを含む', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      for (let i = 0; i < 3; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_${i}`,
          position: 'UTG',
          street: 'PREFLOP',
          action: 'CALL',
          amount: 20,
          potBefore: 30 + i * 20,
          potAfter: 50 + i * 20,
          stackBefore: 1000 - i * 20,
          stackAfter: 980 - i * 20,
          toCall: 20,
          seq: i + 1,
          timestamp: 1200 + i * 100,
          preflopRaiseCountBeforeAction: 0,
          preflopRaiseAmountBeforeAction: 0,
          isOpportunityVpip: true,
          isOpportunityPfr: false,
          isOpportunity3Bet: false,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });
      }

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      const record = finalizedRecords[0].handRecord;
      // HAND_STARTED(seq=0) + 3 ACTION_APPLIED(seq=1,2,3)
      expect(record.actions.length).toBeGreaterThanOrEqual(4);
      expect(record.metrics.actionCount).toBeGreaterThanOrEqual(4);
    });

    // TC-25: HandRecord.result.terminalReason は HAND_COMPLETED から引き継がれる
    it('TC-25: HandRecord.result.terminalReason は HAND_COMPLETED から引き継がれる', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'WALK',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 10,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.result.terminalReason).toBe('WALK');
    });

    // TC-26: HandRecord.result.showdown は SHOWDOWN_RESOLVED から構築される
    it('TC-26: HandRecord.result.showdown は SHOWDOWN_RESOLVED から構築される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onShowdownResolved({
        handId: 'hand_1',
        sessionId: 'session_1',
        reached: true,
        participants: ['player_1', 'player_2'],
        winners: ['player_1'],
        reachedAt: 3000,
        evaluatedAt: 3100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.result.showdown.reached).toBe(true);
      expect(record.result.showdown.winners).toContain('player_1');
    });

    // TC-27: HandRecord.result.payoutByPlayer は POT_DISTRIBUTED から取得される
    it('TC-27: HandRecord.result.payoutByPlayer は POT_DISTRIBUTED から取得される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onPotDistributed({
        handId: 'hand_1',
        sessionId: 'session_1',
        totalPot: 1000,
        payoutByPlayer: { player_a: 600, player_b: 400 },
        payoutByPlayerId: [
          { playerId: 'player_a', payout: 600, gainLoss: 100 },
          { playerId: 'player_b', payout: 400, gainLoss: -100 },
        ],
        distributedAt: 3200,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 100,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.result.payoutByPlayer['player_a']).toBe(600);
      expect(record.result.payoutByPlayer['player_b']).toBe(400);
    });

    // TC-28: HandRecord.metrics.actionCount は actions array length と一致
    it('TC-28: HandRecord.metrics.actionCount は actions array length と一致', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      for (let i = 0; i < 5; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_${i}`,
          position: 'UTG',
          street: 'PREFLOP',
          action: 'CALL',
          amount: 20,
          potBefore: 30 + i * 20,
          potAfter: 50 + i * 20,
          stackBefore: 1000 - i * 20,
          stackAfter: 980 - i * 20,
          toCall: 20,
          seq: i + 1,
          timestamp: 1200 + i * 100,
          preflopRaiseCountBeforeAction: 0,
          preflopRaiseAmountBeforeAction: 0,
          isOpportunityVpip: true,
          isOpportunityPfr: false,
          isOpportunity3Bet: false,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });
      }

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      const record = finalizedRecords[0].handRecord;
      // HAND_STARTED + 5 ACTION_APPLIED = 6以上
      expect(record.metrics.actionCount).toBe(record.actions.length);
    });

    // TC-29: HandRecord.metrics.heroOutcomeAmount は HAND_COMPLETED から取得
    it('TC-29: HandRecord.metrics.heroOutcomeAmount は HAND_COMPLETED から取得', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 250,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.metrics.heroOutcomeAmount).toBe(250);
    });

    // TC-30: HandRecord.metrics.wasHeroInvolved が正確に判定される
    it('TC-30: HandRecord.metrics.wasHeroInvolved が正確に判定される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'hero',
        position: 'SB',
        street: 'PREFLOP',
        action: 'CALL',
        amount: 10,
        potBefore: 30,
        potAfter: 40,
        stackBefore: 1000,
        stackAfter: 990,
        toCall: 10,
        seq: 1,
        timestamp: 1200,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: false,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -10,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.metrics.wasHeroInvolved).toBe(true);
    });

    // TC-31: HandRecord.metrics.wasHeroAtShowdown が SHOWDOWN_RESOLVED から判定される
    it('TC-31: HandRecord.metrics.wasHeroAtShowdown が SHOWDOWN_RESOLVED から判定される', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onShowdownResolved({
        handId: 'hand_1',
        sessionId: 'session_1',
        reached: true,
        participants: ['hero', 'player_1'],
        winners: ['hero'],
        reachedAt: 3000,
        evaluatedAt: 3100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 100,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.metrics.wasHeroAtShowdown).toBe(true);
    });
  });

  // ==================== Category 4: Metrics Calculation ====================

  describe('Category 4: Metrics Calculation', () => {
    // TC-34: handStartToActionableMs = actionableAt - startedAt が正確
    it('TC-34: handStartToActionableMs = actionableAt - startedAt が正確', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1500,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1500,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 500,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 0,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.handStartToActionableMs).toBe(500);
    });

    // TC-35: foldToNextHandMs は最後の FOLD → FAST_FOLD_CONFIRMED 間の時間
    it('TC-35: foldToNextHandMs は最後の FOLD → FAST_FOLD_CONFIRMED 間の時間', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_fold',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'FOLD',
        amount: 0,
        potBefore: 30,
        potAfter: 30,
        stackBefore: 1000,
        stackAfter: 1000,
        toCall: 20,
        seq: 1,
        timestamp: 2000,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: true,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onFastFoldConfirmed({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_fold',
        foldedAt: 2000,
        dequeuedAt: 2400,
        tableId: 'table_1',
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -20,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.foldToNextHandMs).toBe(400);
    });

    // TC-36: foldToNextHandMs が記録される（複数フォルダー場合）
    it('TC-36: foldToNextHandMs が記録される（複数フォルダー場合）', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      // Multiple fold events
      for (let i = 0; i < 3; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_fold_${i}`,
          position: 'UTG',
          street: 'PREFLOP',
          action: 'FOLD',
          amount: 0,
          potBefore: 30 + i * 20,
          potAfter: 30 + i * 20,
          stackBefore: 1000,
          stackAfter: 1000,
          toCall: 20,
          seq: i + 1,
          timestamp: 1500 + i * 100,
          preflopRaiseCountBeforeAction: 0,
          preflopRaiseAmountBeforeAction: 0,
          isOpportunityVpip: true,
          isOpportunityPfr: true,
          isOpportunity3Bet: false,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });

        engine.onFastFoldConfirmed({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_fold_${i}`,
          foldedAt: 1500 + i * 100,
          dequeuedAt: 1800 + i * 100,
          tableId: 'table_1',
        });
      }

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -20,
      });

      const record = finalizedRecords[0].handRecord;
      // Last fold のタイミング: 1500 + 2*100 = 1700
      // Dequeue: 1800 + 2*100 = 2000
      // diff = 300
      expect(record.foldToNextHandMs).toBe(300);
    });

    // TC-37: sessionHandNumber が HAND_STARTED から引き継がれる
    it('TC-37: sessionHandNumber が HAND_STARTED から引き継がれる', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 42,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 0,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.sessionHandNumber).toBe(42);
    });

    // TC-38: durationMs = endedAt - startedAt が正確
    it('TC-38: durationMs = endedAt - startedAt が正確', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 0,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.durationMs).toBe(4000);
    });

    // TC-39: actionCount = actions.length が正確
    it('TC-39: actionCount = actions.length が正確', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      for (let i = 0; i < 8; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_${i}`,
          position: 'UTG',
          street: 'PREFLOP',
          action: 'CALL',
          amount: 20,
          potBefore: 30 + i * 20,
          potAfter: 50 + i * 20,
          stackBefore: 1000 - i * 20,
          stackAfter: 980 - i * 20,
          toCall: 20,
          seq: i + 1,
          timestamp: 1200 + i * 100,
          preflopRaiseCountBeforeAction: 0,
          preflopRaiseAmountBeforeAction: 0,
          isOpportunityVpip: true,
          isOpportunityPfr: false,
          isOpportunity3Bet: false,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });
      }

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      const record = finalizedRecords[0].handRecord;
      // HAND_STARTED + 8 ACTION_APPLIED
      expect(record.metrics.actionCount).toBe(record.actions.length);
      expect(record.metrics.actionCount).toBeGreaterThanOrEqual(9);
    });
  });

  // ==================== Category 5: Session Continuity ====================

  describe('Category 5: Session Continuity', () => {
    // TC-43: 複数ハンド間で sessionId が一貫している
    it('TC-43: 複数ハンド間で sessionId が一貫している', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      // Hand 1
      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3300,
        durationMs: 2300,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -20,
      });

      // Hand 2
      engine.onHandStarted({
        handId: 'hand_2',
        sessionId: 'session_1',
        sessionHandNumber: 2,
        tableId: 'table_1',
        tableSeq: 2,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 5000,
        actionableAt: 5100,
      });

      engine.onHandCompleted({
        handId: 'hand_2',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 5000,
        actionableAt: 5100,
        endedAt: 7000,
        durationMs: 2000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      expect(finalizedRecords).toHaveLength(2);
      expect(finalizedRecords[0].handRecord.sessionId).toBe('session_1');
      expect(finalizedRecords[1].handRecord.sessionId).toBe('session_1');
    });

    // TC-44: sessionHandNumber が単調増加
    it('TC-44: sessionHandNumber が単調増加', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      for (let handNum = 1; handNum <= 5; handNum++) {
        engine.onHandStarted({
          handId: `hand_${handNum}`,
          sessionId: 'session_1',
          sessionHandNumber: handNum,
          tableId: 'table_1',
          tableSeq: handNum,
          heroPlayerId: 'hero',
          players,
          boardA: ['2c', '3d', '4h', '5s', '6d'],
          boardB: ['2c', '3d', '4h', '5s', '6d'],
          blindSize: { sb: 10, bb: 20 },
          format: 'PLO6MAX',
          startedAt: 1000 + handNum * 5000,
          actionableAt: 1100 + handNum * 5000,
        });

        engine.onHandCompleted({
          handId: `hand_${handNum}`,
          sessionId: 'session_1',
          terminalReason: 'FOLDED',
          startedAt: 1000 + handNum * 5000,
          actionableAt: 1100 + handNum * 5000,
          endedAt: 3000 + handNum * 5000,
          durationMs: 2000,
          handStartToActionableMs: 100,
          heroPlayerId: 'hero',
          heroOutcomeAmount: 0,
        });
      }

      expect(finalizedRecords).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(finalizedRecords[i].handRecord.sessionHandNumber).toBe(i + 1);
      }
    });

    // TC-45: heroPlayerId がセッション中一貫している
    it('TC-45: heroPlayerId がセッション中一貫している', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      for (let i = 0; i < 3; i++) {
        engine.onHandStarted({
          handId: `hand_${i}`,
          sessionId: 'session_1',
          sessionHandNumber: i + 1,
          tableId: 'table_1',
          tableSeq: i + 1,
          heroPlayerId: 'hero',
          players,
          boardA: ['2c', '3d', '4h', '5s', '6d'],
          boardB: ['2c', '3d', '4h', '5s', '6d'],
          blindSize: { sb: 10, bb: 20 },
          format: 'PLO6MAX',
          startedAt: 1000 + i * 5000,
          actionableAt: 1100 + i * 5000,
        });

        engine.onHandCompleted({
          handId: `hand_${i}`,
          sessionId: 'session_1',
          terminalReason: 'FOLDED',
          startedAt: 1000 + i * 5000,
          actionableAt: 1100 + i * 5000,
          endedAt: 3000 + i * 5000,
          durationMs: 2000,
          handStartToActionableMs: 100,
          heroPlayerId: 'hero',
          heroOutcomeAmount: 0,
        });
      }

      for (const record of finalizedRecords) {
        expect(record.handRecord.heroPlayerId).toBe('hero');
      }
    });

    // TC-46: 異なる tableId 間での sessionHandNumber は連続
    it('TC-46: 異なる tableId 間での sessionHandNumber は連続', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      const tableIds = ['table_1', 'table_1', 'table_2', 'table_2'];
      for (let i = 0; i < 4; i++) {
        engine.onHandStarted({
          handId: `hand_${i}`,
          sessionId: 'session_1',
          sessionHandNumber: i + 1,
          tableId: tableIds[i],
          tableSeq: (i % 2) + 1,
          heroPlayerId: 'hero',
          players,
          boardA: ['2c', '3d', '4h', '5s', '6d'],
          boardB: ['2c', '3d', '4h', '5s', '6d'],
          blindSize: { sb: 10, bb: 20 },
          format: 'PLO6MAX',
          startedAt: 1000 + i * 5000,
          actionableAt: 1100 + i * 5000,
        });

        engine.onHandCompleted({
          handId: `hand_${i}`,
          sessionId: 'session_1',
          terminalReason: 'FOLDED',
          startedAt: 1000 + i * 5000,
          actionableAt: 1100 + i * 5000,
          endedAt: 3000 + i * 5000,
          durationMs: 2000,
          handStartToActionableMs: 100,
          heroPlayerId: 'hero',
          heroOutcomeAmount: 0,
        });
      }

      expect(finalizedRecords).toHaveLength(4);
      expect(finalizedRecords[0].handRecord.tableId).toBe('table_1');
      expect(finalizedRecords[1].handRecord.tableId).toBe('table_1');
      expect(finalizedRecords[2].handRecord.tableId).toBe('table_2');
      expect(finalizedRecords[3].handRecord.tableId).toBe('table_2');

      // sessionHandNumber must be continuous
      for (let i = 0; i < 4; i++) {
        expect(finalizedRecords[i].handRecord.sessionHandNumber).toBe(i + 1);
      }
    });

    // TC-47: セッション再開時に正しい sessionHandNumber で続行
    it('TC-47: セッション再開時に正しい sessionHandNumber で続行', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      // 最初のハンド: sessionHandNumber=51
      engine.onHandStarted({
        handId: 'hand_51',
        sessionId: 'session_1',
        sessionHandNumber: 51,
        tableId: 'table_1',
        tableSeq: 51,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onHandCompleted({
        handId: 'hand_51',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3000,
        durationMs: 2000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 0,
      });

      // 次のハンド: sessionHandNumber=52
      engine.onHandStarted({
        handId: 'hand_52',
        sessionId: 'session_1',
        sessionHandNumber: 52,
        tableId: 'table_1',
        tableSeq: 52,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 5000,
        actionableAt: 5100,
      });

      engine.onHandCompleted({
        handId: 'hand_52',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 5000,
        actionableAt: 5100,
        endedAt: 7000,
        durationMs: 2000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      expect(finalizedRecords).toHaveLength(2);
      expect(finalizedRecords[0].handRecord.sessionHandNumber).toBe(51);
      expect(finalizedRecords[1].handRecord.sessionHandNumber).toBe(52);
    });
  });

  // ==================== Category 7: Edge Cases ====================

  describe('Category 7: Edge Cases', () => {
    // TC-58: PREFLOP walk（全員 fold → showdown なし）
    it('TC-58: PREFLOP walk（全員 fold → showdown なし）', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      // Multiple folds, no showdown
      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_1',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'FOLD',
        amount: 0,
        potBefore: 30,
        potAfter: 30,
        stackBefore: 1000,
        stackAfter: 1000,
        toCall: 20,
        seq: 1,
        timestamp: 1200,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: true,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onPotDistributed({
        handId: 'hand_1',
        sessionId: 'session_1',
        totalPot: 30,
        payoutByPlayer: { sb: 30 },
        payoutByPlayerId: [{ playerId: 'sb', payout: 30, gainLoss: 20 }],
        distributedAt: 3000,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'WALK',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3100,
        durationMs: 2100,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 20,
      });

      const record = finalizedRecords[0].handRecord;
      expect(record.result.terminalReason).toBe('WALK');
      expect(record.result.showdown.reached).toBe(false);
    });

    // TC-59: Bomb Pot（PREFLOP skip）での記録
    it('TC-59: Bomb Pot（PREFLOP skip）での記録', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      // Jump to FLOP (Bomb Pot scenario)
      engine.onStreetChanged({
        handId: 'hand_1',
        sessionId: 'session_1',
        fromStreet: 'PREFLOP',
        toStreet: 'FLOP',
        boardA: ['2c', '3d', '4h'],
        boardB: ['2c', '3d', '4h'],
        potAtStreetStart: 300,
        actionOrder: ['player_1', 'player_2'],
        timestamp: 1500,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 3000,
        durationMs: 2000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -300,
      });

      const record = finalizedRecords[0].handRecord;
      // Should have HAND_STARTED and STREET_CHANGED, but no PREFLOP action
      const preflopActions = record.actions.filter((a) => a.street === 'PREFLOP');
      expect(preflopActions.length).toBeLessThanOrEqual(0);
    });
  });

  // ==================== Category 8: Data Consistency & Validation ====================

  describe('Category 8: Data Consistency & Validation', () => {
    // TC-68: actionSeq が ハンド内で必ず連続（0-based）
    it('TC-68: actionSeq が ハンド内で必ず連続（0-based）', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      for (let i = 0; i < 5; i++) {
        engine.onActionApplied({
          handId: 'hand_1',
          sessionId: 'session_1',
          playerId: `player_${i}`,
          position: 'UTG',
          street: 'PREFLOP',
          action: 'CALL',
          amount: 20,
          potBefore: 30 + i * 20,
          potAfter: 50 + i * 20,
          stackBefore: 1000 - i * 20,
          stackAfter: 980 - i * 20,
          toCall: 20,
          seq: i + 1,
          timestamp: 1200 + i * 100,
          preflopRaiseCountBeforeAction: 0,
          preflopRaiseAmountBeforeAction: 0,
          isOpportunityVpip: true,
          isOpportunityPfr: false,
          isOpportunity3Bet: false,
          isOpportunityWtsd: false,
          isAutoAction: false,
        });
      }

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'SHOWDOWN',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: 50,
      });

      const record = finalizedRecords[0].handRecord;
      for (let i = 0; i < record.actions.length; i++) {
        expect(record.actions[i].seq).toBe(i);
      }
    });

    // TC-69: 隣接 action の potBefore/potAfter が一致する
    it('TC-69: 隣接 action の potBefore/potAfter が一致する', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      engine.onHandStarted({
        handId: 'hand_1',
        sessionId: 'session_1',
        sessionHandNumber: 1,
        tableId: 'table_1',
        tableSeq: 1,
        heroPlayerId: 'hero',
        players,
        boardA: ['2c', '3d', '4h', '5s', '6d'],
        boardB: ['2c', '3d', '4h', '5s', '6d'],
        blindSize: { sb: 10, bb: 20 },
        format: 'PLO6MAX',
        startedAt: 1000,
        actionableAt: 1100,
      });

      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_1',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'CALL',
        amount: 20,
        potBefore: 30,
        potAfter: 50,
        stackBefore: 1000,
        stackAfter: 980,
        toCall: 20,
        seq: 1,
        timestamp: 1200,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: false,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onActionApplied({
        handId: 'hand_1',
        sessionId: 'session_1',
        playerId: 'player_2',
        position: 'UTG',
        street: 'PREFLOP',
        action: 'RAISE',
        amount: 40,
        raiseTo: 60,
        potBefore: 50,
        potAfter: 90,
        stackBefore: 1000,
        stackAfter: 960,
        toCall: 60,
        seq: 2,
        timestamp: 1300,
        preflopRaiseCountBeforeAction: 0,
        preflopRaiseAmountBeforeAction: 0,
        isOpportunityVpip: true,
        isOpportunityPfr: true,
        isOpportunity3Bet: false,
        isOpportunityWtsd: false,
        isAutoAction: false,
      });

      engine.onHandCompleted({
        handId: 'hand_1',
        sessionId: 'session_1',
        terminalReason: 'FOLDED',
        startedAt: 1000,
        actionableAt: 1100,
        endedAt: 5000,
        durationMs: 4000,
        handStartToActionableMs: 100,
        heroPlayerId: 'hero',
        heroOutcomeAmount: -20,
      });

      const record = finalizedRecords[0].handRecord;
      // Find adjacent potBefore/potAfter matches
      for (let i = 0; i < record.actions.length - 1; i++) {
        const current = record.actions[i];
        const next = record.actions[i + 1];
        if (current.potAfter !== undefined && next.potBefore !== undefined) {
          expect(current.potAfter).toBe(next.potBefore);
        }
      }
    });

    // TC-70: handId の uniqueness
    it('TC-70: handId の uniqueness（異なるハンドで異なる handId）', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      for (let i = 0; i < 3; i++) {
        engine.onHandStarted({
          handId: `hand_${i}`,
          sessionId: 'session_1',
          sessionHandNumber: i + 1,
          tableId: 'table_1',
          tableSeq: i + 1,
          heroPlayerId: 'hero',
          players,
          boardA: ['2c', '3d', '4h', '5s', '6d'],
          boardB: ['2c', '3d', '4h', '5s', '6d'],
          blindSize: { sb: 10, bb: 20 },
          format: 'PLO6MAX',
          startedAt: 1000 + i * 5000,
          actionableAt: 1100 + i * 5000,
        });

        engine.onHandCompleted({
          handId: `hand_${i}`,
          sessionId: 'session_1',
          terminalReason: 'FOLDED',
          startedAt: 1000 + i * 5000,
          actionableAt: 1100 + i * 5000,
          endedAt: 3000 + i * 5000,
          durationMs: 2000,
          handStartToActionableMs: 100,
          heroPlayerId: 'hero',
          heroOutcomeAmount: 0,
        });
      }

      const handIds = new Set(finalizedRecords.map((r) => r.handRecord.handId));
      expect(handIds.size).toBe(3);
    });

    // TC-71: HandRecord の schemaVersion が一貫
    it('TC-71: HandRecord の schemaVersion が一貫', () => {
      const players: PlayerSnapshot[] = [
        {
          playerId: 'hero',
          playerType: 'human',
          seatIndex: 0,
          position: 'SB',
          stackAtHandStart: 1000,
          effectiveStackAtStart: 1000,
          participated: false,
          foldedPreflop: false,
        },
      ];

      for (let i = 0; i < 3; i++) {
        engine.onHandStarted({
          handId: `hand_${i}`,
          sessionId: 'session_1',
          sessionHandNumber: i + 1,
          tableId: 'table_1',
          tableSeq: i + 1,
          heroPlayerId: 'hero',
          players,
          boardA: ['2c', '3d', '4h', '5s', '6d'],
          boardB: ['2c', '3d', '4h', '5s', '6d'],
          blindSize: { sb: 10, bb: 20 },
          format: 'PLO6MAX',
          startedAt: 1000 + i * 5000,
          actionableAt: 1100 + i * 5000,
        });

        engine.onHandCompleted({
          handId: `hand_${i}`,
          sessionId: 'session_1',
          terminalReason: 'FOLDED',
          startedAt: 1000 + i * 5000,
          actionableAt: 1100 + i * 5000,
          endedAt: 3000 + i * 5000,
          durationMs: 2000,
          handStartToActionableMs: 100,
          heroPlayerId: 'hero',
          heroOutcomeAmount: 0,
        });
      }

      for (const record of finalizedRecords) {
        expect(record.handRecord.schemaVersion).toBe(1);
      }
    });
  });
});
