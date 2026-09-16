import React from 'react';
import type { GameState } from '../../../server/src/types';
import { Header } from '../components/Header';
import { CategoryEditor } from '../components/CategoryEditor';

export function Admin() {
  const [content, setContent] = React.useState<{
    categories: GameState['categories'];
    showdownConfig: GameState['showdownConfig'];
  }>({ categories: [], showdownConfig: {
      totalRounds: 4,
      points: []
  } });
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
