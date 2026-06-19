import React from 'react';

export interface TablePageProps {
  boardA: string[];
  boardB: string[];
  pot: number;
  players: string[];
  heroId: string;
  heroHand: string[];
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
    heroHand,
    actingPlayerId,
    isFoldAnimating,
    onFold,
    onCheck,
    onCall,
    onRaise,
    onBackHome,
    message,
  } = props;

  const potBb = Math.max(0, pot / 20).toFixed(1);
  const seatLabel = (index: number): string => players[index] ?? `P${index + 1}`;

  return (
    <main className="app-shell">
      <div className="stack">
        <section className="ui-card">
          <div className="state-row">
            <h1 className="card-title" style={{ marginBottom: 0 }}>テーブル</h1>
            <span className="state-chip">アクション: {actingPlayerId ?? '-'}</span>
          </div>
        </section>

        <section className="ui-card poker-table-card" aria-label="6maxテーブル">
          <div className="table-felt">
            <div className="seat seat-utg">UTG<br />{seatLabel(0)}</div>
            <div className="seat seat-hj">HJ<br />{seatLabel(1)}</div>
            <div className="seat seat-co">CO<br />{seatLabel(2)}</div>
            <div className="seat seat-sb">SB<br />{seatLabel(3)}</div>
            <div className="seat seat-btn">BTN<br />{seatLabel(4)}</div>
            <div className="seat seat-bb">BB<br />{seatLabel(5)}</div>

            <div className="table-center">
              <p className="pot-label">Pot: {potBb}BB</p>
              <p className="status-message table-actioning">進行中: {actingPlayerId ?? '-'}</p>
            </div>
          </div>
        </section>

        <section className="ui-card">
          <h2 className="card-title">Hero</h2>
          <p className="status-message">プレイヤーID: {heroId}</p>
          <div className="hero-hand-row" aria-label="Hero Hand">
            {heroHand.map((card) => (
              <span key={card} className="hero-card-chip">{card}</span>
            ))}
          </div>
        </section>

        <section className="ui-card">
          <h2 className="card-title">アクション</h2>
          <div className="button-row">
            <button type="button" className={`btn btn-primary btn-fold ${isFoldAnimating ? 'is-folding' : ''}`} onClick={onFold}>
              Fold
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCall}>
              Call
            </button>
            <button type="button" className="btn btn-tertiary" onClick={onRaise}>
              Raise
            </button>
          </div>
          <div className="button-stack" style={{ marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onCheck}>
              チェック
            </button>
          </div>
        </section>

        <section className="ui-card">
          <h2 className="card-title">ボード</h2>
          <div className="board-row">
            <p className="status-message">Board A: {boardA.join(' ') || '-'}</p>
            <p className="status-message">Board B: {boardB.join(' ') || '-'}</p>
          </div>
        </section>

        <section className="ui-card">
          <button type="button" className="btn btn-tertiary" onClick={onBackHome}>
            ホームへ戻る
          </button>
          <p className="status-message" style={{ marginTop: '12px' }}>{message}</p>
        </section>
      </div>
    </main>
  );
}
