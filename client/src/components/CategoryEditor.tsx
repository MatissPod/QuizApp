import React from 'react';
import type { GameState } from '../../../server/src/types';

export function CategoryEditor({
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
