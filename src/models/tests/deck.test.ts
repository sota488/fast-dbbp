import { Deck } from '../deck';

describe('Deck model', () => {
  it('52枚生成されること', () => {
    const deck = new Deck();
    expect(deck.remainingCards()).toBe(52);
  });

  it('重複なしで52枚保持されること', () => {
    const deck = new Deck();
    const cards = new Set(deck['cards'].map(card => `${card.rank}${card.suit}`));
    expect(cards.size).toBe(52);
  });

  it('shuffle後も52枚であること', () => {
    const deck = new Deck();
    deck.shuffle();
    expect(deck.remainingCards()).toBe(52);
  });

  it('6人へ4枚配布し、残り28枚になること', () => {
    const deck = new Deck();
    const dealt = deck.dealHoleCards(6);
    expect(dealt).toHaveLength(6);
    dealt.forEach((playerCards) => {
      expect(playerCards).toHaveLength(4);
    });
    expect(deck.remainingCards()).toBe(28);
  });

  it('6人配布後にダブルボードを生成すると残り18枚になること', () => {
    const deck = new Deck();
    const dealt = deck.dealHoleCards(6);
    expect(dealt).toHaveLength(6);
    expect(deck.remainingCards()).toBe(28);

    const boards = deck.dealDoubleBoard();
    expect(boards.boardA).toHaveLength(5);
    expect(boards.boardB).toHaveLength(5);
    expect(deck.remainingCards()).toBe(18);
  });
});
