import type { GameActionType } from '../engine/game/types';
import type { QueueState } from '../engine/queue/types';
import type { TableState } from '../engine/table-state/types';

export interface BettingState {
  lastActionType: GameActionType | null;
  lastError: string | null;
}

export interface AppState {
  queueState: QueueState;
  tableState: TableState;
  bettingState: BettingState;
}
