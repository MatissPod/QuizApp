import React from 'react';
import type { GameState } from '../../../server/src/types';
import { WagerControls } from './WagerControls';
import { ScoreActions } from './ScoreActions';

export function JeopardyBoard({
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
      {active &&activeQuestion ? (
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
                      (() => {
                        const wager = active.wager;
                        const teamId = active.teamId;
                        return (
                          <>
                            <button
                              className="button primary"
                              onClick={() => action('score-jeopardy', { teamId, points: wager })}
                            >
                              Correct +{wager}
                            </button>
                            <button
                              className="button danger"
                              onClick={() => action('score-jeopardy', { teamId, points: -wager })}
                            >
                              Incorrect -{wager}
                            </button>
                          </>
                        );
                      })()
                    ) : (
                    active.revealed && (
                      <ScoreActions state={state} action={action} points={activeQuestion.value} />
                    )
                  )}
                  <button
                    className="button quiet"
                    onClick={() => action('close-jeopardy')}
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
