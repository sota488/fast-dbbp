import { distributePot, PotDistributionResult } from './index';

describe('distributePot', () => {
  const assertPayoutsSum = (result: PotDistributionResult) => {
    const sum = Object.values(result.payouts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(result.totalPot);
  };

  // TC-01: Single Winner Both Boards (同一プレイヤー)
  it('TC-01: Single Winner Both Boards (同一プレイヤー)', () => {
    const result = distributePot(1000, ['PlayerA'], ['PlayerA']);
    expect(result.totalPot).toBe(1000);
    expect(result.potA).toBe(500);
    expect(result.potB).toBe(500);
    expect(result.payouts['PlayerA']).toBe(1000);
    assertPayoutsSum(result);
  });

  // TC-02: Single Winner Both Boards (異なるプレイヤー)
  it('TC-02: Single Winner Both Boards (異なるプレイヤー)', () => {
    const result = distributePot(1000, ['PlayerA'], ['PlayerB']);
    expect(result.payouts['PlayerA']).toBe(500);
    expect(result.payouts['PlayerB']).toBe(500);
    assertPayoutsSum(result);
  });

  // TC-03: Half Split on Board A
  it('TC-03: Half Split on Board A', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB'], ['PlayerA']);
    expect(result.payouts['PlayerA']).toBe(750);
    expect(result.payouts['PlayerB']).toBe(250);
    assertPayoutsSum(result);
  });

  // TC-04: Half Split on Board B
  it('TC-04: Half Split on Board B', () => {
    const result = distributePot(1000, ['PlayerA'], ['PlayerA', 'PlayerB']);
    expect(result.payouts['PlayerA']).toBe(750);
    expect(result.payouts['PlayerB']).toBe(250);
    assertPayoutsSum(result);
  });

  // TC-05: Half Split on Both Boards (同じペア)
  it('TC-05: Half Split on Both Boards (同じペア)', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB'], ['PlayerA', 'PlayerB']);
    expect(result.payouts['PlayerA']).toBe(500);
    expect(result.payouts['PlayerB']).toBe(500);
    assertPayoutsSum(result);
  });

  // TC-06: Half Split on Both Boards (異なるペア)
  it('TC-06: Half Split on Both Boards (異なるペア)', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB'], ['PlayerC', 'PlayerD']);
    expect(result.payouts['PlayerA']).toBe(250);
    expect(result.payouts['PlayerB']).toBe(250);
    expect(result.payouts['PlayerC']).toBe(250);
    expect(result.payouts['PlayerD']).toBe(250);
    assertPayoutsSum(result);
  });

  // TC-07: Quarter Pot (Single + Half)
  it('TC-07: Quarter Pot (Single + Half)', () => {
    const result = distributePot(1000, ['PlayerA'], ['PlayerA', 'PlayerB']);
    expect(result.payouts['PlayerA']).toBe(750);
    expect(result.payouts['PlayerB']).toBe(250);
    assertPayoutsSum(result);
  });

  // TC-08: Quarter Pot (Half + Single)
  it('TC-08: Quarter Pot (Half + Single)', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB'], ['PlayerA']);
    expect(result.payouts['PlayerA']).toBe(750);
    expect(result.payouts['PlayerB']).toBe(250);
    assertPayoutsSum(result);
  });

  // TC-09: Quarter Pot (Half + Half with One Common)
  it('TC-09: Quarter Pot (Half + Half with One Common)', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB'], ['PlayerB', 'PlayerC']);
    expect(result.payouts['PlayerA']).toBe(250);
    expect(result.payouts['PlayerB']).toBe(500);
    expect(result.payouts['PlayerC']).toBe(250);
    assertPayoutsSum(result);
  });

  // TC-10: 3-way Split on Board A
  it('TC-10: 3-way Split on Board A', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB', 'PlayerC'], ['PlayerA']);
    expect(result.payouts['PlayerA']).toBe(667);
    expect(result.payouts['PlayerB']).toBe(167);
    expect(result.payouts['PlayerC']).toBe(166);
    assertPayoutsSum(result);
  });

  // TC-11: 3-way Split on Board B
  it('TC-11: 3-way Split on Board B', () => {
    const result = distributePot(1000, ['PlayerA'], ['PlayerA', 'PlayerB', 'PlayerC']);
    expect(result.payouts['PlayerA']).toBe(667);
    expect(result.payouts['PlayerB']).toBe(167);
    expect(result.payouts['PlayerC']).toBe(166);
    assertPayoutsSum(result);
  });

  // TC-12: 3-way Split on Both Boards (同じ3人)
  it('TC-12: 3-way Split on Both Boards (同じ3人)', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB', 'PlayerC'], ['PlayerA', 'PlayerB', 'PlayerC']);
    expect(result.payouts['PlayerA']).toBe(334);
    expect(result.payouts['PlayerB']).toBe(334);
    expect(result.payouts['PlayerC']).toBe(332);
    assertPayoutsSum(result);
  });

  // TC-13: 4-way Split on Board A
  it('TC-13: 4-way Split on Board A', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD'], ['PlayerA']);
    expect(result.payouts['PlayerA']).toBe(625);
    expect(result.payouts['PlayerB']).toBe(125);
    expect(result.payouts['PlayerC']).toBe(125);
    expect(result.payouts['PlayerD']).toBe(125);
    assertPayoutsSum(result);
  });

  // TC-14: 5-way Split on Board B
  it('TC-14: 5-way Split on Board B', () => {
    const result = distributePot(1000, ['PlayerA'], ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD', 'PlayerE']);
    expect(result.payouts['PlayerA']).toBe(600);
    expect(result.payouts['PlayerB']).toBe(100);
    expect(result.payouts['PlayerC']).toBe(100);
    expect(result.payouts['PlayerD']).toBe(100);
    expect(result.payouts['PlayerE']).toBe(100);
    assertPayoutsSum(result);
  });

  // TC-15: 3-way and 2-way Split (異なるペア)
  it('TC-15: 3-way and 2-way Split (異なるペア)', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB', 'PlayerC'], ['PlayerD', 'PlayerE']);
    expect(result.payouts['PlayerA']).toBe(167);
    expect(result.payouts['PlayerB']).toBe(167);
    expect(result.payouts['PlayerC']).toBe(166);
    expect(result.payouts['PlayerD']).toBe(250);
    expect(result.payouts['PlayerE']).toBe(250);
    assertPayoutsSum(result);
  });

  // TC-16: 4-way and 3-way Split (1人共通)
  it('TC-16: 4-way and 3-way Split (1人共通)', () => {
    const result = distributePot(1000, ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD'], ['PlayerA', 'PlayerB', 'PlayerC']);
    expect(result.payouts['PlayerA']).toBe(292);
    expect(result.payouts['PlayerB']).toBe(292);
    expect(result.payouts['PlayerC']).toBe(291);
    expect(result.payouts['PlayerD']).toBe(125);
    assertPayoutsSum(result);
  });

  // TC-17: Completely Different Winners
  it('TC-17: Completely Different Winners', () => {
    const result = distributePot(2000, ['PlayerA', 'PlayerB'], ['PlayerC', 'PlayerD', 'PlayerE']);
    expect(result.payouts['PlayerA']).toBe(500);
    expect(result.payouts['PlayerB']).toBe(500);
    expect(result.payouts['PlayerC']).toBe(334);
    expect(result.payouts['PlayerD']).toBe(333);
    expect(result.payouts['PlayerE']).toBe(333);
    assertPayoutsSum(result);
  });

  // TC-18: One Common Winner
  it('TC-18: One Common Winner', () => {
    const result = distributePot(2000, ['PlayerA', 'PlayerB', 'PlayerC'], ['PlayerC', 'PlayerD']);
    expect(result.payouts['PlayerA']).toBe(334);
    expect(result.payouts['PlayerB']).toBe(333);
    expect(result.payouts['PlayerC']).toBe(833);
    expect(result.payouts['PlayerD']).toBe(500);
    assertPayoutsSum(result);
  });

  // TC-19: Zero Pot
  it('TC-19: Zero Pot', () => {
    const result = distributePot(0, ['PlayerA'], ['PlayerA']);
    expect(result.totalPot).toBe(0);
    expect(result.potA).toBe(0);
    expect(result.potB).toBe(0);
    expect(result.payouts['PlayerA']).toBe(0);
    assertPayoutsSum(result);
  });

  // TC-20: Single Player on Both Boards (No Split)
  it('TC-20: Single Player on Both Boards (No Split)', () => {
    const result = distributePot(500, ['PlayerA'], ['PlayerA']);
    expect(result.totalPot).toBe(500);
    expect(result.potA).toBe(250);
    expect(result.potB).toBe(250);
    expect(result.payouts['PlayerA']).toBe(500);
    assertPayoutsSum(result);
  });
});
