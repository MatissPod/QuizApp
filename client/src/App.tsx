import React from 'react';
import { useGameState } from './hooks/useGameState';
import { Display } from './views/Display';
import { Host } from './views/Host';
import { Admin } from './views/Admin';

export function App() {
  const { state, action } = useGameState();
  const [route, setRoute] = React.useState(window.location.hash || '#host');
  React.useEffect(() => {
    const handler = () => setRoute(window.location.hash || '#host');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  if (route === '#display') return <Display state={state} action={action} />;
  if (route === '#admin') return <Admin />;
  return <Host state={state} action={action} />;
}
