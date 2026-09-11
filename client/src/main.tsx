import React from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import type { GameState } from '../../server/src/types';
import './styles.css';

const socket = io(import.meta.env.VITE_SOCKET_URL ?? window.location.origin);
const emptyState: GameState = { phase: 'setup', round: 'jeopardy', teams: [], categories: [], feudRounds: [], scoreAwards: [], message: 'Connecting…' };

function useGameState() {
  const [state, setState] = React.useState<GameState>(emptyState);
  React.useEffect(() => {
    const handler = (next: GameState) => setState(next);
    socket.on('game:state', handler);
    return () => { socket.off('game:state', handler); };
  }, []);
  const action = (type: string, payload: Record<string, string | number> = {}) => socket.emit('game:action', { type, ...payload });
  return { state, action };
}

function Scoreboard({ state }: { state: GameState }) {
  return <div className="scoreboard">{state.teams.map((team) => <div className="score" key={team.id} style={{ '--team': team.color } as React.CSSProperties}><span>{team.name}</span><strong>{team.score}</strong></div>)}</div>;
}

function Header({ state, label }: { state: GameState; label: string }) {
  return <header className="topbar"><div><p className="eyebrow">SIGNAL & NOISE / {label}</p><h1>Tonight's game</h1></div><div className="status"><span className="live-dot" /> {state.message}</div></header>;
}

function JeopardyBoard({ state, action, display = false }: { state: GameState; action: (type: string, payload?: Record<string, string | number>) => void; display?: boolean }) {
  const active = state.activeJeopardy;
  const activeCategory = state.categories.find((category) => category.id === active?.categoryId);
  const activeQuestion = activeCategory?.questions.find((question) => question.id === active?.questionId);
  const isDailyDoubleCue = Boolean(activeQuestion && active?.dailyDoubleCue);
  return <div className={`board-stage ${activeQuestion ? 'has-question' : ''}`}>
    <div className="board" style={{ gridTemplateColumns: `repeat(${Math.max(state.categories.length, 1)}, minmax(150px, 1fr))` }}>
      {state.categories.map((category) => <React.Fragment key={category.id}>
        <div className="category-head">{category.title}</div>
      </React.Fragment>)}
      {[0, 1, 2, 3, 4].map((row) => state.categories.map((category) => {
        const question = category.questions[row];
        return <button className={`value-cell ${question?.used ? 'used' : ''}`} disabled={display || question?.used} key={`${category.id}-${row}`} onClick={() => action('select-jeopardy', { categoryId: category.id, questionId: question.id })}>
          {question?.used ? '—' : `$${question?.value ?? 0}`}{!display && question?.dailyDouble && !question.used ? <small>DD</small> : null}
        </button>;
      }))}
    </div>
    {activeQuestion ? <div className={`question-stage ${active.revealed ? 'revealed' : ''} ${isDailyDoubleCue ? 'daily-double-cue' : ''}`}>{isDailyDoubleCue ? <><span className="daily-double-title">DAILY DOUBLE</span>{!display && <div className="wager-panel"><p>Select the wagering team and amount before revealing the question.</p><div className="wager-controls"><select defaultValue=""><option value="" disabled>Wagering team</option>{state.teams.map((team) => <option value={team.id} key={team.id}>{team.name} (up to {Math.abs(team.score)})</option>)}</select><input id="wager-amount" type="number" min="0" placeholder="Wager 0 or more" /><button className="button primary" onClick={() => { const teamId = (document.querySelector('.wager-controls select') as HTMLSelectElement)?.value; const wagerInput = (document.getElementById('wager-amount') as HTMLInputElement)?.value; const wager = Number(wagerInput); if (teamId && wagerInput !== '' && Number.isFinite(wager) && wager >= 0) action('set-wager', { teamId, wager }); }}>Set wager</button></div></div>}</> : <><span className="stage-kicker">{activeCategory?.title} / ${activeQuestion.value}{active.wager !== undefined ? ` / WAGER ${active.wager}` : ''}</span><h2>{active.revealed ? activeQuestion.answer : activeQuestion.question}</h2>{!display && <div className="stage-actions">{!active.revealed && <button className="button primary" onClick={() => action('reveal-jeopardy')}>Reveal answer</button>}{active.revealed && active.wager !== undefined && active.teamId ? <><button className="button primary" onClick={() => action('score-jeopardy', { teamId: active.teamId, points: active.wager })}>Correct +{active.wager}</button><button className="button danger" onClick={() => action('score-jeopardy', { teamId: active.teamId, points: -active.wager })}>Incorrect -{active.wager}</button></> : active.revealed && <div className="score-actions"><div className="score-actions-header"><span>Team</span><span>Award</span><span>Deduct</span></div>{state.teams.map((team) => <div className="score-action-row" key={team.id}><strong style={{ color: team.color }}>{team.name}</strong><button className="button" onClick={() => action('score-jeopardy', { teamId: team.id, points: activeQuestion.value })}>+{activeQuestion.value}</button><button className="button danger" onClick={() => action('score-jeopardy', { teamId: team.id, points: -activeQuestion.value })}>-{activeQuestion.value}</button></div>)}</div>}<button className="button quiet" onClick={() => action('score-jeopardy', { points: 0 })}>Close square</button></div>}</>}</div> : !display && <div className="empty-stage">Pick a square to put it on screen.</div>}
  </div>;
}

function Display({ state, action }: { state: GameState; action: (type: string, payload?: Record<string, string | number>) => void }) {
  return <main className="screen display-view"><Header state={state} label="DISPLAY" /><Scoreboard state={state} /><div className="round-banner"><span>JEOPARDY</span><strong>THE BOARD</strong></div><JeopardyBoard state={state} action={action} display /></main>;
}

function Host({ state, action }: { state: GameState; action: (type: string, payload?: Record<string, string | number>) => void }) {
  return <main className="screen"><Header state={state} label="HOST CONTROL" /><div className="host-layout"><section className="main-panel"><div className="control-strip"><button className="button primary" onClick={() => action('start')}>Start game</button><button className="button quiet" onClick={() => action('reset')}>Reset game</button></div><JeopardyBoard state={state} action={action} /></section><aside className="host-sidebar"><div className="sidebar-title"><h3>Teams</h3><button className="icon-button" onClick={() => action('add-team')} disabled={state.teams.length >= 12}>+</button></div>{state.teams.map((team) => <label className="team-edit" key={team.id}><span className="team-swatch" style={{ background: team.color }} /> <input value={team.name} onChange={(event) => action('rename-team', { teamId: team.id, name: event.target.value })} /><b>{team.score}</b><button className="remove-team" disabled={state.teams.length <= 2} title="Remove team" onClick={() => action('remove-team', { teamId: team.id })}>×</button></label>)}<h3 className="awards-heading">Recent awards</h3>{state.scoreAwards.filter((award) => !award.retracted).slice().reverse().map((award) => <div className="award-row" key={award.id}><span>{state.teams.find((team) => team.id === award.teamId)?.name} +{award.amount}</span><button className="button quiet" onClick={() => action('retract-award', { awardId: award.id })}>Retract</button></div>)}</aside></div></main>;
}

function Admin() {
  const [content, setContent] = React.useState<{ categories: GameState['categories'] }>({ categories: [] });
  const [selected, setSelected] = React.useState<string>('');
  const [notice, setNotice] = React.useState('');
  const load = React.useCallback(() => fetch('/api/content').then((response) => response.json()).then(setContent), []);
  React.useEffect(() => { void load(); }, [load]);
  const selectedCategory = content.categories.find((item) => item.id === selected);
  async function saveCategory(category: GameState['categories'][number]) { const questions = category.questions.map((question) => ({ value: question.value, question: question.question, answer: question.answer, dailyDouble: question.dailyDouble })); await fetch(`/api/categories/${category.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: category.title, questions }) }); setNotice('Board saved'); await load(); }
  async function addCategory() { const response = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New category', questions: [100, 200, 300, 400, 500].map((value) => ({ value, question: 'Write a question', answer: 'Write an answer' })) }) }); const item = await response.json(); await load(); setSelected(item._id); }
  async function deleteCategory(id: string) { await fetch(`/api/categories/${id}`, { method: 'DELETE' }); setSelected(''); await load(); }
  return <main className="screen admin-view"><Header state={{ message: notice || 'Content is saved in MongoDB.', teams: [], categories: [], scoreAwards: [], phase: 'setup', round: 'jeopardy' }} label="ADMIN" /><div className="admin-grid"><aside className="library"><div className="library-heading"><h3>Jeopardy boards</h3><button className="icon-button" onClick={() => void addCategory()}>+</button></div>{content.categories.map((category) => <button className={`library-item ${selected === category.id ? 'selected' : ''}`} key={category.id} onClick={() => setSelected(category.id)}>{category.title}<span>{category.questions.length} squares</span></button>)}</aside><section className="editor">{selectedCategory ? <CategoryEditor category={selectedCategory} onChange={(next) => setContent((current) => ({ ...current, categories: current.categories.map((item) => item.id === next.id ? next : item) }))} onSave={() => void saveCategory(selectedCategory)} onDelete={() => void deleteCategory(selectedCategory.id)} /> : <div className="empty-stage"><h2>Build the room before the room arrives.</h2><p>Choose a category or use + to add a board.</p></div>}</section></div></main>;
}

function CategoryEditor({ category, onChange, onSave, onDelete }: { category: GameState['categories'][number]; onChange: (category: GameState['categories'][number]) => void; onSave: () => void; onDelete: () => void }) {
  return <div><div className="editor-heading"><div><p className="eyebrow">JEOPARDY CATEGORY</p><input className="title-input" value={category.title} onChange={(event) => onChange({ ...category, title: event.target.value })} /></div><div><button className="button primary" onClick={onSave}>Save board</button><button className="button danger" onClick={onDelete}>Delete</button></div></div><div className="question-list">{category.questions.map((question, index) => <div className="question-form" key={question.id}><div className="question-number">{String(index + 1).padStart(2, '0')}<strong>${question.value}</strong></div><label>Question<textarea value={question.question} onChange={(event) => onChange({ ...category, questions: category.questions.map((item) => item.id === question.id ? { ...item, question: event.target.value } : item) })} /></label><label>Answer<input value={question.answer} onChange={(event) => onChange({ ...category, questions: category.questions.map((item) => item.id === question.id ? { ...item, answer: event.target.value } : item) })} /></label><label className="check"><input type="checkbox" checked={question.dailyDouble} onChange={(event) => onChange({ ...category, questions: category.questions.map((item) => item.id === question.id ? { ...item, dailyDouble: event.target.checked } : item) })} /> Daily Double</label></div>)}</div></div>;
}

function App() {
  const { state, action } = useGameState();
  const [route, setRoute] = React.useState(window.location.hash || '#host');
  React.useEffect(() => { const handler = () => setRoute(window.location.hash || '#host'); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  if (route === '#display') return <Display state={state} action={action} />;
  if (route === '#admin') return <Admin />;
  return <Host state={state} action={action} />;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
