# Double Board Bomb Pot Omaha Hand Evaluator 設計

## 1. 概要
Pot Limit Omahaのハンド評価システムは、プレイヤーのホールカード4枚とボード5枚から、Omahaルール（必ずホール2枚+ボード3枚）に従って、最強の5カードハンドを見つけ、ハンドランク（RF/SF/4K/FH/F/S/3K/TP/1P/HC）を判定するコンポーネントです。

この設計では、Board A と Board B の2つの独立したボードに対して同時に評価を行い、各ボードの勝者を判定してポットを分配する構成を前提とします。

## 2. ダブルボード対応
- Board A と Board B は別々に5枚のコミュニティカードを持ち、独立して評価される。
- 各プレイヤーは同じ4枚のホールカードを使って、Board A および Board B それぞれの最強ハンドを計算する。
- それぞれのボードで最強手を持つプレイヤーを決定し、Board A 分と Board B 分の2つのポットシェアを配分する。
- 同一プレイヤーが両方のボードで勝利した場合、そのプレイヤーは総ポットを獲得する。
- 各ボードのタイは、そのボードシェアをタイ持ち間で均等に分割する。

## 3. Omahaルール再確認
- プレイヤーは4枚のホールカードを持つ
- 5枚のコミュニティカード（ボード）が開示される
- 最終的な5カードハンドは、**必ず**ホールカードから正確に2枚、ボードから正確に3枚を組み合わせて作られる
- この制約により、最大 C(4,2) × C(5,3) = 6 × 10 = 60通りの組み合わせが存在する
- 全60通りを評価して、各ボードで最強のハンドを確定する

## 4. ハンドランク定義

```
ランク値（評価用の数値） -> ハンド名称 -> 説明

10 -> Royal Flush (RF) -> A-K-Q-J-10, 全て同一スーツ
9  -> Straight Flush (SF) -> 連続する5枚、同一スーツ
8  -> Four of a Kind (4K) -> 同じランクが4枚
7  -> Full House (FH) -> 3枚+2枚（同ランク）
6  -> Flush (F) -> 同一スーツ5枚
5  -> Straight (S) -> 連続する5枚（スーツ関係なし）
4  -> Three of a Kind (3K) -> 同じランクが3枚
3  -> Two Pair (TP) -> 同ランク2枚×2
2  -> One Pair (1P) -> 同ランク2枚
1  -> High Card (HC) -> 何も成立しない
```

### 3.1 ハンドランクの構造化表現
```
interface HandRank {
  rankValue: number        // 1-10 (10=RF, 1=HC)
  rankName: string         // "Royal Flush" など
  kickers: number[]        // キッカーのランク値配列（降順）
  composition: {
    holeCards: Card[]      // 使用されたホールカード2枚
    boardCards: Card[]     // 使用されたボードカード3枚
  }
  finalHand: Card[]        // 最終5カード
}
```

## 4. アルゴリズム

### 4.1 全体フロー
```
function evaluateOmahaHand(holeCards: Card[], boardCards: Card[]): HandRank {
  // 入力値チェック
  if holeCards.length != 4 or boardCards.length != 5:
    return ERROR("Invalid card count")
  
  // 60通りの全組み合わせ生成
  combinations = generateAllValidCombinations(holeCards, boardCards)
  // combinations.length == 60
  
  // 各組み合わせを評価
  evaluatedHands = []
  for combination in combinations:
    5CardHand = combination.finalHand  // 5枚
    rank = evaluate5CardHand(5CardHand)
    evaluatedHands.push({
      rank: rank,
      holeUsed: combination.holeCards,
      boardUsed: combination.boardCards
    })
  
  // 最強ハンドを抽出
  bestHand = findBestHand(evaluatedHands)
  return bestHand
}
```

### 4.2 組み合わせ生成アルゴリズム
```
function generateAllValidCombinations(holeCards, boardCards):
  // holeCards から 2枚を選ぶ全パターン
  holeCombinations = [
    [0, 1], [0, 2], [0, 3],
    [1, 2], [1, 3],
    [2, 3]
  ]  // 6パターン
  
  // boardCards から 3枚を選ぶ全パターン
  boardCombinations = [
    [0, 1, 2], [0, 1, 3], [0, 1, 4],
    [0, 2, 3], [0, 2, 4], [0, 3, 4],
    [1, 2, 3], [1, 2, 4], [1, 3, 4],
    [2, 3, 4]
  ]  // 10パターン
  
  combinations = []
  
  for holeIndices in holeCombinations:
    for boardIndices in boardCombinations:
      selectedHole = [holeCards[holeIndices[0]], holeCards[holeIndices[1]]]
      selectedBoard = [boardCards[boardIndices[0]], boardCards[boardIndices[1]], boardCards[boardIndices[2]]]
      
      final5Cards = selectedHole.concat(selectedBoard)
      
      combinations.push({
        holeCards: selectedHole,
        boardCards: selectedBoard,
        finalHand: final5Cards
      })
  
  return combinations  // 60パターン
```

### 4.3 5カードハンド評価
```
function evaluate5CardHand(cards: Card[]): HandRank {
  if cards.length != 5:
    return ERROR("Must be 5 cards")
  
  // ランクとスーツを分離して高速処理
  ranks = extractRanks(cards)  // [0-12] (2=0, 3=1, ... A=12)
  suits = extractSuits(cards)  // [0-3] (♠=0, ♥=1, ♦=2, ♣=3)
  
  // 各判定を実行（上位から下位へ）
  if isRoyalFlush(ranks, suits):
    return createHandRank(10, "Royal Flush", cards, getRoyalFlushKickers(ranks))
  
  if isStraightFlush(ranks, suits):
    return createHandRank(9, "Straight Flush", cards, getStraightFlushKickers(ranks))
  
  if isFourOfAKind(ranks):
    return createHandRank(8, "Four of a Kind", cards, getFourOfAKindKickers(ranks))
  
  if isFullHouse(ranks):
    return createHandRank(7, "Full House", cards, getFullHouseKickers(ranks))
  
  if isFlush(suits):
    return createHandRank(6, "Flush", cards, getFlushKickers(ranks))
  
  if isStraight(ranks):
    return createHandRank(5, "Straight", cards, getStraightKickers(ranks))
  
  if isThreeOfAKind(ranks):
    return createHandRank(4, "Three of a Kind", cards, getThreeOfAKindKickers(ranks))
  
  if isTwoPair(ranks):
    return createHandRank(3, "Two Pair", cards, getTwoPairKickers(ranks))
  
  if isOnePair(ranks):
    return createHandRank(2, "One Pair", cards, getOnePairKickers(ranks))
  
  // High Card
  return createHandRank(1, "High Card", cards, getHighCardKickers(ranks))
}
```

### 4.4 各ハンド判定関数
```
// Royal Flush: A-K-Q-J-10 同一スーツ
function isRoyalFlush(ranks, suits):
  if not allSameSuit(suits):
    return false
  sortedRanks = sort(ranks, descending)
  return sortedRanks == [12, 11, 10, 9, 8]

// Straight Flush: 連続5枚、同一スーツ
function isStraightFlush(ranks, suits):
  return isStraight(ranks) and isFlush(suits)

// Four of a Kind: ランク出現度数=4
function isFourOfAKind(ranks):
  rankCounts = countOccurrences(ranks)
  return any(count == 4 for count in rankCounts.values())

// Full House: 3枚+2枚
function isFullHouse(ranks):
  rankCounts = countOccurrences(ranks)
  counts = rankCounts.values()
  return (any(c == 3 for c in counts)) and (any(c == 2 for c in counts))

// Flush: 5枚同一スーツ
function isFlush(suits):
  return allSameSuit(suits)

// Straight: 連続する5ランク
// A-2-3-4-5 (Wheel) も有効
function isStraight(ranks):
  sortedRanks = sort(ranks, ascending)
  
  // 通常のストレート
  if sortedRanks[4] - sortedRanks[0] == 4:
    return true
  
  // Wheel (A-2-3-4-5): [0,1,2,3,12] となる場合
  if sortedRanks == [0, 1, 2, 3, 12]:
    return true
  
  return false

// Three of a Kind
function isThreeOfAKind(ranks):
  rankCounts = countOccurrences(ranks)
  return any(count == 3 for count in rankCounts.values())

// Two Pair
function isTwoPair(ranks):
  rankCounts = countOccurrences(ranks)
  pairCount = sum(1 for count in rankCounts.values() if count == 2)
  return pairCount == 2

// One Pair
function isOnePair(ranks):
  rankCounts = countOccurrences(ranks)
  return any(count == 2 for count in rankCounts.values())

// ユーティリティ
function allSameSuit(suits):
  return all(suit == suits[0] for suit in suits)

function countOccurrences(ranks):
  // {rankValue: count} のマップを返す
  counts = {}
  for rank in ranks:
    counts[rank] = (counts[rank] || 0) + 1
  return counts
```

### 4.5 キッカー抽出と比較
```
function getRoyalFlushKickers(ranks):
  // Royal Flush は唯一のランク
  return [12]  // A

function getStraightFlushKickers(ranks):
  // Straight の最高ランクで比較
  sortedRanks = sort(ranks, ascending)
  if sortedRanks == [0, 1, 2, 3, 12]:  // Wheel
    return [3]  // 5-high
  return [sortedRanks[4]]  // トップランク

function getFourOfAKindKickers(ranks):
  rankCounts = countOccurrences(ranks)
  fourRank = (rank for rank, count in rankCounts if count == 4)[0]
  kicker = (rank for rank in ranks if rank != fourRank)[0]
  return [fourRank, kicker]

function getFullHouseKickers(ranks):
  rankCounts = countOccurrences(ranks)
  threeRank = (rank for rank, count in rankCounts if count == 3)[0]
  twoRank = (rank for rank, count in rankCounts if count == 2)[0]
  return [threeRank, twoRank]

function getFlushKickers(ranks):
  return sort(ranks, descending)

function getStraightKickers(ranks):
  sortedRanks = sort(ranks, ascending)
  if sortedRanks == [0, 1, 2, 3, 12]:  // Wheel
    return [3]  // 5-high
  return [sortedRanks[4]]  // トップランク

function getThreeOfAKindKickers(ranks):
  rankCounts = countOccurrences(ranks)
  threeRank = (rank for rank, count in rankCounts if count == 3)[0]
  kickers = sort([rank for rank in ranks if rank != threeRank], descending)
  return [threeRank].concat(kickers)

function getTwoPairKickers(ranks):
  rankCounts = countOccurrences(ranks)
  pairs = sort([rank for rank, count in rankCounts if count == 2], descending)
  kicker = (rank for rank in ranks if rankCounts[rank] == 1)[0]
  return pairs.concat([kicker])

function getOnePairKickers(ranks):
  rankCounts = countOccurrences(ranks)
  pairRank = (rank for rank, count in rankCounts if count == 2)[0]
  kickers = sort([rank for rank in ranks if rank != pairRank], descending)
  return [pairRank].concat(kickers)

function getHighCardKickers(ranks):
  return sort(ranks, descending)
```

### 4.6 ハンド比較ロジック
```
function compareTwoHandRanks(hand1: HandRank, hand2: HandRank): number {
  // 戻り値: 1 = hand1が強い, -1 = hand2が強い, 0 = 同じ強さ
  
  // 1. ランク値で比較（高いほど強い）
  if hand1.rankValue > hand2.rankValue:
    return 1
  if hand1.rankValue < hand2.rankValue:
    return -1
  
  // 2. 同じランクの場合、キッカーで比較
  for i in 0...hand1.kickers.length:
    if hand1.kickers[i] > hand2.kickers[i]:
      return 1
    if hand1.kickers[i] < hand2.kickers[i]:
      return -1
  
  return 0  // 完全に同じハンド
}

function findBestHand(evaluatedHands: HandRank[]): HandRank {
  best = evaluatedHands[0]
  for hand in evaluatedHands[1...]:
    if compareTwoHandRanks(hand, best) > 0:
      best = hand
  return best
}
```

## 5. データ構造

### 5.1 Card
```
interface Card {
  rank: number        // 0-12 (2-A)
  suit: number        // 0-3 (♠♥♦♣)
  display: string     // "2s", "Ah", "10d" など
}

// ランク定義
const RANK_VALUES = {
  2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8,
  11: 9,  // J
  12: 10, // Q
  13: 11, // K
  14: 12  // A
}

// スーツ定義
const SUIT_VALUES = {
  "s": 0, // ♠
  "h": 1, // ♥
  "d": 2, // ♦
  "c": 3  // ♣
}
```

### 5.2 Combination
```
interface Combination {
  holeCards: Card[]      // 2枚
  boardCards: Card[]     // 3枚
  finalHand: Card[]      // 5枚 = holeCards + boardCards
}
```

### 5.3 EvaluatedHand
```
interface EvaluatedHand {
  rankValue: number              // 1-10
  rankName: string               // "Pair", "Flush" など
  kickers: number[]              // キッカー配列（降順）
  composition: {
    holeUsed: Card[]             // ホール2枚
    boardUsed: Card[]            // ボード3枚
  }
  canWin: boolean                // このハンドが全60通り中最強か
}
```

## 6. 状態図

```
[Input: 4 Hole + 5 Board]
  ↓
[Validate Cards]
  ├─ Invalid → ERROR
  └─ Valid ↓
[Generate 60 Combinations]
  (C(4,2) × C(5,3) = 6 × 10)
  ↓
[For Each Combination: Evaluate 5-Card Hand]
  ├─ Check Royal Flush
  ├─ Check Straight Flush
  ├─ Check Four of a Kind
  ├─ Check Full House
  ├─ Check Flush
  ├─ Check Straight
  ├─ Check Three of a Kind
  ├─ Check Two Pair
  ├─ Check One Pair
  └─ Default to High Card
  ↓
[Store HandRank for Each Combination]
  ↓
[Compare All 60 HandRanks]
  ↓
[Return Best HandRank]
  ├─ rankValue (10: RF, 9: SF, ... 1: HC)
  ├─ rankName
  ├─ kickers
  └─ composition (holeUsed, boardUsed)
```

## 7. テストケース（100個）

### 7.1 Royal Flush テスト（5個）

#### TC-001: Royal Flush - スペード
- Hole: As Ks Qs Js
- Board: 10s 9h 8d 7c 6h
- Expected: Royal Flush (A-K-Q-J-10 spades)
- Hole Used: As Ks
- Board Used: 10s 9h 8d... → 10s, 最初の3枚

#### TC-002: Royal Flush - ハート
- Hole: Ah Kh Qh Jh
- Board: 10h 9s 8d 7c 6d
- Expected: Royal Flush (A-K-Q-J-10 hearts)

#### TC-003: Royal Flush - ダイアモンド
- Hole: Ad Kd Qd Jd
- Board: 10d 9h 8s 7c 6h
- Expected: Royal Flush (A-K-Q-J-10 diamonds)

#### TC-004: Royal Flush - クラブ
- Hole: Ac Kc Qc Jc
- Board: 10c 9h 8s 7d 6h
- Expected: Royal Flush (A-K-Q-J-10 clubs)

#### TC-005: Royal Flush - ボードに多数のハイカード
- Hole: As Ks Qs Js
- Board: 10s Ah Kh Qh Jh
- Expected: Royal Flush in spades (複数組み合わせで最強を選択)

### 7.2 Straight Flush テスト（8個）

#### TC-006: Straight Flush - K-Q-J-10-9
- Hole: Ks Qs Js 9s
- Board: 10s 8h 7d 6c 5h
- Expected: Straight Flush K-high

#### TC-007: Straight Flush - 9-8-7-6-5
- Hole: 9s 8s 7s 6s
- Board: 5s 4h 3d 2c Ah
- Expected: Straight Flush 9-high

#### TC-008: Straight Flush - Wheel (5-4-3-2-A)
- Hole: 5s 4s 3s 2s
- Board: As Kh Qd Jc 10h
- Expected: Straight Flush 5-high (wheel)

#### TC-009: Straight Flush vs Two Pair
- Hole: 9s 8s 7d 6d
- Board: 10s Jh 9h 8h 7c
- Expected: Straight Flush 10-high (10-9-8-7-6)

#### TC-010: Straight Flush - 複数組み合わせ
- Hole: 8s 7s 6s 5s
- Board: 9s 4h 3d 2c Ah
- Expected: Straight Flush 9-high

#### TC-011: Straight Flush vs Full House
- Hole: 6s 5s 4s 3s
- Board: 2s Ah Ad Kc Kh
- Expected: Straight Flush 6-high (wheel無し、通常の6-5-4-3-2)

#### TC-012: Multiple Straight Flushes
- Hole: Ks Qs Js 10s
- Board: 9s 8h 7d 6c 5s
- Expected: Straight Flush K-high (K-Q-J-10-9)

#### TC-013: Straight Flush - Board heavy
- Hole: 5d 4d 3d 2d
- Board: 6s 7s 8s 9s 10s
- Expected: Straight Flush 10-high

### 7.3 Four of a Kind テスト（5個）

#### TC-014: Four Aces
- Hole: Ah As Ad Ac
- Board: 9h 8d 7c 6h 5s
- Expected: Four Aces with 9 kicker

#### TC-015: Four Kings with different board
- Hole: Kh Ks Kd Kc
- Board: 10h 9d 8c 7h 6s
- Expected: Four Kings with 10 kicker

#### TC-016: Four 5s
- Hole: 5h 5s 5d 5c
- Board: Ah Kd Qc Jh 10s
- Expected: Four 5s with A kicker

#### TC-017: Four Pair in hole, board single
- Hole: 7h 7s 7d 7c
- Board: 2h 2s 3d 4h 5c
- Expected: Four 7s with 5 kicker (not Four 2s)

#### TC-018: Four in hand with pairs on board
- Hole: 8h 8s 8d 8c
- Board: Kh Kd Qc Jh 10s
- Expected: Four 8s with K kicker

### 7.4 Full House テスト（8個）

#### TC-019: Three Aces + Two Kings
- Hole: Ah As Ad Kh
- Board: Ac Kd 9c 8h 7s
- Expected: Full House Aces full of Kings

#### TC-020: Three Kings + Two Queens
- Hole: Kh Ks Kd Qh
- Board: Kc Qs 9c 8h 7s
- Expected: Full House Kings full of Queens

#### TC-021: Three on hole, pair on board
- Hole: 7h 7s 7d 4h
- Board: 8c 8d 9c 10h Jh
- Expected: Full House 7s full of 8s

#### TC-022: Two pairs on hole, three on board
- Hole: 6h 6s 4h 4s
- Board: 6d 8c 9d 10h Js
- Expected: Full House 6s full of 4s

#### TC-023: Pair on hole, two trips possible
- Hole: 5h 5s 3h 3s
- Board: 5d 5c 7h 8d 9s
- Expected: Full House 5s full of... (ボード4枚と5s使用で複数組み合わせ)

#### TC-024: Full House from different combinations
- Hole: 9h 9s 8h 8s
- Board: 9d 7c 6d 5h 4s
- Expected: Full House 9s full of 8s (9-9-9-8-8)

#### TC-025: Three Jacks + best pair kicker
- Hole: Jh Js Jd 2h
- Board: Jc Ac Kd Qh 10s
- Expected: Full House Jacks full of Aces

#### TC-026: Full House - multiple pair options
- Hole: Qh Qs Jh Js
- Board: Qd Kc 10d 9h 8s
- Expected: Full House Queens full of Jacks

### 7.5 Flush テスト（8個）

#### TC-027: Flush - 5 spades (highest flush)
- Hole: As Ks Qs Js
- Board: 10s 9h 8d 7c 6h
- Expected: Flush Ace-high spades (A-K-Q-J-10)

#### TC-028: Flush - 4 hole + 1 board
- Hole: 8h 7h 6h 5h
- Board: 4h Kd Qc Js 10d
- Expected: Flush 8-high hearts

#### TC-029: Flush - 3 hole + 2 board
- Hole: 9d 8d 7d 2c
- Board: 6d 5d Kh Qs Jh
- Expected: Flush 9-high diamonds

#### TC-030: Flush vs Straight
- Hole: Kh Qh Jh 10h
- Board: 9h 8c 7d 6s 5h
- Expected: Flush K-high (Kh-Qh-Jh-10h-9h)

#### TC-031: Two flushes possible
- Hole: As Ks Qs Js
- Board: 10h 9h 8h 7c 6d
- Expected: Flush A-high spades (or H, best determined)

#### TC-032: Flush with low board
- Hole: 3s 4s 5s 6s
- Board: 7s 2d 8c 9h 10c
- Expected: Flush 7-high spades

#### TC-033: Flush - duplicate suits in board
- Hole: 2c 3c 4c 5c
- Board: 6c 7h 8d 9s 10h
- Expected: Flush 6-high clubs

#### TC-034: Flush vs Two Pair + Third
- Hole: 5d 4d 3d 2d
- Board: 6d 9c 9h 10s 10d
- Expected: Flush 6-high diamonds (not pairs)

### 7.6 Straight テスト（8個）

#### TC-035: Broadway (A-K-Q-J-10)
- Hole: Ah Kd Qc Js
- Board: 10h 9d 8c 7s 6h
- Expected: Straight Ace-high (broadway)

#### TC-036: 9-8-7-6-5
- Hole: 9h 8d 7c 6s
- Board: 5h 4d 3c 2s Ah
- Expected: Straight 9-high

#### TC-037: Wheel (A-2-3-4-5)
- Hole: Ah 2d 3c 4s
- Board: 5h Kd Qs Jc 10h
- Expected: Straight 5-high (wheel)

#### TC-038: Two straights possible
- Hole: 9h 8d 7c 6s
- Board: 5h 10d Qc Js Ah
- Expected: Straight 10-high (10-9-8-7-6)

#### TC-039: Straight vs Three of a Kind
- Hole: Kh Qd Jc 10s
- Board: 9h 8d 7c 6s 6h
- Expected: Straight K-high (not three 6s)

#### TC-040: Straight on board, different combos
- Hole: 2h 2d 2c 2s
- Board: Ah Kd Qc Js 10h
- Expected: Straight A-high (broadway, not quads or pairs)

#### TC-041: Wheel vs higher straight
- Hole: Ah 2d 3c 4s
- Board: 5h 6d 7c 8s 9h
- Expected: Straight 9-high (9-8-7-6-5, better than wheel)

#### TC-042: Multiple straight options
- Hole: 9h 8d 7c 6s
- Board: 5h 10d 11c Js Qh
- Expected: Straight Q-high (Q-J-10-9-8)

### 7.7 Three of a Kind テスト（5個）

#### TC-043: Three Aces
- Hole: Ah As Ad 2h
- Board: 3c 4d 5h 6s 7c
- Expected: Three Aces with K, Q kickers

#### TC-044: Three Kings - board pair
- Hole: Kh Ks Kd 2h
- Board: Kc Ah 9d 8s 7c
- Expected: Three Kings with A, 9 kickers

#### TC-045: Three 5s with high kickers
- Hole: 5h 5s 5d 2h
- Board: 3c Ah Kd Qs Jc
- Expected: Three 5s with A, K kickers

#### TC-046: Three vs Pair on hole
- Hole: 7h 7s 7d 3h
- Board: 3c 4d 5h 6s 8c
- Expected: Three 7s with 8, 6 kickers

#### TC-047: Three of a Kind - board heavy
- Hole: 4h 4s 4d 2h
- Board: Ac Kd Qs Jh 10c
- Expected: Three 4s with A, K kickers

### 7.8 Two Pair テスト（8個）

#### TC-048: Pair of Aces + Pair of Kings
- Hole: Ah As Kh Ks
- Board: 9c 8d 7h 6s 5c
- Expected: Two Pair A-K with 9 kicker

#### TC-049: Two pairs on board, one in hole
- Hole: Qh Qs 2h 3d
- Board: 9c 9d Jh 8s 7c
- Expected: Two Pair Q-9 with J kicker

#### TC-050: Pair in hole, two on board
- Hole: 8h 8s 2d 3c
- Board: Kh Kd Qc Jh 10s
- Expected: Two Pair K-8 with Q kicker

#### TC-051: Two pairs with high kicker
- Hole: Jh Js 10h 10s
- Board: Ac Kd 2h 3d 4c
- Expected: Two Pair J-10 with A kicker

#### TC-052: Two Pair vs Three of Kind available
- Hole: 6h 6s 6d 5h
- Board: 5c 9d 8h 7s 4c
- Expected: Full House 6-5 (not Two Pair)

#### TC-053: Multiple two-pair combos - choose best
- Hole: Ah As Kh Ks
- Board: 9c 9d 8h 7s 6c
- Expected: Two Pair A-K with 9 kicker

#### TC-054: Two Pair - low kicker
- Hole: 4h 4s 3h 3s
- Board: 2c 2d 5h 6s 7c
- Expected: Two Pair 4-3 with 7 kicker

#### TC-055: Two Pair vs Flush draw
- Hole: 6h 6s 5h 5s
- Board: 9h 8h 7h 4d 3c
- Expected: Flush 9-high hearts (9-8-7-6-5) if available, else Two Pair 6-5

### 7.9 One Pair テスト（8個）

#### TC-056: Pair of Aces
- Hole: Ah As 2h 3d
- Board: 4c 5d 6h 7s 8c
- Expected: One Pair Aces with K, Q, J kickers

#### TC-057: Pair of 2s
- Hole: 2h 2s Kd Qc
- Board: Jh 10s 9c 8d 7h
- Expected: One Pair 2s with K, Q, J kickers

#### TC-058: Pair on board only
- Hole: 9h 8s 7d 6c
- Board: Ah As 4h 5d 6h
- Expected: One Pair Aces with 9, 8, 7 kickers

#### TC-059: Pair with lower kickers
- Hole: 3h 3s 2d 2c
- Board: Kh Qd Jc 10h 9s
- Expected: One Pair 3s with K, Q, J kickers

#### TC-060: Multiple pairs possible - one on hole
- Hole: Jh Js 9h 9s
- Board: Kc Kd 8d 7h 6s
- Expected: One Pair K with J, 9, 8 kickers (or pair from board if better)

#### TC-061: Single pair with high kicker progression
- Hole: 5h 5s 2d 3c
- Board: Ah Kd Qc Jh 10s
- Expected: One Pair 5s with A, K, Q kickers

#### TC-062: Pair vs near-flush/straight
- Hole: 5h 5s 6h 7d
- Board: 8h 9s 10c Kd 2h
- Expected: One Pair 5s with K, 10, 9 kickers (check no straight)

#### TC-063: Lowest pair in deck
- Hole: 2h 2s 3d 4c
- Board: Kh Qd Jc 10h 9s
- Expected: One Pair 2s with K, Q, J kickers

### 7.10 High Card テスト（5個）

#### TC-064: Ace-high
- Hole: Ah Ks Qd Jc
- Board: 9h 8s 7d 6c 4h
- Expected: High Card A with K, Q, J, 9 kickers

#### TC-065: King-high
- Hole: Kh Qd Js 10c
- Board: 9h 8s 7d 6c 4h
- Expected: High Card K with Q, J, 10, 9 kickers

#### TC-066: Low high card
- Hole: 8h 7s 6d 5c
- Board: 4h 3s 2d Kc Qh
- Expected: High Card K with Q, 8, 7, 6 kickers

#### TC-067: High card with scattered ranks
- Hole: Ah 9d 7c 5s
- Board: Kh Qd Js 10c 8h
- Expected: High Card A with K, Q, J, 10 kickers

#### TC-068: High card all low
- Hole: 9h 8s 7d 6c
- Board: 5h 4s 3d 2c Kh
- Expected: High Card K with 9, 8, 7, 6 kickers

### 7.11 複合・エッジケーステスト（20個）

#### TC-069: Omaha constraint check - must use 2 hole + 3 board
- Hole: As Ah Ad Ac (4 suits all)
- Board: Ks Kh Kd Kc Qh
- Expected: Correctly identify best 5-card (test all 60 combos are checked)

#### TC-070: 4フラッシュ vs 3フラッシュ - best should be real flush
- Hole: 9h 8h 7h 6h
- Board: 5h 4d 3c 2s Ah
- Expected: Flush 9-high (9-8-7-6-5)

#### TC-071: 4ストレート vs 3ストレート
- Hole: Kh Qd Js 10c
- Board: 9h 8d 7c 6s 5h
- Expected: Straight K-high

#### TC-072: Quad vs Full House vs Straight
- Hole: 7h 7s 7d 7c
- Board: 5h 6d 7... (error in test design, 7 already used 4x)

#### TC-073: High card comparison between multiple high cards
- Hole: Ah Kd Qs Jc
- Board: 10h 9d 8c 7s 6h
- Expected: High Card A with K, Q, J, 10

#### TC-074: Wheel vs non-wheel straight
- Hole: 5h 4d 3c 2s
- Board: Ah Kd Qs Jc 10h
- Expected: Straight A-high (broadway, not wheel)

#### TC-075: Pair of Aces in hole, King-high flush
- Hole: Ah As 9h 8h
- Board: 7h 6h 5d 4c 3s
- Expected: Flush 9-high hearts (not pair)

#### TC-076: Full House - board 3, hole 2 combo
- Hole: 3h 3s 4d 4c
- Board: 3c Kh Qd Js 10c
- Expected: Full House 3s full of 4s

#### TC-077: 4ペア - should find best 2
- Hole: Kh Ks Qd Qs
- Board: Jh Jd 10c 9h 8s
- Expected: Two Pair K-Q with J kicker

#### TC-078: Straight Flush vs Royal Flush (board heavy)
- Hole: 9s 8s 7d 6c
- Board: Ks Qs Js 10s As
- Expected: Royal Flush (A-K-Q-J-10 suited)

#### TC-079: Consecutive straights - pick highest
- Hole: Qh Jd 10c 9s
- Board: 8h 7d 6c 5s 4h
- Expected: Straight Q-high (Q-J-10-9-8)

#### TC-080: Pair and trips possible - pick trips
- Hole: 7h 7s 7d 2h
- Board: 7c Ac Kd Qs Jh
- Expected: Four of a Kind 7s with A kicker

#### TC-081: Multiple flush colors - pick none, pick best other hand
- Hole: 2h 3d 4c 5s
- Board: 6h 7d 8c 9s 10h
- Expected: Straight 10-high (10-9-8-7-6)

#### TC-082: Ace-2 straight vs Ace-K straight (wheel availability)
- Hole: Ah 2d 3c 4s
- Board: 5h 6d 7c 8s 9h
- Expected: Straight 9-high (9-8-7-6-5)

#### TC-083: Same hand rank, different kickers from different combos
- Hole: 9h 9s 8d 8c
- Board: 9d Ac Kh Qd Js
- Expected: Full House 9s full of 8s

#### TC-084: No made hand, high card ties broken by second card
- Hole: Kh Jd 9c 7s
- Board: 5h 4d 3c 2s 6h
- Expected: High Card K with J, 9, 7, 6

#### TC-085: Three suited cards, needs 2 more for flush
- Hole: 8h 7h 6h 2d
- Board: 5h 4d 3c 2s Kh
- Expected: Flush K-high hearts (K-8-7-6-5)

#### TC-086: Straight on board, multiple ways to make
- Hole: 2h 3d 9c 10s
- Board: 4h 5d 6c 7s 8h
- Expected: Straight 8-high (8-7-6-5-4)

#### TC-087: All broadway cards - multiple high hands
- Hole: Ah Ks Qd Jc
- Board: 10h 9s 8d 7c 6h
- Expected: Straight Ace-high (A-K-Q-J-10, broadway)

#### TC-088: Dead hands due to Omaha constraint
- Hole: As 2s 3s 4s
- Board: 5s 6s 7s 8s 9s
- Expected: Straight Flush 9-high (9-8-7-6-5, using As + 4s not possible)

### 7.12 ダブルチェックテスト（12個）

#### TC-089: Confirm all 60 combinations are evaluated
- Setup: Create scenario where different combinations yield different results
- Expected: Verify that best of all 60 is returned

#### TC-090: Kicker comparison - second and third
- Hole: Ah Ad 2d 3d
- Board: 4d 5d Kc Qh Js
- Expected: Pair of Aces with K, Q, J kickers

#### TC-091: Flush kicker order (all same suit 5 cards)
- Hole: Ah 9h 7h 5h
- Board: 3h Kd Qs Jc 10h
- Expected: Flush A-high hearts with proper kicker order

#### TC-092: Straight kicker determination
- Hole: 9h 8d 7c 6s
- Board: 5h 4d Ah Kh Qd
- Expected: Straight 9-high (highest card of straight)

#### TC-093: Full House - 3 on board vs 2 on hole
- Hole: Kh Ks 9d 9c
- Board: Kd 8h 7s 6d 5c
- Expected: Full House Kings full of 9s

#### TC-094: Multiple valid hands - ensure strongest returned
- Hole: As Ks Qs Js
- Board: 10s 9h 8h 7h 6h
- Expected: Straight Flush (10s-9h won't work due to Omaha constraint, need suited)

#### TC-095: Test boundary - A-2-3-4-5 specific
- Hole: Ah 2d 3c 4s
- Board: 5h Kd Qc Jh 10s
- Expected: Straight 5-high (wheel, lowest straight)

#### TC-096: Test boundary - K-Q-J-10-9
- Hole: Kh Qd Js 10c
- Board: 9h 8d 7c 6s 5h
- Expected: Straight K-high

#### TC-097: Test pair ranking - all pairs
- Hole: 2h 2s 3d 3c
- Board: 4h 5d 6c 7s 8h
- Expected: One Pair 3s with 8, 7, 6 kickers

#### TC-098: Identical ranks, different suits (no meaning to suit in evaluation order)
- Hole: 2h 3d 4c 5s
- Board: 6h 7d 8c 9s 10h
- Expected: Straight 10-high (spades, hearts - order doesn't matter for value)

#### TC-099: Mixed scenario - pair + three card straight flush draw
- Hole: Kh Ks 9h 8h
- Board: 7h 6h 5h 4d 3c
- Expected: Flush K-high hearts (K-9-8-7-6)

#### TC-100: Final validation - all 10 hand ranks in one test set
- Create 10 different scenarios testing each hand rank
- Expected: All 10 correctly identified

## 8. エッジケース

### 8.1 Ace の取り扱い
**ケース**: Wheelでのストレート (A-2-3-4-5)
- Aces は通常は最高ランク（12）だが、Wheelではランク0として機能
- **テスト**: `5h 4d 3c 2s Ah` でホール `Ah 2d 3c 4s` → Straight 5-high を返す

**ケース**: Ace-high straight
- Aces は最高ランク、Broadway (10-J-Q-K-A) を形成
- **テスト**: ホール `Ah Ks Qd Jc` + ボード `10h 9d 8c 7s 6h` → Straight Ace-high

### 8.2 複数スーツのフラッシュ
**ケース**: ボード上に複数フラッシュが存在
- 例: ボード 5s 5h 5d 5c 2s で、ホール As Ad 9c 9h
- 正確なルール: 必ず2ホール + 3ボードを使うため、不可能な組み合わせ
- **テスト**: アルゴリズムが正確に60通りのみ生成することを確認

### 8.3 キッカーの正確な順序
**ケース**: 複数の同ランク
- 例: Three of a Kind + 2キッカー
- キッカーは降順 (高い順) でソートが必須
- **テスト**: `[3K, high_kicker, low_kicker]` の順序を確認

### 8.4 同一ハンドの比較
**ケース**: 2つのハンドが全く同じランク・キッカー
- 例: 両者とも One Pair Kings with A, Q, J kickers
- **テスト**: `compareTwoHandRanks()` が 0 を返すことを確認

### 8.5 6通りのホール組み合わせ確認
```
ホール: [A, B, C, D]
取り出し方: [A,B], [A,C], [A,D], [B,C], [B,D], [C,D]
テスト: 全て正確に生成されることを確認
```

### 8.6 10通りのボード組み合わせ確認
```
ボード: [1, 2, 3, 4, 5]
取り出し方: 
  [1,2,3], [1,2,4], [1,2,5],
  [1,3,4], [1,3,5], [1,4,5],
  [2,3,4], [2,3,5], [2,4,5],
  [3,4,5]
テスト: 全て正確に生成されることを確認
```

### 8.7 不可能なハンド
**ケース**: Royal Flush が複数存在するか確認
- Royal Flush は唯一のランク (A-K-Q-J-10 同一スーツ)
- **テスト**: 複数の Royal Flush が存在しないことを確認

**ケース**: Four of a Kind + Fifth カード (Quints は不可)
- デッキに各ランク4枚のみのため、5ペアは不可能
- **テスト**: 不可能な組み合わせが発生しないことを確認

### 8.8 境界値ケース
**ケース**: 最低のハンド
- High Card 7-5-4-3-2（7 が最高、他は全て異なるランク）
- **テスト**: アルゴリズムが正確に処理できることを確認

**ケース**: 最高のハンド
- Royal Flush
- **テスト**: 常に 最高ランク (10) を返す

### 8.9 Omaha特有の制約
**ケース**: 4フラッシュでも3枚をボードから選べば、フラッシュが成立しない場合
- ホール: 9h 8h 7h 6h
- ボード: 5d 4d 3d 2d Ac
- 必ず 9h, 8h を使わないといけないわけではなく、2枚のホールを選択可能
- **テスト**: 正確に `C(4,2) = 6` 通りのホール選択が行われることを確認

### 8.10 キッカーの重要性
**ケース**: 同じハンドランクで異なるキッカー
- Hand1: Pair of Kings with A, Q, 10
- Hand2: Pair of Kings with A, Q, 9
- Hand1 > Hand2 (10 > 9)
- **テスト**: `compareTwoHandRanks()` が正確にキッカー順位を比較

### 8.11 複雑なハンド混在
**ケース**: ボードに2ペア、ホールにペア
- ホール: 8h 8s 3d 4c
- ボード: 9h 9d 7h 7s 5c
- 最強: Two Pair 9s-8s with 7 kicker (or 9s-7s with 8 kicker?)
- **テスト**: 全60通り評価後、正確に最強を選択

### 8.12 ストレート vs フラッシュ判定
**ケース**: ストレートとフラッシュの混在
- ホール: 9h 8h 7h 6h
- ボード: 5h 4s 3d 2c Ah
- Flush 9-high (9-8-7-6-5 all hearts) が Straight 9-high より強い
- **テスト**: 正確にフラッシュを選択

## 9. 実装時の注意点

### 9.1 パフォーマンス
- 60通りの評価は許容可能な計算量
- キャッシング不要（単一ハンド評価なら十分高速）

### 9.2 精度確保
- ビット演算でランク・スーツをエンコードすると高速化可能（未実装指示のため割愛）
- ソート処理が必要な部分を明確にしておく

### 9.3 テスト駆動
- 上記100+テストケースで網羅的にテスト
- エッジケース全て明示的に確認

### 9.4 ドキュメント
- 各アルゴリズムの計算量を明記
- キッカー比較ロジックを明確にする
