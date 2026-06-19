export enum HandRank {
  HighCard = 'HighCard',
  OnePair = 'OnePair',
  TwoPair = 'TwoPair',
  ThreeOfAKind = 'ThreeOfAKind',
  Straight = 'Straight',
  Flush = 'Flush',
  FullHouse = 'FullHouse',
  FourOfAKind = 'FourOfAKind',
  StraightFlush = 'StraightFlush',
  RoyalFlush = 'RoyalFlush',
}

export interface EvaluationResult {
  rank: HandRank;
  score: number;
  cards: string[];
  description: string;
}

const RANK_VALUE: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const HAND_RANK_SCORE: Record<HandRank, number> = {
  [HandRank.HighCard]: 1,
  [HandRank.OnePair]: 2,
  [HandRank.TwoPair]: 3,
  [HandRank.ThreeOfAKind]: 4,
  [HandRank.Straight]: 5,
  [HandRank.Flush]: 6,
  [HandRank.FullHouse]: 7,
  [HandRank.FourOfAKind]: 8,
  [HandRank.StraightFlush]: 9,
  [HandRank.RoyalFlush]: 10,
};

function parseCard(card: string) {
  const normalized = card.trim().toUpperCase();
  const match = /^([2-9TJQKA])([CDHS])$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid card string: ${card}`);
  }

  return {
    raw: `${match[1]}${match[2].toLowerCase()}`,
    rankSymbol: match[1],
    rank: RANK_VALUE[match[1]],
    suit: match[2].toLowerCase(),
  };
}

function getScoreValues(values: number[]): number {
  return values.reduce((acc, value) => acc * 15 + value, 0);
}

function detectStraight(ranks: number[]): { isStraight: boolean; topStraight: number } {
  const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => a - b);
  if (uniqueRanks.length !== 5) {
    return { isStraight: false, topStraight: 0 };
  }

  const max = uniqueRanks[4];
  const min = uniqueRanks[0];

  if (max - min === 4) {
    return { isStraight: true, topStraight: max };
  }

  const wheel = [2, 3, 4, 5, 14];
  if (uniqueRanks.every((value, index) => value === wheel[index])) {
    return { isStraight: true, topStraight: 5 };
  }

  return { isStraight: false, topStraight: 0 };
}

export function evaluateFiveCardHand(cards: string[]): EvaluationResult {
  if (cards.length !== 5) {
    throw new Error('evaluateFiveCardHand requires exactly 5 cards');
  }

  const parsed = cards.map(parseCard);
  const normalizedCards = parsed.map((card) => card.raw);
  const rankCounts = new Map<number, number>();
  const suitCounts = new Map<string, number>();

  parsed.forEach((card) => {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
    suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  });

  const isFlush = suitCounts.size === 1;
  const ranksDesc = parsed
    .map((card) => card.rank)
    .sort((a, b) => b - a);
  const { isStraight, topStraight } = detectStraight(parsed.map((card) => card.rank));

  const counts = Array.from(rankCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  let rank = HandRank.HighCard;
  let tiebreakers: number[] = [];
  let description = 'High card';

  const uniqueRanksDesc = Array.from(rankCounts.keys()).sort((a, b) => b - a);
  const countValues = counts.map(([, count]) => count);

  const isRoyal = isStraight && topStraight === 14 && isFlush;
  if (isRoyal) {
    rank = HandRank.RoyalFlush;
    tiebreakers = [14];
    description = 'Royal Flush';
  } else if (isFlush && isStraight) {
    rank = HandRank.StraightFlush;
    tiebreakers = [topStraight];
    description = `Straight Flush to ${topStraight}`;
  } else if (countValues[0] === 4) {
    rank = HandRank.FourOfAKind;
    const quadRank = counts[0][0];
    const kicker = uniqueRanksDesc.find((value) => value !== quadRank) ?? 0;
    tiebreakers = [quadRank, kicker];
    description = `Four of a Kind of ${quadRank}`;
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    rank = HandRank.FullHouse;
    const tripRank = counts[0][0];
    const pairRank = counts[1][0];
    tiebreakers = [tripRank, pairRank];
    description = `Full House ${tripRank} over ${pairRank}`;
  } else if (isFlush) {
    rank = HandRank.Flush;
    tiebreakers = ranksDesc;
    description = `Flush ${ranksDesc.join(',')}`;
  } else if (isStraight) {
    rank = HandRank.Straight;
    tiebreakers = [topStraight];
    description = `Straight to ${topStraight}`;
  } else if (countValues[0] === 3) {
    rank = HandRank.ThreeOfAKind;
    const tripRank = counts[0][0];
    const kickers = uniqueRanksDesc.filter((value) => value !== tripRank);
    tiebreakers = [tripRank, ...kickers];
    description = `Three of a Kind of ${tripRank}`;
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    rank = HandRank.TwoPair;
    const pairRanks = counts.slice(0, 2).map(([rank]) => rank).sort((a, b) => b - a);
    const kicker = uniqueRanksDesc.find((value) => value !== pairRanks[0] && value !== pairRanks[1]) ?? 0;
    tiebreakers = [...pairRanks, kicker];
    description = `Two Pair ${pairRanks[0]} and ${pairRanks[1]}`;
  } else if (countValues[0] === 2) {
    rank = HandRank.OnePair;
    const pairRank = counts[0][0];
    const kickers = uniqueRanksDesc.filter((value) => value !== pairRank);
    tiebreakers = [pairRank, ...kickers];
    description = `One Pair of ${pairRank}`;
  } else {
    rank = HandRank.HighCard;
    tiebreakers = ranksDesc;
    description = `High Card ${ranksDesc[0]}`;
  }

  const score = HAND_RANK_SCORE[rank] * 1_000_000 + getScoreValues(tiebreakers);

  return {
    rank,
    score,
    cards: normalizedCards,
    description,
  };
}

function combinations<T>(items: T[], k: number): T[][] {
  const result: T[][] = [];

  function helper(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }

    for (let i = start; i < items.length; i += 1) {
      current.push(items[i]);
      helper(i + 1, current);
      current.pop();
    }
  }

  helper(0, []);
  return result;
}

export function generateOmahaFiveCardHands(holeCards: string[], communityCards: string[]): string[][] {
  if (holeCards.length !== 4) {
    throw new Error('Omaha requires exactly 4 hole cards');
  }
  if (communityCards.length !== 5) {
    throw new Error('Omaha requires exactly 5 community cards');
  }

  const normalizedHole = holeCards.map((card) => parseCard(card).raw);
  const normalizedCommunity = communityCards.map((card) => parseCard(card).raw);
  const holeCombos = combinations(normalizedHole, 2);
  const boardCombos = combinations(normalizedCommunity, 3);

  return holeCombos.flatMap((holeCombo) => boardCombos.map((boardCombo) => [...holeCombo, ...boardCombo]));
}

export function compareHands(a: EvaluationResult, b: EvaluationResult): 1 | 0 | -1 {
  if (a.score > b.score) {
    return 1;
  }
  if (a.score < b.score) {
    return -1;
  }
  return 0;
}

export function evaluateOmahaHand(holeCards: string[], communityCards: string[]): EvaluationResult {
  const combos = generateOmahaFiveCardHands(holeCards, communityCards);
  if (combos.length !== 60) {
    throw new Error(`Omaha evaluation must consider 60 combinations, got ${combos.length}`);
  }

  let bestResult: EvaluationResult | null = null;

  combos.forEach((combo) => {
    const result = evaluateFiveCardHand(combo);
    if (!bestResult || compareHands(result, bestResult) === 1) {
      bestResult = result;
    }
  });

  if (!bestResult) {
    throw new Error('Failed to evaluate Omaha hand');
  }

  return bestResult;
}

export function evaluateDoubleBoard(
  holeCards: string[],
  boardA: string[],
  boardB: string[],
): {
  boardAResult: EvaluationResult;
  boardBResult: EvaluationResult;
} {
  const boardAResult = evaluateOmahaHand(holeCards, boardA);
  const boardBResult = evaluateOmahaHand(holeCards, boardB);

  return {
    boardAResult,
    boardBResult,
  };
}
