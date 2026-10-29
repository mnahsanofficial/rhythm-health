# Testing

## The suites

| Where | Command | What it covers | Talks to real services? |
|---|---|---|---|
| `backend/` | `uv run pytest` | Analysis, safety, progress, auth, ownership, every endpoint | No: Supabase and OpenRouter are faked |
| `frontend/` | `npm test` | Vitest, Testing Library and MSW: data layer, onboarding, auth, the proposal flow, the API contract | No |
| `frontend/` | `npm run test:e2e` | Playwright: sign up, onboarding, propose and start, at 390px and 1440px | No: Supabase and API responses are mocked, using `frontend/.env.test` |
| `frontend/` | `npm run lint`, `npm run typecheck`, `npm run build` | ESLint, route types and `tsc`, production build | No |

- Install the Playwright browser once before the first E2E run: `npx playwright install chromium`.
- Run all of these before opening a PR. The repo has no CI yet, so nothing else runs them.

## Testing by hand

Automated tests don't replace using the app. For every flow you change:

- Run it in the browser, signed in, at **390px** and at desktop width.
- Check the loading, error and empty states as well as the happy path (see [UI quality](ui-quality.md)).
- Say in the PR what you checked, and which calls were real and which were mocked.

## The shared Supabase project and paid calls

There is one shared Supabase project and a paid OpenRouter key.

- **Don't put invented health data into a real account.** To test a write by hand (check-ins, finishing), mock the request in the browser rather than saving made-up check-ins to someone's real experiment.
- **Every `/api/experiments/propose` call costs real money** (Jev plus one or more reasoning-model calls). Make as few as you need to prove the flow works, and say how many you made.
- **Never create accounts or type passwords on someone's behalf.** The person signs in; agents test through the signed-in browser session without printing the token.

## Writing tests

- **Frontend work is test-first:** write a behavior test, run it, and confirm it fails for the intended reason before changing product code. Then implement the smallest change that makes it pass.
- Backend tests mock OpenRouter and Supabase, so they are deterministic (TRD §42).
- Frontend tests use the shared fixtures in `frontend/tests/support/fixtures.ts`.
- Keep fixtures valid against the backend's OpenAPI snapshot; the contract test fails if they drift.
- Don't commit a skipped test without the reason in the `test.skip` message.
