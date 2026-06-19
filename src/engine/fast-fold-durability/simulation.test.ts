import { createDurabilityReport, formatDurabilityReport, simulateFastFold100Hands } from './simulation';

describe('Fast Fold 100-hand simulation', () => {
  it('runs 100 consecutive hands, saves hand history, and builds a durability report', () => {
    const result = simulateFastFold100Hands();

    expect(result.handRecords).toHaveLength(100);
    expect(result.handRecords.every((record) => record.isFinalized)).toBe(true);
    expect(result.handRecords.every((record) => typeof record.handStartToActionableMs === 'number')).toBe(true);
    expect(result.handRecords.every((record) => typeof record.foldToNextHandMs === 'number')).toBe(true);

    expect(result.report.sessionHandsPlayed).toBe(100);
    expect(result.report.completionRate).toBe(100);
    expect(result.report.historyMissingCount).toBe(0);
    expect(result.report.errorCount).toBe(0);
    expect(result.report.crashCount).toBe(0);
    expect(result.report.foldToNextHandMs.p95).toBeGreaterThanOrEqual(0);
    expect(result.report.handStartToActionableMs.p95).toBeGreaterThanOrEqual(0);
    expect(result.report.passFail).toBe('PASS');

    const recomputed = createDurabilityReport(result.handRecords);
    expect(recomputed.sessionHandsPlayed).toBe(100);
    expect(recomputed.historyMissingCount).toBe(0);
    expect(recomputed.crashCount).toBe(0);

    const formatted = formatDurabilityReport(result.report);
    expect(formatted).toContain('# Test Result');
    expect(formatted).toContain('Hands Played: 100');
    expect(formatted).toContain('Completion Rate: 100.00%');
    expect(formatted).toContain('History Missing: 0');
    expect(formatted).toContain('Error Count: 0');
    expect(formatted).toContain('Crash Count: 0');
    expect(formatted).toContain('foldToNextHandMs:');
    expect(formatted).toContain('p95:');
    expect(formatted).toContain('handStartToActionableMs:');
    expect(formatted).toContain('Pass/Fail: PASS');
  });
});