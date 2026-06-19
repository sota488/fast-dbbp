import { evaluateOmahaHand, generateOmahaFiveCardHands, HandRank } from './index';

describe('evaluateOmahaHand', () => {
  it('60通りの組み合わせを生成すること', () => {
    const combos = generateOmahaFiveCardHands(['Ac', 'Ad', 'Ks', 'Qh'], ['2c', '3d', '4h', '5s', '6d']);
    expect(combos).toHaveLength(60);
    combos.forEach((combo) => {
      expect(combo).toHaveLength(5);
      const holeCount = combo.filter((card) => ['Ac', 'Ad', 'Ks', 'Qh'].includes(card)).length;
      expect(holeCount).toBe(2);
    });
  });

  it('ホールカード2枚必須で評価する', () => {
    const result = evaluateOmahaHand(['Ac', 'Ad', 'Ks', 'Qh'], ['2c', '3d', '4h', '5s', '6d']);
    expect(result.rank).toBe(HandRank.OnePair);
  });

  it('ホールカード1枚使用の組み合わせは存在しない', () => {
    const combos = generateOmahaFiveCardHands(['Ac', 'Ad', 'Ks', 'Qh'], ['2c', '3d', '4h', '5s', '6d']);
    combos.forEach((combo) => {
      const holeCount = combo.filter((card) => ['Ac', 'Ad', 'Ks', 'Qh'].includes(card)).length;
      expect(holeCount).toBe(2);
    });
  });

  it('ボードだけで完成するフラッシュは評価に含まれない', () => {
    const result = evaluateOmahaHand(['Ac', 'Ad', 'Ks', 'Qh'], ['2h', '5h', '7h', '9h', 'Kh']);
    expect(result.rank).not.toBe(HandRank.Flush);
    expect(result.rank).not.toBe(HandRank.StraightFlush);
    expect(result.rank).not.toBe(HandRank.RoyalFlush);
  });

  it('ボードだけで完成するストレートは評価に含まれない', () => {
    const result = evaluateOmahaHand(['Ac', 'Ad', 'Ks', 'Qh'], ['2c', '3d', '4h', '5s', '6d']);
    expect(result.rank).not.toBe(HandRank.Straight);
    expect(result.rank).not.toBe(HandRank.StraightFlush);
  });

  it('最良の組み合わせを60通りから選択する', () => {
    const result = evaluateOmahaHand(['Ah', 'Kh', 'Qd', '2c'], ['Jh', 'Td', '3s', '4c', '5d']);
    expect(result.rank).toBe(HandRank.Straight);
    expect(result.description).toContain('Straight');
  });
});
