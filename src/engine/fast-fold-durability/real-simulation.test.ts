import { simulateFastFold100HandsThroughEngine } from './real-simulation';

describe('Fast Fold 100-hand real engine simulation', () => {
  it('routes through queue, assignment, game coordinator, persistence, and hand history', () => {
    const result = simulateFastFold100HandsThroughEngine();

    expect(result.executionPath.queueEngine).toBe(true);
    expect(result.executionPath.tableAssignment).toBe(true);
    expect(result.executionPath.gameCoordinator).toBe(true);
    expect(result.executionPath.persistence).toBe(true);
    expect(result.executionPath.handHistory).toBe(true);

    expect(result.handRecords).toHaveLength(100);
    expect(result.report.sessionHandsPlayed).toBe(100);
    expect(result.report.completionRate).toBe(100);
    expect(result.report.historyMissingCount).toBe(0);
    expect(result.report.crashCount).toBe(0);
    expect(result.report.passFail).toBe('PASS');
    expect(result.metricSource.foldToNextHandMs).toBe('synthetic');
    expect(result.metricSource.handStartToActionableMs).toBe('synthetic');
    expect(result.summaryText).toContain('MetricSource: synthetic');
    expect(result.summaryText).toContain('foldToNextHandMs (Synthetic Metrics):');
    expect(result.summaryText).toContain('handStartToActionableMs (Synthetic Metrics):');
    expect(result.summaryText).toContain('foldToNextHandMs:');
    expect(result.summaryText).toContain('p50:');
    expect(result.summaryText).toContain('p95:');
    expect(result.summaryText).toContain('p99:');
    expect(result.summaryText).toContain('avg:');
    expect(result.summaryText).toContain('max:');
    expect(result.summaryText).toContain('1-20');
    expect(result.summaryText).toContain('21-40');
    expect(result.summaryText).toContain('41-60');
    expect(result.summaryText).toContain('61-80');
    expect(result.summaryText).toContain('81-100');
    expect(result.segmentSummaries).toHaveLength(5);
    expect(result.segmentSummaries[0].rangeLabel).toBe('1-20');
  });
});