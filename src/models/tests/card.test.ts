import { Suit, Rank, createCard, cardToString } from '../card';

describe('Card model', () => {
  it('生成できること', () => {
    const card = createCard(Rank.Ace, Suit.Spades);
    expect(card).toEqual({ rank: Rank.Ace, suit: Suit.Spades });
  });

  it('cardToString は期待どおりの文字列を返す', () => {
    const card = createCard(Rank.Ace, Suit.Spades);
    expect(cardToString(card)).toBe('As');
  });

  it('全ての Suit を列挙できること', () => {
    const suits = Object.values(Suit);
    expect(suits).toEqual(['c', 'd', 'h', 's']);
  });

  it('全ての Rank を列挙できること', () => {
    const ranks = Object.values(Rank);
    expect(ranks).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']);
  });
});
