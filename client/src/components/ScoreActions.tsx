import React from 'react';
import type { GameState } from '../../../server/src/types';

export function ScoreActions({
  state,
  action,
  points,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
  points: number;
}) {
  return (
    <div className="score-actions">
      <div className="score-actions-header">
        <span>Team</span>
        <span>Award</span>
        <span>Deduct</span>
      </div>
      {state.teams.map((team) => (
        <div className="score-action-row" key={team.id}>
          <strong style={{ color: team.color }}>{team.name}</strong>
          <button
            className="button"
            onClick={() => action('score-jeopardy', { teamId: team.id, points })}
          >
            +{points}
          </button>
          <button
            className="button danger"
            onClick={() => action('score-jeopardy', { teamId: team.id, points: -points })}
          >
            -{points}
          </button>
        </div>
      ))}
    </div>
  );
}
