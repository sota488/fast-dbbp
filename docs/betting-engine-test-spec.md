# Betting Engine Test Spec

## 1. 目的
BettingEngine の設計検証として、合法手判定、手番制御、ストリート完了、Fast Fold 連携、異常系を網羅する。

分類:
- Validation
- Raise
- Call
- Check
- Fold
- Turn Progression
- Street Completion
- Fast Fold
- Error Cases

総計: 54ケース

## 2. Test Cases

### 2.1 Validation (V-01 ~ V-07)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| V-01 | actingPlayerId=P1 | P1 Check | VALID |
| V-02 | actingPlayerId=P1 | P2 Call | NOT_ACTING_PLAYER |
| V-03 | P1 Fold済み | P1 Raise | PLAYER_ALREADY_FOLDED |
| V-04 | street=SHOWDOWN | P1 Call | INVALID_STREET |
| V-05 | amount<0 | P1 Raise(-1) | INVALID_AMOUNT |
| V-06 | ストリート開始直後 | 初期値確認 | currentBet=0 |
| V-07 | ストリート開始直後 | 初期値確認 | minRaise=BBサイズ |

### 2.2 Raise (R-01 ~ R-06)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| R-01 | minRaiseTo=40,maxRaiseTo=120 | RaiseTo=40 | VALID |
| R-02 | minRaiseTo=40,maxRaiseTo=120 | RaiseTo=39 | RAISE_BELOW_MINIMUM |
| R-03 | minRaiseTo=40,maxRaiseTo=120 | RaiseTo=121 | RAISE_ABOVE_MAXIMUM |
| R-04 | P1 balance=50, raiseTo=80 | Raise | INSUFFICIENT_BALANCE |
| R-05 | Raise成功 | RaiseTo=60 | currentBet更新, lastAggressor=P1 |
| R-06 | Raise再オープン発生 | P2 Raise | playersActedAfterReopen は原則 [P2] |

### 2.3 Call (C-01 ~ C-05)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| C-01 | toCall=20, balance=100 | Call | VALID, amount=20 |
| C-02 | toCall=0 | Call | CALL_NOT_ALLOWED |
| C-03 | toCall=30, balance=10 | Call | INSUFFICIENT_BALANCE |
| C-04 | Call成功 | Call | committedThisStreet加算 |
| C-05 | Call成功 | Call | playersActed に追加 |

### 2.4 Check (K-01 ~ K-05)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| K-01 | toCall=0 | Check | VALID |
| K-02 | toCall=10 | Check | CHECK_NOT_ALLOWED |
| K-03 | Check成功 | Check | committedThisStreet変化なし |
| K-04 | Check成功 | Check | playersActed に追加 |
| K-05 | Check成功 | Check | actionログ生成 |

### 2.5 Fold (F-01 ~ F-05)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| F-01 | actionOrder=[P1,P2,P3], acting=P1 | P1 Fold | P1 が actionOrder から除外 |
| F-02 | actionOrder=[P1,P2,P3], acting=P1 | P1 Fold | actingPlayerId=P2 |
| F-03 | P1 Fold後 | 再度P1行動 | PLAYER_NOT_IN_ACTION_ORDER |
| F-04 | Fold成功 | Fold | playersActed 更新 |
| F-05 | Fold成功 | Fold | Fold player は勝者候補外 |

### 2.6 Turn Progression (T-01 ~ T-06)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| T-01 | acting=P1, order=[P1,P2,P3] | P1 Check | 次手番=P2 |
| T-02 | acting=P2, order=[P1,P2,P3] | P2 Call | 次手番=P3 |
| T-03 | acting=P3, order=[P1,P2,P3] | P3 Call | ラップしてP1 |
| T-04 | order=[P1] | P1 Fold | 次手番=null |
| T-05 | Raiseで再オープン | P2 Raise | playersActed リセット規則適用 |
| T-06 | Flop/Turn/River開始 | street開始処理 | 先頭アクター=SB |

### 2.7 Street Completion (S-01 ~ S-07)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| S-01 | Flop, 全員acted+追従済み | complete判定 | isComplete=true,next=TURN |
| S-02 | Turn, 1人未acted | complete判定 | isComplete=false |
| S-03 | River, 全員acted+追従済み | complete判定 | isComplete=true,next=SHOWDOWN |
| S-04 | 任意street, active1人 | complete判定 | isComplete=true,reason=ONLY_ONE_ACTIVE_PLAYER |
| S-05 | street完了 | 遷移処理 | playersActed クリア |
| S-06 | 全員actedだが1人未追従 | complete判定 | isComplete=false |
| S-07 | 全員追従済みだが1人未acted | complete判定 | isComplete=false |

### 2.8 Fast Fold (FF-01 ~ FF-07)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| FF-01 | FlopBetting中 | P1 Fold | TableStatusはFlopBetting維持 |
| FF-02 | P1 Fold | queue event生成 | type=QUEUE_ENQUEUE_REQUEST |
| FF-03 | P1 Fold | queue event生成 | payload.playerId=P1 |
| FF-04 | P1 Fold | queue event生成 | payload.handId/tableId一致 |
| FF-05 | P1 Fold後 | 次状態 | actingPlayerId が次アクティブへ移動 |
| FF-06 | P1 Fold確定前 | queue event生成要求 | 発火しない |
| FF-07 | 同一handId/playerIdで再送要求 | queue event生成 | 重複発火しない |

### 2.9 Error Cases (E-01 ~ E-05)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| E-01 | handId 不一致 | action入力 | エラー |
| E-02 | tableId 不一致 | action入力 | エラー |
| E-03 | actionOrder 空, acting有 | action処理 | エラー |
| E-04 | minRaise <= 0 | validation | エラー |
| E-05 | currentBet < committedThisStreet[player] | validation | エラー |

## 3. Coverage Matrix
| 分類 | 件数 |
|---|---:|
| Validation | 7 |
| Raise | 6 |
| Call | 5 |
| Check | 5 |
| Fold | 5 |
| Turn Progression | 6 |
| Street Completion | 7 |
| Fast Fold | 7 |
| Error Cases | 5 |
| 合計 | 54 |

## 4. 追加確認項目
- Fold時に Queue実装本体を呼ばず、イベント生成のみであること。
- PotDistribution 呼び出し前に River完了条件が成立していること。
- Preflop相当のstreetを受理しないこと（Bomb Pot前提）。
- TableState と PlayerState の参照整合（存在しないplayerIdを受理しない）。
