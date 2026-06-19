# Game Engine Test Spec (Stateless Coordinator)

## 1. 目的
GameEngine を Stateless Coordinator として検証する。

検証対象:
- Engine 呼び出し順序
- 既存 State 参照のみで処理できること
- Fast Fold 仲介
- localStorage 保存タイミング通知

検証対象外:
- GameEngine 独自状態
- PlayerState 相当の再定義
- TableStatus 相当の再定義

分類:
- Coordinator Contract
- Startup
- Action Flow
- Fast Fold Integration
- Showdown
- Pot Distribution
- Hand Completion
- Persistence Hook
- Error Cases

総計: 44 ケース

## 2. Test Cases

### 2.1 Coordinator Contract (CC-01 ~ CC-06)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| CC-01 | coordinator作成 | inspect | 内部 mutable state を保持しない |
| CC-02 | coordinator作成 | inspect | phase 定義を持たない |
| CC-03 | coordinator作成 | inspect | player state 再定義を持たない |
| CC-04 | 既存TableState入力 | 任意メソッド | 返却は既存TableState参照更新のみ |
| CC-05 | 既存PlayerState入力 | 任意メソッド | 返却は既存PlayerState参照更新のみ |
| CC-06 | 任意処理 | inspect | Queue/Betting/Showdown/Pot に計算委譲 |

### 2.2 Startup (G-01 ~ G-05)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| G-01 | waiting >= 6 | startHand | QueueEngine.assignNextTable を呼ぶ |
| G-02 | waiting = human1 | startHand | bot 補完で6席確定 |
| G-03 | queue invalid | startHand | QUEUE_STATE_INVALID |
| G-04 | waiting=0 | startHand | NO_PLAYERS_AVAILABLE |
| G-05 | startHand成功 | hook | AFTER_START_HAND 通知 |

### 2.3 Action Flow (A-01 ~ A-08)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| A-01 | 正常入力 | applyAction | Betting.validateAction を先に呼ぶ |
| A-02 | validate成功 | applyAction | Betting.applyAction を次に呼ぶ |
| A-03 | validate失敗 | applyAction | Betting.applyAction を呼ばない |
| A-04 | validate失敗 | applyAction | BETTING_VALIDATION_FAILED |
| A-05 | check成功 | applyAction | state更新順序が一貫 |
| A-06 | call成功 | applyAction | state更新順序が一貫 |
| A-07 | raise成功 | applyAction | state更新順序が一貫 |
| A-08 | action成功 | hook | AFTER_APPLY_ACTION 通知 |

### 2.4 Fast Fold Integration (F-01 ~ F-07)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| F-01 | fold action | applyAction(Fold) | queue event を受理 |
| F-02 | fold queue event あり | applyAction | Queue.enqueueFromBettingEvent を呼ぶ |
| F-03 | dedupe重複 | applyAction(Fold) | Queue 側失敗を返す |
| F-04 | queue enqueue失敗 | applyAction(Fold) | QUEUE_ENQUEUE_FAILED |
| F-05 | fold後 | table status | betting status を維持 |
| F-06 | fold後 | actionOrder/acting | Betting結果を採用 |
| F-07 | fold成功 | hook | AFTER_APPLY_ACTION 通知 |

### 2.5 Showdown (H-01 ~ H-05)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| H-01 | River完了 | resolveShowdown | HandEvaluator(boardA) を呼ぶ |
| H-02 | River完了 | resolveShowdown | HandEvaluator(boardB) を呼ぶ |
| H-03 | Fold playerあり | resolveShowdown | BettingEngine由来の除外済み状態を評価入力として使用 |
| H-04 | board不正 | resolveShowdown | INVALID_BOARD_STATE |
| H-05 | resolve成功 | hook | AFTER_RESOLVE_SHOWDOWN 通知 |

### 2.6 Pot Distribution (P-01 ~ P-05)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| P-01 | showdown結果あり | distributePot | PotDistribution.distribute を呼ぶ |
| P-02 | distribute成功 | distributePot | totalPayout=totalPot を検証 |
| P-03 | distribute失敗 | distributePot | POT_DISTRIBUTION_FAILED |
| P-04 | Side PotなしMVP | distributePot | 型境界で side pot 非許可を保証（Coordinator runtime拒否は不要） |
| P-05 | distribute成功 | hook | AFTER_DISTRIBUTE_POT 通知 |

### 2.7 Hand Completion (C-01 ~ C-04)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| C-01 | active tableあり | completeHand | Queue.completeHand を呼ぶ |
| C-02 | table未active | completeHand | TABLE_NOT_ACTIVE |
| C-03 | handId不一致 | completeHand | HAND_ID_MISMATCH |
| C-04 | complete成功 | hook | AFTER_COMPLETE_HAND 通知 |

### 2.8 Persistence Hook (L-01 ~ L-02)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| L-01 | 5メソッド成功 | hook collector | 5つの保存ポイントが通知される |
| L-02 | メソッド失敗 | hook collector | 失敗時は保存通知しない |

### 2.9 Error Cases (E-01 ~ E-02)
| ID | 前提 | 入力 | 期待 |
|---|---|---|---|
| E-01 | tableId不一致 | applyAction | TABLE_ID_MISMATCH |
| E-02 | handId不一致 | applyAction | HAND_ID_MISMATCH |

## 3. Coverage Matrix
| 分類 | 件数 |
|---|---:|
| Coordinator Contract | 6 |
| Startup | 5 |
| Action Flow | 8 |
| Fast Fold Integration | 7 |
| Showdown | 5 |
| Pot Distribution | 5 |
| Hand Completion | 4 |
| Persistence Hook | 2 |
| Error Cases | 2 |
| 合計 | 44 |

## 4. 実装時カバレッジ目標
- Statement Coverage: 95%以上
- Branch Coverage: 90%以上

## 5. 優先実装順 (TDD)
1. Coordinator Contract
2. Startup
3. Action Flow
4. Fast Fold Integration
5. Showdown
6. Pot Distribution
7. Hand Completion
8. Persistence Hook
9. Error Cases

## 6. 追加確認項目
- GameEngine が独自状態を保持しないこと
- Fast Fold 時に TableStatus を遷移させないこと
- Queue dedupeKey 重複拒否が coordinator 経由でも維持されること
- fold player 除外は BettingEngine 由来の state を入力前提とし、Coordinator が再計算しないこと
- Side Pot なしは型境界で表現し、Coordinator に side pot 判定分岐を持たせないこと
- 保存タイミング通知が 5 境界で一貫すること
