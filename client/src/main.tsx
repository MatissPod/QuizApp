import React from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import type { GameState } from '../../server/src/types';
import './styles.css';

const socket = io(import.meta.env.VITE_SOCKET_URL ?? window.location.origin);
const emptyState: GameState = {
  phase: 'setup',
  round: 'jeopardy',
  teams: [],
  categories: [],
  scoreAwards: [],
  showdownConfig: { totalRounds: 4 },
  message: 'Connectingâ€¦',
};

function useGameState() {
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

function Scoreboard({ state, display = false }: { state: GameState; display?: boolean }) {
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

function Header({ state, label }: { state: GameState; label: string }) {
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

function ScoreActions({
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

function WagerControls({
  state,
  action,
  originalValue,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
  originalValue: number;
}) {
  const [teamId, setTeamId] = React.useState('');
  const [wager, setWager] = React.useState('');
  return (
    <div className="wager-panel">
      <p>Select the wagering team and amount before revealing the question.</p>
      <p className="original-value">Original square value: <strong>${originalValue}</strong></p>
      <div className="wager-controls">
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          <option value="">Wagering team</option>
          {state.teams.map((team) => (
            <option value={team.id} key={team.id}>
              {team.name} (up to {Math.abs(team.score)})
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          value={wager}
          onChange={(event) => setWager(event.target.value)}
          placeholder="Wager 0 or more"
        />
        <button
          className="button primary"
          onClick={() => {
            const amount = Number(wager);
            if (teamId && wager !== '' && Number.isFinite(amount) && amount >= 0)
              action('set-wager', { teamId, wager: amount });
          }}
        >
          Set wager
        </button>
      </div>
    </div>
  );
}

function JeopardyBoard({
  state,
  action,
  display = false,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
  display?: boolean;
}) {
  const active = state.activeJeopardy;
  const activeCategory = state.categories.find((category) => category.id === active?.categoryId);
  const activeQuestion = activeCategory?.questions.find(
    (question) => question.id === active?.questionId,
  );
  const dailyCue = Boolean(activeQuestion && active?.dailyDoubleCue);
  return (
    <div className={`board-stage ${activeQuestion ? 'has-question' : ''}`}>
      <div
        className="board"
        style={{
          gridTemplateColumns: `repeat(${Math.max(state.categories.length, 1)}, minmax(150px, 1fr))`,
        }}
      >
        {state.categories.map((category) => (
          <div className="category-head" key={category.id}>
            {category.title}
          </div>
        ))}
        {[0, 1, 2, 3, 4].flatMap((row) =>
          state.categories.map((category) => {
            const question = category.questions[row];
            return (
              <button
                className={`value-cell ${question?.used ? 'used' : ''}`}
                disabled={display || question?.used}
                key={`${category.id}-${row}`}
                onClick={() =>
                  action('select-jeopardy', { categoryId: category.id, questionId: question.id })
                }
              >
                {question?.used ? null : `$${question?.value ?? 0}`}
                {!display && question?.dailyDouble && !question.used ? <small>GAMBLE</small> : null}
              </button>
            );
          }),
        )}
      </div>
      {activeQuestion ? (
        <div
          className={`question-stage ${active.revealed ? 'revealed' : ''} ${dailyCue ? 'daily-double-cue' : ''}`}
        >
          {dailyCue ? (
            <>
              <span className="daily-double-title">IT'S GAMBLING TIME!</span>
              {!display && <WagerControls state={state} action={action} originalValue={activeQuestion.value} />}
            </>
          ) : (
            <>
              <span className="stage-kicker">
                {activeCategory?.title} / ${activeQuestion.value}
                {active.wager !== undefined ? ` / WAGER ${active.wager}` : ''}
              </span>
              <h2>{active.revealed ? activeQuestion.answer : activeQuestion.question}</h2>
              {!display && (
                <div className="stage-actions">
                  {!active.revealed && (
                    <button className="button primary" onClick={() => action('reveal-jeopardy')}>
                      Reveal answer
                    </button>
                  )}
                  {active.revealed && active.wager !== undefined && active.teamId ? (
                    <>
                      <button
                        className="button primary"
                        onClick={() =>
                          action('score-jeopardy', { teamId: active.teamId, points: active.wager })
                        }
                      >
                        Correct +{active.wager}
                      </button>
                      <button
                        className="button danger"
                        onClick={() =>
                          action('score-jeopardy', { teamId: active.teamId, points: -active.wager })
                        }
                      >
                        Incorrect -{active.wager}
                      </button>
                    </>
                  ) : (
                    active.revealed && (
                      <ScoreActions state={state} action={action} points={activeQuestion.value} />
                    )
                  )}
                  <button
                    className="button quiet"
                    onClick={() => action('score-jeopardy', { points: 0 })}
                  >
                    Close square
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ShowdownBoard({
  state,
  action,
  display = false,
}: {
  state: GameState;
  action: (type: string, payload?: Record<string, string | number>) => void;
  display?: boolean;
}) {
  const showdown = state.activeShowdown;
  const [subjectA, setSubjectA] = React.useState('');
  const [subjectB, setSubjectB] = React.useState('');
  React.useEffect(() => {
    setSubjectA(showdown?.subjectA ?? '');
    setSubjectB(showdown?.subjectB ?? '');
  }, [showdown?.round, showdown?.subjectA, showdown?.subjectB]);
  if (!showdown) return <div className="empty-stage">Start the Search Showdown from Host.</div>;
  const challenger = state.teams.find((team) => team.id === showdown.challengerId);
  const guesser = state.teams.find((team) => team.id === showdown.guesserId);
  const combined = state.teams
    .map((team) => ({
      team,
      total:
        team.score +
        (showdown.finalistIds.includes(team.id)
          ? (showdown.scores.find((item) => item.teamId === team.id)?.score ?? 0)
          : 0),
    }))
    .sort((a, b) => b.total - a.total);
  const finalists = showdown.finalistIds
    .map((teamId) => {
      const entry = combined.find((item) => item.team.id === teamId)!;
      return {
        ...entry,
        boardScore: entry.team.score,
        finaleScore: showdown.scores.find((item) => item.teamId === teamId)?.score ?? 0,
      };
    })
    .sort((a, b) => b.finaleScore - a.finaleScore || b.boardScore - a.boardScore);
  const nonFinalists = combined.filter((entry) => !showdown.finalistIds.includes(entry.team.id));
  const finalistTotals = showdown.finalistIds.map(
    (teamId) => combined.find((entry) => entry.team?.id === teamId)?.total ?? 0,
  );
  const controls = !display && (
    <div className="showdown-controls">
      {showdown.phase === 'draft' && (
        <>
          <div className="subject-inputs">
            <input
              value={subjectA}
              onChange={(event) => setSubjectA(event.target.value)}
              placeholder="Subject A"
            />
            <input
              value={subjectB}
              onChange={(event) => setSubjectB(event.target.value)}
              placeholder="Subject B"
            />
            <button
              className="button"
              onClick={() =>
                subjectA.trim() &&
                subjectB.trim() &&
                action('showdown-set-subjects', { subjectA, subjectB })
              }
            >
              Lock subjects
            </button>
          </div>
          {showdown.subjectA && showdown.subjectB && (
            <div className="choice-controls">
              <span>Lock {guesser?.name}'s choice:</span>
              <button
                className={`button ${showdown.guesserChoice === 'A' ? 'choice-selected' : ''}`}
                onClick={() => action('showdown-set-choice', { choice: 'A' })}
              >
                Choose A
              </button>
              <button
                className={`button ${showdown.guesserChoice === 'B' ? 'choice-selected' : ''}`}
                onClick={() => action('showdown-set-choice', { choice: 'B' })}
              >
                Choose B
              </button>
              {showdown.guesserChoice && (
                <button className="button primary" onClick={() => action('showdown-lookup')}>
                  Live lookup
                </button>
              )}
            </div>
          )}
        </>
      )}
      {showdown.phase === 'manual' && (
        <div className="choice-controls">
          <span>Manual winner:</span>
          <button
            className="button primary"
            onClick={() => action('showdown-manual-result', { choice: 'A' })}
          >
            A wins
          </button>
          <button
            className="button primary"
            onClick={() => action('showdown-manual-result', { choice: 'B' })}
          >
            B wins
          </button>
        </div>
      )}
      {showdown.phase === 'tie' && (
        <button className="button danger" onClick={() => action('showdown-discard-tie')}>
          Discard tied pair
        </button>
      )}
      {showdown.phase === 'resolved' && (
        <button className="button primary" onClick={() => action('showdown-next')}>
          {showdown.round >= showdown.totalRounds ? 'Finish finale' : 'Next round'}
        </button>
      )}
    </div>
  );
  return (
    <div className={`showdown ${showdown.phase === 'calculating' ? 'calculating' : ''}`}>
      <div className="showdown-kicker">
        SEARCH SHOWDOWN / ROUND {showdown.round} OF {showdown.totalRounds}
      </div>
      <div className="showdown-roles">
        <span>
          <b>CHALLENGER</b>
          {challenger?.name}
        </span>
        <span>
          <b>GUESSER</b>
          {guesser?.name}
        </span>
      </div>
      {showdown.phase === 'complete' ? (
        <>
          <h2>Final leaderboard</h2>
          <div className="leaderboard-section">
            <h3>Finalists · ranked by Finale score</h3>
            <div className="final-leaderboard finalist-leaderboard">
              {finalists.map((entry, index) => (
                <div key={entry.team.id}>
                  <strong>#{index + 1} {entry.team.name}</strong>
                  <span>Board {entry.boardScore} · Finale {entry.finaleScore}</span>
                  <b>{entry.total}</b>
                </div>
              ))}
            </div>
          </div>
          {nonFinalists.length > 0 && (
            <div className="leaderboard-section">
              <h3>Other teams · ranked by board score</h3>
              <div className="final-leaderboard non-finalist-leaderboard">
                {nonFinalists.map((entry, index) => (
                  <div key={entry.team.id}>
                    <strong>#{index + 1} {entry.team.name}</strong>
                    <b>{entry.team.score}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
          {finalistTotals[0] === finalistTotals[1] && !display && (
            <button className="button primary" onClick={() => action('showdown-sudden-death')}>
              Start sudden death
            </button>
          )}
        </>
      ) : showdown.phase === 'calculating' ? (
        <div className="trend-calc">
          <span>CALCULATING GOOGLE TRENDS</span>
          <i />
          <i />
          <i />
        </div>
      ) : (
        <>
          <div className="showdown-subjects">
            <div className="subject-card">
              <span>OPTION A</span>
              <strong>{showdown.subjectA || 'Waiting for subjects'}</strong>
            </div>
            <div className="versus">VS</div>
            <div className="subject-card">
              <span>OPTION B</span>
              <strong>{showdown.subjectB || 'Waiting for subjects'}</strong>
            </div>
          </div>
          {showdown.lookup && (
            <div className="trend-result">
              <div className={showdown.lookup.winner === 'A' ? 'winner' : ''}>
                <span>{showdown.subjectA}</span>
                <b>{showdown.lookup.scoreA}</b>
              </div>
              <div className={showdown.lookup.winner === 'B' ? 'winner' : ''}>
                <span>{showdown.subjectB}</span>
                <b>{showdown.lookup.scoreB}</b>
              </div>
              <small>
                {showdown.lookup.source === 'live' ? 'LIVE GOOGLE TRENDS' : 'MANUAL OVERRIDE'}
              </small>
            </div>
          )}
          {showdown.phase === 'tie' && (
            <p className="showdown-alert">Tie. Discard this pair and propose a fresh one.</p>
          )}
          {showdown.phase === 'manual' && (
            <p className="showdown-alert">Live lookup failed. Choose the winner manually.</p>
          )}
          {controls}
        </>
      )}
      {!display && showdown.scores.map((entry) => (
        <span className="showdown-score" key={entry.teamId}>
          {state.teams.find((team) => team.id === entry.teamId)?.name}: <b>{entry.score}</b>
        </span>
      ))}
    </div>
  );
}

function Display({
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

function ShowdownStarter({
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

function Host({
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

function Admin() {
  const [content, setContent] = React.useState<{
    categories: GameState['categories'];
    showdownConfig: GameState['showdownConfig'];
  }>({ categories: [], showdownConfig: { totalRounds: 4 } });
  const [selected, setSelected] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const load = React.useCallback(
    () =>
      fetch('/api/content')
        .then((response) => response.json())
        .then(setContent),
    [],
  );
  React.useEffect(() => {
    void load();
  }, [load]);
  const selectedCategory = content.categories.find((item) => item.id === selected);
  async function saveCategory(category: GameState['categories'][number]) {
    const questions = category.questions.map((question) => ({
      value: question.value,
      question: question.question,
      answer: question.answer,
      dailyDouble: question.dailyDouble,
    }));
    await fetch(`/api/categories/${category.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: category.title, questions }),
    });
    setNotice('Board saved');
    await load();
  }
  async function addCategory() {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New category',
        questions: [100, 200, 300, 400, 500].map((value) => ({
          value,
          question: 'Write a question',
          answer: 'Write an answer',
        })),
      }),
    });
    const item = await response.json();
    await load();
    setSelected(item._id);
  }
  async function deleteCategory(id: string) {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    setSelected('');
    await load();
  }
  async function saveShowdownConfig() {
    const response = await fetch('/api/showdown-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content.showdownConfig),
    });
    const showdownConfig = await response.json();
    setContent((current) => ({ ...current, showdownConfig }));
    setNotice('Showdown settings saved');
  }
  return (
    <main className="screen admin-view">
      <Header
        state={{
          message: notice || 'Content is saved in MongoDB.',
          teams: [],
          categories: [],
          scoreAwards: [],
          showdownConfig: content.showdownConfig,
          phase: 'setup',
          round: 'jeopardy',
        }}
        label="ADMIN"
      />
      <div className="admin-grid">
        <aside className="library">
          <div className="library-heading">
            <h3>Jeopardy boards</h3>
            <button className="icon-button" onClick={() => void addCategory()}>
              +
            </button>
          </div>
          {content.categories.map((category) => (
            <button
              className={`library-item ${selected === category.id ? 'selected' : ''}`}
              key={category.id}
              onClick={() => setSelected(category.id)}
            >
              {category.title}
              <span>{category.questions.length} squares</span>
            </button>
          ))}
          <div className="showdown-settings">
            <p className="eyebrow">SEARCH SHOWDOWN</p>
            <label>
              Even rounds
              <input
                type="number"
                min="2"
                step="2"
                value={content.showdownConfig.totalRounds}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    showdownConfig: {
                      ...current.showdownConfig,
                      totalRounds: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <button className="button primary" onClick={() => void saveShowdownConfig()}>
              Save finale settings
            </button>
          </div>
        </aside>
        <section className="editor">
          {selectedCategory ? (
            <CategoryEditor
              category={selectedCategory}
              onChange={(next) =>
                setContent((current) => ({
                  ...current,
                  categories: current.categories.map((item) => (item.id === next.id ? next : item)),
                }))
              }
              onSave={() => void saveCategory(selectedCategory)}
              onDelete={() => void deleteCategory(selectedCategory.id)}
            />
          ) : (
            <div className="empty-stage">
              <h2>Build the room before the room arrives.</h2>
              <p>Choose a category or use + to add a board.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CategoryEditor({
  category,
  onChange,
  onSave,
  onDelete,
}: {
  category: GameState['categories'][number];
  onChange: (category: GameState['categories'][number]) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <div className="editor-heading">
        <div>
          <p className="eyebrow">JEOPARDY CATEGORY</p>
          <input
            className="title-input"
            value={category.title}
            onChange={(event) => onChange({ ...category, title: event.target.value })}
          />
        </div>
        <div>
          <button className="button primary" onClick={onSave}>
            Save board
          </button>
          <button className="button danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <div className="question-list">
        {category.questions.map((question, index) => (
          <div className="question-form" key={question.id}>
            <div className="question-number">
              {String(index + 1).padStart(2, '0')}
              <strong>${question.value}</strong>
            </div>
            <label>
              Question
              <textarea
                value={question.question}
                onChange={(event) =>
                  onChange({
                    ...category,
                    questions: category.questions.map((item) =>
                      item.id === question.id ? { ...item, question: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
            <label>
              Answer
              <input
                value={question.answer}
                onChange={(event) =>
                  onChange({
                    ...category,
                    questions: category.questions.map((item) =>
                      item.id === question.id ? { ...item, answer: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={question.dailyDouble}
                onChange={(event) =>
                  onChange({
                    ...category,
                    questions: category.questions.map((item) =>
                      item.id === question.id
                        ? { ...item, dailyDouble: event.target.checked }
                        : item,
                    ),
                  })
                }
              />{' '}
              It's Gambling Time!
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
