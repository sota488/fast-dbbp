import {
  formatFastFoldDurabilityReport,
  summarizeFastFoldDurabilitySession,
  type FastFoldDurabilitySample,
} from './index';

function createSamples(count: number, overrides: Partial<FastFoldDurabilitySample> = {}): FastFoldDurabilitySample[] {
  return Array.from({ length: count }, (_, index) => ({
    handNumber: index + 1,
    foldToNextHandMs: 12,
    handStartToActionableMs: 6,
    hasHistory: true,
    errors: [],
    crashed: false,
    ...overrides,
  }));
}

describe('fast fold durability report', () => {
  it('summarizes a clean 100-hand session', () => {
    const report = summarizeFastFoldDurabilitySession(createSamples(100));

    expect(report.sessionHandsPlayed).toBe(100);
    expect(report.historyMissingCount).toBe(0);
    expect(report.errorCount).toBe(0);
    expect(report.crashCount).toBe(0);
    expect(report.sessionDropOffAtHand).toBeNull();
    expect(report.completionRate).toBe(100);
    expect(report.foldToNextHandMs.avg).toBe(12);
    expect(report.foldToNextHandMs.p50).toBe(12);
    expect(report.foldToNextHandMs.p95).toBe(12);
    expect(report.foldToNextHandMs.p99).toBe(12);
    expect(report.foldToNextHandMs.max).toBe(12);
    expect(report.handStartToActionableMs.avg).toBe(6);
    expect(report.passFail).toBe('PASS');

    const formatted = formatFastFoldDurabilityReport(report);
    expect(formatted).toContain('# Test Result');
    expect(formatted).toContain('Hands Played:');
    expect(formatted).toContain('100');
    expect(formatted).toContain('foldToNextHandMs:');
    expect(formatted).toContain('avg: 12');
    expect(formatted).toContain('handStartToActionableMs:');
    expect(formatted).toContain('Pass/Fail: PASS');
  });

  it('tracks the first drop-off and issue counts', () => {
    const samples = [
      ...createSamples(97),
      {
        handNumber: 98,
        foldToNextHandMs: undefined,
        handStartToActionableMs: undefined,
        hasHistory: true,
        errors: ['network error'],
        crashed: false,
      },
      {
        handNumber: 99,
        foldToNextHandMs: undefined,
        handStartToActionableMs: undefined,
        hasHistory: false,
        errors: [],
        crashed: false,
      },
      {
        handNumber: 100,
        foldToNextHandMs: undefined,
        handStartToActionableMs: undefined,
        hasHistory: false,
        errors: ['crash'],
        crashed: true,
      },
    ] satisfies FastFoldDurabilitySample[];

    const report = summarizeFastFoldDurabilitySession(samples);

    expect(report.sessionHandsPlayed).toBe(97);
    expect(report.historyMissingCount).toBe(2);
    expect(report.errorCount).toBe(1);
    expect(report.crashCount).toBe(1);
    expect(report.sessionDropOffAtHand).toBe(98);
    expect(report.completionRate).toBe(97);
    expect(report.passFail).toBe('FAIL');

    const formatted = formatFastFoldDurabilityReport(report);
    expect(formatted).toContain('Hands Played: 97');
    expect(formatted).toContain('History Missing: 2');
    expect(formatted).toContain('Errors: 1');
    expect(formatted).toContain('Pass/Fail: FAIL');
  });
});