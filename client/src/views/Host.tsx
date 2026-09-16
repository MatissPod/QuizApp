import React from 'react';
import type { GameState } from '../../../server/src/types';
import { Header } from '../components/Header';
import { ShowdownStarter } from '../components/ShowdownStarter';
import { ShowdownBoard } from '../components/ShowdownBoard';
import { JeopardyBoard } from '../components/JeopardyBoard';

export function Host({
  state,
  action,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
}) {
  return (
    <main className="screen">
      <Header state={state} label="HOST CONTROL" />
      <div className="host-layout">
        <section className="main-panel">
          <div className="control-strip">
            {state.round === 'jeopardy' && (
              <>
                <ShowdownStarter state={state} action={action} />
                <button className="button" onClick={() => action('start-showdown')}>
                  Start Search Showdown
                </button>
              </>
            )}
            <button className="button quiet" onClick={() => action('reset')}>
              Reset game
            </button>
          </div>
          {state.round === 'showdown' ? (
            <ShowdownBoard state={state} action={action} />
          ) : (
            <JeopardyBoard state={state} action={action} />
          )}
        </section>
        <aside className="host-sidebar">
          <div className="sidebar-title">
            <h3>Teams</h3>
            <button
              className="icon-button"
              onClick={() => action('add-team')}
              disabled={state.teams.length >= 12}
            >
              +
            </button>
          </div>
          {state.teams.map((team) => (
            <label className="team-edit" key={team.id}>
              <span className="team-swatch" style={{ background: team.color }} />{' '}
              <input
                value={team.name}
                onChange={(event) =>
                  action('rename-team', { teamId: team.id, name: event.target.value })
                }
              />
              <b>{team.score}</b>
              <button
                className="remove-team"
                disabled={state.teams.length <= 2}
                title="Remove team"
                onClick={() => action('remove-team', { teamId: team.id })}
              >
                ×
              </button>
            </label>
          ))}
        </aside>
      </div>
    </main>
  );
}
