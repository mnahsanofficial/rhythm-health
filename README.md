# Rhythm Health Lab

**Run personal experiments to learn which habits actually affect you.**

Ask a question like "Does walking after dinner improve my sleep?" and Rhythm turns it into a short experiment. It predicts what will change before you start. You log a 30-second check-in each day for 3 normal days and then 7 test days. At the end, a Lab Report puts the prediction next to what actually happened, and says honestly whether that was a signal or noise.

**Learning that sticks:** the lesson is about you, built from your own evidence. Making a prediction first turns the result into a surprise or a confirmation. The daily check-in is a small act, not reading. The timeline shows the evidence building up. More in [PRODUCT.md](PRODUCT.md).

## Team

| | Owns |
|---|---|
| **Nazmul** ([@mnahsanofficial](https://github.com/mnahsanofficial)) | Frontend and UI: visual direction, onboarding, dashboard, check-in, Lab Report, motion (`frontend/`) |
| **Shakeb** | Backend and features: architecture, experiment model, AI design and prediction, analysis, data model (`backend/`, `supabase/`) |

Product decisions are made together (PRD §27).

## Current status

The core loop works end to end on localhost: onboarding, ask a question, see the prediction, start, daily check-ins, finish, and the Lab Report's calculated sections.

Signed-in users can ask directly on Your lab (`/`); `/experiments/new` uses the same form and proposal flow. With an active experiment, Your lab keeps today's check-in visible and offers “Test another habit” at the top, replacing the experiment summary with the form in place until closed. Until the backend allows more than one active experiment, the form explains the limit and blocks paid proposal requests.

Signed-in home focuses on your experiment and today’s check-in. Open **Demo** in the lab navigation (`/demo`) to explore the seeded completed example.

Still to build for the 5 Nov demo:
- the AI-written parts of the report (what we learned, what to test next);
- past experiments as context for new predictions;
- the experiment history screen;
- a few bugs.

Full list, with owners and priorities: [docs/REMAINING_WORK.md](docs/REMAINING_WORK.md).

## Tech stack and architecture

```text
Browser ── Next.js 16 (frontend/) ──── signs in with ────▶ Supabase Auth
               │                                              │
               │ JSON + Bearer token                          │ JWT, checked against Supabase's keys
               ▼                                              ▼
           FastAPI (backend/) ───────────────────────────────────┐
               ├── Supabase Postgres (profiles, experiments, check-ins, reports; RLS on)
               └── OpenRouter ── Jev (classify the question) + reasoning model (design and predict)
```

| Part | What it is |
|---|---|
| **Frontend** | Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, `motion`, `@supabase/supabase-js` for sign-in only |
| **Backend** | Python 3.11+, FastAPI, Pydantic, managed with `uv`. Checks the Supabase JWT, owns the experiment lifecycle, safety rules, and the deterministic analysis and classification |
| **Supabase** | Auth (email and password) and Postgres. The backend reads and writes with the service-role key, scoped to the signed-in user. The schema is in `supabase/migrations/` |
| **OpenRouter** | One backend client for the reasoning model (experiment design and prediction) and Jev (category, intent and risk), with validated JSON output only |

The rule: **AI proposes, Python measures** (TRD §2.2). The frontend never talks to the database or OpenRouter directly. Details: [TRD.md](TRD.md), [docs/rules/api-contracts.md](docs/rules/api-contracts.md).

Nothing is deployed yet. Everything runs and demos on localhost.

## Getting started

You need Node 20.9+, [uv](https://docs.astral.sh/uv/) and git, plus collaborator access to the repo and the env values from your teammate. Run these from a clean clone.

**1. Clone and set your git identity.** Agent logs record it.

```bash
git clone https://github.com/mnahsanofficial/rhythm-health.git
cd rhythm-health
git config user.name "Your Name"
git config user.email "you@example.com"
```

Before your first agent session, also do the [teammate setup in docs/logging.md](docs/logging.md#teammate-setup).

**2. Backend** (http://localhost:8001):

```bash
cd backend
uv sync
cp .env.example .env.local
```

Fill in the values in `backend/.env.local`; see [docs/ENV_SETUP.md](docs/ENV_SETUP.md). Then start it:

```bash
uv run uvicorn app.main:app --reload --port 8001
```

Check `http://localhost:8001/health` returns `{"status":"ok"}`, and `http://localhost:8001/health/supabase` returns `{"status":"ok"}` once the Supabase values are right.

**3. Frontend** (http://localhost:3000), in a second terminal from the repo root:

```bash
cd frontend
npm ci
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local` before signing in. If either is blank, the app still loads and the sign-in page names the missing variable. Authentication is unavailable until both values are set. Then start it:

```bash
npm run dev
```

Open http://localhost:3000 and choose **Run your first experiment**.

`npm ci` installs exactly what's in `package-lock.json` without rewriting it. Use `npm install` only when you're adding a package.

The shared Supabase project already has the database migrations applied, so there's nothing to run for the database.

## Running tests

None of these call Supabase or OpenRouter.

```bash
cd backend && uv run pytest           # backend: analysis, safety, progress, auth, endpoints
```

From `frontend/`:

```bash
npm run lint
npm run typecheck
npm test                              # Vitest + Testing Library + MSW
npx playwright install chromium       # once, before the first E2E run
npm run test:e2e                      # Playwright at 390px and 1440px, with mocked auth and API
npm run build
```

What each suite covers, and how to test by hand without spending AI credits or writing fake data: [docs/rules/testing.md](docs/rules/testing.md).

## Project structure

```text
frontend/                 Next.js app
  app/                    routes: /, /onboarding, /sign-in, /experiments/new, /experiments/[id], …/check-in, …/report
  components/             UI by area: onboarding, auth, experiments, checkins, report
  lib/                    api client, auth, data layer (lib/data), types, sample data (lib/mock), helpers
  tests/                  unit, component, contract and e2e tests
backend/                  FastAPI app
  app/api/                routes
  app/services/           analysis, safety, progress, check-in validation, experiment design
  app/integrations/       OpenRouter, Jev, Supabase
  app/repositories/       database access, always scoped to the user
  app/schemas/            Pydantic request and response models
  tests/                  pytest
supabase/migrations/      database schema, RLS policies
scripts/                  agent session-log hooks
.claude-logs/             agent session logs (committed)
docs/                     rules, setup, remaining work, logging
```

## Documentation

| File | What it is |
|---|---|
| [AGENTS.md](AGENTS.md) | The entry point for every coding agent: non-negotiables and the rules index ([CLAUDE.md](CLAUDE.md) adds the Claude Code specifics) |
| [PRODUCT.md](PRODUCT.md) | One-page product summary |
| [PRD.md](PRD.md) / [TRD.md](TRD.md) | Full product requirements and technical architecture |
| [DESIGN.md](DESIGN.md) | Design tokens and component conventions |
| [docs/REMAINING_WORK.md](docs/REMAINING_WORK.md) | What's done, what's left, bugs and risks |
| [docs/ENV_SETUP.md](docs/ENV_SETUP.md) | Every environment variable, by name |
| [docs/rules/](docs/rules/) | Git workflow, secrets, API contracts, testing, UI quality, health content |
| [docs/logging.md](docs/logging.md) | How agent session logging works, and teammate setup |

## How we work

- **Branches:** one per feature, cut from `main` (`feat/…`, `fix/…`, `docs/…`, `test/…`, `chore/…`). Never commit to `main`.
- **Commits:** Conventional Commits, such as `feat(frontend): add the daily check-in screen`.
- **PRs:** a short description of what changed and how it was tested by hand. Merged with a **merge commit**, never squashed or rebased, so each person's commits and logs stay visible.
- **Session logs:** every agent session writes to `.claude-logs/` through hooks, and the logs are committed with the work.
- **AI tools:** Claude Code and Codex.
- **Secrets:** they stay in `.env.local`. None go in prompts, logs or commits.

Details: [docs/rules/git-workflow.md](docs/rules/git-workflow.md).

---

Built during **8x Playmakers C2**, track "Health habits", theme "Learning that sticks", by **Team F**.
