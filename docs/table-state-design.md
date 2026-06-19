# Table State Design

## 1. 目的とスコープ
このドキュメントは、Double Board Bomb Pot Fast Fold Omaha のMVP向けに、テーブル全体の単一状態管理オブジェクトである TableState を定義する。

対象範囲:
- 6-max固定
- Human 1人 + Bot 5人
- Double Board
- Bomb Pot
- Fast Fold
- Side Potなし
- All-inなし
- Play Moneyのみ
- localStorage保存

対象外:
- クラス実装
- reducer実装
- Zustand実装
- マルチプレイヤー同期

## 2. 既存設計との整合
整合対象:
- docs/double-board-rules.md
- docs/fastfold-queue-design.md
- docs/pot-distribution-design.md
- docs/architecture.md

整合方針:
- Board A / Board B は独立5枚として保持する
- Potは totalPot を potA / potB へ分割して管理する
- Fast Fold時はフォールドプレイヤーを即時遷移させる
- 同一ハンド再参加禁止は PlayerState 側の participatedHandIds と queuedPlayers 管理で担保する
- Side Pot / All-in はMVPでは扱わない

## 3. 主要型
型定義は src/engine/table-state/types.ts に集約する。

主要要素:
- TableStatus: ハンド進行を表すテーブル状態列挙
- Street: FLOP / TURN / RIVER / SHOWDOWN
- TableState: テーブル全体の単一状態
- StreetBetState: 各ストリートのベット計算スナップショット
- TableAuditTrail: 監査用の遷移メタデータ

## 4. TableStatus
- WaitingForPlayers
- StartingHand
- FlopBetting
- TurnBetting
- RiverBetting
- Showdown
- PotDistribution
- HandCompleted

注記:
- WaitingForPlayers は将来の可変参加人数対応のために保持する。
- MVP (Human 1 + Bot 5 固定) では、実質的に WaitingForPlayers は使用頻度が低い初期化用状態として扱う。

## 5. 状態遷移

### 5.1 メイン遷移
| 現在状態 | イベント | 次状態 | 補足 |
|---|---|---|---|
| WaitingForPlayers | PlayersReady | StartingHand | 6席確定（Human1 + Bot5） |
| StartingHand | BombPotPosted | FlopBetting | Bomb Pot投入完了、Flop開始 |
| FlopBetting | FlopRoundClosed | TurnBetting | Board A/B は継続 |
| TurnBetting | TurnRoundClosed | RiverBetting |  |
| RiverBetting | RiverRoundClosed | Showdown | アクティブプレイヤーで比較 |
| Showdown | ShowdownResolved | PotDistribution | HandEvaluator 接続 |
| PotDistribution | PotDistributed | HandCompleted | PotDistribution 接続 |
| HandCompleted | HandArchived | StartingHand | 次ハンド準備 |

### 5.2 Fast Foldの責務分離
- Fast Fold は TableStatus の遷移として扱わない。
- プレイヤーが Fold した場合、TableStatus は FlopBetting / TurnBetting / RiverBetting のまま維持する。
- Foldプレイヤーの遷移は PlayerStatus.FastFoldTransition -> Queued として扱う。
- queuedPlayers への追加、再割り当て、同一hand再参加禁止は FastFoldQueueEngine の責務とする。

## 6. Invariants
1. tableId は空文字であってはならない。
2. status が WaitingForPlayers の場合、handId は null。
3. status が StartingHand 以降 HandCompleted までの間、handId は null であってはならない。
4. players.length は常に 6。
5. playerStates のキー数は 6。
6. actionOrder の各 playerId は playerStates に存在する。
7. actingPlayerId が null でない場合、actingPlayerId は actionOrder に含まれる。
8. Folded 状態のプレイヤーは actionOrder に含めない。
9. queuedPlayers と completedPlayers は重複しない。
10. queuedPlayers と actionOrder は重複しない。
11. boardA.length は 0 または 5。
12. boardB.length は 0 または 5。
13. status が Showdown のとき boardA.length = 5。
14. status が Showdown のとき boardB.length = 5。
15. totalPot >= 0。
16. potA >= 0 かつ potB >= 0。
17. totalPot = potA + potB。
18. potA = floor(totalPot / 2)。
19. potB = totalPot - potA。
20. currentStreet が null でない場合、status は StartingHand, FlopBetting, TurnBetting, RiverBetting, Showdown, PotDistribution, HandCompleted のいずれか。
21. status が FlopBetting のとき currentStreet = FLOP。
22. status が TurnBetting のとき currentStreet = TURN。
23. status が RiverBetting のとき currentStreet = RIVER。
24. status が Showdown または PotDistribution のとき currentStreet = SHOWDOWN。
25. handStartAt が非nullなら handEndAt は handStartAt 以上。
26. handEndAt が非nullなら status は HandCompleted または WaitingForPlayers。
27. audit.lastTransitionEvent が null のとき audit.lastTransitionAt は null。
28. persistence.storageKey は空文字であってはならない。
29. persistence.version は 1 以上の整数。
30. プレイヤーが Fold した場合、次状態確定時にそのプレイヤーは actionOrder から除外されている。
31. Bomb Pot Omaha では Preflop は存在しない。FlopBetting開始時の actionOrder は SB -> BB -> UTG -> HJ -> CO -> BTN である。
32. actingPlayerId は Folded プレイヤーを指してはならない。
33. actingPlayerId が非nullの場合、actingPlayerId は actionOrder と InHand プレイヤー集合の両方に存在しなければならない。
34. プレイヤーが Fold した場合、次状態確定時の actingPlayerId は次のアクティブプレイヤーへ移動していなければならず、Fold 済みプレイヤーを再度指してはならない。

## 7. 接続設計

### 7.1 PlayerState 接続
- TableState.playerStates は playerId をキーに保持する。
- status同期:
  - TableState.actionOrder から除外されたプレイヤーは PlayerState.hasFolded = true を満たす。
  - queuedPlayers に入ったプレイヤーは PlayerState.status = FastFoldTransition または Queued。
  - TableStatus は Fast Fold のために遷移しない。

### 7.2 HandEvaluator 接続
- Showdownで active players の holeCards + boardA/boardB を入力する。
- 結果は boardAWinners / boardBWinners として PotDistribution へ渡す。
- Fold済みプレイヤーは勝者候補から除外する。

### 7.3 PotDistribution 接続
- 入力: totalPot, boardAWinners, boardBWinners。
- 出力: payouts。
- PotDistribution 実行後に TableState.status を PotDistribution -> HandCompleted へ遷移させる。

## 8. localStorage 永続化方針
- 保存単位: TableState全体をJSON化して単一キーで保存。
- 保存タイミング: status遷移後、プレイヤーアクション確定後、PotDistribution完了後。
- 推奨キー: fastfold:table:<tableId>:state。
- 復元時チェック:
  - version互換性
  - Invariants の主要項目
  - 破損時は WaitingForPlayers へフェイルセーフ初期化
