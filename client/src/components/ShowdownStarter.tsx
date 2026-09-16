import React from 'react';
import type { GameState } from '../../../server/src/types';

export function ShowdownStarter({
  state,
  action,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
}) {
  const finalists = state.teams
    .slice()
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);
  const startingTeamId = state.showdownConfig.startingTeamId ?? finalists[0]?.id ?? '';
  return (
    <div className="finalist-table">
      <div className="finalist-table-heading">
        <span>Finalist</span>
        <span>Main score</span>
        <span>Starts</span>
      </div>
      {finalists.map((team) => (
        <div className="finalist-table-row" key={team.id}>
          <strong style={{ color: team.color }}>{team.name}</strong>
          <span>{team.score}</span>
          <label className="start-radio">
            <input
              type="radio"
              name="showdown-starting-team"
              checked={startingTeamId === team.id}
              onChange={() => action('set-showdown-start', { teamId: team.id })}
            />
            <span>Starts</span>
          </label>
        </div>
      ))}
    </div>
  );
}
