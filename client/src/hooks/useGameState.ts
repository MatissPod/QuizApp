import React from 'react';
import type { GameState } from '../../../server/src/types';
import { socket } from '../socket';

export const emptyState: GameState = {
  phase: 'setup',
  round: 'jeopardy',
  teams: [],
  categories: [],
  scoreAwards: [],
  showdownConfig: {
      totalRounds: 4,
      points: []
  },
  message: 'Connecting...',
};

export function useGameState() {
  const [state, setState] = React.useState<GameState>(emptyState);
  React.useEffect(() => {
    const handler = (next: GameState) => setState(next);
    socket.on('game:state', handler);
    return () => {
      socket.off('game:state', handler);
    };
  }, []);
  const action = (type: string, payload: Record<string, string | number> = {}) =>
    socket.emit('game:action', { type, ...payload });
  return { state, action };
}
