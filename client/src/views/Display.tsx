import React from 'react';
import type { GameState } from '../../../server/src/types';
import { Scoreboard } from '../components/Scoreboard';
import { ShowdownBoard } from '../components/ShowdownBoard';
import { JeopardyBoard } from '../components/JeopardyBoard';

export function Display({
  state,
  action,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
}) {
  return (
    <main className="screen display-view">
      <Scoreboard state={state} display />
      {state.round === 'showdown' ? (
        <ShowdownBoard state={state} action={action} display />
      ) : (
        <>
          <div className="round-banner">
            <span>ROUND 01</span>
            <strong>THE BOARD</strong>
          </div>
          <JeopardyBoard state={state} action={action} display />
        </>
      )}
    </main>
  );
}
