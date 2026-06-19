import { evaluateFiveCardHand, HandRank } from './index';

describe('evaluateFiveCardHand', () => {
  const assertRank = (cards: string[], expectedRank: HandRank) => {
    const result = evaluateFiveCardHand(cards);
    expect(result.rank).toBe(expectedRank);
  };

  it('High Card を判定する', () => {
    assertRank(['2c', '5d', '7h', '9s', 'Jd'], HandRank.HighCard);
  });

  it('One Pair を判定する', () => {
    assertRank(['2c', '2d', '5h', '9s', 'Jd'], HandRank.OnePair);
  });

  it('Two Pair を判定する', () => {
    assertRank(['2c', '2d', '5h', '5s', 'Jd'], HandRank.TwoPair);
  });

  it('Three of a Kind を判定する', () => {
    assertRank(['2c', '2d', '2h', '9s', 'Jd'], HandRank.ThreeOfAKind);
  });

  it('Straight を判定する', () => {
    assertRank(['2c', '3d', '4h', '5s', '6d'], HandRank.Straight);
  });

  it('Wheel Straight (A2345) を判定する', () => {
    assertRank(['Ac', '2d', '3h', '4s', '5d'], HandRank.Straight);
  });

  it('Broadway Straight (TJQKA) を判定する', () => {
    assertRank(['Tc', 'Jd', 'Qh', 'Ks', 'Ad'], HandRank.Straight);
  });

  it('Flush を判定する', () => {
    assertRank(['2h', '5h', '7h', '9h', 'Kh'], HandRank.Flush);
  });

  it('Full House を判定する', () => {
    assertRank(['2c', '2d', '2h', '9s', '9d'], HandRank.FullHouse);
  });

  it('Four of a Kind を判定する', () => {
    assertRank(['2c', '2d', '2h', '2s', '9d'], HandRank.FourOfAKind);
  });

  it('Straight Flush を判定する', () => {
    assertRank(['2h', '3h', '4h', '5h', '6h'], HandRank.StraightFlush);
  });

  it('Royal Flush を判定する', () => {
    assertRank(['Th', 'Jh', 'Qh', 'Kh', 'Ah'], HandRank.RoyalFlush);
  });

  it('High Card 比較のスコア順序を確認する', () => {
    const low = evaluateFiveCardHand(['2c', '5d', '7h', '9s', 'Jd']).score;
    const high = evaluateFiveCardHand(['3c', '6d', '8h', 'Ts', 'Qd']).score;
    expect(high).toBeGreaterThan(low);
  });

  it('One Pair はキッカーで比較できる', () => {
    const pairLow = evaluateFiveCardHand(['2c', '2d', '5h', '9s', 'Jd']).score;
    const pairHigh = evaluateFiveCardHand(['2c', '2d', '6h', '9s', 'Jd']).score;
    expect(pairHigh).toBeGreaterThan(pairLow);
  });

  it('Two Pair はより高いペアで比較できる', () => {
    const low = evaluateFiveCardHand(['2c', '2d', '3h', '3s', 'Jd']).score;
    const high = evaluateFiveCardHand(['2c', '2d', '4h', '4s', 'Jd']).score;
    expect(high).toBeGreaterThan(low);
  });

  it('Three of a Kind はキッカーで比較できる', () => {
    const low = evaluateFiveCardHand(['2c', '2d', '2h', '5s', '9d']).score;
    const high = evaluateFiveCardHand(['2c', '2d', '2h', '6s', '9d']).score;
    expect(high).toBeGreaterThan(low);
  });

  it('Straight はトップカードで比較できる', () => {
    const low = evaluateFiveCardHand(['2c', '3d', '4h', '5s', '6d']).score;
    const high = evaluateFiveCardHand(['3c', '4d', '5h', '6s', '7d']).score;
    expect(high).toBeGreaterThan(low);
  });

  it('Wheel Straight は最小ランクのストレート', () => {
    const wheel = evaluateFiveCardHand(['Ac', '2d', '3h', '4s', '5d']);
    expect(wheel.rank).toBe(HandRank.Straight);
    expect(wheel.score).toBeLessThan(evaluateFiveCardHand(['2c', '3d', '4h', '5s', '6d']).score);
  });

  it('Flush はハイカードで比較できる', () => {
    const low = evaluateFiveCardHand(['2h', '5h', '7h', '9h', 'Kh']).score;
    const high = evaluateFiveCardHand(['3h', '6h', '8h', 'Th', 'Ah']).score;
    expect(high).toBeGreaterThan(low);
  });

  it('Full House はトリップスで比較できる', () => {
    const low = evaluateFiveCardHand(['2c', '2d', '2h', '9s', '9d']).score;
    const high = evaluateFiveCardHand(['3c', '3d', '3h', '8s', '8d']).score;
    expect(high).toBeGreaterThan(low);
  });

  it('Four of a Kind はクアッズで比較できる', () => {
    const low = evaluateFiveCardHand(['2c', '2d', '2h', '2s', '9d']).score;
    const high = evaluateFiveCardHand(['3c', '3d', '3h', '3s', '2d']).score;
    expect(high).toBeGreaterThan(low);
  });

  it('Straight Flush はトップカードで比較できる', () => {
    const low = evaluateFiveCardHand(['2h', '3h', '4h', '5h', '6h']).score;
    const high = evaluateFiveCardHand(['3h', '4h', '5h', '6h', '7h']).score;
    expect(high).toBeGreaterThan(low);
  });

  it('Royal Flush は最高ランクであること', () => {
    const royal = evaluateFiveCardHand(['Th', 'Jh', 'Qh', 'Kh', 'Ah']).score;
    const straightFlush = evaluateFiveCardHand(['9h', 'Th', 'Jh', 'Qh', 'Kh']).score;
    expect(royal).toBeGreaterThan(straightFlush);
  });

  it('同じ役の手はスコア比較で正しく判定されること', () => {
    const handA = evaluateFiveCardHand(['2c', '3d', '5h', '9s', 'Kd']);
    const handB = evaluateFiveCardHand(['2d', '3h', '5s', '9c', 'Qh']);
    expect(handA.score).toBeGreaterThan(handB.score);
  });

  it('ストレートとフラッシュの比較でフラッシュが勝つ', () => {
    const straight = evaluateFiveCardHand(['2c', '3d', '4h', '5s', '6d']).score;
    const flush = evaluateFiveCardHand(['2h', '5h', '7h', '9h', 'Kh']).score;
    expect(flush).toBeGreaterThan(straight);
  });

  it('フラッシュとフルハウスの比較でフルハウスが勝つ', () => {
    const flush = evaluateFiveCardHand(['2h', '5h', '7h', '9h', 'Kh']).score;
    const fullHouse = evaluateFiveCardHand(['2c', '2d', '2h', '9s', '9d']).score;
    expect(fullHouse).toBeGreaterThan(flush);
  });

  it('フルハウスとフォーカードの比較でフォーカードが勝つ', () => {
    const fullHouse = evaluateFiveCardHand(['2c', '2d', '2h', '9s', '9d']).score;
    const quad = evaluateFiveCardHand(['3c', '3d', '3h', '3s', '2d']).score;
    expect(quad).toBeGreaterThan(fullHouse);
  });

  it('ワイルドカードなしの正しいランク判定', () => {
    assertRank(['7c', '8d', '9h', 'Tc', 'Js'], HandRank.Straight);
  });

  it('Ace はストレートで最高ランクとして扱われる', () => {
    assertRank(['Tc', 'Jd', 'Qh', 'Ks', 'Ad'], HandRank.Straight);
  });

  it('Ace はストレートで最小ランクとして扱われる', () => {
    assertRank(['Ac', '2d', '3h', '4s', '5c'], HandRank.Straight);
  });
});
