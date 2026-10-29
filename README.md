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

Check `http://localhost:8001/health` returns `{"status":"ok"}`. For auth, fill in the Supabase values in both `.env.local` files (see the `.env.example` files) and check `http://localhost:8001/health/supabase` returns `{"status":"ok"}`.

## Layout

- `frontend/`: the Next.js app (`app/`, `components/`, `lib/`). Its agent rules are in [`frontend/AGENTS.md`](frontend/AGENTS.md).
- `backend/`: the FastAPI app, per [`TRD.md`](TRD.md).
- `supabase/migrations/`: database schema.

## Scripts

Run these from `frontend/`.

| Command | What it does |
|---|---|
| `npm run dev` / `lint` / `typecheck` / `build` (in `frontend/`) | Next.js dev server, ESLint, route types + `tsc`, production build |
| `npm test` / `npm run test:watch` (in `frontend/`) | Frontend unit and component tests (Vitest, Testing Library, MSW) |
| `npm run test:e2e` (in `frontend/`) | Playwright browser flows, using fake Supabase and API responses from `.env.test` |
| `uv run pytest` (in `backend/`) | Backend tests |

Frontend tests never contact Supabase or OpenRouter. The Playwright flows mock auth and API requests, so they do not need a test account or shared database. Install Chromium once with `npx playwright install chromium` before the first E2E run.

## Testing

Run the frontend suites from `frontend/`:

```bash
npm test                 # unit and component tests
npm run test:watch        # watch unit and component tests
npx playwright install chromium  # one-time browser install
npm run test:e2e          # mocked browser flows at mobile and desktop widths
```

Run backend tests from `backend/` with `uv run pytest`. Frontend automated tests use fake credentials in `frontend/.env.test`; they do not use a Supabase project or call OpenRouter.

## Agent logs

Claude Code, Codex and Cursor sessions are logged to `.claude-logs/` automatically, and the logs are committed with your changes. Before your first agent session, do the [teammate setup](docs/logging.md#teammate-setup) in `docs/logging.md` and run a canary. Agent rules are in [`AGENTS.md`](AGENTS.md).
