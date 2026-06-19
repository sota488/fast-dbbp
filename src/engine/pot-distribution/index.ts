export interface PotDistributionResult {
  totalPot: number;
  potA: number;
  potB: number;
  boardAWinners: string[];
  boardBWinners: string[];
  payouts: Record<string, number>;
}

/**
 * Pot を Board A と Board B に分割し、各プレイヤーに分配する。
 *
 * ルール:
 * - potA = floor(totalPot / 2)
 * - potB = totalPot - potA
 * - 各ボードの勝者数で均等分割
 * - 端数処理: winner 配列の先頭から順に 1 チップずつ配布
 *   例: 500 チップを 3 人で分配 → [167, 167, 166]
 * - payouts の合計は必ず totalPot に等しい
 *
 * @param totalPot - 総ポット
 * @param boardAWinners - Board A の勝者プレイヤーID リスト
 * @param boardBWinners - Board B の勝者プレイヤーID リスト
 * @returns 各プレイヤーの支払い額を含む分配結果
 */
export function distributePot(
  totalPot: number,
  boardAWinners: string[],
  boardBWinners: string[],
): PotDistributionResult {
  const potA = Math.floor(totalPot / 2);
  const potB = totalPot - potA;

  const payouts: Record<string, number> = {};

  // 初期化: すべてのプレイヤーを 0 で初期化
  const allPlayers = new Set([...boardAWinners, ...boardBWinners]);
  allPlayers.forEach((player) => {
    payouts[player] = 0;
  });

  // Board A の分配
  if (boardAWinners.length > 0) {
    const baseShare = Math.floor(potA / boardAWinners.length);
    const remainder = potA % boardAWinners.length;

    boardAWinners.forEach((winner, index) => {
      let share = baseShare;
      if (index < remainder) {
        share += 1;
      }
      payouts[winner] += share;
    });
  }

  // Board B の分配
  if (boardBWinners.length > 0) {
    const baseShare = Math.floor(potB / boardBWinners.length);
    const remainder = potB % boardBWinners.length;

    boardBWinners.forEach((winner, index) => {
      let share = baseShare;
      if (index < remainder) {
        share += 1;
      }
      payouts[winner] += share;
    });
  }

  return {
    totalPot,
    potA,
    potB,
    boardAWinners,
    boardBWinners,
    payouts,
  };
}
