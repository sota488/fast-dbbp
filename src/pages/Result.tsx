import React from 'react';

export interface ResultPageProps {
  winner: string;
  payout: number;
  queueReturned: boolean;
  onNextHand: () => void;
  onBackHome: () => void;
  message: string;
}

export function ResultPage(props: ResultPageProps): React.JSX.Element {
  const { winner, payout, queueReturned, onNextHand, onBackHome, message } = props;

  return (
    <main>
      <h1>Result</h1>
      <p>Winner: {winner}</p>
      <p>Payout: {payout}</p>
      <p>Queue復帰: {queueReturned ? 'OK' : 'Pending'}</p>
      <button type="button" onClick={onNextHand}>
        Next Hand
      </button>
      <button type="button" onClick={onBackHome}>
        Home
      </button>
      <p>{message}</p>
    </main>
  );
}
