# Fast Fold Queue 設計

## 1. 目的
Fast Fold Queueは、プレイヤープールを中心とした高速テーブル再配置機構です。プレイヤーがフォールド後に即座に新しい6-maxハンドへ移動でき、同一ハンドへの再参加を厳密に禁止しながら、1人プレイでもBotで席を埋めて常に6-maxゲームを実現します。

## 2. 核心設計
- **プレイヤープール中心**: テーブルではなく、プレイヤーの状態と遷移を管理する
- **FIFOキューベース**: 待機中のプレイヤーを先着順で処理
- **即時フォールド処理**: フォールド時に瞬時に次テーブル割り当てを実行
- **HandPool追跡**: 各プレイヤーがどのハンドに参加したかを厳密に記録し、再参加を防止
- **Botによる席補完**: 常に6席を埋め、1人プレイでもゲームが成立
- **ローカルファースト**: ブラウザ内でも動作する同期処理を優先、スケール時はサーバー移行

## 3. データ構造

### 3.1 PlayerPoolEntry
プレイヤープール内のプレイヤー状態
```
{
  playerId: string                    // ユニークなプレイヤーID
  playerType: "human" | "bot"         // プレイヤー種別
  status: PlayerStatus                // 現在の状態（後述）
  currentTableId: string | null       // 割り当てられたテーブルID
  currentHandId: string | null        // 現在参加中のハンドID
  participatedHandIds: Set<string>    // 参加済みハンドのセット（同一ハンド再参加禁止用）
  joinedAt: number                    // ミリ秒単位のタイムスタンプ
  botProfile?: BotProfile             // Bot情報（型がbotの場合）
  playStats: {
    balance: number                   // Play Money残高
    handsPlayed: number
    handsWon: number
    lastActivityAt: number
  }
}
```

### 3.2 FastFoldQueue
プレイヤープール全体を管理するキュー
```
{
  queueId: string
  playerPool: Map<string, PlayerPoolEntry>           // playerId -> 最新ステート
  waitingQueue: string[]                              // 待機中のplayerIdのFIFOキュー
  activeTableIds: Set<string>                         // 現在進行中のテーブルID
  completedTableIds: Set<string>                      // 完了したテーブルID
  handRegistry: Map<string, HandRecord>              // handId -> ハンド詳細
  transitionLog: TransitionLogEntry[]                // 状態遷移ログ（デバッグ用）
  lastAssignmentTime: number
  stats: {
    totalHandsProcessed: number
    totalPlayersJoined: number
    averageTableOccupancy: number
  }
}
```

### 3.3 HandRecord
ハンドの参加者と状態を厳密に追跡
```
{
  handId: string
  tableId: string
  status: "Preflop" | "Flop" | "Turn" | "River" | "Showdown" | "Completed"
  participants: {
    playerId: string
    seat: number
    initialStatus: "Active" | "Folded" | "AllIn"
    foldedAt?: number                  // フォールド時のミリ秒
    finalPosition?: "Winner" | "Loser" | "Split"
  }[]
  startedAt: number
  endedAt?: number
  communityCards?: string[]
}
```

### 3.4 PlayerStatus
プレイヤー状態の詳細
```
enum PlayerStatus {
  IDLE = "idle"                   // ゲーム外
  WAITING = "waiting"             // キューで待機中
  ASSIGNED = "assigned"           // テーブル割り当て完了、ディール準備
  IN_HAND = "in_hand"             // ハンド進行中（Action可能）
  FOLDED = "folded"               // フォールド済み（ハンド終了待ち）
  ALL_IN = "all_in"               // オールイン
  EXCLUDED = "excluded"           // セッション中断・除外
}
```

### 3.5 Table
テーブル実行状態
```
{
  tableId: string
  status: "WaitingForStart" | "InProgress" | "Completed"
  seats: TableSeat[]              // 6個のシート
  currentStreet: "Preflop" | "Flop" | "Turn" | "River" | "Showdown"
  handId: string
  pot: number
  communityCards: string[]
  startedAt: number
  endedAt?: number
}

interface TableSeat {
  position: number (0-5)
  playerId: string
  holeCards?: string[]
  status: "Active" | "Folded" | "AllIn" | "Empty"
  betAmount: number
}
```


## 4. Queueアルゴリズム

### 4.1 プレイヤー加入処理 (PlayerJoin)
```
function joinQueue(queue, playerId, playerType = "human"):
  // 既存プレイヤーチェック
  if playerId in queue.playerPool:
    if queue.playerPool[playerId].status != IDLE:
      return ERROR("Player already in queue")
  
  // 新規エントリ作成
  entry = {
    playerId: playerId,
    playerType: playerType,
    status: WAITING,
    currentTableId: null,
    currentHandId: null,
    participatedHandIds: Set()
  }
  
  queue.playerPool[playerId] = entry
  queue.waitingQueue.push(playerId)
  
  // テーブル再構成トリガー
  triggerTableReconfiguration(queue)
  return SUCCESS
```

### 4.2 テーブル割り当てアルゴリズム (AssignToTable)
```
function assignPlayersToTable(queue):
  // Botで席を埋める配置アルゴリズム
  // 1. 待機キューから最大6人を取り出す
  // 2. 不足分はBotで補完
  // 3. 同一ハンド再参加チェック
  
  seatCount = 6
  selectedPlayers = []
  
  // FIFO順に待機プレイヤーをチェック
  for playerId in queue.waitingQueue:
    entry = queue.playerPool[playerId]
    
    // 同一ハンド再参加チェック（複数テーブル間でも禁止）
    if not hasConflictingHand(entry, queue.activeTableIds):
      selectedPlayers.push(entry)
      if selectedPlayers.length == seatCount:
        break
  
  // Botで不足分を補完
  while selectedPlayers.length < seatCount:
    botEntry = createBotEntry()
    selectedPlayers.push(botEntry)
  
  // テーブル生成
  table = createTable(selectedPlayers)
  queue.activeTableIds.add(table.tableId)
  
  // 割り当てプレイヤーを待機キューから削除
  for entry in selectedPlayers:
    queue.waitingQueue.remove(entry.playerId)
    entry.status = ASSIGNED
    entry.currentTableId = table.tableId
  
  return table

function hasConflictingHand(entry, activeTableIds):
  // activeTableIds内のテーブルで、現在のプレイヤーが参加中または参加予定か確認
  for tableId in activeTableIds:
    table = getTable(tableId)
    for handRecord in table.handHistory:
      if entry.playerId in handRecord.participants:
        if not handRecord.isCompleted():
          return true  // 同一テーブル内のハンドに参加中
    
    // 今から始まるハンドでの参加チェック
    if entry.playerId in table.nextHandParticipants:
      return true
  
  return false
```

### 4.3 フォールド時の即時再配置 (OnPlayerFold)
```
function onPlayerFold(queue, playerId, tableId, handId):
  // プレイヤーを即座に削除し、ハンド完了を待たずに再配置
  entry = queue.playerPool[playerId]
  
  // 参加済みハンド記録
  entry.participatedHandIds.add(handId)
  entry.currentHandId = null
  entry.currentTableId = null
  entry.status = WAITING
  
  // 待機キューに戻す
  queue.waitingQueue.push(playerId)
  
  // テーブル更新（席を空けたので、Botまたは待機プレイヤーで埋める）
  updateTableAfterFold(tableId, playerId)
  
  // 新規テーブル割り当てトリガー
  triggerTableReconfiguration(queue)
```

### 4.4 ハンド完了時の処理 (OnHandComplete)
```
function onHandComplete(queue, handId, tableId, results):
  // ハンド結果を記録
  handRecord = {
    handId: handId,
    tableId: tableId,
    participants: results.participants,
    winners: results.winners,
    endedAt: getCurrentTimestamp()
  }
  queue.handRegistry[handId] = handRecord
  
  // 全プレイヤーの状態をクリア
  table = getTable(tableId)
  for playerId in table.players:
    entry = queue.playerPool[playerId]
    entry.participatedHandIds.add(handId)  // 参加済みハンドを記録
    entry.currentHandId = null
    entry.currentTableId = null
    
    // プレイヤーが自発的に残っている場合のみ待機キューに戻す
    if entry.status != EXCLUDED:
      entry.status = WAITING
      queue.waitingQueue.push(playerId)
  
  // テーブルを完了済みに
  table.status = COMPLETED
  queue.activeTableIds.remove(tableId)
  queue.completedTableIds.add(tableId)
  
  // 新規テーブル割り当てトリガー
  triggerTableReconfiguration(queue)
```

## 5. テーブル生成アルゴリズム

### 5.1 動的テーブル作成フロー
```
function createTable(playerEntries):
  // playerEntries: 選出されたPlayerPoolEntry配列（通常6個）
  
  tableId = generateTableId()
  handId = generateHandId()
  
  table = {
    tableId: tableId,
    status: "WaitingForStart",
    handId: handId,
    seats: [],
    currentStreet: "Preflop",
    pot: 0,
    communityCards: [],
    startedAt: getCurrentTimestamp()
  }
  
  // シートに割り当て
  dealerPosition = calculateDealerPosition(tableId)
  
  for i in 0...5:
    entry = playerEntries[i]
    seat = {
      position: i,
      playerId: entry.playerId,
      status: "Active",
      holeCards: null,  // ディール時に設定
      betAmount: 0
    }
    table.seats.push(seat)
  
  // ブラインドポジション計算
  table.smallBlindPos = (dealerPosition + 1) % 6
  table.bigBlindPos = (dealerPosition + 2) % 6
  
  // HandRecord作成
  handRecord = {
    handId: handId,
    tableId: tableId,
    status: "Preflop",
    participants: playerEntries.map(e => ({ playerId: e.playerId, seat: calculateSeat(e) })),
    startedAt: getCurrentTimestamp()
  }
  
  return table
```

### 5.2 ディーラーボタン計算
```
function calculateDealerPosition(tableId):
  // テーブルが作成される度にボタン位置を回転
  // テーブルIDのハッシュ値からシード取得
  seed = hash(tableId)
  return seed % 6
```

## 6. プレイヤープール設計

### 6.1 プレイヤー状態遷移
```
IDLE
  ↓ (join())
WAITING (キューで待機)
  ↓ (assignToTable())
ASSIGNED (テーブル割り当て、ディール準備)
  ↓ (dealHand())
IN_HAND (アクション可能)
  ├─ (fold())
  │  ↓
  │  FOLDED (ハンド完了を待つ)
  │    ↓ (onHandComplete())
  │    WAITING (即座にキューに戻る)
  │
  ├─ (allIn())
  │  ↓
  │  ALL_IN (ハンド終了まで待機)
  │    ↓ (onHandComplete())
  │    WAITING
  │
  └─ (showdown時に残存)
     ↓ (onHandComplete())
     WAITING

EXCLUDED (自発的な退席 / エラー)
  → (reJoin可能)
```

### 6.2 プレイヤープール管理
```
class PlayerPool:
  playerPool: Map<string, PlayerPoolEntry> = {}
  playerIndex: Array<string> = []  // playerId配列（検索高速化用）
  
  function addPlayer(playerId, playerType):
    entry = createPlayerPoolEntry(playerId, playerType)
    this.playerPool[playerId] = entry
    this.playerIndex.push(playerId)
  
  function removePlayer(playerId):
    if playerId in this.playerPool:
      this.playerPool.delete(playerId)
      this.playerIndex.remove(playerId)
  
  function updatePlayerStatus(playerId, newStatus):
    if playerId in this.playerPool:
      this.playerPool[playerId].status = newStatus
      this.playerPool[playerId].lastActivityAt = getCurrentTimestamp()
  
  function getParticipatedHands(playerId):
    return this.playerPool[playerId].participatedHandIds
  
  function canPlayerJoinTable(playerId, tableId, handId):
    entry = this.playerPool[playerId]
    if handId in entry.participatedHandIds:
      return false  // 既にこのハンドに参加している
    return true
```

## 7. HandPool設計

### 7.1 ハンド参加記録の厳密な管理
```
class HandRegistry:
  hands: Map<string, HandRecord> = {}
  playerHandIndex: Map<string, Set<string>> = {}  // playerId -> Set of handIds
  
  function registerHand(handRecord):
    this.hands[handRecord.handId] = handRecord
    
    // プレイヤーごとのハンド参加記録を更新
    for participant in handRecord.participants:
      if participant.playerId not in this.playerHandIndex:
        this.playerHandIndex[participant.playerId] = Set()
      this.playerHandIndex[participant.playerId].add(handRecord.handId)
  
  function hasPlayerParticipatedInHand(playerId, handId):
    if playerId not in this.playerHandIndex:
      return false
    return handId in this.playerHandIndex[playerId]
  
  function getPlayerHandHistory(playerId):
    return this.playerHandIndex[playerId] || Set()
  
  function completeHand(handId, results):
    hand = this.hands[handId]
    hand.status = "Completed"
    hand.endedAt = getCurrentTimestamp()
    hand.results = results
```

### 7.2 ハンドスコープ境界
```
// 同一ハンドへの再参加禁止ロジック
function validateHandParticipation(playerId, targetHandId, queue):
  // チェック1: 同一ハンド内での二重参加禁止
  table = getTableByHandId(targetHandId)
  if playerId in table.currentParticipants:
    return false
  
  // チェック2: 参加済みハンドか確認
  participatedHands = queue.playerPool[playerId].participatedHandIds
  if targetHandId in participatedHands:
    return false
  
  // チェック3: 進行中のハンドなのか、完了ハンドなのか
  handRecord = queue.handRegistry[targetHandId]
  if handRecord.status == "Completed":
    return false  // 完了ハンドには参加できない
  
  return true
```

## 8. レースコンディション対策

### 8.1 ローカルブラウザ環境での同期問題
```
// シングルスレッド的な動作を保証
class QueueOperationMutex:
  isLocked: boolean = false
  queue: Function[] = []
  
  function async executeAtomic(operation):
    while this.isLocked:
      await sleep(1ms)
    
    this.isLocked = true
    try:
      result = await operation()
      return result
    finally:
      this.isLocked = false
```

### 8.2 フォールド時の即時割り当てでの競合
```
// フォールド処理中に別テーブル割り当てが走る場合
function onPlayerFoldSafe(queue, playerId, tableId, handId):
  mutex.executeAtomic(() => {
    entry = queue.playerPool[playerId]
    
    // チェック: 既に別のテーブルに割り当てられていないか
    if entry.currentTableId != null and entry.currentTableId != tableId:
      return ERROR("Player already assigned to different table")
    
    // 更新
    entry.participatedHandIds.add(handId)
    entry.currentTableId = null
    entry.currentHandId = null
    entry.status = WAITING
    queue.waitingQueue.push(playerId)
  })
```

### 8.3 同一ハンド再参加禁止の厳密化
```
// テーブル割り当て時にもう一度チェック
function assignToTableSafe(queue, playerList):
  mutex.executeAtomic(() => {
    selectedPlayers = []
    
    for playerId in playerList:
      entry = queue.playerPool[playerId]
      
      // チェック1: 既に割り当てられていないか
      if entry.status != WAITING:
        continue
      
      // チェック2: 同一ハンド参加チェック（最新のテーブル全体で再確認）
      for tableId in queue.activeTableIds:
        table = getTable(tableId)
        if playerId in table.participants:
          if table.currentHand.status != "Completed":
            continue  // スキップ
      
      selectedPlayers.push(entry)
    
    table = createTable(selectedPlayers)
    // ... テーブル初期化
  })
```

## 9. 詳細な状態遷移図

```
┌──────────────────────────────────────────────────────────────────────────┐
│ IDLE状態（ゲーム外）                                                      │
└──────────────────────────────────────────────────────────────────────────┘
  │
  │ join()
  ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ WAITING状態（キュー待機）                                                │
│ - FIFOキューに入った                                                    │
│ - waitingQueue配列に追加された                                          │
│ - 同一ハンド再参加禁止チェック中                                        │
└──────────────────────────────────────────────────────────────────────────┘
  │
  │ assignToTable() [FIFO順に6人選出 + Bot補完]
  ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ ASSIGNED状態（テーブル割り当て完了）                                    │
│ - テーブルが生成された                                                  │
│ - シート位置が確定した                                                  │
│ - ディール準備中                                                        │
└──────────────────────────────────────────────────────────────────────────┘
  │
  │ dealHand() [ホールカード配布、プリフロップ開始]
  ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ IN_HAND状態（アクション待機中）                                         │
│ - プリフロップ〜リバーのいずれかのストリート                            │
│ - プレイヤーのアクション待機中                                          │
└──────────────────────────────────────────────────────────────────────────┘
  │
  ├─────────────── fold() ─────────────────┐
  │                                          │
  ↓                                          ↓
┌──────────────────┐              ┌──────────────────────────────┐
│ FOLDED状態       │              │ ALL_IN状態                   │
│ - フォールド済み │              │ - オールインした              │
│ - 即座にWAITING↓ │              │ - ハンド完了待機              │
└──────────────────┘              └──────────────────────────────┘
  │                                          │
  │ [即時]                                   │ [ハンド完了後]
  │ onPlayerFold()                           │ onHandComplete()
  │ participatedHandIds.add(handId)          │
  ↓                                          ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ WAITING状態に戻る（高速リサイクル）                                      │
│ - 別のハンドIDで次テーブル割り当て対象に                                  │
│ - participatedHandIds.contains(oldHandId) で再参加禁止                   │
└──────────────────────────────────────────────────────────────────────────┘

別ルート：showdown到達（フォールドなし）
┌──────────────────────────────────────────────────────────────────────────┐
│ IN_HAND → Showdown進行 → onHandComplete()                               │
│ → participatedHandIds.add(handId) → WAITING                            │
└──────────────────────────────────────────────────────────────────────────┘

セッション終了ルート：
IN_HAND or WAITING → exitGame() → EXCLUDED
```

## 10. 疑似コード（全体フロー）

### 10.1 ゲームループ（メインプロセス）
```
class FastFoldGameEngine:
  queue: FastFoldQueue
  tableMap: Map<string, Table> = {}
  handMap: Map<string, HandRecord> = {}
  
  function main():
    while RUNNING:
      // 1. キュー再構成（新規プレイヤーやフォールドプレイヤーの再配置）
      processQueueReconfiguration()
      
      // 2. 各テーブルの進行
      processAllActiveTables()
      
      // 3. 完了ハンドの処理とクリーンアップ
      processCompletedHands()
      
      // 4. UI更新通知
      notifyUIUpdate()
      
      sleep(100ms)  // ブラウザ負荷制御
  
  function processQueueReconfiguration():
    // 新規テーブルが作成できるだけ作成
    while this.queue.waitingQueue.length >= 3:  // 最低3人いれば、Bot3人で6-max構成
      table = this.queue.assignPlayersToTable()
      this.tableMap[table.tableId] = table
      startNewHand(table)
  
  function processAllActiveTables():
    for table in this.tableMap.values():
      if table.status == "InProgress":
        // テーブルのゲームロジック実行（ベッティング、ストリート進行）
        advanceTableState(table)
        
        // フォールドハンドリング
        for foldedPlayer in table.justFoldedPlayers:
          this.queue.onPlayerFold(
            this.queue,
            foldedPlayer.playerId,
            table.tableId,
            table.handId
          )
          // 此のタイミングで待機キューが更新される
        
        // テーブル状態をクライアント/サーバーに通知
        broadcastTableState(table)
  
  function processCompletedHands():
    for table in this.tableMap.values():
      if table.status == "Completed":
        results = table.getHandResults()
        this.queue.onHandComplete(
          this.queue,
          table.handId,
          table.tableId,
          results
        )
        
        // HandRegistry に記録
        handRecord = createHandRecord(table, results)
        this.handMap[table.handId] = handRecord
        
        // テーブル削除
        this.tableMap.remove(table.tableId)
```

### 10.2 プレイヤー参加フロー
```
function playerJoinFlow(gameEngine, userId):
  // UI: "Fast Fold プレイ開始" クリック
  
  playerId = createOrGetPlayerId(userId)
  
  // 参加
  result = gameEngine.queue.joinQueue(gameEngine.queue, playerId, "human")
  if result == ERROR:
    return UI_SHOW_ERROR(result.message)
  
  // プレイヤーをキューに追加
  gameEngine.queue.playerPool[playerId].status = WAITING
  
  // UI: キュー待機画面に表示
  displayQueueStatus(gameEngine.queue)
```

### 10.3 フォールド時の即時再配置フロー
```
function playerFoldFlow(gameEngine, playerId, tableId):
  // ゲームUI: "Fold" ボタンをクリック
  
  table = gameEngine.tableMap[tableId]
  handId = table.handId
  
  // テーブルエンジンがフォールド処理
  table.applyPlayerAction(playerId, "fold")
  
  // キュー側に即座に通知
  gameEngine.queue.onPlayerFold(gameEngine.queue, playerId, tableId, handId)
  
  // フロー：
  // 1. playerPool[playerId].status = WAITING に変更
  // 2. participatedHandIds.add(handId)
  // 3. waitingQueue に追加
  // 4. 待機テーブルのシートが空く
  // → テーブル内の残りプレイヤーで手番が続行
  // → 別のテーブルをトリガーして新規割り当て検討
  
  // UI: "新しいハンドに移動中..." ローディング表示
  // → 次のテーブルが割り当てられたら自動遷移
```

### 10.4 ハンド完了フロー
```
function handCompleteFlow(gameEngine, tableId):
  table = gameEngine.tableMap[tableId]
  
  // ゲームエンジン: Showdown 決定
  results = table.determineWinners()
  
  // キューに完了通知
  gameEngine.queue.onHandComplete(gameEngine.queue, table.handId, tableId, results)
  
  // フロー：
  // 1. HandRegistry[handId] に結果を記録
  // 2. テーブル内の全プレイヤー
  //    - participatedHandIds.add(handId)
  //    - currentHandId = null
  //    - status = WAITING
  //    - waitingQueue に追加
  // 3. table.status = COMPLETED
  // 4. activeTableIds から削除
  
  // 続行：テーブル再構成がトリガーされ、新規テーブル割い当て検討
  
  // UI: "ハンド完了、結果表示" → 次のハンド割り当てまで待機
```

## 11. エッジケース処理

### 11.1 複数テーブル間の同一ハンド再参加禁止
```
// シナリオ：プレイヤーがハンド H123 に Table A で参加中
//          その後 Table B が作成されて、同じプレイヤーが割り当てられようとする

function validateMultiTableParticipation(playerId, newTableId, queue):
  entry = queue.playerPool[playerId]
  
  for activeTableId in queue.activeTableIds:
    table = getTable(activeTableId)
    if activeTableId == newTableId:
      continue  // 同じテーブルは別途チェック
    
    // 既存テーブル内でこのプレイヤーが参加中のハンドがあるか
    for participant in table.currentHand.participants:
      if participant.playerId == playerId:
        if table.currentHand.status != "Completed":
          return false  // ハンド進行中は新テーブル割り当て不可
  
  return true
```

### 11.2 1人プレイ時の Bot 補完
```
function ensureBotComplement(queue, targetPlayerCount):
  humanCount = count(entry for entry in queue.playerPool.values() if entry.playerType == "human")
  requiredBots = max(0, 6 - humanCount)
  
  currentBots = count(entry for entry in queue.playerPool.values() if entry.playerType == "bot")
  
  if currentBots < requiredBots:
    // Bot を追加生成
    for i in 0...(requiredBots - currentBots):
      botProfile = selectBotProfile()  // ルールベースBotを選択
      botEntry = {
        playerId: generateBotPlayerId(),
        playerType: "bot",
        botProfile: botProfile,
        status: WAITING,
        participatedHandIds: Set()
      }
      queue.playerPool[botEntry.playerId] = botEntry
      queue.waitingQueue.push(botEntry.playerId)
```

## 12. まとめ

Fast Fold Queueの詳細設計は、以下の原則に基づいています：

### 12.1 プレイヤープール中心の設計
- テーブルではなく、プレイヤーの状態遷移を中核に管理
- `PlayerPoolEntry` が各プレイヤーの状態を一元管理
- `participatedHandIds` により同一ハンド再参加を厳密に禁止

### 12.2 FIFOキューによる公平な割り当て
- `waitingQueue` が参加順序を保証
- 先着順で新テーブルに割り当て
- FIFO順を保つことで、待ち時間の予測性向上

### 12.3 即時フォールド処理
- フォールド時に `onPlayerFold()` で即座にプレイヤーを待機キューに戻す
- ハンド完了を待たず、次テーブル割り当て対象に
- Fast Foldの本質的な特徴を実現

### 12.4 レースコンディション対策
- `QueueOperationMutex` でローカルアトミック処理を保証
- 複数テーブル間での同一ハンド再参加チェック
- ブラウザ環境でも安全に状態遷移

### 12.5 Bot補完による常時6-max構成
- `ensureBotComplement()` でBot数を動的に管理
- 1人プレイでも6-maxゲーム体験
- 将来的にBot戦略を追加・変更可能

### 12.6 スケーラビリティ
- ローカルブラウザベースで初期運用
- `HandRegistry` と `PlayerPool` の分離により、サーバー移行時に容易に永続化可能
- APIレイヤーを追加して、マルチプレイヤー対応へ拡張可能

### 12.7 エッジケース対応
- 複数テーブル間の同一ハンド再参加禁止
- プレイヤーの強制退席・セッション切断
- Botの動的追加・削除
- 同時アクション時の競合処理

このアーキテクチャにより、Fast Fold Omahaの高速で反復的な練習体験をブラウザベースで実現しながら、将来のマルチプレイヤー展開やBot対戦追加に対応できる拡張性を確保しています。