# Double Board Bomb Pot Fast Fold - 設計変更点一覧

## 概要
現在の設計は「通常のPot Limit Omaha Fast Fold」を前提としていますが、実際のゲームルールは **Double Board Bomb Pot Fast Fold** です。これにより、以下の仕様が大きく変更となります。

---

## 1. ゲームルール変更

### 旧ルール（通常PLO Fast Fold）
```
プリフロップ → フロップ → ターン → リバー → Showdown
Board: 1つ（5カード）
Pot: 1つ
Betting Rounds: 4ラウンド
```

### 新ルール（Double Board Bomb Pot Fast Fold）
```
Bomb Pot + フロップ → ターン → リバー → Showdown
Board: 2つ (Board A 5カード、Board B 5カード)
Pot: 2つ (Pot A、Pot B)
Betting Rounds: 3ラウンド (プリフロップなし)
```

### 主要な変更点

| 項目 | 旧 | 新 | 影響度 |
|------|-----|-----|--------|
| **ゲーム開始** | ブラインド → プリフロップ | Bomb Pot + フロップ表示 | 🔴 高 |
| **Board数** | 1つ | 2つ独立 | 🔴 高 |
| **Pot分配** | 単一Pot | Pot A + Pot B (各Boardごと) | 🔴 高 |
| **Betting Round数** | 4 (PF/F/T/R) | 3 (F/T/R) | 🟡 中 |
| **ハンド評価** | 1つのBoard | Board A + Board B (独立評価) | 🔴 高 |
| **勝敗判定** | 単独勝者/複数勝者 | Quarter/Split Pot対応 | 🔴 高 |
| **プレイヤー入金** | ブラインド | 毎ハンドBB額（Bomb Pot） | 🟡 中 |

---

## 2. 各設計資料の修正対象

### 2.1 requirements.md

**修正セクション**

#### ❌ 旧: 「3. 開発ロードマップ → フェーズ2」
```
- プリフロップ・フロップ・ターン・リバーの流れを実装
- Pot Limit Omahaのベッティングとフォールド・チェック・コールを実装
```

#### ✅ 新：
```
- Bomb Pot機構の実装（毎ハンド全プレイヤーが同額投資）
- Double Board表示（Board AとBoard Bを同時管理）
- フロップ・ターン・リバーの3ベッティングラウンド実装
- 各Boardの独立ハンド評価
- Quarter/Split Pot対応の勝敗判定
- 2つのPot（Pot A、Pot B）の個別計算・分配
```

#### ❌ 旧: 「4. 機能要件」
```
- プレイヤーは手札4枚から2枚、ボード5枚から3枚を組み合わせて最良の5枚を作る
```

#### ✅ 新：
```
- プレイヤーは手札4枚から2枚、Board A（5カード）から3枚 + Board B（5カード）から3枚を組み合わせて、各Boardで最良の5カードを作る
- 毎ハンド全プレイヤーが Blind × 2 のBomb Pot を投資
- Board AとBoard Bで独立して勝敗を決定
- 複数勝者の場合、QuarterとSplit Potで分配
```

---

### 2.2 architecture.md

**修正セクション**

#### ❌ 旧: 「2.2 ゲームエンジン」
```
- ハンド進行（プリフロップ／フロップ／ターン／リバー）
- ベッティングラウンド、ポット計算、勝敗判定
- Omahaの5枚ベストハンド判定
```

#### ✅ 新：
```
- Bomb Pot管理（毎ハンド全プレイヤーが同額投資）
- ハンド進行（フロップ／ターン／リバーのみ、プリフロップなし）
- Double Board管理（Board A、Board B独立追跡）
- 3ベッティングラウンド
- 各Boardのポット計算（Pot A、Pot B）
- 各Boardでの独立ハンド評価
- Quarter/Split Pot対応の複数勝者判定
```

#### ❌ 旧: 「4.3 ルールエンジン」
```
- デッキ、シャッフル、配牌
- Pot Limitベッティング制約
- ベット額検証とプリフロップ〜リバー進行
- 勝者判定とポット分配
```

#### ✅ 新：
```
- 2つのデッキ（Board A用、Board B用）管理・シャッフル
- Board A・B同時配牌・進行
- Bomb Pot投資処理
- Pot Limitベッティング制約（各Boardのポットに対して計算）
- ベット額検証とフロップ～リバー進行（3ラウンド）
- 各Board独立のハンド評価
- Quarter/Split Pot対応の複数勝者判定・分配
```

#### ❌ 旧: 「5. 状態遷移図」
```
[Idle] --> [Queued] : プレイヤー入場
[Queued] --> [AssignedToTable] : テーブル割り当て
[AssignedToTable] --> [WaitingForAction] : ディール後プレイヤーの行動待ち
...
[Acted] --フォールド--> [FastFoldTransition]
```

#### ✅ 新：
```
[Idle] --> [Queued] : プレイヤー入場
[Queued] --> [AssignedToTable] : テーブル割り当て
[AssignedToTable] --> [BombPotInvested] : Bomb Pot投資
[BombPotInvested] --> [FlopRevealed] : Board A・B フロップ表示
[FlopRevealed] --> [WaitingForAction] : プレイヤーの行動待ち
...
[Acted] --フォールド--> [FastFoldTransition]
```

---

### 2.3 omaha-hand-evaluator-design.md

**修正セクション：全体的に大幅変更**

#### ❌ 旧: 「1. 概要」
```
...ホールカード4枚とボード5枚から...
```

#### ✅ 新：
```
...ホールカード4枚とBoard A（5枚）＋ Board B（5枚）から...
各Boardで独立してOmahaルール（必ず2ホール+3Board）に従い最強5カードを見つけ、各Boardでハンドランクを判定する
```

#### ❌ 旧: 「2. Omahaルール再確認」
```
プレイヤーは手札4枚から2枚、ボード5枚から3枚を組み合わせて作られる
この制約により、最大 C(4,2) × C(5,3) = 60通りの組み合わせ
```

#### ✅ 新：
```
プレイヤーは手札4枚から2枚を使用
Board A（5枚）から3枚 + Board B（5枚）から3枚を組み合わせ、各Boardで独立して5カードハンドを作成
Board A組み合わせ: C(4,2) × C(5,3) = 60通り
Board B組み合わせ: C(4,2) × C(5,3) = 60通り
総合: 60 × 60 = 3,600通りの組み合わせペア（但しBoard AとBは同じカードセットを使用するため、実質は60通りの反復）

実装上は：
- 同じ60通りの組み合わせを Board Aで評価
- 同じ60通りの組み合わせを Board Bで評価
- 各Boardで最強ハンドを選択 → 2つのハンドランク出力
```

#### ❌ 旧: 「4. アルゴリズム → 4.1 全体フロー」
```
function evaluateOmahaHand(holeCards, boardCards):
  // 60通りの全組み合わせ生成
  // 各組み合わせを評価
  // 最強ハンドを抽出
  return bestHand
```

#### ✅ 新：
```
function evaluateDoubleBoard(holeCards, boardA, boardB):
  // Board A: 60通り評価 → 最強ハンド取得
  handRankA = evaluateBoardCombinations(holeCards, boardA)
  
  // Board B: 60通り評価 → 最強ハンド取得
  handRankB = evaluateBoardCombinations(holeCards, boardB)
  
  return {
    boardA: handRankA,
    boardB: handRankB
  }
```

#### ❌ 旧: 「7. テストケース」
```
### TC-001: Royal Flush - スペード
- Hole: As Ks Qs Js
- Board: 10s 9h 8d 7c 6h
- Expected: Royal Flush
```

#### ✅ 新：
```
### TC-001: Double Board - Royal Flush vs Pair
- Hole: As Ks Qs Js
- Board A: 10s 9h 8d 7c 6h
- Board B: 2d 3d 4h 5h 6s
- Expected: 
  - Board A: Royal Flush (A-K-Q-J-10 spades)
  - Board B: One Pair (6s with...) or High Card
```

#### ❌ 旧: 「8. エッジケース」
```
### 8.1 Ace の取り扱い
**ケース**: Wheelでのストレート
```

#### ✅ 新：
```
### 8.1 Board AとBでの異なるハンドランク
**ケース**: Board A でペアが成立、Board B では成立しない場合の処理

### 8.2 Quarter Pot計算
**ケース**: Board A で2人勝利、Board B で異なる2人が勝利 → 4人すべてが利益獲得

### 8.3 Split Pot
**ケース**: Board AとBoard Bで同じ2人が勝利 → 2分割（各Boardで）
```

---

### 2.4 mvp.md

**修正セクション**

#### ❌ 旧: 「2. MVP判定基準」
```
- 1人のプレイヤーが確実にゲームをプレイ可能
- 6-max（1人 + 5Bot）テーブルで常にゲームが進行
- フォールド後、次ハンドへ即座に移動可能（Fast Fold体験）
```

#### ✅ 新：
```
- 1人のプレイヤーが確実にゲームをプレイ可能
- 6-max（1人 + 5Bot）テーブルで常にゲームが進行
- 毎ハンドBomb Pot投資 → Board A・B同時表示でゲーム開始
- プリフロップなしの3ベッティングラウンド（フロップ/ターン/リバー）
- 各Board独立評価 + Quarter/Split Pot対応
- フォールド後、次ハンドへ即座に移動可能（Fast Fold体験）
```

#### ❌ 旧: 「3.1 Must Have → ゲームルール実装」
```
- [x] Pot Limit Omaha ルール（必ず2ホール + 3ボード）
- [x] 4ホールカード配布
- [x] 5ボードカード（フロップ3枚、ターン1枚、リバー1枚）
- [x] 60通り組み合わせハンド評価
- [x] プリフロップ・フロップ・ターン・リバーのベッティングラウンド
- [x] ポット計算と勝敗判定
```

#### ✅ 新：
```
- [x] Double Board Bomb Pot Omaha ルール
- [x] Bomb Pot投資機構（毎ハンド全プレイヤーが同額投資）
- [x] 4ホールカード配布
- [x] Board A・B（各5カード: フロップ3+ターン1+リバー1）
- [x] 各Board 60通り組み合わせハンド評価（独立）
- [x] フロップ・ターン・リバーのベッティングラウンド（3ラウンド）
- [x] Pot A・B計算と各Board勝敗判定
- [x] Quarter/Split Pot対応複数勝者分配
```

#### ❌ 旧: 「7. MVP後のロードマップ」
```
**Phase 4** (2-3ヶ月後)
- 複数難易度Bot
- ハンド履歴・統計ダッシュボード
```

#### ✅ 新：
```
**Phase 4** (2-3ヶ月後)
- 複数難易度Bot（Double Board戦略対応）
- Board A・B独立の戦略分析ダッシュボード
```

---

### 2.5 phase1-plan.md

**修正セクション：大幅に関連するため複数箇所**

#### ❌ 旧: 「4. Omaha Hand Evaluator（T4-HandEvaluator）」
```
### 目的
ホールカード4枚 + ボード5枚から、Omahaルール（必ず2+3）に従って最強の5カードハンドを評価する。

### スコープ
- 60通り組み合わせ生成
- 各組み合わせの5カードハンド評価
```

#### ✅ 新：
```
### 目的
ホールカード4枚 + Board A（5枚）+ Board B（5枚）から、各Boardで独立してOmahaルール（必ず2+3）に従い最強の5カードハンドを評価する。

### スコープ
- 60通り組み合わせ生成（Board A用）
- 60通り組み合わせ生成（Board B用）
- 各組み合わせの5カードハンド評価（Board A・B独立）
- 各Boardで最強ハンド選択（2つのハンドランク出力）
```

#### ❌ 旧: 「6. Table Engine（T6-TableEngine）」
```
### 目的
1テーブル（6-max）の完全なゲーム進行を管理し、プリフロップ～リバーまでの流れを実装する。

### スコープ
- Table 状態管理
- ブラインド・ディーラーボタン
- ベッティングラウンド（4ラウンド）
- ポット計算
```

#### ✅ 新：
```
### 目的
1テーブル（6-max）の完全なDouble Board Bomb Pot ゲーム進行を管理し、Bomb Pot投資 → Board A・B表示 → フロップ～リバーまでの流れを実装する。

### スコープ
- Table 状態管理（2つのBoard状態、2つのPot状態）
- Bomb Pot投資機構
- 2つのデッキ管理（Board A・B用）
- ベッティングラウンド（3ラウンド: フロップ/ターン/リバー）
- Pot A・B個別計算
- 各Boardの独立ハンド評価
- Quarter/Split Pot対応勝敗判定
```

#### ❌ 旧: 「T6-1: Table 型定義」
```
export interface TableState {
  tableId: string;
  seats: TableSeat[];
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  pot: number;
  communityCards: Card[];    // 0-5枚
}
```

#### ✅ 新：
```
export interface TableState {
  tableId: string;
  seats: TableSeat[];
  street: 'flop' | 'turn' | 'river' | 'showdown';  // プリフロップなし
  potA: number;
  potB: number;
  boardA: Card[];            // 5枚
  boardB: Card[];            // 5枚
  bombPotAmount: number;     // 投資額
}
```

#### ❌ 旧: 「T6-2: Table クラス」
```
// ハンド開始
startNewHand(): void {
  this.rotateDealer();
  this.setBlindPositions();
  this.dealCards();
  this.startPreflop();
}
```

#### ✅ 新：
```
// ハンド開始
startNewHand(): void {
  this.rotateDealerAndBlinds();
  this.collectBombPot();      // 全プレイヤーがBB×2投資
  this.dealHoleCards();
  this.dealFlop();            // Board A・B同時にフロップ3枚
  this.startFlopBetting();    // プリフロップなし → フロップから開始
}
```

#### ❌ 旧: 「T6-4: ポット計算」
```
export class PotCalculator {
  static calculatePot(bets: number[]): number { ... }
  static calculateSidePots(...): SidePot[] { ... }
  static distributePot(...): Map<string, number> { ... }
}
```

#### ✅ 新：
```
export class PotCalculator {
  // Board A・Bの独立ポット計算
  static calculatePotA(bets: number[]): number { ... }
  static calculatePotB(bets: number[]): number { ... }
  
  // Bomb Pot管理
  static collectBombPot(players: PlayerProfile[]): number { ... }
  
  // Quarter/Split Pot対応分配
  static distributeQuarterPot(
    potA: number,
    potB: number,
    winnersA: string[],
    winnersB: string[]
  ): Map<string, number> { ... }
}
```

#### ❌ 旧: 「T6-5: 勝敗判定」
```
export class Showdown {
  static executeShowdown(
    table: Table,
    activePlayers: PlayerProfile[]
  ): HandResult {
    // 各プレイヤーのハンド評価
    // 勝者決定
  }
}
```

#### ✅ 新：
```
export class Showdown {
  static executeDoubleShowdown(
    table: Table,
    activePlayers: PlayerProfile[]
  ): HandResult {
    // Board Aでのハンド評価・勝者決定
    const winnersA = evaluateBoardAndFindWinners(table.boardA, activePlayers);
    
    // Board Bでのハンド評価・勝者決定
    const winnersB = evaluateBoardAndFindWinners(table.boardB, activePlayers);
    
    // Quarter/Split Pot分配
    const distribution = calculateQuarterSplitDistribution(
      winnersA, winnersB, table.potA, table.potB
    );
    
    return {
      winnersA,
      winnersB,
      distribution,
      detailsByBoard: { boardA: ..., boardB: ... }
    };
  }
}
```

#### ❌ 旧: 「T7: UI コンポーネント」
```
### 目的
Next.js + React + Tailwind CSSでシンプルで機能的なUIを構築

### スコープ
- テーブルビュー（カード表示、プレイヤー配置）
```

#### ✅ 新：
```
### 目的
Next.js + React + Tailwind CSSで、Double Board表示対応UIを構築

### スコープ
- Double Boardテーブルビュー（Board A・B同時表示）
- Bomb Pot表示
- 各Boardの独立ハンド表示（フロップ/ターン/リバー）
- Quarter/Split Pot結果表示
```

#### ❌ 旧: 「T7-2: Table コンポーネント」
```
export function Table({ gameState, onPlayerAction }: TableProps) {
  return (
    <div className="relative w-96 h-64 border-8 border-green-700 rounded-full bg-green-900">
      {/* ボード表示 */}
      <div>
        <CommunityCards cards={gameState.boardCards} />
      </div>
```

#### ✅ 新：
```
export function DoubleTable({ gameState, onPlayerAction }: TableProps) {
  return (
    <div className="flex gap-8">
      {/* Board A */}
      <div className="relative w-96 h-64 border-8 border-blue-700 rounded-full bg-green-900">
        <CommunityCards cards={gameState.boardA} label="Board A" />
        <div className="absolute bottom-4 left-1/2">Pot A: ${gameState.potA}</div>
      </div>
      
      {/* Board B */}
      <div className="relative w-96 h-64 border-8 border-red-700 rounded-full bg-green-900">
        <CommunityCards cards={gameState.boardB} label="Board B" />
        <div className="absolute bottom-4 left-1/2">Pot B: ${gameState.potB}</div>
      </div>
```

---

## 3. 追加で必要な設計資料

### 3.1 新規: Double Board Bomb Pot ルール詳細書
**ファイル**: `docs/double-board-rules.md` （新規作成推奨）

```
内容：
- Bomb Pot メカニクス
- Double Board構造
- Quarter/Split Pot計算
- ベッティングルール（3ラウンド）
- プレイヤー破産時の処理
```

### 3.2 新規: Pot分配アルゴリズム設計
**ファイル**: `docs/pot-distribution-design.md` （新規作成推奨）

```
内容：
- Pot A・Bの独立管理
- Quarter Pot計算ロジック
- Split Pot シナリオ
- サイドポット対応（オールイン時）
- テストケース（30+ TC）
```

---

## 4. 修正工数推定

| 資料 | 修正量 | 工数 |
|------|-------|------|
| requirements.md | 高（ルール全体） | 2h |
| architecture.md | 高（ゲームエンジン全体） | 2-3h |
| omaha-hand-evaluator-design.md | 高（アルゴリズム大幅変更） | 3-4h |
| mvp.md | 中（スコープ調整） | 1-2h |
| phase1-plan.md | 高（Table Engine・UI大幅変更） | 3-4h |
| **新規**: double-board-rules.md | 新規作成 | 3h |
| **新規**: pot-distribution-design.md | 新規作成 | 3-4h |
| **合計** | | **17-20h** |

---

## 5. 修正後の主要な変更内容

### 5.1 ゲームフロー
```
旧: ブラインド → プリフロップ → フロップ → ターン → リバー → Showdown
新: Bomb Pot投資 → Board A・Bフロップ同時表示 → フロップ → ターン → リバー → Double Showdown
```

### 5.2 ハンド評価
```
旧: 60通り組み合わせ → 最強ハンド（1つ）
新: 60通りBoard A → 最強ハンド
    60通りBoard B → 最強ハンド
   （独立した2つのハンドランク出力）
```

### 5.3 ポット分配
```
旧: 単一ポット → 単独/複数勝者に全配分
新: Pot A（Board A勝者） + Pot B（Board B勝者）
   → Quarter Pot (両Board異なる勝者の場合4人分配)
   → Split Pot (同一勝者の場合2分配)
```

### 5.4 UI表示
```
旧: 1テーブル、1ボード表示
新: 1テーブル、2ボード同時表示（Board A・B並列）
    Bomb Pot表示、各Board独立ポット表示
    Double Showdown結果表示
```

---

## 6. 実装への影響

### Phase 1 リプランニング

| タスク | 旧 | 新 | 追加工数 |
|--------|-----|-----|---------|
| T4 Hand Evaluator | 20-30h | 25-35h | +5h |
| T6 Table Engine | 25-35h | 35-45h | +10h |
| T7 UI | 20-25h | 25-35h | +10h |
| **新**: Double Board管理 | 0h | 15-20h | +15-20h |
| **新**: Pot分配ロジック | 0h | 10-15h | +10-15h |
| **Phase 1 合計** | 84-118h | 120-160h | +36-42h |

**推定**: 1開発者フルタイムで 3-4週間（旧：2-3週間）

---

## 7. 次のステップ

1. ✅ **変更点一覧作成**（本資料）
2. ⏳ **各設計資料の修正**（以下の順で）
   - requirements.md
   - architecture.md
   - 新規: double-board-rules.md
   - 新規: pot-distribution-design.md
   - omaha-hand-evaluator-design.md
   - mvp.md
   - phase1-plan.md
3. ⏳ **修正内容のレビュー・確認**
4. ⏳ **実装開始**

---

## まとめ

**Double Board Bomb Pot Fast Fold** は通常のFast Fold PLOと比べ、以下の面で大幅に複雑化します：

- **ゲームフロー**: プリフロップなし → Bomb Pot + 2Board同時進行
- **ハンド評価**: 1つのハンド判定 → 2つの独立ハンド判定
- **ポット分配**: 単純分配 → Quarter/Split対応の複雑分配
- **UI**: 1Board表示 → 2Board同時表示
- **工数**: +36-42時間増加

設計資料の修正は、**ゲームロジックとハンド評価**の部分を優先して行う必要があります。
