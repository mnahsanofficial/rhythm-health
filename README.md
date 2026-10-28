8x Playmakers C2 (Oct 28 – Nov 6), track "Health habits". A pair project by Nazmul and Shakeb. Runs and demos on localhost; nothing is deployed.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, SQLite via Drizzle (`better-sqlite3`).

## Setup

Requires Node 20.9+ (22 recommended) and git.

```bash
git clone https://github.com/mnahsanofficial/rhythm-health.git
cd rhythm-health
git config user.name "Your Name"          # local to this repo; agent logs record it
git config user.email "you@example.com"
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Check `http://localhost:3000/api/health` returns `{"ok":true,...}`. The SQLite file is created at `./data/health.db` on first use.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run build` | Production build |
| `npm run db:push` | Apply `src/db/schema.ts` to the local database |
| `npm run db:studio` | Browse the database |

## Agent logs

Claude Code, Codex and Cursor sessions are logged to `.claude-logs/` automatically, and the logs are committed with your changes. Before your first agent session, read [`docs/logging.md`](docs/logging.md): Codex needs a one-time hook approval. Agent rules are in [`AGENTS.md`](AGENTS.md).
