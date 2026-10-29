# Remaining work

Status as of **29 Oct 2026**, taken from the code on `main` (commit `17a64f4`), not from the PRD. Final demo: **Thu 5 Nov**.

The core loop, in the order this list follows: **onboarding → propose an experiment → daily check-ins → see results and progress.** 8x judges "a core loop that works end to end", so open items that block the loop come first.

## Status key

| Status | Meaning |
|---|---|
| **Done** | Built and working end to end |
| **Partial** | Started; what's missing is stated |
| **Not started** | Nothing in the code yet |
| **Uses sample data** | UI exists but isn't wired to the API |

**How "Done" was checked.** These pass on `main`:

- Backend: `uv run pytest`, 168 tests.
- Frontend: `npm run lint`, `npm run typecheck`, `npm test` (35 tests), `npm run build`.
- Playwright: `npm run test:e2e`, 2 flows passed. 2 more are skipped in the code; see [Bugs and risks](#bugs-and-risks).

Each flow was also tried by hand at 390px and 1440px, signed in with a real account:

| Flow | Run against |
|---|---|
| Profile, propose, save, start | The real backend |
| Check-in, finish, report | Real backend reads; writes mocked, so no fake health data went into the shared database |

Nobody has finished a real experiment against the real database yet. The earliest that's possible is about 3 Nov.

**Priority:** **Must** = needed for the 5 Nov demo. **Nice** = nice to have.

---

## Frontend (owner: Nazmul)

### Open, most important first

| # | Item | Status | Source | Done means | Priority | Depends on Shakeb |
|---|---|---|---|---|---|---|
| F1 | Check for an active experiment **before** proposing | Partial | TRD §2.5 | `/experiments/new` says "you already have an active experiment" before any AI call | Must | No |
| F2 | Open the seeded completed experiment | Not started | PRD §18, TRD §28–29 | A signed-in user can load the demo experiment and open its full Lab Report from the app | Must | Yes: B1 |
| F3 | Lab Report sections 7 and 9: what we learned, and what to test next | Partial | PRD §15 (sections 6, 7, 9), TRD §24–25 | The report shows the AI summary, learnings and next experiment, and a **Run this experiment** button that starts a new proposal from it | Must | Yes: B2 |
| F4 | Don't show future days as "Missed" after finishing early | Partial (bug) | PRD §13, §15 section 5 | An early finish lists only days that actually passed without a check-in | Must | Yes: B4, or agree the frontend filters |
| F5 | Experiment history screen | Not started | PRD §17, §19 screen 8, §23 | A list of past experiments, each with question, date, prediction, observed change and signal | Must | Maybe: I5 |
| F6 | Primary-metric trend on the experiment dashboard | Partial | PRD §11 | The dashboard shows the primary metric day by day (today it's only in each day's details), without calling a result early | Nice | No |
| F7 | Rhythm ring hydration mismatch under reduced motion | Partial (bug) | PRD §21; our quality floor | No server/client mismatch with reduced motion on; the skipped e2e test is turned back on | Nice | No |
| F8 | Tests for check-in, dashboard and report | Not started | TRD §43 (frontend owns these screens) | Component and e2e tests cover these three screens; the contract test covers `CheckinIn`/`CheckinOut`/`ReportOut` | Nice | No |
| F9 | Magic-link sign-in | Not started | TRD §6, §27 | A user can sign in from an emailed link | Nice | Yes: redirect URL set in the Supabase project |
| F10 | Edit the AI proposal before starting | Not started | PRD §23 (nice to have) | The user can adjust the proposal before **Start** | Nice | Maybe: whether the backend re-checks edits |
| F11 | Share or export the Lab Report | Not started | PRD §23 (nice to have) | A report can be shared or saved | Nice | No |
| F12 | Clean-up | Partial | none | Unused `auth-panel.tsx` and `backend-status.tsx` deleted, one `signedPercent`, keyboard e2e test fixed and turned back on | Nice | No |

### Done

| Item | Source | Notes |
|---|---|---|
| Onboarding: 7 questions, saved on the device, account created at the end, sent as `PUT /api/profile` | PRD §6, TRD §12.1 | Returning users start from their saved profile |
| Sign up, sign in and sign out with email and password | TRD §6 | A 401 sends you to `/sign-in?next=…` and back afterwards (TRD §33) |
| Home: new, returning and active states | PRD §20 | Active shows "Check in for day X", or "Done for today" |
| Home rhythm ring | PRD §20 | **Uses sample data**, labelled as sample, by design. Onboarding draws the user's own ring |
| Ask a question, see the proposal and prediction, start | PRD §7–9, TRD §13 | Shows confidence, reasoning and uncertainty factors |
| Safety block with a suggested alternative ("Use this instead") | PRD §10, TRD §15 | |
| Daily check-in from the experiment's own metrics | PRD §12, TRD §20 | Scale, number, boolean, duration; optional note; server field errors shown per field |
| Experiment dashboard and timeline | PRD §11, §13 | Day X of N, phase, adherence, logged/missed/today/upcoming days, tap a day for its values |
| Finish an experiment, with a warning if it's early | TRD §27 `/complete` | Shows the check-ins still needed when the server says there aren't enough yet |
| Lab Report, calculated parts | PRD §15 sections 1–6, 8 | Verdict and reasons, prediction vs reality, accuracy, adherence, interactive day chart, other metrics |

---

## Backend (owner: Shakeb)

### Open, most important first

| # | Item | Status | Source | Done means | Priority | Depends on Nazmul |
|---|---|---|---|---|---|---|
| B1 | Seeded demo: `POST /api/demo/reset` and seed data | Not started | PRD §18, TRD §28–29 | One call gives the signed-in user a completed "walk after dinner" experiment with 10 check-ins and a report, in the normal tables | Must | Yes: F2 |
| B2 | AI report: interpretation, learnings, next experiment | Not started | PRD §15, TRD §24–25, §31 | `/complete` fills `interpretation`, `learnings` and `next_experiment` from the calculated facts, validated by Pydantic; the AI can't change the classification | Must | Yes: F3, agree the shape (I2) |
| B3 | Past experiments as context for new predictions | Not started | PRD §5.6, §16, §23, TRD §19 | `/propose` passes up to 5 relevant completed experiments to the model | Must | No |
| B4 | Don't count future days as missing when finished early | Partial (bug) | PRD §14 ("missing days") | `adherence.missing_days` only lists days before the completion day | Must | Yes: F4 |
| B5 | Chart-ready data in the report | Not started | TRD §26 | The report includes the `chart` array | Nice | No; the frontend builds the chart from check-ins today |
| B6 | Regenerate the prediction before start | Not started | TRD §18 | A proposed experiment's prediction can be regenerated; after start it can't | Nice | Yes, if the UI offers it |
| B7 | Structured request logging | Partial | TRD §37 | Each request logs request_id, user_id, experiment_id, operation, duration_ms, status (today only AI calls are logged) | Nice | No |
| B8 | One full-flow integration test | Partial | TRD §42 | One test runs profile → propose → save → start → check-ins → complete → report with mocked AI | Nice | No |
| B9 | Optional AI safety assessment | Not started | TRD §15 (marked optional) | An AI check runs after the rules for borderline requests | Nice | No |
| B10 | Deployment | Not started | TRD §39 | Frontend on Vercel, backend on Railway, CORS set to those origins (TRD §40). The README says localhost only for now | Nice | Yes: env values on Vercel |

### Done

| Item | Source | Notes |
|---|---|---|
| Supabase JWT check; user id from `sub`, never from the body | TRD §6–7 | JWKS, audience, issuer and expiry checked |
| Profile `GET`/`PUT` | TRD §27 | |
| Database tables, RLS and the one-active-experiment index | TRD §12, §35 | `supabase/migrations/` |
| Propose: Jev classification, rule-based safety, AI design and prediction, safety check on the AI output | TRD §13–17, §32 | Retries once on invalid JSON; falls back to the reasoning model if Jev fails (TRD §33) |
| Save, list, get, start | TRD §27 | Start is atomic, with a clear 409 for a second active experiment |
| Day and phase, calculated on read | TRD §11, §20 | See I4 about day boundaries |
| Check-ins: submit or replace today, list | TRD §20, §34 | Validated against the experiment's own metrics |
| Complete: deterministic analysis, signal, prediction accuracy | TRD §21–23 | Needs at least 2 baseline and 3 test check-ins |
| `GET /report` (calculated analysis only) | TRD §27 | |
| `/health` and `/health/supabase` | TRD §39 | |

---

## Integration (needs both of us)

| # | Item | Why | Priority |
|---|---|---|---|
| I1 | Seeded demo end to end (B1 + F2) | A real experiment can't reach a Lab Report before about 3 Nov. The seed is the only reliable way to demo results on 5 Nov | Must |
| I2 | Agree the AI report JSON shape before building (B2 + F3) | `ReportOut` types `interpretation`, `learnings` and `next_experiment` as loose `dict`s. TRD §25 has an example shape | Must |
| I3 | Missing days after an early finish (B4 + F4) | Decide whether the backend fixes `missing_days` or the frontend filters it, so the two don't disagree | Must |
| I4 | Day boundaries | A day is 24 hours from the start time, not a calendar day. Start at 11pm and "day 2" begins at 11pm the next night | Must (decision) |
| I5 | Data for the history screen (F5) | `GET /api/experiments` has no result fields. Either the frontend fetches each report, or the list includes a short result summary | Must (decision) |
| I6 | Keep `frontend/tests/contracts/openapi.json` in step with the backend | The contract test catches drift, but only if the snapshot is refreshed when schemas change | Nice |

---

## Where the code differs from the PRD/TRD

| Area | PRD/TRD says | The code does |
|---|---|---|
| Proposal AI calls | Design, then a separate prediction call (TRD §13, §17) | One call returns both, validated together (`backend/app/services/experiment_designer.py`) |
| Jev config | `JEV_API_KEY`, `JEV_API_URL` (TRD §36, §38) | Jev runs through OpenRouter's Decisions API, set by `OPENROUTER_JEV_MODEL` |
| Fast model | `OPENROUTER_FAST_MODEL` (TRD §30, §38) | Not used; only the reasoning model (TRD §31 allows this) |
| Backend files | `predictor.py`, `report_generator.py`, `api/demo.py`, `demo/*.json` (TRD §5) | Not present; the prediction lives in `experiment_designer.py` |
| Experiment length | "Default for V1: 7 days" (PRD §8) | 3 baseline + 7 test days, per TRD §11 |
| Days | Not defined | Rolling 24 hours from `started_at` (`backend/app/services/progress.py`) |
| Finishing early | Not covered | Allowed once there are 2 baseline and 3 test check-ins; the UI warns first |
| `draft` status | First lifecycle state (TRD §10) | Allowed by the schema, never used; experiments are saved as `proposed` |
| Report chart data | `chart` array (TRD §26) | Not returned; the frontend draws from check-ins |
| Sign-in methods | Email/password and magic link (TRD §6) | Email/password only |
| Deployment | Vercel and Railway (TRD §39) | Localhost only |
| Confounders | "Potential confounders from user notes" (PRD §14) | Notes are stored and shown, but the analysis doesn't use them |

---

## Bugs and risks

| # | Where | What | Effect |
|---|---|---|---|
| R1 | `frontend/components/experiments/new-experiment.tsx:309` | The active-experiment check runs only at **Start**, after `/propose` | Two paid AI calls are spent on a proposal that can't be started (F1) |
| R2 | `backend/app/services/analysis.py:98`, shown at `frontend/components/report/lab-report.tsx:184` | `missing_days` covers every planned day, including ones not reached yet | An early finish says days 6–10 were "Missed" (B4/F4) |
| R3 | `frontend/components/rhythm-ring.tsx:118` | `initial={reduce ? false : …}`: `useReducedMotion()` differs between server and browser | Hydration mismatch with reduced motion on; e2e test skipped at `frontend/tests/e2e/onboarding-experiment.spec.ts:98` (F7) |
| R4 | `backend/app/services/progress.py:34` | Days are 24 hours from the start time | A late-evening start shifts every day (I4) |
| R5 | `backend/app/api/checkins.py:29` | Only today's check-in can be submitted | A missed day can't be filled in later. By design, but worth knowing for the demo |
| R6 | Schedule | A real experiment needs about 5 days of check-ins before it can finish | The 5 Nov demo depends on the seed (I1) |
| R7 | `frontend/tests/contracts/api-contract.test.ts` | The contract test covers profile and experiment schemas only | Check-in and report shape drift wouldn't be caught (F8) |
| R8 | `frontend/tests/e2e/onboarding-experiment.spec.ts:30` | Keyboard-only onboarding test skipped: Chromium leaves the time fields empty | Keyboard path through the sleep-schedule step isn't covered automatically (F12) |
| R9 | `frontend/components/experiments/new-experiment.tsx:17` vs `frontend/lib/report/copy.ts:51` | Two `signedPercent` functions; only one rounds | A range could read "+7.5%" on the proposal and "+8%" on the report (F12) |
| R10 | `frontend/components/auth-panel.tsx`, `frontend/components/backend-status.tsx` | Not imported anywhere | Dead code (F12) |

---

## Coming back on day 3 and day 7, and visible progress

The brief's theme ("Learning that sticks") needs a reason to return on day 3 and day 7, and visible progress.

**Already in the code**

- Home shows **Check in for day X**, or "✓ Done for today · day X of N".
- The dashboard shows day X of N, the phase, the timeline and the check-ins still needed before finishing.
- After the 3 baseline days, the check-in switches to test days ("Did you make the change today?"), from day 4.
- The Lab Report is the payoff, once enough days are logged.

**What the PRD says.** It names day 3 retention as a metric (PRD §26). It says the app may show when today's check-in is due (PRD §22), and that the timeline should read as evidence building up, not a streak (PRD §13). Nothing in the PRD or TRD is aimed at day 7, and push notifications are out of scope (PRD §22).

## Suggestions

> **Suggested by Claude, not in the PRD, TRD or code.** For us to decide on, not commitments.

- **S1. Day 3, "your normal week" moment.** When the baseline ends, show the user's own baseline range for the primary metric, so day 4 starts with "now let's see if the change moves this".
- **S2. Day 7, halfway check.** On test day 4 (experiment day 7), show "N of 7 test days logged" and the earliest date the report can be ready. Use the counts the finish card already has.
- **S3. Report countdown on home.** "Your report can be ready from {date}" under the check-in button.
- **S4. Abandon or restart an experiment.** There's no way out of an active experiment, and only one is allowed at a time.
- **S5. Rehearse the demo.** On 4 Nov, run seed → report → history → new question by hand, at 390px, on the machine used for the demo.
