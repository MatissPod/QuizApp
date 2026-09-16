import React from 'react';
import type { GameState } from '../../../server/src/types';

export function Header({ state, label }: { state: GameState; label: string }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">SIGNAL & NOISE / {label}</p>
        <h1>Tonight's game</h1>
      </div>
      <div className="status">
        <span className="live-dot" /> {state.message}
      </div>
    </header>
  );
}
