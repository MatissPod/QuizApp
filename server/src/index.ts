import 'dotenv/config';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import googleTrends from 'google-trends-api';
import { CategoryModel, ShowdownConfigModel } from './models';
import type { GameState, JeopardyCategory, ScoreAward, ShowdownConfig, ShowdownHistoryEntry, ShowdownOption, Team } from './types';

const port = Number(process.env.PORT ?? 3000);
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lan_party_trivia';
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const defaultTeams: Team[] = [
  { id: 'team-red', name: 'The Bright Sparks', color: '#ff6b5f', score: 0 },
  { id: 'team-blue', name: 'Quiztopher Walken', color: '#4da8da', score: 0 },
];

function createDefaultTeams() {
  return defaultTeams.map((team) => ({ ...team, score: 0 }));
}

let state: GameState = {
  phase: 'setup',
  round: 'jeopardy',
  teams: createDefaultTeams(),
  categories: [],
  showdownConfig: { totalRounds: 4, points: [100, 150, 200, 250] },
  scoreAwards: [],
  message: 'Choose a square to begin.',
};

const serializeCategories = (items: Array<{ _id: { toString: () => string }; title: string; order: number; questions: Array<{ _id: { toString: () => string }; value: number; question: string; answer: string; dailyDouble: boolean }> }>): JeopardyCategory[] =>
  items.map((item) => ({
    id: item._id.toString(),
    title: item.title,
    order: item.order,
    questions: item.questions.map((question) => ({
      id: question._id.toString(),
      value: question.value,
      question: question.question,
      answer: question.answer,
      dailyDouble: question.dailyDouble,
      used: false,
    })),
  }));

async function loadContent() {
  const [categories, config] = await Promise.all([
    CategoryModel.find().sort({ order: 1 }),
    ShowdownConfigModel.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true }),
  ]);
  state.categories = serializeCategories(categories);
  state.showdownConfig = { totalRounds: normalizeRoundCount(config.totalRounds), points: normalizePoints(config.points), startingTeamId: config.startingTeamId ?? undefined };
}

function normalizeRoundCount(value: number) {
  const count = Number.isFinite(value) ? Math.max(2, Math.floor(value)) : 4;
  return count % 2 === 0 ? count : count + 1;
}

function normalizePoints(values: number[]) {
  const points = values.filter((value) => Number.isFinite(value) && value > 0).map((value) => Math.floor(value));
  return points.length > 0 ? points : [100, 150, 200, 250];
}

function publish() {
  io.emit('game:state', state);
}

function updateTeam(teamId: string, amount: number) {
  const team = state.teams.find((item) => item.id === teamId);
  if (team) team.score += amount;
}

function recordAward(teamId: string, amount: number, label: string) {
  if (amount === 0) return;
  const award: ScoreAward = { id: randomUUID(), teamId, amount, label, retracted: false };
  state.scoreAwards.push(award);
  updateTeam(teamId, amount);
}

function showdownScore(showdown: NonNullable<GameState['activeShowdown']>, teamId: string) {
  return showdown.scores.find((item) => item.teamId === teamId)?.score ?? 0;
}

function addShowdownScore(showdown: NonNullable<GameState['activeShowdown']>, teamId: string, amount: number) {
  const score = showdown.scores.find((item) => item.teamId === teamId);
  if (score) score.score += amount;
}

function finalistIds() {
  return state.teams.slice().sort((a, b) => b.score - a.score).slice(0, 2).map((team) => team.id);
}

function startShowdown() {
  const finalists = finalistIds();
  if (finalists.length < 2) return false;
  const startingTeam = finalists.includes(state.showdownConfig.startingTeamId ?? '') ? state.showdownConfig.startingTeamId : finalists[0];
  state.round = 'showdown';
  state.activeShowdown = {
    finalistIds: finalists,
    challengerId: startingTeam!,
    guesserId: finalists.find((id) => id !== startingTeam)!,
    round: 1,
    totalRounds: state.showdownConfig.totalRounds,
    phase: 'draft',
    subjectA: '',
    subjectB: '',
    scores: finalists.map((teamId) => ({ teamId, score: 0 })),
    history: [],
  };
  state.message = 'Search Showdown ready. Enter the first pair.';
  return true;
}

function resolveShowdown(lookup: { scoreA: number; scoreB: number; winner: ShowdownOption | 'tie'; source: 'live' | 'manual' }) {
  const showdown = state.activeShowdown;
  if (!showdown || !showdown.guesserChoice || lookup.winner === 'tie') return;
  const winnerId = showdown.guesserChoice === lookup.winner ? showdown.guesserId : showdown.challengerId;
    const points = 1;
  const history: ShowdownHistoryEntry = { round: showdown.round, subjectA: showdown.subjectA, subjectB: showdown.subjectB, lookup, points, winnerTeamId: winnerId };
  showdown.history.push(history);
  addShowdownScore(showdown, winnerId, points);
  showdown.lookup = lookup;
  showdown.phase = 'resolved';
  state.message = `${state.teams.find((team) => team.id === winnerId)?.name ?? 'Team'} wins ${points} Finale points.`;
}

async function trendsLookup(subjectA: string, subjectB: string) {
  const raw = await googleTrends.interestOverTime({
    keyword: [subjectA, subjectB],
    startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    endTime: new Date(),
  });
  const data = JSON.parse(raw) as { default?: { timelineData?: Array<{ value?: number[] }> } };
  const values = data.default?.timelineData?.map((item) => item.value ?? []).filter((value) => value.length >= 2);
  if (!values || values.length === 0) throw new Error('Google Trends returned no comparison data.');
  const scoreA = Math.round(values.reduce((sum, value) => sum + value[0], 0) / values.length);
  const scoreB = Math.round(values.reduce((sum, value) => sum + value[1], 0) / values.length);
  return { scoreA, scoreB, winner: scoreA === scoreB ? 'tie' as const : scoreA > scoreB ? 'A' as const : 'B' as const };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/content', (_req, res) => res.json({ categories: state.categories, showdownConfig: state.showdownConfig }));
app.get('/api/state', (_req, res) => res.json(state));
app.get('/api/showdown-config', (_req, res) => res.json(state.showdownConfig));

app.post('/api/content/reload', async (_req, res) => {
  await loadContent();
  publish();
  res.json({ ok: true });
});

app.post('/api/categories', async (req, res) => {
  const body = req.body as { title?: string; questions?: unknown[] };
  const item = await CategoryModel.create({ title: body.title ?? 'New category', questions: body.questions ?? [] });
  await loadContent();
  res.status(201).json(item);
});

app.put('/api/categories/:id', async (req, res) => {
  const item = await CategoryModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await loadContent();
  res.json(item);
});

app.delete('/api/categories/:id', async (req, res) => {
  await CategoryModel.findByIdAndDelete(req.params.id);
  await loadContent();
  res.status(204).end();
});

app.put('/api/showdown-config', async (req, res) => {
  const body = req.body as Partial<ShowdownConfig>;
  const totalRounds = normalizeRoundCount(Number(body.totalRounds));
  const points = normalizePoints(Array.isArray(body.points) ? body.points.map(Number) : []);
  const config = await ShowdownConfigModel.findOneAndUpdate({}, { totalRounds, points, startingTeamId: body.startingTeamId }, { upsert: true, new: true, setDefaultsOnInsert: true });
  state.showdownConfig = { totalRounds, points, startingTeamId: config.startingTeamId ?? undefined };
  publish();
  res.json(state.showdownConfig);
});

io.on('connection', (socket) => {
  socket.emit('game:state', state);
  socket.on('game:action', async (action: { type: string; [key: string]: string | number | undefined }) => {
    switch (action.type) {
      case 'start-showdown':
        if (!startShowdown()) state.message = 'At least two teams are needed for the Search Showdown.';
        break;
      case 'set-showdown-start':
        if (typeof action.teamId === 'string' && state.teams.some((team) => team.id === action.teamId)) {
          state.showdownConfig.startingTeamId = action.teamId;
          state.message = `${state.teams.find((team) => team.id === action.teamId)?.name} starts the Search Showdown.`;
        }
        break;
      case 'select-jeopardy': {
        const category = state.categories.find((item) => item.id === action.categoryId);
        const question = category?.questions.find((item) => item.id === action.questionId);
        if (category && question && !question.used) {
          state.activeJeopardy = { categoryId: category.id, questionId: question.id, revealed: false, dailyDoubleCue: question.dailyDouble };
          state.message = question.dailyDouble ? "It's Gambling Time! Set a wager, then reveal." : 'Question selected.';
        }
        break;
      }
      case 'reveal-jeopardy':
        if (state.activeJeopardy && !state.activeJeopardy.dailyDoubleCue && state.activeJeopardy.wager !== undefined) {
          state.activeJeopardy.revealed = true;
          state.message = 'Answer revealed. Award points or move on.';
        } else if (state.activeJeopardy && !state.activeJeopardy.dailyDoubleCue) {
          state.activeJeopardy.revealed = true;
          state.message = 'Answer revealed. Award points or move on.';
        }
        break;
      case 'set-wager': {
        const category = state.categories.find((item) => item.id === state.activeJeopardy?.categoryId);
        const question = category?.questions.find((item) => item.id === state.activeJeopardy?.questionId);
        const team = state.teams.find((item) => item.id === action.teamId);
        if (state.activeJeopardy?.dailyDoubleCue && question && team && typeof action.teamId === 'string') {
          const maximum = Math.abs(team.score);
          const parsedWager = Number(action.wager);
          const requested = Number.isFinite(parsedWager) ? Math.floor(parsedWager) : 0;
          const wager = Math.max(0, Math.min(requested, maximum));
          state.activeJeopardy = { ...state.activeJeopardy, dailyDoubleCue: false, teamId: team.id, wager };
          state.message = `${team.name} wagered ${wager} points.`;
        }
        break;
      }
      case 'score-jeopardy': {
        const category = state.categories.find((item) => item.id === state.activeJeopardy?.categoryId);
        const question = category?.questions.find((item) => item.id === state.activeJeopardy?.questionId);
        const points = Number(action.points ?? state.activeJeopardy?.wager ?? question?.value ?? 0);
        if (question) question.used = true;
        if (typeof action.teamId === 'string') recordAward(action.teamId, points, `Jeopardy / ${question?.value ?? points}`);
        state.activeJeopardy = undefined;
        state.message = points > 0 ? `Awarded ${points} points.` : 'Square closed.';
        break;
      }
      case 'showdown-set-subjects': {
        const showdown = state.activeShowdown;
        if (state.round === 'showdown' && showdown && showdown.phase === 'draft' && typeof action.subjectA === 'string' && typeof action.subjectB === 'string' && action.subjectA.trim() && action.subjectB.trim()) {
          showdown.subjectA = action.subjectA.trim();
          showdown.subjectB = action.subjectB.trim();
          showdown.guesserChoice = undefined;
          showdown.lookup = undefined;
          state.message = 'Subjects entered. Choose the Guesser\'s side.';
        }
        break;
      }
      case 'showdown-set-choice': {
        const showdown = state.activeShowdown;
        if (showdown && showdown.phase === 'draft' && showdown.subjectA && showdown.subjectB && (action.choice === 'A' || action.choice === 'B')) {
          showdown.guesserChoice = action.choice;
          state.message = 'Choice locked. Run the Trends lookup.';
        }
        break;
      }
      case 'showdown-lookup': {
        const showdown = state.activeShowdown;
        if (showdown && showdown.phase === 'draft' && showdown.subjectA && showdown.subjectB && showdown.guesserChoice) {
          showdown.phase = 'calculating';
          state.message = 'Calculating Google Trends comparison...';
          publish();
          try {
            const result = await trendsLookup(showdown.subjectA, showdown.subjectB);
            if (result.winner === 'tie') {
              showdown.lookup = { ...result, source: 'live' };
              showdown.history.push({ round: showdown.round, subjectA: showdown.subjectA, subjectB: showdown.subjectB, lookup: showdown.lookup, points: 0 });
              showdown.phase = 'tie';
              state.message = 'Trends returned a tie. Discard this pair and propose another.';
            } else {
              resolveShowdown({ ...result, source: 'live' });
            }
          } catch (error) {
            console.error('Google Trends lookup failed:', error);
            showdown.phase = 'manual';
            state.message = 'Live lookup failed. Choose the winning subject manually.';
          }
        }
        break;
      }
      case 'showdown-manual-result': {
        const showdown = state.activeShowdown;
        if (showdown && showdown.phase === 'manual' && (action.choice === 'A' || action.choice === 'B')) {
          resolveShowdown({ scoreA: 0, scoreB: 0, winner: action.choice, source: 'manual' });
        }
        break;
      }
      case 'showdown-discard-tie': {
        const showdown = state.activeShowdown;
        if (showdown && showdown.phase === 'tie') {
          showdown.phase = 'draft';
          showdown.subjectA = '';
          showdown.subjectB = '';
          showdown.guesserChoice = undefined;
          showdown.lookup = undefined;
          state.message = 'Pair discarded. Enter a fresh comparison.';
        }
        break;
      }
      case 'showdown-next': {
        const showdown = state.activeShowdown;
        if (showdown && showdown.phase === 'resolved') {
          if (showdown.round >= showdown.totalRounds) {
            showdown.phase = 'complete';
            state.message = 'Search Showdown complete.';
          } else {
            const nextChallenger = showdown.guesserId;
            showdown.challengerId = nextChallenger;
            showdown.guesserId = showdown.finalistIds.find((id) => id !== nextChallenger)!;
            showdown.round += 1;
            showdown.phase = 'draft';
            showdown.subjectA = '';
            showdown.subjectB = '';
            showdown.guesserChoice = undefined;
            showdown.lookup = undefined;
            state.message = `Round ${showdown.round}: enter a fresh pair.`;
          }
        }
        break;
      }
      case 'showdown-sudden-death': {
        const showdown = state.activeShowdown;
        if (showdown && showdown.phase === 'complete') {
          const combined = showdown.finalistIds.map((teamId) => (state.teams.find((team) => team.id === teamId)?.score ?? 0) + showdownScore(showdown, teamId));
          if (combined[0] === combined[1]) {
            const nextChallenger = showdown.guesserId;
            showdown.challengerId = nextChallenger;
            showdown.guesserId = showdown.finalistIds.find((id) => id !== nextChallenger)!;
            showdown.round += 1;
            showdown.totalRounds = showdown.round;
            showdown.phase = 'draft';
            showdown.subjectA = '';
            showdown.subjectB = '';
            showdown.guesserChoice = undefined;
            showdown.lookup = undefined;
            state.message = 'Sudden death. Enter the deciding pair.';
          }
        }
        break;
      }
      case 'rename-team': {
        const team = state.teams.find((item) => item.id === action.teamId);
        if (team && typeof action.name === 'string') team.name = action.name;
        break;
      }
      case 'add-team': {
        if (state.teams.length < 12) {
          const colors = ['#ff6b5f', '#4da8da', '#7bcf8e', '#c084fc', '#f59e5b', '#e879a9', '#62d4d8', '#b7d46a'];
          const index = state.teams.length;
          state.teams.push({ id: `team-${randomUUID()}`, name: `Team ${index + 1}`, color: colors[index % colors.length], score: 0 });
          state.message = 'Team added.';
        }
        break;
      }
      case 'remove-team':
        if (state.teams.length > 2 && typeof action.teamId === 'string') {
          state.teams = state.teams.filter((team) => team.id !== action.teamId);
          state.message = 'Team removed.';
        }
        break;
      case 'retract-award': {
        const award = state.scoreAwards.find((item) => item.id === action.awardId && !item.retracted);
        if (award) {
          updateTeam(award.teamId, -award.amount);
          award.retracted = true;
          state.message = `Retracted ${award.amount} points.`;
        }
        break;
      }
      case 'reset':
        state = { ...state, phase: 'setup', round: 'jeopardy', teams: createDefaultTeams(), scoreAwards: [], activeJeopardy: undefined, activeShowdown: undefined, message: 'Game reset. Default teams and scores restored.' };
        for (const category of state.categories) for (const question of category.questions) question.used = false;
        break;
    }
    publish();
  });
});

const clientPath = path.resolve(process.cwd(), 'client/dist');
app.use(express.static(clientPath));
app.get('*', (_req, res) => res.sendFile(path.join(clientPath, 'index.html')));

async function main() {
  await mongoose.connect(mongoUri);
  await loadContent();
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`LAN Party Trivia listening on http://0.0.0.0:${port}`);
    console.log(`Open from another device at http://<this-computer-ip>:${port}`);
  });
}

void main();
