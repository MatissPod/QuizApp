import React from 'react';
import type { GameState } from '../../../server/src/types';

export function WagerControls({
  state,
  action,
  originalValue,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
  originalValue: number;
}) {
  const [teamId, setTeamId] = React.useState('');
  const [wager, setWager] = React.useState('');
  return (
    <div className="wager-panel">
      <p>Select the wagering team and amount before revealing the question.</p>
      <p className="original-value">Original square value: <strong>${originalValue}</strong></p>
      <div className="wager-controls">
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          <option value="">Wagering team</option>
          {state.teams.map((team) => (
            <option value={team.id} key={team.id}>
              {team.name} (up to {Math.abs(team.score)})
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          value={wager}
          onChange={(event) => setWager(event.target.value)}
          placeholder="Wager 0 or more"
        />
        <button
          className="button primary"
          onClick={() => {
            const amount = Number(wager);
            if (teamId && wager !== '' && Number.isFinite(amount) && amount >= 0)
              action('set-wager', { teamId, wager: amount });
          }}
        >
          Set wager
        </button>
      </div>
    </div>
  );
}
