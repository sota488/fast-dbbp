import { HandHistoryEngine } from '../hand-history';
import type {
  ActionAppliedEvent,
  FastFoldConfirmedEvent,
  HandCompletedEvent,
  HandRecord,
  HandRecordFinalizedEvent,
  HandStartedEvent,
  PlayerSnapshot,
} from '../hand-history/types';
import {
  formatFastFoldDurabilityReport,
  summarizeFastFoldDurabilitySession,
  type FastFoldDurabilityReport,
  type FastFoldDurabilitySample,
} from './index';

export interface FastFoldSimulationResult {
  handRecords: HandRecord[];
  report: FastFoldDurabilityReport;
  formattedReport: string;
}

function createPlayers(): PlayerSnapshot[] {
  return [
    { playerId: 'hero', playerType: 'human', seatIndex: 0, position: 'BTN', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-1', playerType: 'bot', seatIndex: 1, position: 'SB', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-2', playerType: 'bot', seatIndex: 2, position: 'BB', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-3', playerType: 'bot', seatIndex: 3, position: 'UTG', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-4', playerType: 'bot', seatIndex: 4, position: 'HJ', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
    { playerId: 'bot-5', playerType: 'bot', seatIndex: 5, position: 'CO', stackAtHandStart: 1000, effectiveStackAtStart: 1000, participated: false, foldedPreflop: false },
  ];
}

function createBoard(seed: number): string[] {
  const base = ['Ah', 'Kd', 'Qc', 'Js', 'Tc', '9h', '8d', '7c', '6s', '5h'];
  const offset = seed % base.length;
  return Array.from({ length: 5 }, (_, index) => base[(offset + index) % base.length]);
}

function buildSamples(records: HandRecord[]): FastFoldDurabilitySample[] {
  return records.map((record) => ({
    handNumber: record.sessionHandNumber,
    foldToNextHandMs: typeof record.foldToNextHandMs === 'number' ? record.foldToNextHandMs : undefined,
    handStartToActionableMs: typeof record.handStartToActionableMs === 'number' ? record.handStartToActionableMs : undefined,
    hasHistory: record.isFinalized,
    errors: [],
    crashed: false,
  }));
}

export function createDurabilityReport(handRecords: HandRecord[]): FastFoldDurabilityReport {
  return summarizeFastFoldDurabilitySession(buildSamples(handRecords));
}

export function formatDurabilityReport(report: FastFoldDurabilityReport): string {
  return [
    '# Test Result',
    `Hands Played: ${report.sessionHandsPlayed}`,
    `Completion Rate: ${report.completionRate.toFixed(2)}%`,
    `History Missing: ${report.historyMissingCount}`,
    `Error Count: ${report.errorCount}`,
    `Crash Count: ${report.crashCount}`,
    '',
    'foldToNextHandMs:',
    `avg: ${report.foldToNextHandMs.avg.toFixed(3)}`,
    `median: ${report.foldToNextHandMs.median.toFixed(3)}`,
    `p50: ${report.foldToNextHandMs.p50.toFixed(3)}`,
    `p95: ${report.foldToNextHandMs.p95.toFixed(3)}`,
    `p99: ${report.foldToNextHandMs.p99.toFixed(3)}`,
    `max: ${report.foldToNextHandMs.max.toFixed(3)}`,
    '',
    'handStartToActionableMs:',
    `avg: ${report.handStartToActionableMs.avg.toFixed(3)}`,
    `median: ${report.handStartToActionableMs.median.toFixed(3)}`,
    `p50: ${report.handStartToActionableMs.p50.toFixed(3)}`,
    `p95: ${report.handStartToActionableMs.p95.toFixed(3)}`,
    `p99: ${report.handStartToActionableMs.p99.toFixed(3)}`,
    `max: ${report.handStartToActionableMs.max.toFixed(3)}`,
    '',
    `Pass/Fail: ${report.passFail}`,
  ].join('\n');
}

export function simulateFastFold100Hands(): FastFoldSimulationResult {
  const engine = new HandHistoryEngine();
  const handRecords: HandRecord[] = [];

  engine.subscribe({
    onActionRecorded: () => undefined,
    onHandRecordFinalized: (event: HandRecordFinalizedEvent) => {
      handRecords.push(event.handRecord);
    },
  });

  let now = 1_000_000;

  for (let handNumber = 1; handNumber <= 100; handNumber += 1) {
    const handId = `hand-${handNumber}`;
    const sessionId = 'fast-fold-durability-session';
    const tableId = 'table-1';
    const handStartToActionableMs = 20 + (handNumber % 7);
    const foldToNextHandMs = 120 + (handNumber % 13);
    const startedAt = now;
    const actionableAt = startedAt + handStartToActionableMs;
    const foldedAt = actionableAt + 8;
    const dequeuedAt = foldedAt + foldToNextHandMs;
    const endedAt = dequeuedAt + 10;

    const handStartedEvent: HandStartedEvent = {
      handId,
      sessionId,
      sessionHandNumber: handNumber,
      tableId,
      tableSeq: handNumber,
      heroPlayerId: 'hero',
      players: createPlayers(),
      boardA: createBoard(handNumber),
      boardB: createBoard(handNumber + 1),
      blindSize: { sb: 10, bb: 20 },
      format: 'PLO6MAX',
      startedAt,
      actionableAt,
    };

    const foldEvent: ActionAppliedEvent = {
      handId,
      sessionId,
      playerId: 'hero',
      position: 'BTN',
      street: 'PREFLOP',
      action: 'FOLD',
      amount: 0,
      potBefore: 30,
      potAfter: 30,
      stackBefore: 1000,
      stackAfter: 1000,
      toCall: 0,
      seq: 1,
      timestamp: foldedAt,
      preflopRaiseCountBeforeAction: 0,
      preflopRaiseAmountBeforeAction: 0,
      isOpportunityVpip: true,
      isOpportunityPfr: true,
      isOpportunity3Bet: false,
      isOpportunityWtsd: false,
      isAutoAction: false,
    };

    const fastFoldConfirmedEvent: FastFoldConfirmedEvent = {
      handId,
      sessionId,
      playerId: 'hero',
      foldedAt,
      dequeuedAt,
      tableId,
      nextTableId: tableId,
    };

    const handCompletedEvent: HandCompletedEvent = {
      handId,
      sessionId,
      terminalReason: 'FOLDED',
      startedAt,
      actionableAt,
      endedAt,
      durationMs: endedAt - startedAt,
      handStartToActionableMs,
      heroPlayerId: 'hero',
      heroOutcomeAmount: 0,
    };

    engine.onHandStarted(handStartedEvent);
    engine.onActionApplied(foldEvent);
    engine.onFastFoldConfirmed(fastFoldConfirmedEvent);
    engine.onHandCompleted(handCompletedEvent);

    now = endedAt + 25;
  }

  const report = createDurabilityReport(handRecords);

  return {
    handRecords,
    report,
    formattedReport: formatDurabilityReport(report),
  };
}