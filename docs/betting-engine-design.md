# Betting Engine Design

## 1. 目的
BettingEngine は Double Board Bomb Pot Fast Fold Omaha のベッティング制御を担当する。

前提:
- 6-max固定
- Human 1 + Bot 5
- Side Potなし
- All-inなし
- Play Moneyのみ
- Preflopなし（Bomb Pot開始）

## 1.1 Bomb Pot MVP既定値
- currentBet = 0
- minRaise = BBサイズ

理由:
- Bomb PotはFlop開始のため、初回アクションで Check を許可する。

## 2. 責務
BettingEngine の責務は以下に限定する。

- Action Validation
  - Check / Call / Raise / Fold / PostBombPot の合法手判定
  - Call額、Raise最小額、Raise最大額の算出
- Turn Management
  - actingPlayerId と actionOrder の整合維持
  - Fold後の次アクティブプレイヤーへの手番移動
- Street Completion
  - Flop / Turn / River の終了判定
- Fast Fold Interaction
  - Fold時に actionOrder から除外
  - actingPlayerId 更新
  - Queue移動イベント (QUEUE_ENQUEUE_REQUEST) を発火

責務外:
- Queue実処理（FastFoldQueueEngine責務）
- Showdown 評価（HandEvaluator責務）
- Pot分配（PotDistribution責務）

## 3. 既存設計との整合
- TableState連携:
  - src/engine/table-state/types.ts の actingPlayerId/actionOrder/currentStreet と整合
  - TableStatus は Fast Fold で遷移しない
- PlayerState連携:
  - Fold後プレイヤーは PlayerStatus.FastFoldTransition -> Queued を想定
- PotDistribution連携:
  - BettingEngineは totalPot 構築まで担当し、分配は PotDistribution へ委譲

## 4. コアデータ構造
型定義は src/engine/betting/types.ts に集約する。

主要型:
- BettingActionType
- BettingRoundState
  - currentBet
  - minRaise
  - lastAggressor
  - playersActed
- BettingTurnState
  - actingPlayerId
  - actionOrder
- AllowedActionSet
- BettingValidationResult
- StreetCompletionResult
- FastFoldQueueEvent

## 5. Action Validation ルール

### 5.1 共通前提
- action.playerId は actingPlayerId と一致する必要がある
- Fold済みプレイヤーはアクション不可
- street は FLOP / TURN / RIVER のいずれか（SHOWDOWN不可）
- amount は整数かつ 0 以上

### 5.2 Check
- 条件: toCall = 0
- 失敗時: CHECK_NOT_ALLOWED

### 5.3 Call
- 条件: toCall > 0
- callAmount = min(toCall, balance)
- MVPはAll-inなしのため、balance < toCall は INSUFFICIENT_BALANCE 扱い

### 5.4 Raise
- 条件:
  - canRaise = true
  - raiseTo >= minRaiseTo
  - raiseTo <= maxRaiseTo
- minRaiseTo:
  - ベース: currentBet + minRaise
- maxRaiseTo:
  - Pot Limit 計算結果とプレイヤー残高の小さい方
- 失敗時:
  - RAISE_BELOW_MINIMUM
  - RAISE_ABOVE_MAXIMUM
  - INSUFFICIENT_BALANCE

### 5.4.1 Raise Reopen Rule
Raise発生時は playersActed を再計算する。

再計算ルール:
- raiser はアクション済みとして保持する
- Fold済みプレイヤーは対象外
- actionOrder 上で raiser 以外のアクティブプレイヤーは再アクション対象へ戻す

結果:
- playersActedAfterReopen は原則 [raiserPlayerId]
- playersRequiredToAct は「アクティブかつ raiser 以外」の集合

### 5.5 Fold
- 条件: アクティブプレイヤーであること
- 効果:
  - actionOrder から除外
  - Fold player は current hand の勝者候補から除外
  - Queue移動イベントを発火

### 5.6 PostBombPot
- 条件:
  - StartingHand中のみ
  - 未投稿プレイヤーのみ
  - 投稿額を支払える残高を持つこと
- 効果:
  - committedThisHand 加算
  - totalPot 加算
  - bombPotPostedPlayerIds へ追加

## 6. Turn Management

### 6.1 基本
- actingPlayerId は actionOrder の先頭または次順で決定する
- playersActed は同一ストリートで一意に管理

### 6.1.1 ストリート開始時の先頭アクター
Flop / Turn / River のすべてで、開始順は以下で固定する。

SB -> BB -> UTG -> HJ -> CO -> BTN

各ストリート開始時:
- actingPlayerId は上記順序の先頭（SB）
- actionOrder は上記順序をベースに Fold済みを除いた順序
- currentBet は 0 に初期化
- minRaise は BBサイズに初期化

### 6.2 Fold後
- Foldプレイヤーを actionOrder から削除
- actingPlayerId は次のアクティブプレイヤーへ移動
- 残りアクティブが1人なら street 即終了（Showdown準備）

## 7. Street Completion

### 7.1 Flop終了条件
- actionOrder に残る全プレイヤーが playersActed に含まれる
- かつ全プレイヤーの committedThisStreet が currentBet に追いついている

両方を満たした場合のみ終了可能。

### 7.2 Turn終了条件
- Flopと同じ

両方を満たした場合のみ終了可能。

### 7.3 River終了条件
- Turnと同じ
- 完了時は Showdown へ遷移可能

両方を満たした場合のみ終了可能。

### 7.4 早期終了
- アクティブプレイヤーが1人になった場合は street 完了扱い

## 8. Fast Fold Interaction
- Fold時に Queue への移動要求イベントを生成する。

イベント仕様:
- type: QUEUE_ENQUEUE_REQUEST
- trigger: AFTER_FOLD_CONFIRMED
- dedupeKey: <handId>:<playerId>
- payload: tableId, handId, playerId, at

注意:
- Queueへの追加処理は行わない（Queue責務）
- BettingEngine はイベント生成のみ
- イベントは Fold確定後に発火する
- 1回のみ発火する
- 同一playerId / handId で重複発火を禁止する

## 9. Invariants
1. actingPlayerId が非nullなら actionOrder に含まれる。
2. actingPlayerId は Folded プレイヤーを指さない。
3. actionOrder の playerId は重複しない。
4. playersActed の playerId は重複しない。
5. playersActed は actionOrder の部分集合である。
6. currentBet >= 0。
7. minRaise > 0。
8. Raise後の currentBet は直前より小さくならない。
9. lastAggressor は null または actionOrder 内 playerId。
10. toCall = currentBet - playerCommittedThisStreet[playerId]。
11. toCall は負にならない。
12. Check は toCall = 0 のときのみ有効。
13. Call は toCall > 0 のときのみ有効。
14. Raise は minRaiseTo <= raiseTo <= maxRaiseTo を満たす。
15. Raise後は lastAggressor = playerId。
16. Fold後は対象 playerId が actionOrder から除外される。
17. Fold後の actingPlayerId は次のアクティブプレイヤー。
18. Fold時に Queueイベントを1件発火する。
19. Queueイベントの playerId は Foldした playerId と一致する。
20. Street完了時は playersActed がクリアされる。
21. Street完了時は playerCommittedThisStreet が全員 0 にリセットされる。
22. Bomb Pot投稿総額は totalPot 初期値に一致する。
23. PostBombPot は1プレイヤー1回のみ。
24. SHOWDOWN street で Check/Call/Raise/Fold は受理しない。
25. balance は負にならない。
26. playerCommittedThisStreet <= playerCommittedThisHand。
27. totalPot は全プレイヤー committedThisHand 合計に一致する。
28. River完了後のみ Showdown遷移可能。
29. TableStatus は Foldのみでは変化しない（Betting status維持）。
30. Fold済みプレイヤーは同一street中に再度actingPlayerIdにならない。
31. 各ストリート開始時、currentBet = 0。
32. 各ストリート開始時、minRaise = BBサイズ。
33. Flop / Turn / River の開始順は SB -> BB -> UTG -> HJ -> CO -> BTN。
34. Queueイベントは Fold確定後にのみ発火する。
35. Queueイベントは同一 handId / playerId で1回のみ発火する。
36. Queueイベント dedupeKey は <handId>:<playerId> 形式で一意である。
37. Street終了は「全員アクション済み」かつ「全員currentBet追従済み」のAND条件のみで成立する。
38. Raise発生時、playersActed は再計算され、raiser以外のアクティブプレイヤーは再アクション対象になる。

## 10. インターフェース境界

### 入力
- TableState 由来:
  - currentStreet
  - actingPlayerId
  - actionOrder
  - totalPot
- PlayerState 由来:
  - balance
  - committedThisStreet
  - committedThisHand
  - status (Fold判定)

### 出力
- 更新済み BettingRoundState
- 更新済み actingPlayerId/actionOrder
- Queue移動イベント（Fold時）
- StreetCompletionResult

## 11. 監査・永続化
- アクションごとに BettingActionRecord を生成
- ログには before/after の currentBet と actingPlayerId を保持
- localStorage 復元時に round/turn/actionOrder の整合を再検証
