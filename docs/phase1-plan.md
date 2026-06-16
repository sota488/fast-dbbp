# Phase 1 実装計画 - Core Game Engine & Basic UI

## 0. 技術スタック（更新版）

MVP実装の技術スタックを以下のように更新します：

### フロントエンド
- **フレームワーク**: Next.js 14+（TypeScript）
- **言語**: TypeScript（型安全性重視）
- **スタイリング**: Tailwind CSS
- **状態管理**: React Context + Zustand（シンプル）
- **パッケージマネージャー**: npm / yarn / pnpm

### ゲームロジック
- **実行環境**: ブラウザ（JavaScript/TypeScript）
- **永続化**: localStorage（セッション情報）
- **外部依存**: なし（DB/サーバーなし）

### 開発環境
- **バージョン管理**: Git
- **テスト**: Jest + React Testing Library
- **Linter**: ESLint + Prettier
- **デプロイ**: Vercel / GitHub Pages

---

## 1. プロジェクト初期化（T1-Initialize）

### 目的
Next.js + TypeScript + Tailwind CSS の開発環境を構築し、プロジェクト基盤を完成させる。

### スコープ
- Next.js プロジェクト作成
- TypeScript 基本設定
- Tailwind CSS セットアップ
- ESLint / Prettier 設定
- 基本的なフォルダ構成確立
- 環境変数・設定ファイル準備

### タスク分解

#### T1-1: Next.js プロジェクト作成
```
$ npx create-next-app@latest fastfold-omaha \
  --typescript \
  --tailwind \
  --use-npm
```

**成果物**
- `package.json`（依存パッケージ記載）
- `tsconfig.json`（TypeScript設定）
- `tailwind.config.ts`（Tailwind設定）
- `next.config.ts`（Next.js設定）

**完了条件**
- `npm run dev` で http://localhost:3000 が起動
- TypeScript コンパイルエラーなし
- 基本的なNext.jsアプリケーション動作

---

#### T1-2: フォルダ構成・ディレクトリ設計
```
fastfold-omaha/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── Table/
│   │   ├── ActionPanel/
│   │   └── ...
│   ├── lib/
│   │   ├── game/
│   │   │   ├── Card.ts
│   │   │   ├── Deck.ts
│   │   │   ├── HandEvaluator.ts
│   │   │   ├── BotEngine.ts
│   │   │   ├── TableEngine.ts
│   │   │   └── types.ts
│   │   ├── state/
│   │   │   └── store.ts (Zustand)
│   │   └── utils/
│   ├── hooks/
│   ├── types/
│   └── styles/
├── public/
├── tests/
│   ├── unit/
│   └── integration/
└── docs/
```

**完了条件**
- フォルダ構成確立
- 各ファイル作成可能状態
- TypeScript パスエイリアス設定完了（`@/lib`, `@/components` など）

---

#### T1-3: ESLint / Prettier 設定
```
npm install --save-dev eslint prettier eslint-config-next
```

**成果物**
- `.eslintrc.json`
- `.prettierrc`
- `.prettierignore`

**完了条件**
- `npm run lint` 実行可能
- `npm run format` で自動整形実行可能
- GitHub Actions で自動チェック設定（後で）

---

#### T1-4: 基本的なテスト環境セットアップ
```
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @types/jest
```

**成果物**
- `jest.config.ts`
- サンプルテストファイル（`__tests__/` フォルダ）

**完了条件**
- `npm run test` で実行可能
- サンプルテスト成功

---

#### T1-5: 環境変数・設定ファイル
```
.env.local
- (必要に応じて)
```

**成果物**
- `.env.local`（ローカル環境変数）
- `next.config.ts`（環境に応じた設定）

**完了条件**
- 開発・本番環境切り替え準備

---

### 依存関係
なし（最初のタスク）

### 完了条件
- プロジェクト起動・開発サーバー動作
- TypeScript / ESLint / Prettier 全て動作
- フォルダ構成確立
- テスト環境準備完了

### テスト条件
- `npm run dev` 起動確認
- `npm run lint` 実行確認
- `npm run test` 実行確認
- VS Code TypeScript インテリセンス動作確認

---

## 2. Cardモデル（T2-Card）

### 目的
Omahaゲームで使用するカード表現を定義し、ランク・スーツの操作を標準化する。

### スコープ
- Card 型定義（rank, suit）
- カード定数（全52枚）
- カード操作ユーティリティ（ディスプレイ文字列、比較など）
- CardPool（デッキ用）

### タスク分解

#### T2-1: Card 型定義と定数
**ファイル**: `src/lib/game/types.ts`

```typescript
// ランク定義 (0-12 = 2-A)
export const RANK_VALUES = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8,
  'J': 9, 'Q': 10, 'K': 11, 'A': 12
} as const;

// スーツ定義 (0-3 = ♠♥♦♣)
export const SUIT_VALUES = {
  'spades': 0, 'hearts': 1, 'diamonds': 2, 'clubs': 3
} as const;

// Card インターフェース
export interface Card {
  rank: number;        // 0-12
  suit: number;        // 0-3
  display: string;     // "As", "Kh", "10d" など
}

// 全52枚定数
export const ALL_CARDS: Card[] = [
  // 生成ロジック
];
```

**完了条件**
- Card 型定義完了
- 定数 RANK_VALUES, SUIT_VALUES 定義
- 全52枚 ALL_CARDS 生成
- TypeScript コンパイルエラーなし

**テスト条件**
- `ALL_CARDS.length === 52`
- 各カードが一意（重複なし）
- ランク・スーツが正確な範囲

---

#### T2-2: Card ユーティリティ関数
**ファイル**: `src/lib/game/Card.ts`

```typescript
export class CardUtil {
  // 文字列からCard作成
  static fromString(str: string): Card { ... }
  
  // Cardを文字列に変換
  static toString(card: Card): string { ... }
  
  // ランク取得（ユーザーフレンドリー）
  static getRankName(rank: number): string { ... }
  
  // スーツ取得（ユーザーフレンドリー）
  static getSuitName(suit: number): string { ... }
  
  // 2枚のカード比較（ハンド内の順序決定用）
  static compare(a: Card, b: Card): number { ... }
  
  // カードの視覚的表現（HTMLで使用）
  static getEmoji(card: Card): string { ... }
}
```

**完了条件**
- 全ユーティリティ関数実装
- TypeScript型チェック完全

**テスト条件**
- `CardUtil.fromString("As")` → Card(12, 0)
- `CardUtil.toString(...)` でラウンドトリップ可能
- Emoji生成正確

---

### 依存関係
- T1-4: テスト環境（テスト実行用）

### 完了条件
- Card型とユーティリティ実装完了
- 全ユーティリティのテストケース成功

### テスト条件
- ユーティリティ関数テスト（15+ TC）
  - fromString/toString ラウンドトリップ
  - ランク・スーツ名取得
  - 比較ロジック

---

## 3. Deckモデル（T3-Deck）

### 目的
ゲーム用デッキを管理し、カードシャッフル・配布機能を実装する。

### スコープ
- Deck クラス（52枚管理）
- シャッフルアルゴリズム（Fisher-Yates）
- カード配布（dealCards）
- デッキリセット

### タスク分解

#### T3-1: Deck クラス実装
**ファイル**: `src/lib/game/Deck.ts`

```typescript
export class Deck {
  private cards: Card[];
  private discarded: Card[];
  
  constructor() {
    this.reset();
  }
  
  // デッキをリセット
  reset(): void {
    this.cards = [...ALL_CARDS];
    this.discarded = [];
  }
  
  // Fisher-Yates シャッフル
  shuffle(): void { ... }
  
  // n枚のカード配布
  dealCards(count: number): Card[] { ... }
  
  // 残りカード枚数
  getRemainingCount(): number { ... }
  
  // デッキが再シャッフル必要か
  needsShuffle(): boolean { ... }
}
```

**完了条件**
- Deck クラス実装完了
- シャッフル・配布動作確認
- TypeScript 型チェック完全

**テスト条件**
- シャッフル均一性テスト
- 配布カードが正確に削除される
- 残りカード数計算正確

---

#### T3-2: Deckシャッフル均一性テスト
**テスト**: `tests/unit/Deck.test.ts`

```typescript
describe('Deck Shuffle Uniformity', () => {
  it('should shuffle cards uniformly', () => {
    // Fisher-Yates正確性確認
    // 複数回シャッフルで重複がないこと
  });
  
  it('should deal exact number of cards', () => {
    const deck = new Deck();
    deck.shuffle();
    const cards = deck.dealCards(5);
    expect(cards.length).toBe(5);
  });
  
  it('should not deal duplicate cards', () => {
    // 配布カードが重複していないこと
  });
});
```

**完了条件**
- 全テストケース成功

---

### 依存関係
- T2-1, T2-2: Card型・ユーティリティ

### 完了条件
- Deck クラス実装・テスト完了
- シャッフル均一性確認

### テスト条件
- ユニットテスト（10+ TC）
  - 初期化
  - シャッフル
  - 配布
  - リセット

---

## 4. Omaha Hand Evaluator（T4-HandEvaluator）

### 目的
ホールカード4枚 + ボード5枚から、Omahaルール（必ず2+3）に従って最強の5カードハンドを評価する。

### スコープ
- 60通り組み合わせ生成
- 各組み合わせの5カードハンド評価
- 10ハンドランク判定（RF/SF/4K/FH/F/S/3K/TP/1P/HC）
- キッカー比較
- 最強ハンド選択

### タスク分解

#### T4-1: HandRank 型定義
**ファイル**: `src/lib/game/types.ts`

```typescript
// ハンドランク定義
export const HAND_RANKS = {
  ROYAL_FLUSH: 10,
  STRAIGHT_FLUSH: 9,
  FOUR_OF_A_KIND: 8,
  FULL_HOUSE: 7,
  FLUSH: 6,
  STRAIGHT: 5,
  THREE_OF_A_KIND: 4,
  TWO_PAIR: 3,
  ONE_PAIR: 2,
  HIGH_CARD: 1
} as const;

export interface HandRank {
  rankValue: number;           // 1-10
  rankName: string;            // "Pair", "Flush" など
  kickers: number[];           // キッカー配列
  composition: {
    holeUsed: Card[];         // 使用ホール2枚
    boardUsed: Card[];        // 使用ボード3枚
  };
  finalHand: Card[];          // 最終5枚
}

export interface Combination {
  holeCards: Card[];          // 2枚
  boardCards: Card[];         // 3枚
  finalHand: Card[];          // 5枚
}
```

**完了条件**
- 型定義完了
- TypeScript 定義ファイル確立

---

#### T4-2: 組み合わせ生成アルゴリズム
**ファイル**: `src/lib/game/HandEvaluator.ts`

```typescript
export class CombinationGenerator {
  // ホール2枚選択（C(4,2) = 6通り）
  static generateHoleCombinations(holeCards: Card[]): Card[][] { ... }
  
  // ボード3枚選択（C(5,3) = 10通り）
  static generateBoardCombinations(boardCards: Card[]): Card[][] { ... }
  
  // 全60通り組み合わせ生成
  static generateAllCombinations(
    holeCards: Card[],
    boardCards: Card[]
  ): Combination[] { ... }
}
```

**完了条件**
- 組み合わせ生成ロジック実装
- 全60通り正確に生成確認

**テスト条件**
- `generateAllCombinations().length === 60`
- 各組み合わせが一意
- ホール2枚・ボード3枚構成確認

---

#### T4-3: 5カードハンド判定エンジン
**ファイル**: `src/lib/game/HandEvaluator.ts`

```typescript
export class HandJudge {
  private ranks: number[];  // 5カードのランク
  private suits: number[];  // 5カードのスーツ
  
  constructor(cards: Card[]) {
    if (cards.length !== 5) throw new Error('Must be 5 cards');
    this.ranks = cards.map(c => c.rank).sort((a, b) => a - b);
    this.suits = cards.map(c => c.suit);
  }
  
  // 各判定メソッド
  isRoyalFlush(): boolean { ... }
  isStraightFlush(): boolean { ... }
  isFourOfAKind(): boolean { ... }
  isFullHouse(): boolean { ... }
  isFlush(): boolean { ... }
  isStraight(): boolean { ... }
  isThreeOfAKind(): boolean { ... }
  isTwoPair(): boolean { ... }
  isOnePair(): boolean { ... }
  
  // メインの判定関数
  evaluate(): HandRank { ... }
}
```

**完了条件**
- 全判定メソッド実装
- キッカー抽出ロジック実装

**テスト条件**
- 各ハンドランク判定テスト（60+ TC）
  - Royal Flush: 5 TC
  - Straight Flush: 8 TC
  - Four of a Kind: 5 TC
  - Full House: 8 TC
  - Flush: 8 TC
  - Straight: 8 TC （Wheel含む）
  - Three of a Kind: 5 TC
  - Two Pair: 8 TC
  - One Pair: 8 TC
  - High Card: 5 TC

---

#### T4-4: ハンド比較・最強選択
**ファイル**: `src/lib/game/HandEvaluator.ts`

```typescript
export class HandComparator {
  // 2つのハンドを比較
  static compare(hand1: HandRank, hand2: HandRank): number {
    // 戻り値: 1 = hand1が強い, -1 = hand2が強い, 0 = 同じ
  }
  
  // 複数ハンドから最強を選択
  static findBest(hands: HandRank[]): HandRank { ... }
  
  // 複数ハンドからトップを抽出（分割ポット用）
  static findBestPlayers(hands: HandRank[]): HandRank[] { ... }
}
```

**完了条件**
- 比較ロジック実装
- 最強選択ロジック実装

**テスト条件**
- ハンド比較テスト（15+ TC）
  - 異なるランク比較
  - 同一ランク・異なるキッカー比較

---

#### T4-5: HandEvaluator メイン関数
**ファイル**: `src/lib/game/HandEvaluator.ts`

```typescript
export class HandEvaluator {
  static evaluateOmahaHand(
    holeCards: Card[],
    boardCards: Card[]
  ): HandRank {
    // 入力検証
    if (holeCards.length !== 4 || boardCards.length !== 5) {
      throw new Error('Invalid card count');
    }
    
    // 60通り組み合わせ生成
    const combinations = CombinationGenerator.generateAllCombinations(
      holeCards,
      boardCards
    );
    
    // 各組み合わせを評価
    const evaluatedHands = combinations.map(combo => {
      const judge = new HandJudge(combo.finalHand);
      return judge.evaluate();
    });
    
    // 最強ハンド選択
    return HandComparator.findBest(evaluatedHands);
  }
}
```

**完了条件**
- 全フロー実装・テスト完了

**テスト条件**
- エンドツーエンドテスト（30+ TC）
  - 設計資料の100 TCから主要30個
  - Royal Flush含む全ランク
  - エッジケース（Wheel, 複雑な手など）

---

### 依存関係
- T2-1, T2-2: Card型
- T1-4: テスト環境

### 完了条件
- 全100+ テストケース成功
- 60通り評価の正確性確認

### テスト条件
- ユニットテスト（100+ TC）
  - 組み合わせ生成テスト
  - ハンド判定テスト
  - キッカー比較テスト
  - エンドツーエンドテスト

---

## 5. Bot Engine（T5-BotEngine）

### 目的
ルールベースの基本的なBot行動選択エンジンを実装し、5体のBotが遊べるようにする。

### スコープ
- Bot プレイヤー型定義
- ハンド強度評価（簡易版）
- アクション選択ロジック（Fold/Check/Call/Raise）
- ポジション別戦略（基本）
- 複数Bot インスタンス管理

### タスク分解

#### T5-1: Bot プレイヤー型定義
**ファイル**: `src/lib/game/types.ts`

```typescript
export interface BotProfile {
  botId: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';  // MVP: easyのみ
  position: number;  // 0-5
  balance: number;
  status: PlayerStatus;
}

export type PlayerStatus = 
  | 'idle'
  | 'waiting'
  | 'assigned'
  | 'in_hand'
  | 'folded'
  | 'all_in'
  | 'excluded';
```

**完了条件**
- Bot 型定義完了

---

#### T5-2: ハンド強度評価（簡易版）
**ファイル**: `src/lib/game/BotEngine.ts`

```typescript
export class HandStrengthEvaluator {
  // 手札強度を0-1の値で返す（簡易版）
  // プリフロップのみ対応（ボードがない場合）
  static evaluatePreflop(
    holeCards: Card[],
    position: number  // ポジション
  ): number {
    // ランク基準の簡単な判定
    // AAA: 0.95, AKA: 0.90, KKK: 0.85, ...
    // ポジション補正
  }
  
  // ボード後の強度評価（簡易版）
  static evaluatePostflop(
    holeCards: Card[],
    boardCards: Card[],
    evaluatedHand: HandRank
  ): number {
    // ハンドランク基準
    // Pair以上: 0.6+, High Card: 0.1-
  }
}
```

**完了条件**
- 簡易版評価ロジック実装

**テスト条件**
- 強度評価テスト（10+ TC）
  - 高強度ハンド（AA, KK など）
  - 低強度ハンド（23o など）

---

#### T5-3: アクション選択ロジック
**ファイル**: `src/lib/game/BotEngine.ts`

```typescript
export class BotActionSelector {
  static chooseAction(
    botProfile: BotProfile,
    gameState: {
      handStrength: number;
      potSize: number;
      toBet: number;
      street: 'preflop' | 'flop' | 'turn' | 'river';
      position: number;
    }
  ): BotAction {
    // action: 'fold' | 'check' | 'call' | 'raise'
    // raiseAmount?: number
    
    // 簡単なルール：
    // - handStrength < 0.2 && toBet > 2BB → fold
    // - handStrength < 0.4 && toBet > 4BB → fold
    // - handStrength >= 0.6 → call or raise
  }
  
  static calculateRaiseAmount(
    botProfile: BotProfile,
    gameState: GameState,
    handStrength: number
  ): number {
    // Pot Limit ベッティング内で raise額計算
    // handStrength * maxPotBet
  }
}
```

**完了条件**
- アクション選択ロジック実装

**テスト条件**
- アクション選択テスト（15+ TC）
  - 強いハンド → call/raise
  - 弱いハンド → fold
  - ストリート別判定

---

#### T5-4: Bot インスタンス管理
**ファイル**: `src/lib/game/BotEngine.ts`

```typescript
export class BotManager {
  private bots: Map<string, BotProfile> = new Map();
  
  constructor(count: number = 5) {
    this.initializeBots(count);
  }
  
  private initializeBots(count: number): void {
    for (let i = 0; i < count; i++) {
      const bot: BotProfile = {
        botId: `bot_${i}`,
        name: `Bot ${i + 1}`,
        difficulty: 'easy',
        position: i,
        balance: 10000,  // 初期残高
        status: 'idle'
      };
      this.bots.set(bot.botId, bot);
    }
  }
  
  getBotByPosition(position: number): BotProfile { ... }
  
  getBots(): BotProfile[] { ... }
  
  updateBotBalance(botId: string, delta: number): void { ... }
}
```

**完了条件**
- Bot 管理クラス実装

---

### 依存関係
- T4: Hand Evaluator（ハンド評価用）
- T2: Card型

### 完了条件
- Bot Engine実装・テスト完了
- 5体Bot同時管理可能

### テスト条件
- ユニットテスト（30+ TC）
  - ハンド強度評価
  - アクション選択
  - Bot管理

---

## 6. Table Engine（T6-TableEngine）

### 目的
1テーブル（6-max）の完全なゲーム進行を管理し、プリフロップ～リバーまでの流れを実装する。

### スコープ
- Table 状態管理
- プレイヤー座席管理
- ブラインド・ディーラーボタン
- ベッティングラウンド（4ラウンド）
- ポット計算
- 勝敗判定・ポット分配
- ハンド結果

### タスク分解

#### T6-1: Table 型定義・初期化
**ファイル**: `src/lib/game/types.ts`

```typescript
export interface TableSeat {
  position: number;           // 0-5
  playerId: string;          // プレイヤーID (human or bot)
  holeCards: Card[];         // 4枚 (Omaha)
  status: 'active' | 'folded' | 'all_in' | 'empty';
  balance: number;           // 残高
  bet: number;               // 現ベット額
  totalInvested: number;     // ハンド累積投資
}

export interface TableState {
  tableId: string;
  seats: TableSeat[];        // 6席
  dealerPosition: number;     // 0-5
  smallBlindPosition: number;
  bigBlindPosition: number;
  currentPlayerPosition: number;
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  pot: number;
  sidePots: SidePot[];
  communityCards: Card[];    // 0-5枚
  bettingRound: BettingRound;
  handId: string;
  startedAt: number;
}

export interface BettingRound {
  currentBet: number;        // ラウンド内の現在のベット額
  activePlayers: number[];   // アクティブなプレイヤーのposition
  actionCount: number;       // アクション数
}
```

**完了条件**
- 型定義完了

---

#### T6-2: Table クラス・初期化ロジック
**ファイル**: `src/lib/game/TableEngine.ts`

```typescript
export class Table {
  private state: TableState;
  private deck: Deck;
  
  constructor(tableId: string, players: PlayerProfile[]) {
    this.state = this.initializeTable(tableId, players);
    this.deck = new Deck();
  }
  
  private initializeTable(tableId: string, players: PlayerProfile[]): TableState {
    // テーブル初期化
    // - 6席に players を配置
    // - ディーラーボタン・ブラインド計算
    // - 初期残高・ベット
  }
  
  // ハンド開始
  startNewHand(): void {
    this.rotateDealer();
    this.setBlindPositions();
    this.dealCards();
    this.startPreflop();
  }
  
  // カード配布（プリフロップ）
  private dealCards(): void {
    this.deck.shuffle();
    for (let seat of this.state.seats) {
      seat.holeCards = this.deck.dealCards(4);
    }
  }
}
```

**完了条件**
- Table 初期化ロジック実装

---

#### T6-3: ベッティングラウンド実装
**ファイル**: `src/lib/game/TableEngine.ts`

```typescript
export class BettingRound {
  private table: Table;
  
  // アクション処理
  processAction(playerPosition: number, action: 'fold' | 'check' | 'call' | 'raise', raiseAmount?: number): void {
    // アクション有効性チェック
    // プレイヤー残高・ベット額検証
    // Pot Limit ベッティング制約チェック
    // 状態更新
  }
  
  // 次プレイヤーに手番
  advanceToNextPlayer(): void { ... }
  
  // ラウンド完了判定
  isRoundComplete(): boolean { ... }
  
  // ストリート進行
  advanceToNextStreet(): void {
    // フロップ3枚配布
    // ターン1枚配布
    // リバー1枚配布
  }
}
```

**完了条件**
- ベッティングラウンド全ロジック実装

**テスト条件**
- アクション有効性テスト（20+ TC）
  - 合法的ベット
  - 無効なベット
  - Pot Limit 制約

---

#### T6-4: ポット計算
**ファイル**: `src/lib/game/TableEngine.ts`

```typescript
export class PotCalculator {
  // ポット計算
  static calculatePot(bets: number[]): number { ... }
  
  // サイドポット計算（オールイン時）
  static calculateSidePots(
    bets: number[],
    balances: number[]
  ): SidePot[] { ... }
  
  // ポット分配（複数勝者対応）
  static distributePot(
    pot: number,
    winners: string[],
    sidePots: SidePot[]
  ): Map<string, number> { ... }
}
```

**完了条件**
- ポット計算ロジック実装

**テスト条件**
- ポット計算テスト（15+ TC）
  - 通常ポット
  - サイドポット
  - 複数勝者分配

---

#### T6-5: 勝敗判定・ハンド完了
**ファイル**: `src/lib/game/TableEngine.ts`

```typescript
export class Showdown {
  // Showdown 実行
  static executeShowdown(
    table: Table,
    activePlayers: PlayerProfile[]
  ): HandResult {
    // 各プレイヤーのハンド評価
    const hands = activePlayers.map(player => ({
      playerId: player.id,
      hand: HandEvaluator.evaluateOmahaHand(
        player.holeCards,
        table.state.communityCards
      )
    }));
    
    // 勝者決定
    const bestHands = hands.filter(h => 
      h.hand.rankValue === Math.max(...hands.map(x => x.hand.rankValue))
    );
    
    // ポット分配
    const distribution = PotCalculator.distributePot(
      table.state.pot,
      bestHands.map(h => h.playerId),
      table.state.sidePots
    );
    
    return {
      winners: bestHands.map(h => h.playerId),
      distribution,
      handDetails: hands
    };
  }
}
```

**完了条件**
- Showdown ロジック実装

**テスト条件**
- Showdown テスト（10+ TC）
  - 単独勝者
  - 複数勝者
  - オールイン

---

#### T6-6: Table 統合テスト
**テスト**: `tests/integration/Table.integration.test.ts`

```typescript
describe('Table Gameplay', () => {
  it('should complete a full hand from preflop to showdown', () => {
    // シナリオ: 6人テーブル、複数ラウンド、ハンド完了
  });
  
  it('should handle all-in scenario', () => {
    // シナリオ: プレイヤーがオールイン
  });
  
  it('should calculate pots correctly with side pots', () => {
    // シナリオ: 複数オールイン、サイドポット
  });
});
```

**完了条件**
- 統合テスト全て成功

---

### 依存関係
- T2, T3: Card・Deck
- T4: HandEvaluator
- T5: Bot Engine
- T1-4: テスト環境

### 完了条件
- Table Engine完全実装
- 1テーブル完全なゲーム進行可能
- 統合テスト成功

### テスト条件
- ユニットテスト（50+ TC）
  - ベッティング・アクション
  - ポット計算
  - Showdown
- 統合テスト（10+ TC）
  - 完全なハンド進行
  - エッジケース

---

## 7. UI コンポーネント（T7-UI）

### 目的
Next.js + React + Tailwind CSSでシンプルで機能的なUIを構築し、プレイヤーがゲームを操作できるようにする。

### スコープ
- テーブルビュー（カード表示、プレイヤー配置）
- プレイヤーステータスパネル（残高、アクション状態）
- アクションボタン群（Fold, Check/Call, Raise）
- ゲーム状態表示（street, pot, blinds）
- ハンド結果表示
- ゲーム開始・設定画面

### タスク分解

#### T7-1: Layout・基本スタイル
**ファイル**: `src/app/layout.tsx`, `src/styles/globals.css`

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-100">
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
```

**成果物**
- Global styles（Tailwind CSS）
- レスポンシブレイアウト

**完了条件**
- Tailwind CSS 完全統合
- 基本的なレスポンシブ対応

---

#### T7-2: Table コンポーネント
**ファイル**: `src/components/Table/Table.tsx`

```typescript
export interface TableProps {
  gameState: GameState;
  onPlayerAction: (action: PlayerAction) => void;
}

export function Table({ gameState, onPlayerAction }: TableProps) {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="relative w-96 h-64 border-8 border-green-700 rounded-full bg-green-900">
        {/* ボード表示 */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <CommunityCards cards={gameState.boardCards} />
        </div>
        
        {/* 6席のプレイヤー */}
        {gameState.seats.map((seat, idx) => (
          <PlayerSeat
            key={idx}
            seat={seat}
            isCurrentPlayer={idx === gameState.currentPlayerPosition}
          />
        ))}
        
        {/* ポット表示 */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <PotDisplay pot={gameState.pot} />
        </div>
      </div>
    </div>
  );
}
```

**完了条件**
- Table コンポーネント実装
- 基本的なレイアウト確立

---

#### T7-3: PlayerSeat・CardDisplay コンポーネント
**ファイル**: `src/components/Table/PlayerSeat.tsx`

```typescript
export function PlayerSeat({ seat, isCurrentPlayer }: PlayerSeatProps) {
  return (
    <div className={`absolute ${getPositionStyle(seat.position)}`}>
      {/* プレイヤー名・残高 */}
      <div className="text-white font-bold">{seat.playerId}</div>
      <div className="text-yellow-300">${seat.balance}</div>
      
      {/* ホールカード */}
      {seat.holeCards?.map((card, idx) => (
        <CardDisplay key={idx} card={card} />
      ))}
      
      {/* ステータス表示 */}
      {isCurrentPlayer && <div className="animate-pulse">▶</div>}
    </div>
  );
}

export function CardDisplay({ card }: { card: Card }) {
  return (
    <div className="w-12 h-16 border border-white rounded bg-white text-black text-center">
      {card.display}
    </div>
  );
}
```

**完了条件**
- プレイヤーシート表示
- カード表示

---

#### T7-4: ActionPanel コンポーネント
**ファイル**: `src/components/ActionPanel/ActionPanel.tsx`

```typescript
export function ActionPanel({
  validActions,
  onAction,
  toBet,
  playerBalance,
}: ActionPanelProps) {
  const [raiseAmount, setRaiseAmount] = React.useState(0);
  
  return (
    <div className="flex gap-4">
      {validActions.includes('fold') && (
        <button
          onClick={() => onAction({ type: 'fold' })}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Fold
        </button>
      )}
      
      {validActions.includes('check') && (
        <button
          onClick={() => onAction({ type: 'check' })}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Check
        </button>
      )}
      
      {validActions.includes('call') && (
        <button
          onClick={() => onAction({ type: 'call' })}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Call {toBet}
        </button>
      )}
      
      {validActions.includes('raise') && (
        <div className="flex gap-2">
          <input
            type="number"
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="border px-2 py-1 w-20"
          />
          <button
            onClick={() => onAction({ type: 'raise', amount: raiseAmount })}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Raise
          </button>
        </div>
      )}
    </div>
  );
}
```

**完了条件**
- アクションパネル実装
- ボタン動作

---

#### T7-5: GameState・管理コンポーネント
**ファイル**: `src/components/Game/Game.tsx`

```typescript
export function Game() {
  const [gameState, setGameState] = React.useState<GameState>(initializeGame());
  
  const handlePlayerAction = (action: PlayerAction) => {
    // アクション処理
    const newGameState = processAction(gameState, action);
    setGameState(newGameState);
    
    // 次のアクション（Botなど）
    // ...
  };
  
  return (
    <div>
      <Table gameState={gameState} onPlayerAction={handlePlayerAction} />
      <ActionPanel
        validActions={getValidActions(gameState)}
        onAction={handlePlayerAction}
        toBet={gameState.currentBet}
        playerBalance={getCurrentPlayerBalance(gameState)}
      />
      <GameInfo gameState={gameState} />
    </div>
  );
}
```

**完了条件**
- ゲーム管理コンポーネント実装

---

#### T7-6: ゲーム設定・スタート画面
**ファイル**: `src/app/page.tsx`

```typescript
export default function Home() {
  const [gameStarted, setGameStarted] = React.useState(false);
  const [config, setConfig] = React.useState({
    bigBlind: 2,
    smallBlind: 1,
    initialStack: 10000,
  });
  
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold mb-8">Fast Fold Omaha</h1>
        <div className="flex flex-col gap-4">
          <label>
            Small Blind: 
            <input type="number" value={config.smallBlind} />
          </label>
          <label>
            Big Blind: 
            <input type="number" value={config.bigBlind} />
          </label>
          <button
            onClick={() => setGameStarted(true)}
            className="bg-green-500 text-white px-8 py-3 rounded"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }
  
  return <Game />;
}
```

**完了条件**
- ゲーム開始画面実装

---

#### T7-7: Zustand 状態管理
**ファイル**: `src/lib/state/store.ts`

```typescript
import { create } from 'zustand';

interface GameStore {
  gameState: GameState | null;
  initializeGame: (config: GameConfig) => void;
  updateGameState: (newState: GameState) => void;
  processPlayerAction: (action: PlayerAction) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  initializeGame: (config) => {
    // ゲーム初期化
  },
  updateGameState: (newState) => {
    set({ gameState: newState });
  },
  processPlayerAction: (action) => {
    // アクション処理
  },
}));
```

**完了条件**
- Zustand ストア実装

---

#### T7-8: UI 統合テスト
**テスト**: `tests/integration/UI.integration.test.ts`

```typescript
describe('Game UI', () => {
  it('should render game board with 6 players', () => {
    render(<Game />);
    // テーブルとプレイヤーが表示されることを確認
  });
  
  it('should enable/disable action buttons based on valid actions', () => {
    render(<Game />);
    // 有効なアクションボタンのみ有効化
  });
  
  it('should update player balance after action', () => {
    // アクション後、残高が更新されることを確認
  });
});
```

**完了条件**
- UI テスト成功

---

### 依存関係
- T1: Next.js プロジェクト
- T6: Table Engine（ゲームロジック）
- T5: Bot Engine（Bot表示・動作）

### 完了条件
- UI コンポーネント全て実装
- ゲーム画面で1ハンド完全プレイ可能

### テスト条件
- ユニットテスト（20+ TC）
  - コンポーネント描画
  - ボタン状態
- 統合テスト（10+ TC）
  - 完全なゲーム画面
  - ユーザーインタラクション

---

## 8. Phase 1 マイルストーン

| # | タスク | 依存 | 工数 | 状態 |
|----|--------|------|------|------|
| T1 | プロジェクト初期化 | - | 2-3h | 🔴 未開始 |
| T2 | Card モデル | T1 | 4-6h | 🔴 未開始 |
| T3 | Deck モデル | T2 | 3-4h | 🔴 未開始 |
| T4 | Hand Evaluator | T2, T1 | 20-30h | 🔴 未開始 |
| T5 | Bot Engine | T4, T2 | 10-15h | 🔴 未開始 |
| T6 | Table Engine | T2, T3, T4, T5 | 25-35h | 🔴 未開始 |
| T7 | UI Components | T1, T6, T5 | 20-25h | 🔴 未開始 |
| **合計** | | | **84-118h** | |

**推定**: 1開発者（フルタイム）で 2-3週間

---

## 9. Phase 1 成功基準

✓ **ゲームロジック**
- 60通りハンド評価が正確
- Pot Limit ベッティング制約が適用
- プリフロップ～リバーまで完全に進行
- ポット計算・勝敗判定が正確

✓ **UI/UX**
- ブラウザで完全にプレイ可能
- 人間プレイヤーがアクションを選択可能
- ゲーム状態が明確に表示
- 1ハンド完了～次ハンド開始を繰り返し可能

✓ **テスト**
- 全ユニットテスト成功（150+ TC）
- 統合テスト成功（30+ TC）
- エッジケース対応

✓ **パフォーマンス**
- 1ハンド完了 < 30秒
- UI応答性 < 100ms

---

## 10. Phase 1 後の進行

**Phase 2 準備**: Fast Fold Queue実装
- PlayerPool 管理
- FIFOキュー（waitingQueue）
- テーブル再配置・同一ハンド再参加禁止
- セッション管理（localStorage）

**テスト駆動**: Hand Evaluator テストから開始
- 100+ テストケースで仕様確認
- 実装→テスト→リファクタリング

---

## まとめ

Phase 1 は、**基本的に遊べる1テーブルOmahaゲーム**を完成させることが目標です。

- **T1～T7**: 7つの主要タスク
- **工数**: 84-118時間（2-3週間）
- **成功基準**: 人間 vs Bot 5体で完全にプレイ可能

各タスクは依存関係を明確にし、テスト駆動で進行します。
