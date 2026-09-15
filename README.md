# Signal & Noise Trivia

A local-network party trivia app for a shared TV or laptop screen. The host controls the game from a private browser tab, while the display view stays clean for everyone in the room. It uses Node.js, Express, TypeScript, React/Vite, Socket.io, MongoDB, Mongoose, and Docker Compose.

## Views

- **Host**: `/#host` is the control desk. Pick squares, reveal questions and answers, manage It's Gambling Time! wagers, award or retract points, add/remove/rename teams, start the Search Showdown, lock subject pairs and Guesser choices, run live lookup, or use manual override.
- **Display**: `/#display` is the shared screen. It shows the Jeopardy board, active question, Search Showdown roles/results, finale score, and final leaderboard without controls.
- **Admin**: `/#admin` is the unauthenticated local setup panel for adding, editing, and deleting Jeopardy categories and their five questions, plus configuring the even number of Search Showdown rounds.

All host actions go to the Node server over Socket.io. The server owns the live game state and broadcasts `game:state` to every connected browser, so host and display stay synchronized without refreshes. MongoDB stores reusable Jeopardy categories; a game reset only resets live state and does not delete content.

## How To Play

### Round 1: Jeopardy board

Open Host and Display. Start the game, then choose a category/value square from Host. The selected question opens over the board on the Display. Reveal the answer, award the square value to a team, or close it unanswered. Used squares turn grey.

It's Gambling Time! is configured per question in Admin. When selected, the Display plays a bright It's Gambling Time! cue while the Host chooses the wagering team and amount. There is no base-value minimum: a team with a positive score can wager any amount from zero up to its score, while a team in the negatives can wager up to the absolute value of its score to work back to break-even. After the wager is set, reveal the question and choose `Correct` to add the wager or `Incorrect` to subtract it. Every awarded score change appears in Host's Recent awards list and can be retracted later; the correction is broadcast to Display immediately.

Scores are manual and team-based. The default teams are The Bright Sparks and Quiztopher Walken. Host can add teams up to 12, remove teams while keeping at least two, and rename any team before or during play. Team changes and scores are broadcast to Display in real time.

### Finale: Search Showdown

After Jeopardy, only the top two main-round teams advance. The Host starts an even-numbered finale, with the starting Challenger selected from the finalist pair and roles alternating strictly every round. The Challenger proposes two non-empty subjects. The Host locks the Guesser to Option A or B; the other finalist automatically owns the remaining option.

`Live lookup` compares the exact pair through the unofficial `google-trends-api` package over the previous 12 months. The Display shows a calculating state, then both relative scores and the winning option. The team holding the higher option receives exactly 1 Finale point. If the lookup fails, Host can choose the winning option manually and the round is recorded as a manual override. Equal Trends scores are not scored: discard the pair and propose a fresh one. Finale score details remain Host-only during play; the final leaderboard reveals combined totals at the end.

Finale points are tracked separately. At completion, finalists are ranked by main-round score plus Finale score; non-finalists keep their main-round placement. An overall tie starts sudden death, using the same enforced challenge format.

## Setup

### Prerequisites

- Docker Desktop with Docker Compose
- A laptop/desktop on the same Wi-Fi network as the TV or other display device
- Optional for local development: Node.js 22+

### Docker (recommended)

```bash
docker-compose up --build
```

The app container binds to `0.0.0.0:3000` and logs the port on startup. On the host computer, open `http://localhost:3000/#host`. Find the host computer's LAN IPv4 address (`ipconfig` on Windows, `ifconfig` or `ip addr` on macOS/Linux), then open `http://YOUR-LAN-IP:3000/#display` on the TV or another device. Use `/#admin` to prepare content.

MongoDB is available to the app at `mongodb://mongo:27017/lan_party_trivia`. From the host machine, the Compose file also exposes it as `mongodb://localhost:27017/lan_party_trivia`, which can be entered in the MongoDB VS Code extension.

### Seed example content

The Docker image starts with an empty database. After the containers are running, seed the example board from the host with:

```bash
docker-compose exec app node server/dist/seed.js
```

Restart or visit the app again after seeding. The seed creates two five-question Jeopardy categories. Running the seed replaces existing categories, so do not run it after creating your own content unless that reset is intended.

### Local development

Local development uses two application processes plus MongoDB:

- MongoDB: `localhost:27017`
- Express and Socket.io backend: `localhost:3000`
- Vite frontend: `localhost:5173`

Start MongoDB with Docker while running the app from source:

```powershell
docker-compose up -d mongo
npm install
Copy-Item .env.example .env
npm run dev
```

Then open:

- Host: `http://localhost:5173/#host`
- Display: `http://localhost:5173/#display`
- Admin: `http://localhost:5173/#admin`

The Vite development server proxies `/api` requests and Socket.io WebSocket traffic to the Express server on port `3000`, so buttons, realtime updates, and the Admin panel work from the `5173` URL. The backend connects to MongoDB using `MONGODB_URI`.

The Search Showdown's live lookup is the one feature that requires internet access at party time. Jeopardy, MongoDB, and local realtime sync continue to work on the home network, but a venue with no internet or aggressive rate limiting may require the Host's manual winner override.

To seed the database while using this setup, run:

```powershell
npx tsx server/src/seed.ts
```

Do not run the Docker `app` service at the same time as `npm run dev`, because both use port `3000`. Stop a previously running Docker app with:

```powershell
docker-compose stop app
```

If MongoDB is already installed locally, you can skip `docker-compose up -d mongo` and use `mongodb://localhost:27017/lan_party_trivia` in `.env`.

For source changes, Vite updates the frontend through hot module replacement and `tsx watch` restarts the backend automatically. Restart is only needed after changing dependencies or Docker configuration.

The environment variables are:

- `PORT`: Express/Socket.io port, default `3000`
- `MONGODB_URI`: Mongoose connection string, normally `mongodb://localhost:27017/lan_party_trivia` for local development
- `VITE_SOCKET_URL`: optional Socket.io URL; leave unset during local development to use the Vite proxy

## Day-of checklist

1. Confirm the venue's Wi-Fi has real internet access, not just a local network — the Search Showdown's live lookup needs it. If it's unreliable, be ready to use the Host's manual winner override.
2. Start Docker Desktop and run `docker-compose up --build`.
3. Seed content once, or confirm your saved MongoDB content is present at `/#admin`.
4. Open `/#display` on the TV and full-screen the browser.
5. Open `/#host` on the host laptop; rename teams and test one reveal.
6. Confirm both devices show the same scoreboard and board state.
7. Keep the host tab private; only the display URL is shared with the room.

## Project layout

```text
client/              React + Vite UI and responsive CSS
server/src/          Express, Socket.io, Mongoose models, and seed script
Dockerfile           Multi-stage client/server production image
docker-compose.yml   app + MongoDB services
.env.example         documented connection settings
eslint.config.js     root ESLint flat config
.prettierrc          shared formatting rules
```

The client and server intentionally share `server/src/types.ts` for the realtime state contract. `npm run build` builds the Vite client into `client/dist` and compiles the Express server into `server/dist`; the production server serves the client from that directory.
