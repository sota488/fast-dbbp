import { Card, Rank, Suit, createCard } from './card';

export class Deck {
  private cards: Card[];

  constructor() {
    this.cards = Deck.generateCards();
  }

  static generateCards(): Card[] {
    const cards: Card[] = [];
    const ranks = Object.values(Rank) as Array<Rank>;
    const suits = Object.values(Suit) as Array<Suit>;

    for (const suit of suits) {
      for (const rank of ranks) {
        cards.push(createCard(rank, suit));
      }
    }

    return cards;
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(): Card | undefined {
    return this.cards.shift();
  }

  remainingCards(): number {
    return this.cards.length;
  }

  dealHoleCards(playerCount: number): Card[][] {
    const totalCards = playerCount * 4;
    if (totalCards > this.remainingCards()) {
      throw new Error('Not enough cards to deal hole cards');
    }

    const dealt: Card[][] = [];
    for (let player = 0; player < playerCount; player += 1) {
      const playerCards: Card[] = [];
      for (let cardIndex = 0; cardIndex < 4; cardIndex += 1) {
        const card = this.draw();
        if (!card) {
          throw new Error('Unexpected empty deck while dealing hole cards');
        }
        playerCards.push(card);
      }
      dealt.push(playerCards);
    }

    return dealt;
  }

  dealDoubleBoard(): { boardA: Card[]; boardB: Card[] } {
    if (this.remainingCards() < 10) {
      throw new Error('Not enough cards to deal double boards');
    }

    const boardA: Card[] = [];
    const boardB: Card[] = [];

    for (let i = 0; i < 5; i += 1) {
      const card = this.draw();
      if (!card) {
        throw new Error('Unexpected empty deck while dealing board A');
      }
      boardA.push(card);
    }

    for (let i = 0; i < 5; i += 1) {
      const card = this.draw();
      if (!card) {
        throw new Error('Unexpected empty deck while dealing board B');
      }
      boardB.push(card);
    }

    return { boardA, boardB };
  }
}
