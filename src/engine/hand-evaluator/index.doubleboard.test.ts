import { evaluateDoubleBoard, evaluateFiveCardHand, HandRank, compareHands } from './index';

describe('evaluateDoubleBoard', () => {
  it('BoardA が勝利するケース', () => {
    const holeCards = ['Ah', 'Ad', 'Ks', 'Qc'];
    const boardA = ['Kh', 'Qh', 'Jh', 'Th', '2d'];
    const boardB = ['2h', '3d', '4s', '5c', '7d'];
    const result = evaluateDoubleBoard(holeCards, boardA, boardB);
    expect(compareHands(result.boardAResult, result.boardBResult)).toBe(1);
  });

  it('BoardB が勝利するケース', () => {
    const holeCards = ['Ah', 'Ad', 'Ks', 'Qc'];
    const boardA = ['2h', '3d', '4s', '5c', '7d'];
    const boardB = ['Kh', 'Qh', 'Jh', 'Th', '2d'];
    const result = evaluateDoubleBoard(holeCards, boardA, boardB);
    expect(compareHands(result.boardAResult, result.boardBResult)).toBe(-1);
  });

  it('BoardA と BoardB が同じ強さになるケース', () => {
    const holeCards = ['Ah', 'Ad', 'Ks', 'Qc'];
    const boardA = ['Kh', 'Qh', 'Jh', '2c', '3d'];
    const boardB = ['Kh', 'Qh', 'Js', '2c', '3d'];
    const result = evaluateDoubleBoard(holeCards, boardA, boardB);
    expect(compareHands(result.boardAResult, result.boardBResult)).toBe(0);
  });

  it('BoardA と BoardB で勝者が異なるケース', () => {
    const holeCards = ['Ah', 'Kd', 'Qs', 'Jc'];
    const boardA = ['2h', '3d', '4s', '5c', '6d'];
    const boardB = ['Th', 'Jh', 'Qc', 'Kc', '2d'];
    const result = evaluateDoubleBoard(holeCards, boardA, boardB);
    expect(compareHands(result.boardAResult, result.boardBResult)).toBe(-1);
  });
});
