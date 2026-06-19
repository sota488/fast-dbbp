# Pot Distribution テストケース仕様

## テストセット一覧（最低20件）

### 1. Single Winner パターン（2件）

#### TC-01: Single Winner Both Boards (同一プレイヤー)
- Total Pot: 1000
- Board A Winner: ['PlayerA']
- Board B Winner: ['PlayerA']
- 期待値:
  - PlayerA: 1000
  - Pot A: 500 (PlayerA)
  - Pot B: 500 (PlayerA)

#### TC-02: Single Winner Both Boards (異なるプレイヤー)
- Total Pot: 1000
- Board A Winner: ['PlayerA']
- Board B Winner: ['PlayerB']
- 期待値:
  - PlayerA: 500
  - PlayerB: 500
  - Pot A: 500 (PlayerA)
  - Pot B: 500 (PlayerB)

---

### 2. Split Pot パターン（4件）

#### TC-03: Half Split on Board A
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB']
- Board B Winner: ['PlayerA']
- 期待値:
  - PlayerA: 750 (250 + 500)
  - PlayerB: 250
  - Pot A: 250 each (PlayerA, PlayerB)
  - Pot B: 500 (PlayerA)

#### TC-04: Half Split on Board B
- Total Pot: 1000
- Board A Winner: ['PlayerA']
- Board B Winner: ['PlayerA', 'PlayerB']
- 期待値:
  - PlayerA: 750 (500 + 250)
  - PlayerB: 250
  - Pot A: 500 (PlayerA)
  - Pot B: 250 each (PlayerA, PlayerB)

#### TC-05: Half Split on Both Boards (同じペア)
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB']
- Board B Winner: ['PlayerA', 'PlayerB']
- 期待値:
  - PlayerA: 500
  - PlayerB: 500
  - Pot A: 250 each
  - Pot B: 250 each

#### TC-06: Half Split on Both Boards (異なるペア)
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB']
- Board B Winner: ['PlayerC', 'PlayerD']
- 期待値:
  - PlayerA: 250
  - PlayerB: 250
  - PlayerC: 250
  - PlayerD: 250
  - Pot A: 250 each (A, B)
  - Pot B: 250 each (C, D)

---

### 3. Quarter Pot パターン（3件）

#### TC-07: Quarter Pot (Single + Half)
- Total Pot: 1000
- Board A Winner: ['PlayerA']
- Board B Winner: ['PlayerA', 'PlayerB']
- 期待値:
  - PlayerA: 750
  - PlayerB: 250
  - Pot A: 500 (PlayerA)
  - Pot B: 250 each (PlayerA, PlayerB)

#### TC-08: Quarter Pot (Half + Single)
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB']
- Board B Winner: ['PlayerA']
- 期待値:
  - PlayerA: 750
  - PlayerB: 250
  - Pot A: 250 each (PlayerA, PlayerB)
  - Pot B: 500 (PlayerA)

#### TC-09: Quarter Pot (Half + Half with One Common)
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB']
- Board B Winner: ['PlayerB', 'PlayerC']
- 期待値:
  - PlayerA: 250
  - PlayerB: 500
  - PlayerC: 250
  - Pot A: 250 each (PlayerA, PlayerB)
  - Pot B: 250 each (PlayerB, PlayerC)

---

### 4. Three-way Split パターン（3件）

#### TC-10: 3-way Split on Board A
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB', 'PlayerC']
- Board B Winner: ['PlayerA']
- 計算:
  - Pot A = 500, Pot B = 500
  - Board A: 500 / 3 = 166 余り 2 → A=167(+1), B=167(+1), C=166
  - Board B: 500 / 1 = 500 → A=500
- 期待値:
  - PlayerA: 667 (167 + 500)
  - PlayerB: 167
  - PlayerC: 166
  - 合計: 1000 ✓

#### TC-11: 3-way Split on Board B
- Total Pot: 1000
- Board A Winner: ['PlayerA']
- Board B Winner: ['PlayerA', 'PlayerB', 'PlayerC']
- 計算:
  - Pot A = 500, Pot B = 500
  - Board A: 500 / 1 = 500 → A=500
  - Board B: 500 / 3 = 166 余り 2 → A=167(+1), B=167(+1), C=166
- 期待値:
  - PlayerA: 667 (500 + 167)
  - PlayerB: 167
  - PlayerC: 166
  - 合計: 1000 ✓

#### TC-12: 3-way Split on Both Boards (同じ3人)
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB', 'PlayerC']
- Board B Winner: ['PlayerA', 'PlayerB', 'PlayerC']
- 計算:
  - Pot A = 500, Pot B = 500
  - Board A: 500 / 3 = 166 余り 2 → A=167(+1), B=167(+1), C=166
  - Board B: 500 / 3 = 166 余り 2 → A=167(+1), B=167(+1), C=166
- 期待値:
  - PlayerA: 334 (167 + 167)
  - PlayerB: 334 (167 + 167)
  - PlayerC: 332 (166 + 166)
  - 合計: 1000 ✓

---

### 5. Multi-way Split パターン（4件）

#### TC-13: 4-way Split on Board A
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD']
- Board B Winner: ['PlayerA']
- 期待値:
  - PlayerA: 625 (125 + 500)
  - PlayerB: 125
  - PlayerC: 125
  - PlayerD: 125
  - Pot A: 125 each (500 / 4)
  - Pot B: 500 (PlayerA)

#### TC-14: 5-way Split on Board B
- Total Pot: 1000
- Board A Winner: ['PlayerA']
- Board B Winner: ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD', 'PlayerE']
- 期待値:
  - PlayerA: 600 (500 + 100)
  - PlayerB: 100
  - PlayerC: 100
  - PlayerD: 100
  - PlayerE: 100
  - Pot A: 500 (PlayerA)
  - Pot B: 100 each (500 / 5)

#### TC-15: 3-way and 2-way Split (異なるペア)
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB', 'PlayerC']
- Board B Winner: ['PlayerD', 'PlayerE']
- 計算:
  - Pot A = 500, Pot B = 500
  - Board A: 500 / 3 = 166 余り 2 → A=167(+1), B=167(+1), C=166
  - Board B: 500 / 2 = 250 余り 0 → D=250, E=250
- 期待値:
  - PlayerA: 167
  - PlayerB: 167
  - PlayerC: 166
  - PlayerD: 250
  - PlayerE: 250
  - 合計: 1000 ✓

#### TC-16: 4-way and 3-way Split (1人共通)
- Total Pot: 1000
- Board A Winner: ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD']
- Board B Winner: ['PlayerA', 'PlayerB', 'PlayerC']
- 計算:
  - Pot A = 500, Pot B = 500
  - Board A: 500 / 4 = 125 余り 0 → A=125, B=125, C=125, D=125
  - Board B: 500 / 3 = 166 余り 2 → A=167(+1), B=167(+1), C=166
- 期待値:
  - PlayerA: 292 (125 + 167)
  - PlayerB: 292 (125 + 167)
  - PlayerC: 291 (125 + 166)
  - PlayerD: 125
  - 合計: 1000 ✓

---

### 6. Different Winners パターン（2件）

#### TC-17: Completely Different Winners
- Total Pot: 2000
- Board A Winner: ['PlayerA', 'PlayerB']
- Board B Winner: ['PlayerC', 'PlayerD', 'PlayerE']
- 期待値:
  - PlayerA: 500
  - PlayerB: 500
  - PlayerC: 334
  - PlayerD: 333
  - PlayerE: 333
  - Pot A: 500 each (1000 / 2)
  - Pot B: 334 + 333 + 333 (1000 / 3)

#### TC-18: One Common Winner
- Total Pot: 2000
- Board A Winner: ['PlayerA', 'PlayerB', 'PlayerC']
- Board B Winner: ['PlayerC', 'PlayerD']
- 期待値:
  - PlayerA: 334
  - PlayerB: 333
  - PlayerC: 833 (333 + 500)
  - PlayerD: 500
  - Pot A: 334 + 333 + 333 (1000 / 3)
  - Pot B: 500 each (1000 / 2)

---

### 7. Edge Cases（2件）

#### TC-19: Zero Pot
- Total Pot: 0
- Board A Winner: ['PlayerA']
- Board B Winner: ['PlayerA']
- 期待値:
  - PlayerA: 0
  - Pot A: 0
  - Pot B: 0

#### TC-20: Single Player on Both Boards (No Split)
- Total Pot: 500
- Board A Winner: ['PlayerA']
- Board B Winner: ['PlayerA']
- 期待値:
  - PlayerA: 500
  - Pot A: 250
  - Pot B: 250

---

## テストケースの実装方針

各テストは以下の検証を行う：

1. 戻り値の `PotDistributionResult` が正しい構造
2. `potA` と `potB` が正確に計算されている（= totalPot / 2）
3. `winnings` の合計が **正確に** `totalPot` に等しい
4. 各プレイヤーの獲得額が期待値と完全に一致
5. 端数処理: winner 配列の先頭から順に 1 チップずつ配布
6. 各ボード内の支払い合計がボード部分に等しい
7. 勝者リストが正しく反映されている
8. すべての計算が整数演算のみで実行される（浮動小数点なし）

---

## 仕様確認項目（MVP）

- [x] 端数処理ルール: winner 配列の先頭から順に 1 チップずつ配布
- [x] 負のポット値の扱い: エラーまたはスキップ
- [x] 空の Winner リストの扱い: エラー処理
- [x] チップは整数のみ
- [x] 支払い合計が totalPot に必ず等しい
- [ ] プレイヤーID の重複チェック（必要に応じて）
- [ ] 実装時の浮動小数点演算は使用しない（整数演算のみ）

## 端数処理の詳細仕様

### 計算式
```
baseShare = floor(boardShare / winnerCount)
remainder = boardShare % winnerCount

for i in 0 to winnerCount-1:
  share = baseShare
  if i < remainder:
    share += 1
  allocation[winners[i]] += share
```

### 検証項目
- 各ボード分配の合計が `boardShare` に等しい
- 全プレイヤーの支払い合計が `totalPot` に等しい
- 支払いが 0 以下にならない
- 小数は発生しない（整数のみ）
