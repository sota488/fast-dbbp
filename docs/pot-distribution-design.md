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
```
function distributePot(totalPot, boardAWinners, boardBWinners): Allocation {
  if totalPot <= 0:
    return EMPTY_ALLOCATION

  const boardShare = totalPot / 2
  const allocations = new Map<PlayerId, number>()

  const allocateBoardShare = (winners, boardShare) => {
    const count = winners.length
    if count == 0:
      return
    const share = Math.floor(boardShare / count)
    const remainder = boardShare - share * count

    for (const winner of winners):
      allocations[winner] = (allocations[winner] || 0) + share

    // 余りは最も強い勝者、または事前規則に従い分配する
    if remainder > 0:
      allocations[winners[0]] += remainder
  }

  allocateBoardShare(boardAWinners, boardShare)
  allocateBoardShare(boardBWinners, boardShare)

  return allocations
}
```
- `boardAWinners` / `boardBWinners` は、それぞれのボードで最強手を持つプレイヤーのリスト。
- `share` はボード部分を勝者数で等分した額。
- `remainder` は最小単位で切り捨てた余りを、事前定義した勝者に与える。

## 6. 具体例
1. Board A を Player A が単独勝利、Board B を Player B が単独勝利
   - A = totalPot/2
   - B = totalPot/2

2. Board A を Player A と Player B がタイ、Board B を Player C が単独勝利
   - A = totalPot/4
   - B = totalPot/4
   - C = totalPot/2

3. Board A を Player A と Player B がタイ、Board B を Player B と Player C がタイ
   - A = totalPot/4
   - B = totalPot/4
   - C = totalPot/4
   - B は両方で勝利しているため合計 totalPot/2

## 7. フォールドプレイヤーの扱い
- フォールドしたプレイヤーは、そのハンドのBoard A / Board Bの勝者判定対象から除外される。
- しかし、フォールド時点でコミットされたチップは totalPot に含まれ、配分対象となる。
- そのため、フォールドしたプレイヤーがいても、残りのアクティブプレイヤーがBoard A/Bの勝利分を受け取る。

## 8. 端数処理
- アプリケーションでは最小ステーク単位を整数で管理する。
- `boardShare / winners.length` が整数にならない場合、余りは片方の勝者へ付与するか、あらかじめ定義した切り捨てルールを適用する。
- 一貫性を保つため、端数処理のルールは実装前に明文化する。

## 9. 片方のボードだけ勝者が不在の場合
- 実務上、ハンド成立時には各ボードに少なくとも1人の有効プレイヤーが存在するように設計する。
- もし片方のボードに有効プレイヤーが1人しかいない場合、そのプレイヤーがそのボードの配分を単独で獲得する。
