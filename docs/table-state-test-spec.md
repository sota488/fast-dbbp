# Table State Test Spec

## 1. 方針
本仕様は TableState の設計検証用テスト観点を定義する。実装方式は問わず、状態遷移・不変条件・外部接続整合を確認する。

分類:
- 正常系
- 状態遷移
- Fast Fold
- Double Board
- Bomb Pot
- 異常系

合計: 53ケース

## 2. テストケース

### 2.1 正常系 (N-01 ~ N-06)
| ID | 前提 | 操作 | 期待結果 |
|---|---|---|---|
| N-01 | WaitingForPlayers, players=6 | PlayersReady | status=StartingHand, handId生成 |
| N-02 | StartingHand, Bomb Pot未投入 | BombPotPosted | status=FlopBetting, currentStreet=FLOP |
| N-03 | FlopBetting, 全員アクション完了 | FlopRoundClosed | status=TurnBetting, currentStreet=TURN |
| N-04 | TurnBetting, 全員アクション完了 | TurnRoundClosed | status=RiverBetting, currentStreet=RIVER |
| N-05 | RiverBetting, 全員アクション完了 | RiverRoundClosed | status=Showdown, currentStreet=SHOWDOWN |
| N-06 | PotDistribution実行済み | HandArchived | status=StartingHand |

### 2.2 状態遷移 (T-01 ~ T-06)
| ID | 前提 | 操作 | 期待結果 |
|---|---|---|---|
| T-01 | WaitingForPlayers | PlayersReady | StartingHand 以外へ遷移しない |
| T-02 | StartingHand | BombPotPosted | FlopBetting 以外へ遷移しない |
| T-03 | FlopBetting | FlopRoundClosed | TurnBetting へ遷移 |
| T-04 | TurnBetting | TurnRoundClosed | RiverBetting へ遷移 |
| T-05 | RiverBetting | RiverRoundClosed | Showdown へ遷移 |
| T-06 | Showdown -> PotDistribution | ShowdownResolved -> PotDistributed | HandCompleted まで遷移 |

### 2.3 Fast Fold (F-01 ~ F-05)
| ID | 前提 | 操作 | 期待結果 |
|---|---|---|---|
| F-01 | FlopBetting, P1がInHand | P1がFold | TableStatusはFlopBettingのまま変化しない |
| F-02 | TurnBetting, P2がInHand | P2がFold | P2のPlayerStatusがFastFoldTransitionになる |
| F-03 | RiverBetting, P3がInHand | P3がFold | P3がqueuedPlayersへ追加される |
| F-04 | FlopBetting, actingPlayerId=P4 | P4がFold | actingPlayerId が次アクティブプレイヤーへ移る |
| F-05 | TurnBetting, P5がFold | 次状態確定 | Fold済みP5がactionOrderから除外される |

### 2.4 Double Board (D-01 ~ D-06)
| ID | 前提 | 操作 | 期待結果 |
|---|---|---|---|
| D-01 | StartingHand直後 | ボード配布 | boardA.length=5, boardB.length=5 |
| D-02 | Showdown | HandEvaluator入力生成 | 各プレイヤーで boardA/boardB を独立評価 |
| D-03 | Showdown | 勝者決定 | boardAWinners と boardBWinners が別管理 |
| D-04 | Showdown | 片方のみ複数勝者 | 片側のみ split が反映される |
| D-05 | Showdown | 両ボード同一勝者 | 該当プレイヤーが両ボード配分を合算 |
| D-06 | Showdown | Fold済みプレイヤーが強ハンド | 勝者候補に含まれない |

### 2.5 Bomb Pot (B-01 ~ B-06)
| ID | 前提 | 操作 | 期待結果 |
|---|---|---|---|
| B-01 | StartingHand, 6人 | 強制投入 | 全員 bombPotPosted=true |
| B-02 | StartingHand | 強制投入後 | totalPot が 6人分の投入合計 |
| B-03 | FlopBetting開始 | pot分割計算 | potA=floor(totalPot/2), potB=残差 |
| B-04 | River終了 | PotDistribution入力 | totalPot と potA+potB が一致 |
| B-05 | 一部プレイヤーが途中Fold | Showdown | コミット済みチップはtotalPotに残る |
| B-06 | PotDistribution完了 | 監査確認 | payout合計=totalPot |

### 2.6 異常系 (E-01 ~ E-06)
| ID | 前提 | 操作 | 期待結果 |
|---|---|---|---|
| E-01 | players.length != 6 | PlayersReady | 開始拒否 |
| E-02 | boardA.length != 5 で Showdown 遷移 | RiverRoundClosed | 遷移拒否 |
| E-03 | actingPlayerId が Foldedプレイヤー | ベット処理 | エラー |
| E-04 | totalPot < 0 | 状態確定 | エラー |
| E-05 | queuedPlayers と actionOrder が重複 | 状態確定 | エラー |
| E-06 | handEndAt < handStartAt | HandCompleted確定 | エラー |

## 3. Invariants 検証ケース (I-01 ~ I-06)
| ID | 検証対象 | 期待結果 |
|---|---|---|
| I-01 | totalPot = potA + potB | 常に真 |
| I-02 | Showdown時 boardA/boardB 5枚 | 常に真 |
| I-03 | Folded は actionOrder に存在しない | 常に真 |
| I-04 | actingPlayerId は actionOrder 内 | 常に真 |
| I-05 | queuedPlayers と completedPlayers の排他 | 常に真 |
| I-06 | handId null は WaitingForPlayers のみ | 常に真 |

## 4. localStorage 検証ケース (L-01 ~ L-06)
| ID | 前提 | 操作 | 期待結果 |
|---|---|---|---|
| L-01 | 有効なTableState | 保存 | storageKeyに保存される |
| L-02 | 保存済み | 復元 | 状態が完全復元される |
| L-03 | 破損JSON | 復元 | WaitingForPlayersへフェイルセーフ |
| L-04 | version不一致 | 復元 | マイグレーションまたは初期化 |
| L-05 | PotDistribution直後 | 保存 | handEndAtが保存される |
| L-06 | Fold直後（TableStatusはBetting継続） | 保存/復元 | queuedPlayers が欠落しない |

## 5. 外部接続検証ケース (X-01 ~ X-06)
| ID | 対象 | 操作 | 期待結果 |
|---|---|---|---|
| X-01 | PlayerState | sync | playerStatesキーと players のID一致 |
| X-02 | PlayerState | fold同期 | Fold後 hasFolded=true |
| X-03 | HandEvaluator | showdown入力 | hole+boardA/boardB の形式が有効 |
| X-04 | HandEvaluator | winner抽出 | boardAWinners/boardBWinners 生成 |
| X-05 | PotDistribution | distributePot実行 | payouts が返る |
| X-06 | PotDistribution | payout反映 | 残高更新後も total 整合 |

## 6. 期待合計
- 正常系: 6
- 状態遷移: 6
- Fast Fold: 5
- Double Board: 6
- Bomb Pot: 6
- 異常系: 6
- Invariants検証: 6
- localStorage検証: 6
- 外部接続検証: 6

総計: 53ケース
