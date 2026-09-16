import React from 'react';
import type { GameState } from '../../../server/src/types';

export function Scoreboard({ state, display = false }: { state: GameState; display?: boolean }) {
  const showdown = state.activeShowdown;
  return (
    <div className="scoreboard">
      {state.teams.map((team) => {
        const finale = showdown?.scores.find((item) => item.teamId === team.id)?.score ?? 0;
        const total =
          team.score +
          (showdown?.phase === 'complete' && showdown.finalistIds.includes(team.id) ? finale : 0);
        return (
          <div
            className="score"
            key={team.id}
            style={{ '--team': team.color } as React.CSSProperties}
          >
            <span>
              {team.name}
                {!display && <small>{showdown?.finalistIds.includes(team.id) ? `Finale +${finale}` : ''}</small>}
            </span>
            <strong>{total}</strong>
          </div>
        );
      })}
    </div>
  );
}
