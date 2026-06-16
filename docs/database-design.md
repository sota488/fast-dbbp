# データベース設計

## 1. 目的
本設計は、Fast Fold Omaha Practiceの将来的なバックエンド対応および永続化を見越したデータ構造を定義します。初期段階ではブラウザのローカル状態でも運用可能とし、必要に応じてサーバー側データベースに移行できるようにします。

## 2. データモデル
### 2.1 プレイヤー (`Player`)
- `playerId`: string
- `displayName`: string
- `balance`: number
- `status`: enum(`Idle`, `Queued`, `Assigned`, `InHand`, `Folded`, `Finished`)
- `seat`: number | null
- `hand`: string[] // 4枚のカード
- `isBot`: boolean
- `botProfileId`: string | null
- `statistics`: {
  - `handsPlayed`: number
  - `handsWon`: number
  - `totalProfit`: number
}

### 2.2 テーブル (`Table`)
- `tableId`: string
- `seats`: number // 6
- `players`: Player[]
- `dealerPosition`: number
- `smallBlindPosition`: number
- `bigBlindPosition`: number
- `pot`: number
- `sidePots`: SidePot[]
- `board`: string[] // フロップ/ターン/リバーのカード
- `street`: enum(`Preflop`, `Flop`, `Turn`, `River`, `Showdown`, `Finished`)
- `bettingRound`: BettingRound
- `currentPlayerIndex`: number
- `communityCards`: string[]
- `handId`: string
- `isFastFoldTable`: boolean

### 2.3 ハンド (`Hand`)
- `handId`: string
- `tableId`: string
- `players`: string[] // playerIdリスト
- `deck`: string[]
- `board`: string[]
- `pot`: number
- `sidePots`: SidePot[]
- `street`: enum(`Preflop`, `Flop`, `Turn`, `River`, `Showdown`)
- `actions`: ActionLog[]
- `winnerIds`: string[]
- `results`: HandResult[]
- `startedAt`: datetime
- `endedAt`: datetime | null

### 2.4 Fast Foldキュー (`FastFoldQueue`)
- `queueId`: string
- `waitingPlayers`: string[] // playerIdのFIFOキュー
- `activeTableIds`: string[]
- `pendingAssignments`: Assignment[]

### 2.5 Botプロファイル (`BotProfile`)
- `botProfileId`: string
- `name`: string
- `skillLevel`: enum(`Beginner`, `Intermediate`, `Advanced`)
- `behavior`: string // ルールベース/確率ベースなど
- `strategyParams`: Record<string, any>
- `createdAt`: datetime

### 2.6 セッション／ユーザー設定 (`Session`)
- `sessionId`: string
- `playerId`: string
- `lastActiveAt`: datetime
- `preferredTheme`: string
- `practiceMode`: enum(`Solo`, `FastFold`)

## 3. 関係性
- `Player` は `Table` に所属し、`Hand` を共有する
- `Hand` は `Table` と紐づき、`Player` のアクション履歴を持つ
- `FastFoldQueue` は `Player` を待機・割り当てし、`Table` を生成または再利用する
- `BotProfile` は `Player` を拡張し、Botインスタンスを生成する

## 4. 画面遷移向けデータ構造
- テーブル一覧: `TableSummary[]`
- プレイヤーステータス: `PlayerStatus` と `QueueStatus`
- ハンド履歴: `HandLog[]`

## 5. キュー設計の詳細
### 5.1 同一ハンド再参加禁止
- `Hand` に参加した `playerId` は、該当 `handId` の終了まで `FastFoldQueue.waitingPlayers` に戻さない
- `Hand` 終了後に `playerId` を再度 `waitingPlayers` に追加
- クライアント側でも `handId` ごとの参加履歴を保持し、重複割り当てを防止

### 5.2 1人練習対応
- プレイヤーが単独入場した場合、Botを使って6-maxテーブルを埋める
- サーバー／クライアント内でBot席を生成し、必要数のBotインスタンスを追加
- `Table` と `Hand` はBotを含む形で通常通り扱う

### 5.3 Fast FoldとPlay Money管理
- `Player.balance` でPlay Moneyを管理
- `HandResult` に収益を記録し、`Player.statistics` を更新
- キュー割り当て後は `balance` を即時反映し、次のテーブルで継続

## 6. データベースの永続化レイヤー
### 6.1 レコードストア例
- `players`: プレイヤープロファイルと残高
- `tables`: アクティブ or 過去テーブル情報
- `hands`: ハンド履歴と結果
- `bots`: Botプロファイルと戦略
- `sessions`: プレイヤーセッション管理

### 6.2 参照モデル
- ノード内でローカル保存する場合は `localStorage` / `IndexedDB` を利用
- サーバー移行時は `players`, `hands`, `bots` をSQL/NoSQLテーブルにマッピング

## 7. 拡張のための設計方針
- データモデルは薄いエンティティとし、ゲームロジックで状態を計算
- `FastFoldQueue` は独立コンポーネントとして抽象化
- Bot用プロファイルを追加しやすいように `Player` に `isBot` と `botProfileId` を設ける
- `Hand` と `Table` を明確に区別して、同一ハンドへの再参加を禁止する
