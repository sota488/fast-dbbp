export enum Suit {
  Clubs = 'c',
  Diamonds = 'd',
  Hearts = 'h',
  Spades = 's',
}

export enum Rank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = 'T',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

export interface Card {
  rank: Rank;
  suit: Suit;
}

export function createCard(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}
