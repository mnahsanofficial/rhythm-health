# Remaining work

Status as of **29 Oct 2026**. Backend checked against branch `feat/report-generation` (commit `b4749f2`, merged with `main` at `f935b7e`); frontend status carried over from the earlier pass and **not re-run here** (frontend dev dependencies aren't installed in this checkout). Final demo: **Thu 5 Nov**.

The core loop, in the order this list follows: **onboarding → propose an experiment → daily check-ins → see results and progress.** 8x judges "a core loop that works end to end", so open items that block the loop come first.

## Status key

| Status | Meaning |
|---|---|
| **Done** | Built and working end to end |
| **Partial** | Started; what's missing is stated |
| **Not started** | Nothing in the code yet |
| **Uses sample data** | UI exists but isn't wired to the API |
| **Waiting on backend** | Frontend work is ready against a proposed contract; backend confirmation or implementation is still needed |

**How "Done" was checked.** Backend checks below were last run on `main`; frontend checks were run on this branch:

- Backend: `uv run pytest`, 189 tests, re-run on 29 Oct on `feat/report-generation`.
- Frontend (last run on the F2 branch, not re-run on 29 Oct): `npm run lint`, `npm run typecheck`, `npm test` (49 tests).
- Playwright: `npm run test:e2e`, 12 flows passed, including the seeded demo and report flows at 390px and 1440px. Two existing flows remain skipped in the code; see [Bugs and risks](#bugs-and-risks).

The main account flows were also tried by hand at 390px and 1440px, signed in with a real account:

| Flow | Run against |
|---|---|
| Profile, propose, save, start | The real backend |
| Check-in, finish, report | Real backend reads; writes mocked, so no fake health data went into the shared database |

The history screen was checked in Playwright at both widths with typed mocked API responses, including empty, error, missing-report and retry states. The Lab Report flow (finish, see the analysis, write the report, read the narrative, run the next experiment) was checked in Playwright at 390px, 768px and 1440px with mocked responses in the real `LabReport` shape (`tests/e2e/report-writing.spec.ts`). The frontend hasn't made a real `POST /report` yet: the test account had no completed experiment, and no check-ins were invented to force one. The F2 entry point expects the decided bare `LabReport`; the live backend still has no B1 endpoint.

Nobody has finished a real experiment through the UI yet; the earliest that's possible is about 3 Nov. On the backend, a seeded 10-check-in experiment has been completed and given a narrative against the real Supabase and OpenRouter (see Done, Backend).

**Priority:** **Must** = needed for the 5 Nov demo. **Nice** = nice to have.

---

## Frontend (owner: Nazmul)

### Open, most important first

| # | Item | Status | Source | Done means | Priority | Depends on Shakeb |
|---|---|---|---|---|---|---|
| F2 | Open the seeded completed experiment | Waiting on backend. The frontend side is ready: `resetDemo` and the demo entry expect the bare `LabReport`. The entry stays visible; until B1 exists, clicking it shows the API's error | PRD §18, TRD §28–29 | With the agreed B1 endpoint, a signed-in user can prepare the seeded demo from home and open its completed experiment and Lab Report | Must | Yes: B1 |
| F4 | Don't show future days as "Missed" after finishing early | Frontend done; waiting on B4. The report's "Missed" and the day chart use `analysis.adherence.missing_days` exactly as returned; an unlogged day not in that list shows as "Not reached before you finished". Tested in `tests/report/lab-report-flow.test.tsx`. Until B4 lands, the live backend still lists future days as missing, so they still show as missed | PRD §13, §15 section 5 | An early finish shows the `missing_days` the API returns, with no frontend filtering (the backend is the source of truth, I3). Once B4 lands, check it by hand | Must | Yes: B4 |
| F6 | Primary-metric trend on the experiment dashboard | Partial | PRD §11 | The dashboard shows the primary metric day by day (today it's only in each day's details), without calling a result early | Nice | No |
| F7 | Rhythm ring hydration mismatch under reduced motion | Done | PRD §21; our quality floor | No server/client mismatch with reduced motion on; the skipped e2e test is turned back on | Nice | No |
| F8 | Tests for check-in, dashboard and report | Partial: the report is covered (`lab-report-flow.test.tsx`, `report-writing.spec.ts`) and `LabReport` is in the contract test; `CheckinIn`/`CheckinOut` aren't yet | TRD §43 (frontend owns these screens) | Component and e2e tests cover these three screens; the contract test covers `CheckinIn`/`CheckinOut`/`LabReport` | Nice | No |
| F9 | Magic-link sign-in | Skipped for V1 (decided) | TRD §6, §27 | A user can sign in from an emailed link | Nice | Yes: redirect URL set in the Supabase project |
| F10 | Edit the AI proposal before starting | Not started | PRD §23 (nice to have) | The user can adjust the proposal before **Start** | Nice | Maybe: whether the backend re-checks edits |
| F11 | Share or export the Lab Report | Not started | PRD §23 (nice to have) | A report can be shared or saved | Nice | No |
| F12 | Clean-up | Partial | none | Unused `auth-panel.tsx` and `backend-status.tsx` deleted, one `signedPercent`, keyboard e2e test fixed and turned back on | Nice | No |

### Done

| Item | Source | Notes |
|---|---|---|
| Blank Supabase environment values | TRD §38 | Missing or blank public settings no longer crash pages; sign-in names the missing variables. Covered by F0 tests and checked at 390px and 1440px in PR #12. |
| Onboarding: 7 questions, saved on the device, account created at the end, sent as `PUT /api/profile` | PRD §6, TRD §12.1 | Returning users start from their saved profile |
| Sign up, sign in and sign out with email and password | TRD §6 | A 401 sends you to `/sign-in?next=…` and back afterwards (TRD §33) |
| Home: new, returning and active states | PRD §20 | Active shows "Check in for day X", or "Done for today" |
| Home rhythm ring | PRD §20 | **Uses sample data**, labelled as sample, by design. Onboarding draws the user's own ring |
| Ask a question, see the proposal and prediction, start | PRD §7–9, TRD §13 | Shows confidence, reasoning and uncertainty factors |
| Check for an active experiment before proposing | TRD §2.5 | Your lab (`/`) and `/experiments/new` share the question/proposal flow. Both check the active list before `/propose`; home also shows the known active warning immediately when opening a question. No paid call is made while one is running |
| Experiment history | PRD §17, §19 screen 8, §23; TRD §27 | Lists completed experiments with date, prediction, observed outcome and signal; loads each existing report independently, with loading, missing, error and retry states |
| Safety block with a suggested alternative ("Use this instead") | PRD §10, TRD §15 | |
| Daily check-in from the experiment's own metrics | PRD §12, TRD §20 | Scale, number, boolean, duration; optional note; server field errors shown per field |
| Experiment dashboard and timeline | PRD §11, §13 | Day X of N, phase, adherence, logged/missed/today/upcoming days, tap a day for its values |
| Finish an experiment, with a warning if it's early | TRD §27 `/complete` | Shows the check-ins still needed when the server says there aren't enough yet |
| Lab Report, calculated parts | PRD §15 sections 1–6, 8 | Verdict and reasons, prediction vs reality, accuracy, adherence, interactive day chart, other metrics. Every figure comes from `analysis`; the day chart is drawn from the backend's `chart` data |
| Lab Report on the real `LabReport` shape (F3, I2) | PRD §15 sections 7, 9; TRD §24–25 | One `GET /report` per page. While `narrative` is null, **Write my report** calls `POST /report` once (guarded against double-clicks), with a busy state and plain 503/502 errors with retry; `?regenerate=true` isn't exposed. Shows summary, interpretation, personal learnings, confounders and next experiment. **Run this experiment** prefills the proposal, or points to the running experiment if one is active |
| API contract snapshot refreshed (I6) | TRD §42 | `frontend/tests/contracts/openapi.json` regenerated from the backend after PR #21; the contract test checks the shared `LabReport` fixtures |

---

## Backend (owner: Shakeb)

### Open, most important first

B2 and B5 are done and moved to the Done table below; their IDs are not reused.

| # | Item | Status | Source | Done means | Priority | Depends on Nazmul |
|---|---|---|---|---|---|---|
| B1 | Seeded demo: `POST /api/demo/reset` and seed data | Not started; next priority after the basic backend features (B3, B4) | PRD §18, TRD §28–29 | One call gives the signed-in user a completed "walk after dinner" experiment with 10 check-ins and a report, in the normal tables | Must | Yes: F2 |
| B3 | Past experiments as context for new predictions | Not started | PRD §5.6, §16, §23, TRD §19 | `/propose` passes up to 5 relevant completed experiments to the model | Must | No |
| B4 | Don't count future days as missing when finished early | Partial (bug) | PRD §14 ("missing days") | `adherence.missing_days` only lists days whose 24-hour interval had ended by the completion time, and `coverage_rate` uses elapsed days only, so future days neither count as missing nor lower coverage. The backend is the single source of truth; the frontend renders it as returned | Must | No (F4 just displays the result) |
| B6 | Regenerate the prediction before start | Not started | TRD §18 | A proposed experiment's prediction can be regenerated; after start it can't | Nice | Yes, if the UI offers it |
| B7 | Structured request logging | Deferred: only if time permits (decided) | TRD §37 | Each request logs request_id, user_id, experiment_id, operation, duration_ms, status (today only AI calls are logged) | Nice | No |
| B8 | One full-flow integration test | Partial; last step, after all features and the frontend are ready (decided) | TRD §42 | One test runs profile → propose → save → start → check-ins → complete → report with mocked AI | Nice | No |
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
| Complete: deterministic analysis, signal, prediction accuracy | TRD §21–23 | Needs at least 2 baseline and 3 test check-ins (fewer if the plan has fewer days) |
| `POST /complete` | TRD §21–23, §27 | Deterministic only; no model call, so it is fast and can't fail on the AI service. Returns the `LabReport` with `narrative: null`. Saves the report row and marks the experiment completed |
| `GET /report` | TRD §27 | Returns the `LabReport`: experiment, analysis, `narrative` (null until written), `chart`, `created_at`. 404 until completed |
| B2. `POST /report?regenerate=false`: AI narrative | PRD §15, TRD §24–25, §31 | One reasoning-model call explains the stored analysis (summary, interpretation, personal learnings, confounders, next experiment). Pydantic-validated with one retry; wording and safety checks reject over-claiming, "you predicted", an unsafe next experiment, or a narrative that disagrees with the signal. Idempotent (returns the saved narrative unless `regenerate=true`); 409 until completed, 404 if no report, 503/502 on AI failure. The analysis is never rewritten |
| B5. Chart-ready data | TRD §26 | `chart` in every `LabReport`: primary metric and metric list, per-day points (phase, logged, intervention done, value, all values, note), baseline and intervention means, and the predicted band |
| `/health` and `/health/supabase` | TRD §39 | |

---

## Integration (needs both of us)

| # | Item | Why | Priority |
|---|---|---|---|
| I1 | Seeded demo end to end (B1 + F2) | F2 now expects the decided bare `LabReport`; the backend endpoint and seed data are still needed for the 5 Nov demo | Must; waiting on Shakeb |
| I2 | Move the frontend to the real report shape (B2 + F3) | Done in `feat/lab-report-v2`: the frontend reads the nested `narrative`, the embedded `experiment` and `chart`, and writes the narrative with a separate `POST /report` | Done |
| I3 | Missing days after an early finish (B4 + F4) | **Decided:** the backend is the source of truth for `missing_days`; the frontend does not filter it. Remaining work is B4 itself (backend), then confirming F4 shows the result | Must (B4 still to build) |
| I4 | Day boundaries | **Accepted V1 decision:** a day is a rolling 24 hours from `started_at`, not a calendar day (start at 11pm and "day 2" begins at 11pm the next night). No profile time zone is used. Timestamps are shown in the viewer's local time | Decided |
| I5 | History data source (F5) | Resolved: frontend fetches completed experiments, then each existing report; no backend change is needed | Resolved |
| I6 | Refresh `frontend/tests/contracts/openapi.json` | Done in `feat/lab-report-v2`, regenerated from the backend after PR #21. Refresh it again whenever a backend schema changes (see `docs/rules/api-contracts.md`) | Done |

### B1 seeded demo reset: decided, not built

Contract (recorded in [DECISIONS.md](DECISIONS.md#b1--seeded-demo-reset-decided-not-built)):

- Authenticated `POST /api/demo/reset` with an empty JSON body `{}`; no user or profile ID, the bearer token identifies the user.
- Returns the bare `LabReport` for the completed seeded experiment (it already embeds the experiment). No `{ experiment, report }` wrapper.
- Creates or resets only the signed-in user's seeded demo data, using the normal tables and schemas; idempotent. All non-seeded experiments are preserved, including an active one.
- Still to do: Shakeb builds the endpoint and seed data; Nazmul changes `frontend/lib/data/demo.ts`, its tests and the e2e fixture to the bare `LabReport`; TRD §28 gets the JSON.

PRD §18 requires an example that can be explored without waiting for a multi-day experiment. Until the endpoint exists, F2 can't be verified against the live backend.

### Report API as built

This replaces the earlier B2 proposal. Source: `backend/app/schemas/lab_report.py`, `backend/app/api/reports.py`. All endpoints need the bearer token; no user or profile id is accepted.

| Call | Request | Response | Errors |
|---|---|---|---|
| `POST /api/experiments/{id}/complete` | none | `LabReport` with `narrative: null` | 409 not enough check-ins (detail has the counts), already completed, or not active |
| `POST /api/experiments/{id}/report?regenerate=false` | none | `LabReport` with `narrative` filled | 409 not completed; 404 no report; 503 AI unavailable; 502 AI output invalid after retry |
| `GET /api/experiments/{id}/report` | none | `LabReport` (`narrative` null until written) | 404 no report yet |

```
LabReport = {
  experiment: ExperimentOut,
  analysis: Analysis,                 // authoritative, deterministic
  narrative: null | {
    summary: string, interpretation: string,
    personal_learnings: string[], confounders: string[],
    next_experiment: { question: string, reason: string }
  },
  chart: {
    primary_metric: Metric, metrics: Metric[],
    baseline_days: number, intervention_days: number,
    points: { day, phase, logged, intervention_completed, value, values, note }[],
    baseline_mean, intervention_mean,
    predicted_band: null | { min_percent, max_percent, midpoint_percent,
                             expected_value_min, expected_value_max }
  },
  created_at: string
}
```

Differences from the old proposal: there is no top-level `experiment_id` (use `experiment.id`); the narrative fields sit under `narrative`; `/complete` returns the report, not `{ experiment, report }`; and the narrative is a separate call. Narrative storage reuses the existing columns (`interpretation = {summary, interpretation, confounders}`, `learnings` = list, `next_experiment`); no new migration.

---

## Where the code differs from the PRD/TRD

| Area | PRD/TRD says | The code does |
|---|---|---|
| Proposal AI calls | Design, then a separate prediction call (TRD §13, §17) | One call returns both, validated together (`backend/app/services/experiment_designer.py`) |
| Jev config | `JEV_API_KEY`, `JEV_API_URL` (TRD §36, §38) | Jev runs through OpenRouter's Decisions API, set by `OPENROUTER_JEV_MODEL` |
| Fast model | `OPENROUTER_FAST_MODEL` (TRD §30, §38) | Not used; only the reasoning model (TRD §31 allows this) |
| Backend files | `predictor.py`, `report_generator.py`, `api/demo.py`, `demo/*.json` (TRD §5) | `predictor.py` and `report_generator.py` not present: the prediction lives in `experiment_designer.py`, the narrative in `services/report_writer.py` and `services/lab_report.py`. `api/demo.py` and `demo/*.json` still absent (`backend/app/demo/` is empty) |
| Experiment length | "Default for V1: 7 days" (PRD §8) | 3 baseline + 7 test days, per TRD §11 |
| Days | Not defined | Rolling 24 hours from `started_at` (`backend/app/services/progress.py`); accepted V1 decision (I4) |
| Finishing early | Not covered | Allowed once there are 2 baseline and 3 test check-ins; the UI warns first |
| `draft` status | First lifecycle state (TRD §10) | Allowed by the schema, never used; experiments are saved as `proposed` |
| Report chart data | `chart` array (TRD §26) | Returned as a `chart` object (metrics, per-day points, means, predicted band), not a bare array. The frontend still draws from check-ins |
| Completion and the AI report | `/complete` generates the interpretation (TRD §24) | Split: `/complete` is deterministic only; `POST /report` writes the narrative afterwards |
| Report shape | Flat `summary`, `personal_learnings`, `confounders`, `next_experiment` (TRD §25) | Nested under `narrative`, alongside `experiment`, `analysis`, `chart` |
| Sign-in methods | Email/password and magic link (TRD §6) | Email/password only |
| Deployment | Vercel and Railway (TRD §39) | Localhost only |
| Confounders | "Potential confounders from user notes" (PRD §14) | Notes are stored and shown, but the analysis doesn't use them |

---

## Bugs and risks

| # | Where | What | Effect |
|---|---|---|---|
| R2 | `backend/app/services/analysis.py:98`, shown by the report's "Missed" and the day chart | `missing_days` covers every planned day, including ones not reached yet. The frontend shows it as returned | An early finish says days 6–10 were "Missed" until B4 lands (F4 is ready) |
| R3 | `frontend/components/rhythm-ring.tsx` | Resolved: CSS controls arrival motion; the server and browser render identical SVG | F7 regression passes and the reduced-motion browser test is enabled again |
| R4 | `backend/app/services/progress.py:34` | Days are 24 hours from the start time | A late-evening start shifts every day. Accepted V1 behavior (I4); worth knowing when demoing |
| R5 | `backend/app/api/checkins.py:29` | Only today's check-in can be submitted | A missed day can't be filled in later. By design, but worth knowing for the demo |
| R6 | Schedule | A real experiment needs about 5 days of check-ins before it can finish | The 5 Nov demo depends on the seed (I1) |
| R7 | `frontend/tests/contracts/api-contract.test.ts` | The snapshot is current and covers `LabReport`, but the test doesn't check check-in fixtures yet | Check-in shape drift wouldn't be caught (F8) |
| R12 | `backend/app/services/report_writer.py` | Nothing in code checks that numbers quoted in the narrative match the analysis (the signal classification and wording are checked) | A model could misquote a figure in the prose. The frontend never takes a figure from the narrative: every number on the report comes from `analysis` or `chart` (tested) |
| R8 | `frontend/tests/e2e/onboarding-experiment.spec.ts:30` | Keyboard-only onboarding test skipped: Chromium leaves the time fields empty | Keyboard path through the sleep-schedule step isn't covered automatically (F12) |
| R9 | `frontend/components/experiments/experiment-flow.tsx` (`signedPercent`) vs `frontend/lib/report/copy.ts:51` | Two `signedPercent` functions; only one rounds | A range could read "+7.5%" on the proposal and "+8%" on the report (F12) |
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

## UI motion review follow-up

- PRD §11 also asks for a primary-metric trend on the experiment dashboard. The existing detail screen shows recorded values when a day is selected, but has no across-days trend. This pre-existing gap was found while sharing the timeline with signed-in home; it needs a separate test-first item.
- Signed-in home now focuses on the user's experiment, daily check-in and recorded progress. The seeded demo entry moved to `/demo`, reachable through the lab's Demo link.

### Production build blocker found during motion review — resolved

- `frontend/app/experiments/new/page.tsx` previously awaited `searchParams` outside Suspense with Cache Components enabled; that route was identical in baseline `cac55a4`. The page now serves a shaped static loading shell and reads URL data in a child inside Suspense. Prefilled questions retain their existing behavior.
- The new server-render regression first failed when URL data was pending, then passed after the boundary was added. The production build using fake frontend test variables now generates all 12 pages, including `/experiments/new` as a partially prerendered route.
