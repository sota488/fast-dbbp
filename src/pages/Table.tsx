import React from 'react';

export interface TablePageProps {
  boardA: string[];
  boardB: string[];
  pot: number;
  players: string[];
  heroId: string;
  actingPlayerId: string | null;
  isFoldAnimating?: boolean;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: () => void;
  onBackHome: () => void;
  message: string;
}

export function TablePage(props: TablePageProps): React.JSX.Element {
  const {
    boardA,
    boardB,
    pot,
    players,
    heroId,
    actingPlayerId,
    isFoldAnimating,
    onFold,
    onCheck,
    onCall,
    onRaise,
    onBackHome,
    message,
  } = props;

  return (
    <main className="app-shell">
      <div className="stack">
        <section className="ui-card">
          <div className="state-row">
            <h1 className="card-title" style={{ marginBottom: 0 }}>Table</h1>
            <span className="state-chip">Acting: {actingPlayerId ?? '-'}</span>
          </div>
        </section>

        <section className="ui-card">
          <h2 className="card-title">Board</h2>
          <div className="board-row">
            <p className="status-message">Board A: {boardA.join(' ') || '-'}</p>
            <p className="status-message">Board B: {boardB.join(' ') || '-'}</p>
            <p className="status-message">Pot: {pot}</p>
          </div>
        </section>

        <section className="ui-card">
          <h2 className="card-title">Hero Hand</h2>
          <p className="status-message">Hero: {heroId}</p>
          <p className="status-message">Players: {players.join(', ') || '-'}</p>
        </section>

        <section className="ui-card">
          <h2 className="card-title">Action</h2>
          <div className="button-stack">
            <button type="button" className={`btn btn-primary btn-fold ${isFoldAnimating ? 'is-folding' : ''}`} onClick={onFold}>
              Fold
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCall}>
              Call
            </button>
            <button type="button" className="btn btn-tertiary" onClick={onRaise}>
              Raise
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCheck}>
              Check
            </button>
          </div>
        </section>

        <section className="ui-card">
          <button type="button" className="btn btn-tertiary" onClick={onBackHome}>
            Back Home
          </button>
          <p className="status-message" style={{ marginTop: '12px' }}>{message}</p>
        </section>
      </div>
    </main>
  );
}
