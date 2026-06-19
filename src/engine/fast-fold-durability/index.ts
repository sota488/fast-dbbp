export interface FastFoldDurabilitySample {
  handNumber: number;
  foldToNextHandMs?: number;
  handStartToActionableMs?: number;
  hasHistory: boolean;
  errors: string[];
  crashed: boolean;
}

type MetricSummary = {
  avg: number;
  median: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

export interface FastFoldDurabilityReport {
  sessionHandsPlayed: number;
  sessionDropOffAtHand: number | null;
  historyMissingCount: number;
  errorCount: number;
  crashCount: number;
  completionRate: number;
  foldToNextHandMs: MetricSummary;
  handStartToActionableMs: MetricSummary;
  passFail: 'PASS' | 'FAIL';
}

function summarizeMetric(values: number[]): MetricSummary {
  if (values.length === 0) {
    return {
      avg: 0,
      median: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const sum = sorted.reduce((total, value) => total + value, 0);

  const percentile = (ratio: number): number => {
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index];
  };

  const median = percentile(0.5);

  return {
    avg: sum / sorted.length,
    median,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted[sorted.length - 1],
  };
}

export function summarizeFastFoldDurabilitySession(samples: FastFoldDurabilitySample[]): FastFoldDurabilityReport {
  const successfulSamples = samples.filter(
    (sample) =>
      sample.hasHistory &&
      !sample.crashed &&
      sample.errors.length === 0 &&
      typeof sample.foldToNextHandMs === 'number' &&
      typeof sample.handStartToActionableMs === 'number',
  );

  const foldToNextHandValues = successfulSamples
    .map((sample) => sample.foldToNextHandMs)
    .filter((value): value is number => typeof value === 'number');

  const handStartToActionableValues = successfulSamples
    .map((sample) => sample.handStartToActionableMs)
    .filter((value): value is number => typeof value === 'number');

  const historyMissingCount = samples.filter((sample) => !sample.hasHistory).length;
  const errorCount = samples.reduce(
    (total, sample) => total + (sample.crashed ? 0 : sample.errors.length),
    0,
  );
  const crashCount = samples.filter((sample) => sample.crashed).length;
  const firstFailure = samples.find(
    (sample) => !sample.hasHistory || sample.crashed || sample.errors.length > 0,
  );

  const sessionHandsPlayed = successfulSamples.length;
  const completionRate = samples.length === 0 ? 0 : (sessionHandsPlayed / samples.length) * 100;

  return {
    sessionHandsPlayed,
    sessionDropOffAtHand: firstFailure ? firstFailure.handNumber : null,
    historyMissingCount,
    errorCount,
    crashCount,
    completionRate,
    foldToNextHandMs: summarizeMetric(foldToNextHandValues),
    handStartToActionableMs: summarizeMetric(handStartToActionableValues),
    passFail:
      samples.length === 100 &&
      sessionHandsPlayed === 100 &&
      historyMissingCount === 0 &&
      errorCount === 0 &&
      crashCount === 0 &&
      firstFailure === undefined
        ? 'PASS'
        : 'FAIL',
  };
}

function formatMetricSection(name: string, metric: MetricSummary): string {
  return [
    `${name}:`,
    `avg: ${metric.avg.toFixed(3)}`,
    `median: ${metric.median.toFixed(3)}`,
    `p50: ${metric.p50.toFixed(3)}`,
    `p95: ${metric.p95.toFixed(3)}`,
    `p99: ${metric.p99.toFixed(3)}`,
    `max: ${metric.max.toFixed(3)}`,
  ].join('\n');
}

export function formatFastFoldDurabilityReport(report: FastFoldDurabilityReport): string {
  return [
    '# Test Result',
    `Hands Played: ${report.sessionHandsPlayed}`,
    `Drop Off At Hand: ${report.sessionDropOffAtHand ?? '-'}`,
    formatMetricSection('foldToNextHandMs', report.foldToNextHandMs),
    formatMetricSection('handStartToActionableMs', report.handStartToActionableMs),
    `Errors: ${report.errorCount}`,
    `History Missing: ${report.historyMissingCount}`,
    `Crashes: ${report.crashCount}`,
    `Completion Rate: ${report.completionRate.toFixed(2)}%`,
    `Pass/Fail: ${report.passFail}`,
  ].join('\n\n');
}