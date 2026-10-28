8x Playmakers C2 (Oct 28 – Nov 6), track "Health habits". A pair project by Nazmul and Shakeb. Runs and demos on localhost; nothing is deployed.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4 in `frontend/`; FastAPI (Python 3.11+, managed with `uv`) in `backend/`. See `PRD.md` and `TRD.md`.

## Setup

Requires Node 20.9+, [uv](https://docs.astral.sh/uv/) and git.

```bash
git clone https://github.com/mnahsanofficial/rhythm-health.git
cd rhythm-health
git config user.name "Your Name"          # local to this repo; agent logs record it
git config user.email "you@example.com"

# frontend, http://localhost:3000
cd frontend && npm install && cp .env.example .env.local && npm run dev

# backend, http://localhost:8001 (second terminal)
cd backend && uv sync && cp .env.example .env.local
uv run uvicorn app.main:app --reload --port 8001
```

Check `http://localhost:8001/health` returns `{"status":"ok"}`; the home page shows "Backend connected".

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `lint` / `typecheck` / `build` (in `frontend/`) | Next.js dev server, ESLint, route types + `tsc`, production build |
| `uv run pytest` (in `backend/`) | Backend tests |

## Agent logs

Claude Code, Codex and Cursor sessions are logged to `.claude-logs/` automatically, and the logs are committed with your changes. Before your first agent session, do the [teammate setup](docs/logging.md#teammate-setup) in `docs/logging.md` and run a canary. Agent rules are in [`AGENTS.md`](AGENTS.md).
