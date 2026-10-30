# Agent instructions

The main instructions file for every agent on this repo (Claude Code, Codex, Cursor). The rules live here and in [`docs/rules/`](docs/rules/). `CLAUDE.md` imports this file and adds only what is specific to Claude Code. Codex and Cursor read this file directly. [`frontend/AGENTS.md`](frontend/AGENTS.md) adds the Next.js rules for code in `frontend/`.

If you're about to write a rule into a per-tool file, it belongs here instead.

## The project

**Rhythm Health Lab.** People turn a habit question into a short personal experiment. They see a prediction first, log a 30-second check-in each day, and get a Lab Report comparing the prediction with what actually happened. See [`PRODUCT.md`](PRODUCT.md), with the full detail in [`PRD.md`](PRD.md) and [`TRD.md`](TRD.md).

**Context:**
- 8x Playmakers C2, track "Health habits" (fitness, sleep, food), theme "Learning that sticks".
- Built by a pair, Nazmul and Shakeb, each rated on their own work. V1 was split by layer (Nazmul frontend, Shakeb backend); V2 is split by feature, and both work across frontend, backend and database.
- What's left to build: [`docs/REMAINING_WORK.md`](docs/REMAINING_WORK.md).

## Run it

You need Node 22.18+, [uv](https://docs.astral.sh/uv/) and the two `.env.local` files described in [`docs/ENV_SETUP.md`](docs/ENV_SETUP.md).

Install JavaScript dependencies once at the repository root with `npm ci`; the root lockfile covers all npm workspaces. Do not install separately in `frontend/`.

```bash
npm ci
(cd backend && uv sync)  # root contract checks import FastAPI
cd frontend && npm run dev                                             # http://localhost:3000
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8001  # http://localhost:8001
```

Checks:
- root: `npm run contract:check`, `npm run brand:check`, `npm test` (generated-file freshness and all workspace unit suites)
- frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`
- backend: `uv run pytest`

See [`docs/rules/testing.md`](docs/rules/testing.md).

## Non-negotiables

1. **Session logs are committed.** Hooks write `.claude-logs/` automatically (see [`docs/logging.md`](docs/logging.md)).
   - Always commit it with your changes.
   - Never gitignore it, edit it or delete files from it.
   - Don't change `scripts/extract-log.py`. It is the 8x guide's script, byte for byte.
2. **A branch and a PR per feature, merged with a merge commit.**
   - Claude Code, Codex and Cursor may commit, push their own branches and open PRs directly, and refresh their own feature branch by merging `origin/main`. The people review and merge PRs.
   - Agents never merge PRs, never force-push, and never push to `main`. Always include `.claude-logs/` in the commits. Commit failing behavior tests separately before the green implementation.
   - Before opening any PR: fetch, merge the latest `origin/main` into the branch, resolve conflicts (retain the newer complete copy for session logs), and rerun the checks.
   - Never squash or rebase-merge. We're rated individually, and squashing collapses the code and log history that shows who did what.
   - Cursor may only be used as an agent if its sessions are logged to `.claude-logs/`. Check this before its first use (see [`docs/logging.md`](docs/logging.md)).
3. **No secrets in prompts, logs or commits.**
   - Secrets go in `.env.local` only.
   - Never print, echo or paste a secret value, not even in a response: these logs are public.
4. **No calorie counting, weight targets or medical claims**, anywhere in the product.

## Pair rule

V2 work is split by feature, not by layer: Shakeb and Nazmul both work across frontend, backend and database. Full rule: [`docs/rules/pair-rule.md`](docs/rules/pair-rule.md).

- Don't change files the other person is actively working on; check their open PRs and branches first. If you have to, say so in your PR description.
- Whoever changes the other's area tells them in the team chat when the PR opens.
- A database migration is never applied to the shared Supabase project without telling the other person first, because it affects them immediately. Agents must also tell the requesting person before applying one.

## Product principles

- Small daily sessions, a few minutes each.
- Practice, not just content: the user does something every session.
- Visible progress.
- A reason to come back on day 3 and on day 7.
- Mobile-first. Check every screen at 390px wide.
- Test every flow by hand in the browser. Don't trust that generated code works.

## Rules

Each line is a summary. Read the file before you work in that area.

- **[Git workflow](docs/rules/git-workflow.md):** branch names, Conventional Commit messages, session logs, what agents may do (commit, push their own branches, open PRs; never merge), and the [latest-main merge before every PR](docs/rules/git-workflow.md#refresh-main-before-opening-a-pr).
- **[Pair rule](docs/rules/pair-rule.md):** V2 split by feature, telling the other person when you change their area, and never applying a shared-database migration unannounced.
- **[Secrets](docs/rules/secrets.md):** which values are secret, where they live, and how to check one is set without printing it.
- **[API contracts](docs/rules/api-contracts.md):** how the frontend and the FastAPI backend talk. Covers auth, error shapes, the shared types and the contract test.
- **[Testing](docs/rules/testing.md):** the suites, what they mock, testing by hand, and keeping paid AI calls to a minimum. Frontend changes follow red-before-green: prove the behavior with a failing test before changing product code.
- **[UI quality](docs/rules/ui-quality.md):** mobile-first, loading, error and empty states for every API call, accessibility, and labelled sample data.
- **[UI motion](docs/rules/ui-motion.md):** action/state triggers, shared timing tokens, transform/opacity only, reduced motion, hydration and screenshot evidence.
- **[Health content](docs/rules/health-content.md):** no calorie counting, weight targets or medical claims, and a short experiment shows a pattern, not proof.

Design tokens and component conventions are in [`DESIGN.md`](DESIGN.md).

## Code layout

- `packages/brand/`: shared numeric design tokens, web CSS generation and motion units. Edit `src/tokens.json`, then run root `npm run brand:generate`; never edit generated CSS. See `DESIGN.md`.
- `packages/contract/`: generated FastAPI API types and the shared OpenAPI schema. Run root `npm run contract:generate` after backend schema changes, and `npm run contract:check` before handing over; never edit generated files.
- `apps/*`: reserved for the approved Expo app, built only after the shared-package PR merges.
- `frontend/`: the Next.js app. Read [`frontend/AGENTS.md`](frontend/AGENTS.md) before writing code there.
- `backend/`: the FastAPI app, per [`TRD.md`](TRD.md).
- `supabase/migrations/`: the database schema. Tell the other person before applying a migration to the shared project (see the [pair rule](docs/rules/pair-rule.md)).
- `scripts/`, `.claude/`, `.codex/`, `.cursor/`: agent session logging. Don't change these without reading [`docs/logging.md`](docs/logging.md).
