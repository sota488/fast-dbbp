# システムアーキテクチャ

## 1. 目的
Fast Fold Omaha Practiceのアーキテクチャは、ブラウザベースでPlay MoneyのPot Limit Omaha練習体験を実現し、Fast Fold形式の高速ハンド切り替えと将来的なBot対戦をサポートすることを目的とします。

## 2. 全体構成

### 2.1 フロントエンド
- ブラウザで動作するUIと操作管理
- ゲーム状態の表示
- プレイヤー入力（チェック、コール、レイズ、フォールド）
- Fast Fold切り替え体験の提示
- ローカルでプレイ可能なシングルクライアント動作

### 2.2 ゲームエンジン
- Pot Limit Omahaルールの実装
- 6-maxテーブルとプレイヤー管理
- ハンド進行（プリフロップ／フロップ／ターン／リバー）
- ベッティングラウンド、ポット計算、勝敗判定
- Omahaの5枚ベストハンド判定

### 2.3 Fast Fold Queue
- プレイヤーをテーブルに割り当てる高速キュー／プール
- フォールド後の即時テーブル再配置
- 同一ハンドへの再参加禁止を保証
- 1人プレイ時はBot／ダミー席付きのテーブルを生成

### 2.4 Botレイヤー（将来）
- Bot行動ルールとAIインターフェース
- Botを混在できるプレイヤー管理
- Botごとの戦略・強さパラメータ

### 2.5 バックエンド（将来オプション）
- APIサーバー（ゲーム履歴、プレイヤーデータ、Bot管理）
- リアルタイム通信チャネル（Socket / WebSocket）
- 永続化データベース

## 3. システム境界
- 初期フェーズ: フロントエンド中心、状態管理とゲームロジックはクライアント内で完結
- 拡張フェーズ: バックエンドを追加し、複数クライアントやBot管理、セッション共有を可能にする

## 4. コンポーネント設計

### 4.1 UIコンポーネント
- テーブルビュー
- プレイヤーステータスパネル
- アクションボタン群
- ハンド履歴/通知ログ
- Fast Fold切り替えバナー

### 4.2 ゲーム状態管理
- テーブル状態: `TableState`
- プレイヤー状態: `PlayerState`
- ハンド状態: `HandState`
- キュー状態: `FastFoldQueueState`
- Bot状態: `BotState`

### 4.3 ルールエンジン
- デッキ、シャッフル、配牌
- Pot Limitベッティング制約
- ベット額検証とプリフロップ〜リバー進行
- 勝者判定とポット分配

### 4.4 Fast Foldプール管理
- アクティブテーブルのプール
- 待機プレイヤー用キュー
- 自動再割り当てロジック
- 無駄なく席を埋めるマッチング

### 4.5 Bot拡張ポイント
- Botは`Player`インターフェースを実装
- 行動決定は`chooseAction(tableState, handState)`で抽象化
- Bot生成／退席ロジックを既存プレイヤー管理に統合

## 5. 状態遷移図

```
[Idle] --> [Queued] : プレイヤー入場
[Queued] --> [AssignedToTable] : テーブル割り当て
[AssignedToTable] --> [WaitingForAction] : ディール後プレイヤーの行動待ち
[WaitingForAction] --> [Acted] : チェック/コール/レイズ/フォールド
[Acted] --> [ContinueRound] : ラウンド継続
[ContinueRound] --> [NextStreet] : フロップ/ターン/リバー進行
[ContinueRound] --> [Showdown] : 最終ラウンド後
[Showdown] --> [HandFinished] : 勝者決定とポット分配
[HandFinished] --> [Queued] : Fast Fold再割り当て（フォールド時は即時）
[HandFinished] --> [Idle] : セッション終了

[Acted] --フォールド--> [FastFoldTransition]
[FastFoldTransition] --> [Queued]
[Queued] --> [AssignedToTable] : 新しいテーブル/ハンドに再配置

[AssignedToTable] --> [AssignedToTable] : Botを含む6-maxテーブル完成
```

### 5.1 状態説明
- Idle: プレイヤーがまだゲームを開始していない状態
- Queued: Fast Foldマッチング用の待機キューに入っている状態
- AssignedToTable: テーブルに配置され、ディール準備中の状態
- WaitingForAction: プレイヤーのアクションを待機している状態
- Acted: プレイヤーがアクションを完了した状態
- ContinueRound: ベッティングラウンド継続中
- NextStreet: ストリート進行中（フロップ→ターン→リバー）
- Showdown: 最終的な勝敗判定を行う状態
- HandFinished: ハンド終了後、再割り当てまたはセッション終了
- FastFoldTransition: フォールド後、既存テーブルから高速に離脱し次テーブルへ移動する遷移状態

## 6. ブラウザベース設計のポイント
- UIとゲームロジックの分離: ルールエンジンは状態管理層に集約
- 1人でも練習可能: Botもしくはダミー空席を使って6-maxテーブルを維持
- Fast Fold体験: フォールド時の再配置を瞬時に処理し、待ち時間を最小化
- Play Money専用: 残高管理と統計は実装しやすいローカル保存から開始

## 7. 将来の拡張性
- サーバー側への移行: APIとWebSocketを追加して、実際のマルチクライアント対戦をサポート
- Botの学習・戦略追加: ボット行動ロジックを分離して種類を増やせる設計
- 複数テーブル/ルーム: Fast Foldプールを拡張して同時稼働テーブルを増加可能
