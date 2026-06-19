# Game Engine Design (Stateless Coordinator)

## 1. 目的
GameEngine は Stateful Engine ではなく Stateless Coordinator として、既存 Engine の呼び出し順序だけを管理する。

前提:
- 6-max 固定
- Human 1 + Bot 5
- Fast Fold
- Double Board Bomb Pot
- Side Pot なし
- All-in なし
- Play Money のみ
- localStorage 対応予定

## 2. 設計原則
1. GameEngine は独自状態を保持しない。
2. TableStatus / PlayerState 相当を再定義しない。
3. 既存 State を入力として受け、更新済み既存 State を返す。
4. ドメイン計算は既存 Engine に委譲し、GameEngine は順序制御のみ行う。

## 3. スコープ
対象:
- QueueEngine / BettingEngine / HandEvaluator / PotDistribution の統合呼び出し
- startHand / applyAction / resolveShowdown / distributePot / completeHand の順序保証
- Fast Fold 仲介
- localStorage 保存タイミング通知

対象外:
- 状態の独自保持
- TableState 本体ロジック実装
- PlayerState 本体ロジック実装
- UI / Bot 戦略 / ネットワーク / DB

## 4. GameEngine の責務
1. startHand()
- QueueEngine.assignNextTable を呼ぶ。
- 返却された席情報で既存 TableState / PlayerState を更新する処理を順序化する。

2. applyAction()
- BettingEngine.validateAction -> BettingEngine.applyAction を順に呼ぶ。
- Fold queue event が返った場合のみ QueueEngine.enqueueFromBettingEvent を仲介する。

3. resolveShowdown()
- HandEvaluator を boardA / boardB に適用して勝者集合を確定する。
- fold player 除外は BettingEngine が更新した TableState を前提とする。

4. distributePot()
- PotDistribution に委譲し、分配結果を既存 PlayerState に反映する処理を順序化する。

5. completeHand()
- QueueEngine.completeHand を呼び、手札完了後の待機復帰を確定する。

6. localStorage 境界通知
- 各メソッド完了時に保存ポイントを通知する。

## 5. 非責務
1. GameEngine 独自の phase 管理
2. GameEngine 独自の player state 管理
3. ベット計算 / hand 評価 / pot 分配計算
4. Queue の dedupe 本体ロジック

## 6. 依存関係
依存方向:
- GameEngine -> QueueEngine
- GameEngine -> BettingEngine
- GameEngine -> HandEvaluator
- GameEngine -> PotDistribution

状態参照:
- TableState は参照・更新対象として受け渡しする
- PlayerState は参照・更新対象として受け渡しする

ルール:
1. QueueEngine は queue 状態の唯一ソース
2. BettingEngine は betting 状態判定の唯一ソース
3. HandEvaluator は showdown 評価の唯一ソース
4. PotDistribution は分配計算の唯一ソース

## 7. 状態遷移の扱い
GameEngine は遷移状態を保持しない。以下を「適用順序」として扱う。

1. startHand: WaitingForPlayers -> StartingHand -> FlopBetting
2. applyAction: Flop/Turn/River 中の betting 継続または次 street 遷移
3. resolveShowdown: Showdown 解決
4. distributePot: PotDistribution -> HandCompleted
5. completeHand: HandCompleted -> StartingHand 準備

注記:
- Fast Fold 時は TableStatus を変更しない。

## 8. メソッド契約

### 8.1 startHand()
入力:
- tableState
- playerStates
- queueState
- now
- requestedHandId (任意)

処理:
1. QueueEngine.validateQueueState
2. QueueEngine.assignNextTable
3. 既存 TableState / PlayerState 更新処理を呼び出し
4. 保存ポイント通知: AFTER_START_HAND

失敗:
- NO_PLAYERS_AVAILABLE
- INSUFFICIENT_PLAYERS
- QUEUE_STATE_INVALID

### 8.2 applyAction()
入力:
- tableState
- playerStates
- queueState
- action input

処理:
1. BettingEngine.validateAction
2. BettingEngine.applyAction
3. fold queue event があれば QueueEngine.enqueueFromBettingEvent
4. street 完了判定
5. 保存ポイント通知: AFTER_APPLY_ACTION

失敗:
- BETTING_VALIDATION_FAILED
- QUEUE_ENQUEUE_FAILED
- TABLE_ID_MISMATCH
- HAND_ID_MISMATCH

### 8.3 resolveShowdown()
入力:
- tableState
- playerStates
- handId

処理:
1. HandEvaluator(boardA)
2. HandEvaluator(boardB)
3. fold player は BettingEngine が actionOrder / folded へ反映済みの状態を前提に評価
4. 保存ポイント通知: AFTER_RESOLVE_SHOWDOWN

失敗:
- INVALID_BOARD_STATE
- NO_ACTIVE_PLAYERS

### 8.4 distributePot()
入力:
- tableState
- playerStates
- showdown result

処理:
1. PotDistribution 実行
2. 既存 PlayerState.balance 更新
3. 保存ポイント通知: AFTER_DISTRIBUTE_POT

失敗:
- POT_DISTRIBUTION_FAILED

### 8.5 completeHand()
入力:
- tableState
- playerStates
- queueState
- handId

処理:
1. QueueEngine.completeHand
2. handRegistry 反映確認
3. 保存ポイント通知: AFTER_COMPLETE_HAND

失敗:
- TABLE_NOT_ACTIVE
- HAND_ID_MISMATCH

## 9. Fast Fold フロー
1. applyAction(FOLD)
2. BettingEngine.applyAction から queue event を受領
3. QueueEngine.enqueueFromBettingEvent を実行
4. queue dedupeKey を QueueEngine が検証
5. GameEngine は betting 継続状態を維持

## 10. QueueEngine 接続
使用 API:
- validateQueueState
- assignNextTable
- enqueueFromBettingEvent
- completeHand
- excludePlayer

保証:
1. dedupeKey は handId:playerId 形式
2. 同一 hand 再参加禁止は QueueEngine 判定を使用
3. active table seats=6 を QueueEngine 判定に従う

## 11. BettingEngine 接続
使用 API:
- validateAction
- applyAction
- isStreetComplete

保証:
1. betting 可否判定は BettingEngine の結果をそのまま採用
2. street 完了判定は BettingEngine の結果をそのまま採用
3. fold player の勝者候補除外は BettingEngine が更新した状態を唯一ソースとして扱う

## 12. PotDistribution 接続
使用 API:
- distribute(totalPot, winnersA, winnersB)

保証:
1. totalPayout = totalPot
2. Side Pot なしは型境界で保証し、Coordinator は runtime で side pot 判定を持たない

## 13. localStorage 境界
保存タイミング通知:
1. AFTER_START_HAND
2. AFTER_APPLY_ACTION
3. AFTER_RESOLVE_SHOWDOWN
4. AFTER_DISTRIBUTE_POT
5. AFTER_COMPLETE_HAND

注意:
- GameEngine は保存処理本体を持たず、hook/callback に通知するのみ。

## 14. Open Questions
1. Queue assign と TableState 更新の原子性をどの層で担保するか
2. localStorage 復元時、途中 street 再開か hand 破棄再開か
3. Bot AI の行動要求を同期実行にするか、ジョブキュー化するか
