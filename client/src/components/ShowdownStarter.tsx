import React from 'react';
import type { GameState } from '../../../server/src/types';

export function ShowdownStarter({
  state,
  action,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
}) {
  const finalistIds = state.showdownConfig.finalistIds ?? 
    state.teams.slice().sort((a, b) => b.score - a.score).slice(0, 2).map(t => t.id);

  return (
    <div className="finalist-table">
      <div className="finalist-table-heading">
        <span>Team</span>
        <span>Score</span>
        <span>Finalist</span>
      </div>
      {state.teams.map((team) => (
        <div className="finalist-table-row" key={team.id}>
          <strong style={{ color: team.color }}>{team.name}</strong>
          <span>{team.score}</span>
          <label className="start-radio">
            <input
              type="checkbox"
              checked={finalistIds.includes(team.id)}
              disabled={!finalistIds.includes(team.id) && finalistIds.length >= 2}
              onChange={() => action('toggle-showdown-finalist', { teamId: team.id })}
            />
            <span>Finalist</span>
          </label>
        </div>
      ))}
    </div>
  );
}
