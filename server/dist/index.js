"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const node_http_1 = require("node:http");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const socket_io_1 = require("socket.io");
const models_1 = require("./models");
const port = Number(process.env.PORT ?? 3000);
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lan_party_trivia';
const app = (0, express_1.default)();
const httpServer = (0, node_http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, { cors: { origin: '*' } });
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const defaultTeams = [
    { id: 'team-red', name: 'The Bright Sparks', color: '#ff6b5f', score: 0 },
    { id: 'team-blue', name: 'Quiztopher Walken', color: '#4da8da', score: 0 },
];
let state = {
    phase: 'setup',
    round: 'jeopardy',
    teams: defaultTeams,
    categories: [],
    scoreAwards: [],
    message: 'Choose a square to begin.',
};
const serializeCategories = (items) => items.map((item) => ({
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
    const categories = await models_1.CategoryModel.find().sort({ order: 1 });
    state.categories = serializeCategories(categories);
}
function publish() {
    io.emit('game:state', state);
}
function updateTeam(teamId, amount) {
    const team = state.teams.find((item) => item.id === teamId);
    if (team)
        team.score += amount;
}
function recordAward(teamId, amount, label) {
    if (amount === 0)
        return;
    const award = { id: (0, node_crypto_1.randomUUID)(), teamId, amount, label, retracted: false };
    state.scoreAwards.push(award);
    updateTeam(teamId, amount);
}
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/content', (_req, res) => res.json({ categories: state.categories }));
app.get('/api/state', (_req, res) => res.json(state));
app.post('/api/content/reload', async (_req, res) => {
    await loadContent();
    publish();
    res.json({ ok: true });
});
app.post('/api/categories', async (req, res) => {
    const body = req.body;
    const item = await models_1.CategoryModel.create({ title: body.title ?? 'New category', questions: body.questions ?? [] });
    await loadContent();
    res.status(201).json(item);
});
app.put('/api/categories/:id', async (req, res) => {
    const item = await models_1.CategoryModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await loadContent();
    res.json(item);
});
app.delete('/api/categories/:id', async (req, res) => {
    await models_1.CategoryModel.findByIdAndDelete(req.params.id);
    await loadContent();
    res.status(204).end();
});
io.on('connection', (socket) => {
    socket.emit('game:state', state);
    socket.on('game:action', (action) => {
        switch (action.type) {
            case 'start':
                state.phase = 'playing';
                state.message = 'Game on. Pick a square.';
                break;
            case 'select-jeopardy': {
                const category = state.categories.find((item) => item.id === action.categoryId);
                const question = category?.questions.find((item) => item.id === action.questionId);
                if (category && question && !question.used) {
                    state.activeJeopardy = { categoryId: category.id, questionId: question.id, revealed: false, dailyDoubleCue: question.dailyDouble };
                    state.message = question.dailyDouble ? 'Daily Double! Set a wager, then reveal.' : 'Question selected.';
                }
                break;
            }
            case 'reveal-jeopardy':
                if (state.activeJeopardy && !state.activeJeopardy.dailyDoubleCue && state.activeJeopardy.wager !== undefined) {
                    state.activeJeopardy.revealed = true;
                    state.message = 'Answer revealed. Award points or move on.';
                }
                else if (state.activeJeopardy && !state.activeJeopardy.dailyDoubleCue) {
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
                if (question)
                    question.used = true;
                if (typeof action.teamId === 'string')
                    recordAward(action.teamId, points, `Jeopardy / ${question?.value ?? points}`);
                state.activeJeopardy = undefined;
                state.message = points > 0 ? `Awarded ${points} points.` : 'Square closed.';
                break;
            }
            case 'rename-team': {
                const team = state.teams.find((item) => item.id === action.teamId);
                if (team && typeof action.name === 'string')
                    team.name = action.name;
                break;
            }
            case 'add-team': {
                if (state.teams.length < 12) {
                    const colors = ['#ff6b5f', '#4da8da', '#7bcf8e', '#c084fc', '#f59e5b', '#e879a9', '#62d4d8', '#b7d46a'];
                    const index = state.teams.length;
                    state.teams.push({ id: `team-${(0, node_crypto_1.randomUUID)()}`, name: `Team ${index + 1}`, color: colors[index % colors.length], score: 0 });
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
                state = { ...state, phase: 'setup', round: 'jeopardy', teams: state.teams.map((team) => ({ ...team, score: 0 })), scoreAwards: [], activeJeopardy: undefined, message: 'Choose a square to begin.' };
                for (const category of state.categories)
                    for (const question of category.questions)
                        question.used = false;
                break;
        }
        publish();
    });
});
const clientPath = node_path_1.default.resolve(process.cwd(), 'client/dist');
app.use(express_1.default.static(clientPath));
app.get('*', (_req, res) => res.sendFile(node_path_1.default.join(clientPath, 'index.html')));
async function main() {
    await mongoose_1.default.connect(mongoUri);
    await loadContent();
    httpServer.listen(port, '0.0.0.0', () => {
        console.log(`LAN Party Trivia listening on http://0.0.0.0:${port}`);
        console.log(`Open from another device at http://<this-computer-ip>:${port}`);
    });
}
void main();
