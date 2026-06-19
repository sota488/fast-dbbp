import { Street } from '../table-state/types';
import {
  applyAction,
  computeAllowedActions,
  getNextActingPlayer,
  initializeBettingRound,
  isStreetComplete,
  validateAction,
} from './index';
import { BettingActionType, BettingValidationCode, type BettingEngineView } from './types';

function createView(overrides: Partial<BettingEngineView> = {}): BettingEngineView {
  return {
    tableId: 'table-1',
    handId: 'hand-1',
    street: Street.Flop,
    streetFirstActorOrder: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
    round: {
      bbSize: 2,
      currentBet: 0,
      minRaise: 2,
      lastAggressor: null,
      playersActed: [],
    },
    turn: {
      actingPlayerId: 'SB',
      actionOrder: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
    },
    foldedPlayerIds: [],
    playerBalances: {
      SB: 100,
      BB: 100,
      UTG: 100,
      HJ: 100,
      CO: 100,
      BTN: 100,
    },
    playerCommittedThisStreet: {
      SB: 0,
      BB: 0,
      UTG: 0,
      HJ: 0,
      CO: 0,
      BTN: 0,
    },
    playerCommittedThisHand: {
      SB: 2,
      BB: 2,
      UTG: 2,
      HJ: 2,
      CO: 2,
      BTN: 2,
    },
    bombPotPostedPlayerIds: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
    ...overrides,
  };
}

describe('betting engine (TDD)', () => {
  it('initializeBettingRound: Bomb Pot MVP 既定値を返す', () => {
    const round = initializeBettingRound(2);
    expect(round.currentBet).toBe(0);
    expect(round.minRaise).toBe(2);
    expect(round.bbSize).toBe(2);
    expect(round.playersActed).toEqual([]);
  });

  it('computeAllowedActions: toCall=0 なら check が可能', () => {
    const view = createView();
    const allowed = computeAllowedActions(view, 'SB');
    expect(allowed.canCheck).toBe(true);
    expect(allowed.canCall).toBe(false);
    expect(allowed.canFold).toBe(true);
  });

  it('computeAllowedActions: toCall>0 なら call が可能', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 10, minRaise: 2, lastAggressor: 'BB', playersActed: [] },
      playerCommittedThisStreet: { SB: 4, BB: 10, UTG: 10, HJ: 10, CO: 10, BTN: 10 },
    });
    const allowed = computeAllowedActions(view, 'SB');
    expect(allowed.canCheck).toBe(false);
    expect(allowed.canCall).toBe(true);
    expect(allowed.callAmount).toBe(6);
  });

  it('computeAllowedActions: actionOrder外プレイヤーは行動不可', () => {
    const view = createView();
    const allowed = computeAllowedActions(view, 'X' as keyof BettingEngineView['playerBalances']);
    expect(allowed.canCheck).toBe(false);
    expect(allowed.canCall).toBe(false);
    expect(allowed.canRaise).toBe(false);
    expect(allowed.canFold).toBe(false);
  });

  it('computeAllowedActions: fold済みプレイヤーは行動不可', () => {
    const view = createView({ foldedPlayerIds: ['SB'] });
    const allowed = computeAllowedActions(view, 'SB');
    expect(allowed.canCheck).toBe(false);
    expect(allowed.canCall).toBe(false);
    expect(allowed.canRaise).toBe(false);
    expect(allowed.canFold).toBe(false);
  });

  it('computeAllowedActions: raise上限不足なら raise不可', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 10, minRaise: 2, lastAggressor: 'BB', playersActed: [] },
      playerCommittedThisStreet: { SB: 0, BB: 20, UTG: 20, HJ: 20, CO: 20, BTN: 20 },
      playerBalances: { SB: 10, BB: 100, UTG: 100, HJ: 100, CO: 100, BTN: 100 },
      playerCommittedThisHand: { SB: 2, BB: 2, UTG: 2, HJ: 2, CO: 2, BTN: 2 },
    });
    const allowed = computeAllowedActions(view, 'SB');
    expect(allowed.canRaise).toBe(false);
  });

  it('validateAction: actingPlayer 以外は拒否', () => {
    const view = createView();
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'BB',
      type: BettingActionType.Check,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.NotActingPlayer);
  });

  it('validateAction: SHOWDOWN のアクションは拒否', () => {
    const view = createView({ street: Street.Showdown });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Showdown,
      playerId: 'SB',
      type: BettingActionType.Call,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.InvalidStreet);
  });

  it('validateAction: handId 不一致は拒否', () => {
    const view = createView();
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'other-hand',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Check,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.HandIdMismatch);
  });

  it('validateAction: tableId 不一致は拒否', () => {
    const view = createView();
    const result = validateAction(view, {
      tableId: 'table-x',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Check,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.TableIdMismatch);
  });

  it('validateAction: actionOrder空かつactingありは拒否', () => {
    const view = createView({ turn: { actingPlayerId: 'SB', actionOrder: [] } });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Check,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.InvalidTurnState);
  });

  it('validateAction: actionOrderに存在しないプレイヤーは拒否', () => {
    const view = createView({ turn: { actingPlayerId: 'SB', actionOrder: ['BB', 'UTG'] } });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Check,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.PlayerNotInActionOrder);
  });

  it('validateAction: minRaise<=0 は拒否', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 0, minRaise: 0, lastAggressor: null, playersActed: [] },
    });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      amount: 2,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.InvalidRoundState);
  });

  it('validateAction: currentBet<committedThisStreet は拒否', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 4, minRaise: 2, lastAggressor: 'BB', playersActed: [] },
      playerCommittedThisStreet: { SB: 10, BB: 4, UTG: 4, HJ: 4, CO: 4, BTN: 4 },
    });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Call,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.InvalidRoundState);
  });

  it('validateAction: fold済みプレイヤーは拒否', () => {
    const view = createView({ foldedPlayerIds: ['SB'] });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      amount: 6,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.PlayerAlreadyFolded);
  });

  it('validateAction: amount<0 は拒否', () => {
    const view = createView();
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      amount: -1,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.InvalidAmount);
  });

  it('validateAction: toCall>0 のcheckは拒否', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 10, minRaise: 2, lastAggressor: 'BB', playersActed: [] },
      playerCommittedThisStreet: { SB: 0, BB: 10, UTG: 10, HJ: 10, CO: 10, BTN: 10 },
    });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Check,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.CheckNotAllowed);
  });

  it('validateAction: toCall=0 のcallは拒否', () => {
    const view = createView();
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Call,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.CallNotAllowed);
  });

  it('validateAction: raise amount 未指定は拒否', () => {
    const view = createView();
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.InvalidAmount);
  });

  it('validateAction: raise不可状態では拒否', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 10, minRaise: 2, lastAggressor: 'BB', playersActed: [] },
      playerCommittedThisStreet: { SB: 0, BB: 10, UTG: 10, HJ: 10, CO: 10, BTN: 10 },
      playerBalances: { SB: 10, BB: 100, UTG: 100, HJ: 100, CO: 100, BTN: 100 },
      playerCommittedThisHand: { SB: 2, BB: 2, UTG: 2, HJ: 2, CO: 2, BTN: 2 },
    });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      amount: 12,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.RaiseNotAllowed);
  });

  it('validateAction: raise min未満は拒否', () => {
    const view = createView();
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      amount: 1,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.RaiseBelowMinimum);
  });

  it('validateAction: raise max超過は拒否', () => {
    const view = createView({ playerBalances: { SB: 5, BB: 100, UTG: 100, HJ: 100, CO: 100, BTN: 100 } });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      amount: 100,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.RaiseAboveMaximum);
  });

  it('validateAction: raise 残高不足は拒否', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 10, minRaise: 2, lastAggressor: 'BB', playersActed: [] },
      playerCommittedThisStreet: { SB: 10, BB: 10, UTG: 10, HJ: 10, CO: 10, BTN: 10 },
      playerBalances: { SB: 1, BB: 100, UTG: 100, HJ: 100, CO: 100, BTN: 100 },
    });
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      amount: 12,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.InsufficientBalance);
  });

  it('validateAction: POST_BOMB_POT は拒否', () => {
    const view = createView();
    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.PostBombPot,
      actedAt: Date.now(),
    });
    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.BombPotNotAllowedNow);
  });

  it('validateAction: 残高不足 call は拒否', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 20, minRaise: 2, lastAggressor: 'BB', playersActed: [] },
      playerCommittedThisStreet: { SB: 0, BB: 20, UTG: 20, HJ: 20, CO: 20, BTN: 20 },
      playerBalances: { SB: 5, BB: 100, UTG: 100, HJ: 100, CO: 100, BTN: 100 },
    });

    const result = validateAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Call,
      actedAt: Date.now(),
    });

    expect(result.isValid).toBe(false);
    expect(result.code).toBe(BettingValidationCode.InsufficientBalance);
  });

  it('applyAction: raise で currentBet と lastAggressor を更新する', () => {
    const view = createView();
    const result = applyAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Raise,
      amount: 6,
      actedAt: Date.now(),
    });

    expect(result.validation.isValid).toBe(true);
    expect(result.view.round.currentBet).toBe(6);
    expect(result.view.round.lastAggressor).toBe('SB');
    expect(result.raiseReopen?.playersActedAfterReopen).toEqual(['SB']);
  });

  it('getNextActingPlayer: 次プレイヤーへ進む', () => {
    const next = getNextActingPlayer(['SB', 'BB', 'UTG'], 'SB', []);
    expect(next).toBe('BB');
  });

  it('getNextActingPlayer: fold済みをスキップする', () => {
    const next = getNextActingPlayer(['SB', 'BB', 'UTG', 'HJ'], 'SB', ['BB']);
    expect(next).toBe('UTG');
  });

  it('getNextActingPlayer: actionOrder空ならnull', () => {
    const next = getNextActingPlayer([], 'SB', []);
    expect(next).toBeNull();
  });

  it('getNextActingPlayer: 全員fold済みならnull', () => {
    const next = getNextActingPlayer(['SB', 'BB'], 'SB', ['SB', 'BB']);
    expect(next).toBeNull();
  });

  it('getNextActingPlayer: currentActingがnullなら先頭へ', () => {
    const next = getNextActingPlayer(['SB', 'BB', 'UTG'], null, []);
    expect(next).toBe('SB');
  });

  it('applyAction: fold で actionOrder から除外し queue event を作る', () => {
    const view = createView();
    const dedupe = new Set<string>();

    const result = applyAction(
      view,
      {
        tableId: 'table-1',
        handId: 'hand-1',
        street: Street.Flop,
        playerId: 'SB',
        type: BettingActionType.Fold,
        actedAt: 12345,
      },
      dedupe,
    );

    expect(result.validation.isValid).toBe(true);
    expect(result.view.turn.actionOrder).toEqual(['BB', 'UTG', 'HJ', 'CO', 'BTN']);
    expect(result.view.turn.actingPlayerId).toBe('BB');
    expect(result.foldResolution?.queueEvent.type).toBe('QUEUE_ENQUEUE_REQUEST');
    expect(result.foldResolution?.queueEvent.trigger).toBe('AFTER_FOLD_CONFIRMED');
    expect(result.foldResolution?.queueEvent.dedupeKey).toBe('hand-1:SB');
    expect(result.foldResolution?.queueEventEmitted).toBe(true);
  });

  it('applyAction: fold queue event は同一 hand/player で重複発火しない', () => {
    const view = createView();
    const dedupe = new Set<string>(['hand-1:SB']);

    const result = applyAction(
      view,
      {
        tableId: 'table-1',
        handId: 'hand-1',
        street: Street.Flop,
        playerId: 'SB',
        type: BettingActionType.Fold,
        actedAt: 12345,
      },
      dedupe,
    );

    expect(result.validation.isValid).toBe(true);
    expect(result.foldResolution?.queueEventEmitted).toBe(false);
  });

  it('applyAction: call 成功でcommitとbalanceが更新される', () => {
    const view = createView({
      round: { bbSize: 2, currentBet: 10, minRaise: 2, lastAggressor: 'BB', playersActed: [] },
      playerCommittedThisStreet: { SB: 4, BB: 10, UTG: 10, HJ: 10, CO: 10, BTN: 10 },
      playerCommittedThisHand: { SB: 6, BB: 12, UTG: 12, HJ: 12, CO: 12, BTN: 12 },
    });

    const result = applyAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Call,
      actedAt: 100,
    });

    expect(result.validation.isValid).toBe(true);
    expect(result.view.playerCommittedThisStreet.SB).toBe(10);
    expect(result.view.playerCommittedThisHand.SB).toBe(12);
    expect(result.view.playerBalances.SB).toBe(94);
    expect(result.view.turn.actingPlayerId).toBe('BB');
  });

  it('applyAction: check 成功で次手番へ移動', () => {
    const view = createView();
    const result = applyAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'SB',
      type: BettingActionType.Check,
      actedAt: 100,
    });

    expect(result.validation.isValid).toBe(true);
    expect(result.view.turn.actingPlayerId).toBe('BB');
    expect(result.view.playerCommittedThisStreet.SB).toBe(0);
  });

  it('applyAction: 無効アクションは状態を変更しない', () => {
    const view = createView();
    const result = applyAction(view, {
      tableId: 'table-1',
      handId: 'hand-1',
      street: Street.Flop,
      playerId: 'BB',
      type: BettingActionType.Check,
      actedAt: 100,
    });
    expect(result.validation.isValid).toBe(false);
    expect(result.view).toBe(view);
    expect(result.record).toBeUndefined();
  });

  it('isStreetComplete: 全員acted && 全員追従済みなら完了', () => {
    const view = createView({
      round: {
        bbSize: 2,
        currentBet: 10,
        minRaise: 2,
        lastAggressor: 'SB',
        playersActed: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
      },
      playerCommittedThisStreet: {
        SB: 10,
        BB: 10,
        UTG: 10,
        HJ: 10,
        CO: 10,
        BTN: 10,
      },
    });

    const result = isStreetComplete(view);
    expect(result.isComplete).toBe(true);
  });

  it('isStreetComplete: 全員actedでも未追従がいれば未完了', () => {
    const view = createView({
      round: {
        bbSize: 2,
        currentBet: 10,
        minRaise: 2,
        lastAggressor: 'SB',
        playersActed: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
      },
      playerCommittedThisStreet: {
        SB: 10,
        BB: 10,
        UTG: 8,
        HJ: 10,
        CO: 10,
        BTN: 10,
      },
    });

    const result = isStreetComplete(view);
    expect(result.isComplete).toBe(false);
    expect(result.reason).toBe('BETTING_CONTINUES');
  });

  it('isStreetComplete: 全員追従済みでも未actedがいれば未完了', () => {
    const view = createView({
      round: {
        bbSize: 2,
        currentBet: 10,
        minRaise: 2,
        lastAggressor: 'SB',
        playersActed: ['SB', 'BB', 'UTG', 'HJ', 'CO'],
      },
      playerCommittedThisStreet: {
        SB: 10,
        BB: 10,
        UTG: 10,
        HJ: 10,
        CO: 10,
        BTN: 10,
      },
    });

    const result = isStreetComplete(view);
    expect(result.isComplete).toBe(false);
    expect(result.reason).toBe('BETTING_CONTINUES');
  });

  it('isStreetComplete: active1人なら即完了', () => {
    const view = createView({ turn: { actingPlayerId: 'SB', actionOrder: ['SB'] } });
    const result = isStreetComplete(view);
    expect(result.isComplete).toBe(true);
    expect(result.reason).toBe('ONLY_ONE_ACTIVE_PLAYER');
    expect(result.nextStreet).toBe(Street.Turn);
  });

  it('isStreetComplete: active0人なら完了', () => {
    const view = createView({
      turn: { actingPlayerId: 'SB', actionOrder: ['SB'] },
      foldedPlayerIds: ['SB'],
    });
    const result = isStreetComplete(view);
    expect(result.isComplete).toBe(true);
    expect(result.reason).toBe('NO_ACTIVE_PLAYERS');
  });

  it('isStreetComplete: Turn完了でnext=River', () => {
    const view = createView({
      street: Street.Turn,
      round: { bbSize: 2, currentBet: 8, minRaise: 2, lastAggressor: 'SB', playersActed: ['SB', 'BB'] },
      turn: { actingPlayerId: 'SB', actionOrder: ['SB', 'BB'] },
      playerCommittedThisStreet: { SB: 8, BB: 8, UTG: 0, HJ: 0, CO: 0, BTN: 0 },
    });
    const result = isStreetComplete(view);
    expect(result.isComplete).toBe(true);
    expect(result.nextStreet).toBe(Street.River);
  });

  it('isStreetComplete: River完了でnext=Showdown', () => {
    const view = createView({
      street: Street.River,
      round: { bbSize: 2, currentBet: 8, minRaise: 2, lastAggressor: 'SB', playersActed: ['SB', 'BB'] },
      turn: { actingPlayerId: 'SB', actionOrder: ['SB', 'BB'] },
      playerCommittedThisStreet: { SB: 8, BB: 8, UTG: 0, HJ: 0, CO: 0, BTN: 0 },
    });
    const result = isStreetComplete(view);
    expect(result.isComplete).toBe(true);
    expect(result.nextStreet).toBe(Street.Showdown);
  });

  it('isStreetComplete: Showdownではnext=null', () => {
    const view = createView({
      street: Street.Showdown,
      round: { bbSize: 2, currentBet: 0, minRaise: 2, lastAggressor: null, playersActed: ['SB', 'BB'] },
      turn: { actingPlayerId: 'SB', actionOrder: ['SB', 'BB'] },
      playerCommittedThisStreet: { SB: 0, BB: 0, UTG: 0, HJ: 0, CO: 0, BTN: 0 },
    });
    const result = isStreetComplete(view);
    expect(result.isComplete).toBe(true);
    expect(result.nextStreet).toBeNull();
  });
});
