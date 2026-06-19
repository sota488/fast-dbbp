# Pot Distribution Design

## 1. 概要
Double Board Bomb Pot Fast Foldでは、1つの総ポットを2つの独立したボードに分割して配分する。
各ボードの勝者は、それぞれ総ポットの半分を受け取るため、最大で2つの異なるプレイヤーがポットを分け合う。

## 2. 基本方針
- totalPot = すべてのプレイヤーがコミットしたチップの合計。
- Board A portion = totalPot / 2
- Board B portion = totalPot / 2
- 各ボードの勝者が1人の場合、その勝者はボード部分全額を獲得する。
- 各ボードで複数の勝者がタイになった場合、該当ボード部分を均等に分割する。

## 3. Quarter Pot の定義
- Quarter Potは、総ポットの1/4に相当する配分単位。
- 1つのボード部分（totalPot/2）を2人でタイ分割すると、各プレイヤーはtotalPot/4を受け取る。
- そのため、Board A/Bの両方でタイが発生すると、複数のプレイヤー間で1/4単位の分配が発生しやすい。

## 4. Multi-way Split Pot
- 1つのボードでタイ持ちがN人いる場合、そのボードの半分は N で割られ、各プレイヤーに分配される。
- 例: Board Aの勝者が3人タイの場合、各プレイヤーは totalPot / 2 / 3 を獲得する。
- これがMulti-way Split Potであり、Board A/Bのどちらか、または両方で発生する。

## 5. 配分アルゴリズム

### 基本フロー
```
function distributePot(totalPot, boardAWinners, boardBWinners): Allocation {
  if totalPot <= 0:
    return EMPTY_ALLOCATION

  const potA = totalPot / 2
  const potB = totalPot / 2
  const allocations = new Map<PlayerId, number>()

  const allocateBoardShare = (winners, boardShare) => {
    const count = winners.length
    if count == 0:
      return
    const baseShare = Math.floor(boardShare / count)
    const remainder = boardShare % count

    for (let i = 0; i < count; i++):
      const winner = winners[i]
      let share = baseShare
      // 余りを先頭から順番に配布
      if i < remainder:
        share += 1
      allocations[winner] = (allocations[winner] || 0) + share

  allocateBoardShare(boardAWinners, potA)
  allocateBoardShare(boardBWinners, potB)
  return allocations
}
```

### 計算例
- totalPot = 10
- boardAWinners = ['PlayerA', 'PlayerB', 'PlayerC']
- boardBWinners = ['PlayerD']

計算：
1. potA = 10 / 2 = 5
2. potB = 10 / 2 = 5
3. Board A 分配:
   - baseShare = floor(5 / 3) = 1
   - remainder = 5 % 3 = 2
   - PlayerA = 1 + 1 = 2 (i=0 < remainder=2)
   - PlayerB = 1 + 1 = 2 (i=1 < remainder=2)
   - PlayerC = 1 (i=2 >= remainder=2)
4. Board B 分配:
   - baseShare = floor(5 / 1) = 5
   - remainder = 5 % 1 = 0
   - PlayerD = 5

結果：PlayerA = 2, PlayerB = 2, PlayerC = 1, PlayerD = 5
合計 = 2 + 2 + 1 + 5 = 10 ✓

## 6. 端数処理ルール（MVP）

### ルール
1. チップは整数のみを扱う
2. ボード部分（potA または potB）を勝者数で割った際に余りが発生した場合：
   - `baseShare = floor(boardShare / winnerCount)`
   - `remainder = boardShare % winnerCount`
3. 余ったチップは **winner 配列の先頭から順番に 1 チップずつ配布**
4. 配分結果の合計が必ず `totalPot` に等しいことを保証

### 例1: 3人で10を分配
```
10 / 3 = 3 余り 1
winner = ['A', 'B', 'C']
→ A = 4, B = 3, C = 3
合計 = 10
```

### 例2: 5人で10を分配
```
10 / 5 = 2 余り 0
winner = ['A', 'B', 'C', 'D', 'E']
→ A = 2, B = 2, C = 2, D = 2, E = 2
合計 = 10
```

### 例3: 6人で25を分配
```
25 / 6 = 4 余り 1
winner = ['A', 'B', 'C', 'D', 'E', 'F']
→ A = 5, B = 4, C = 4, D = 4, E = 4, F = 4
合計 = 25
```

## 7. Multi-way Split Pot

1つのボードでタイ持ちがN人いる場合、そのボードの半分は N で割られ、端数処理ルールに従い各プレイヤーに分配される。

例: Board Aの勝者が3人タイ、Board Bの勝者が1人
- Total Pot = 100
- Pot A = 50 → 3人で分配 → 17, 17, 16
- Pot B = 50 → 1人で分配 → 50
結果: タイ勝者1人は 50 + 17 = 67, タイ勝者2人は 50 + 17 = 67, タイ勝者3人は 50 + 16 = 66

## 8. 複数ボードでの勝者重複

1人のプレイヤーが Board A と Board B の両方で勝利した場合、各ボードの配分を合算する。

例: PlayerA が両方で勝利
- potA で A = 50
- potB で A = 50
- 最終: A = 100

## 9. 片方のボードだけ勝者が複数の場合

- Board A: 複数人 Split
- Board B: 1人単独勝利

各ボードの配分を独立に計算し、合算する。

## 10. 検証チェックリスト

実装時に以下を確認：
- [ ] `floor()` で整数除算を行っている
- [ ] `%` で余りを正確に計算している
- [ ] winner 配列の先頭から順に余りを配布している
- [ ] 最終的な支払い合計が `totalPot` に等しいことを確認している
- [ ] 空の winner リスト（エラーケース）を適切に処理している
- [ ] 負の Pot や totalPot 値を排除している

## 11. 具体例

### Example 1: TC-10 (3-way Split)
```
totalPot = 1000
boardAWinners = ['A', 'B', 'C']
boardBWinners = ['A']

potA = 500, potB = 500

Board A 分配:
  baseShare = floor(500 / 3) = 166
  remainder = 500 % 3 = 2
  A = 166 + 1 = 167 (i=0 < 2)
  B = 166 + 1 = 167 (i=1 < 2)
  C = 166 (i=2 >= 2)

Board B 分配:
  baseShare = floor(500 / 1) = 500
  remainder = 500 % 1 = 0
  A = 500

最終:
  A = 167 + 500 = 667
  B = 167
  C = 166
  合計 = 667 + 167 + 166 = 1000 ✓
```

### Example 2: TC-16 (4-way + 3-way)
```
totalPot = 1000
boardAWinners = ['A', 'B', 'C', 'D']
boardBWinners = ['A', 'B', 'C']

potA = 500, potB = 500

Board A 分配:
  baseShare = floor(500 / 4) = 125
  remainder = 500 % 4 = 0
  A = 125, B = 125, C = 125, D = 125

Board B 分配:
  baseShare = floor(500 / 3) = 166
  remainder = 500 % 3 = 2
  A = 166 + 1 = 167 (i=0 < 2)
  B = 166 + 1 = 167 (i=1 < 2)
  C = 166 (i=2 >= 2)

最終:
  A = 125 + 167 = 292
  B = 125 + 167 = 292
  C = 125 + 166 = 291
  D = 125
  合計 = 292 + 292 + 291 + 125 = 1000 ✓
```

## 12. MVP 外のため未実装

- Side Pot の処理
- All-in による部分的 Pot 分配
- 異なる参加額の処理
- Rake 差し引き
- フォールド時の Pot 返金ロジック（参加額確定時点のみ対応）
