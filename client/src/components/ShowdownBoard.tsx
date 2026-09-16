import React from 'react';
import type { GameState } from '../../../server/src/types';

export function ShowdownBoard({
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
