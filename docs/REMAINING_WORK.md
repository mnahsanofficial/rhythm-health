# Remaining work

Status updated **31 Oct 2026** against `main` at `874ce4f` (after #36), with reminders/Progress implemented on `feat/mobile-reminders-progress`. Next feedback call: **Mon 2 Nov**. Final demos: **Thu 5 Nov**.

V2 work is split **by feature**: both of us work across frontend, backend and database ([pair rule](rules/pair-rule.md)). Each item names an owner. Owners marked "(proposed)" are to be confirmed together.

**Status:** **Done** = built and working end to end. **Partial** = started; what's missing is stated. **Not started** = nothing in the code yet. **Planned** = agreed, not built. **Priority:** **Must** = needed for the 5 Nov demo; **Nice** = nice to have.

---

## Merged since the last update (#28–#36)

| PR | What it finished |
|---|---|
| #28 | Your lab clean-up: the day panel opens on the latest recorded day instead of an empty box, the repeated footer nav is gone, and DESIGN.md has the seven "Ours, not AI-default" rules (for web and mobile) |
| #29 | Web calendar reminder: **Add day N+1 to your calendar** on Done for today, a browser-built `.ics` event for when the next day opens |
| #30 | Shared packages: root npm workspace, `packages/contract` (API types generated from FastAPI, with a drift check) and `packages/brand` (design tokens, generated web CSS) |
| #31 | Workflow and pair rules: agents commit, push and open PRs while people merge; V2 split by feature; migrations announced before they're applied |
| #32 | Native-ready type styles (`NATIVE_TYPOGRAPHY`), a readable fallback for unknown report reasons, and setup prerequisites at the top of the README |
| #33 | `GET /api/experiments/{id}/progress`, the one source of day states, counts and the next day's opening, for web and mobile ([PROGRESS_API.md](PROGRESS_API.md)). Your lab, the experiment page and the calendar reminder use it; the web no longer works out missed days or the next opening itself |
| #35 | Expo Go sign-in/profile, secure session persistence and local-device sign-out; verified on iPhone |
| #36 | Mobile Today and Check-in; automatic saved-state refresh and real-iPhone close/reopen verification |

---

## From feedback

Sources: the Oct 30 reviewer call (points supplied by Nazmul; the call transcripts weren't available to this update) and feedback session 1.

| What reviewers said | What we've done | Still open |
|---|---|---|
| Build a mobile app: tracking every day on a website doesn't make sense for a 10-day sprint, and 8x's template is already provided | Agreed. Prepared the shared contract and brand packages (#30, #32) and the progress endpoint (#33) so the app reuses the backend's rules. Added a web calendar reminder (#29) as a stopgap. Plan: [MOBILE_PLAN.md](MOBILE_PLAN.md) | The Expo app itself (Mobile section below). Where 8x's template lives (question) |
| Get the main functionality done ASAP, then add features no competitor has | The web core loop works end to end: onboarding → prediction → check-ins → Lab Report → next experiment | The mobile daily loop first, then one or two [suggested features](#suggested-features-how-we-make-sure-it-helps) |
| "What will you do to make sure this actually helps?" | Built in: prediction before results, deterministic signal-or-noise analysis, honest "pattern, not proof" wording, past experiments as context for new predictions | A clear answer for Monday, from the [suggested features](#suggested-features-how-we-make-sure-it-helps) |
| Demos under 1 minute, after every working feature | Each mobile step in the plan ends with a one-minute demo | Record the demos as features land (in the plan below) |
| Evaluated on innovation and thinking, UI/UX, demos, teamwork, comms and speed | Small, frequent PRs with session logs; DESIGN.md rules against AI-default UI; the feature-based pair rule | Keep shipping daily; post each demo in the team chat |
| Tracking every day on the web is hard (session 1) | Calendar reminder (#29); progress shown from the backend (#33) | The mobile reminder replaces the calendar file |

---

## Plan to Thursday 5 Nov

Mobile core loop shipped through #37. On 31 Oct, Nazmul selected S8 → S6 → B12/B11/F13 → active demo as separate PRs; he covers critical-path backend work until Shakeb returns. These deadline decisions are reversible ([DECISIONS](DECISIONS.md#deadline-decisions-by-nazmul--31-oct-2026)). S8 is in progress on `feat/baseline-context`, with no migration.

Original schedule: **N** = Nazmul, **S** = Shakeb, **?** = not yet agreed (see questions).

| Date | Must work | Owner |
|---|---|---|
| **Sat 31 Oct** | Merge this docs PR. Mobile step 1: scaffold `apps/mobile`, sign in on a phone. Start step 2, Today | N (Codex) |
| **Sun 1 Nov** | Mobile steps 2–4: Today, Check-in, local daily reminder, on a real phone against the local backend. A one-minute demo after each | N (Codex) |
| | Scale words for check-in metrics (B12), or confirm the frontend fallback is fine for now | S ? |
| **Mon 2 Nov (call)** | Show the mobile loop on a phone: sign in → Today → 30-second check-in → Done for today → reminder. Answer "how do we make sure it helps?" with one or two chosen [suggestions](#suggested-features-how-we-make-sure-it-helps) | N + S |
| | Mobile step 5, Progress, if it's not done by the call | N (Codex) |
| **Tue 3 Nov** | Build the first chosen suggestion. Web clean-up (F12: dead code, one percent formatter) | ? (depends on the choice), N |
| | B11 `missed` flag on chart points, then F13 on the web report | S, then N |
| **Wed 4 Nov** | Second chosen suggestion, if time. Mobile polish: offline states, large text, reduced motion. Rehearse the full demo at phone size, on the demo machine and phone | ?, N |
| | Full-flow backend test (B8) | S |
| **Thu 5 Nov** | Freeze in the morning: only fixes. Final demos | N + S |

**By Monday:** the mobile loop (steps 1–4) on a phone, plus an answer to "how do we make sure it helps". **By Thursday:** the full mobile loop including Progress, one or two suggested features, and a rehearsed demo.

---

## Mobile app

Owner: **Nazmul** (built with Codex). Full plan, screens, states and risks: [MOBILE_PLAN.md](MOBILE_PLAN.md).

| # | Item | Status | Done means | Priority |
|---|---|---|---|---|
| MB1 | Scaffold `apps/mobile` and sign in | Done (#35) | Same account as the web on a phone with Expo Go; the session survives a restart; root `npm ci` and the web suites still pass | Must |
| MB2 | Today | Done (#36; iPhone verified) | Day, phase, Done for today and the next opening come only from the progress endpoint; loading, empty, error and offline states | Must |
| MB3 | Check-in | Done (#36; iPhone verified) | All metric types, the test-day question and the note; record or replace today; field errors; answers kept when offline | Must |
| MB4 | Daily reminder (local notification) | Done (this PR; iPhone verified) | Fires at `next_day_at`, names the day only, and opens the check-in when tapped; permission asked after the first check-in | Must |
| MB5 | Progress | Done (this PR; iPhone verified) | Day states and counts only from the progress endpoint; recorded days show their answers | Must |

Already done for mobile: shared types (#30), native type styles (#32) and the progress endpoint (#33).

---

## Daily loop on the web

Owner: **Nazmul**.

| # | Item | Status | Done means | Priority |
|---|---|---|---|---|
| F4 | Missed and future days | **Done** (#24, #26, #33). The timeline uses the progress endpoint; the report's "Missed" uses stored `analysis.adherence.missing_days`. Days after an early finish show as "not recorded before completion", never missed | No frontend date rule anywhere | Must |
| F6 | Primary-metric trend on the experiment page | Partial: recorded values show per day, with no across-days trend (PRD §11) | The experiment page shows the primary metric day by day without calling a result early | Nice |
| F8 | Tests for check-in, dashboard and report | Partial: report and progress are covered; the contract test doesn't check `CheckinIn` / `CheckinOut` yet (R7) | Contract fixtures for check-ins, plus component tests for the check-in screen | Nice |
| F12 | Clean-up | Not started: `auth-panel.tsx` and `backend-status.tsx` are unused, `lib/mock/profile.ts` only feeds the unused `exampleProfile` export, and there are two `signedPercent` functions (R9, R10) | Dead code deleted, one formatter, ARCHITECTURE §6 updated | Nice |
| F9 | Magic-link sign-in | Skipped for V1 (decided) | | Nice |
| F10 | Edit the AI proposal before starting | Not started | The plan can be adjusted before **Start** | Nice |

## Lab Report and analysis

| # | Item | Status | Done means | Priority | Owner |
|---|---|---|---|---|---|
| B11 | `missed: boolean` on each `chart.points` item | Agreed 30 Oct, not built | Each chart point says whether that day counts as missed, by the same rule as `missing_days` | Nice | Shakeb |
| F13 | Web report chart reads `chart.points[].missed` | Waiting on B11; the chart uses `missing_days` today, which gives the same answer | No lookup in `missing_days`; contract refreshed | Nice | Nazmul |
| F11 | Share or export the Lab Report | Not started | A report can be shared or saved | Nice | Nazmul (proposed) |
| R12 | Narrative numbers checked against the analysis | Deferred by Shakeb (30 Oct), time permitting. The web never takes a figure from the narrative | | Nice | Shakeb |

## Experiment design and AI

Owner: **Shakeb**.

| # | Item | Status | Done means | Priority |
|---|---|---|---|---|
| B12 | Scale words for check-in metrics (for example "drained" / "full of energy") | Requested; not built. Web and mobile use frontend copy with a "Low / High" fallback until then | The metric schema carries the words for each end; the contract is regenerated | Nice |
| B6 | Regenerate the prediction before start | Not started (TRD §18) | Possible before start; not after | Nice |
| B9 | Optional AI safety assessment | Not started (TRD §15, optional) | An AI check runs after the rules for borderline requests | Nice |

## Platform and quality

| # | Item | Status | Owner | Priority |
|---|---|---|---|---|
| B8 | One full-flow integration test | Partial; planned as the last step (decided) | Shakeb | Nice |
| B7 | Structured request logging | Deferred, time permitting (decided) | Shakeb | Nice |
| B10 | Deployment | Not started. Localhost is the C2 demo target (DECISIONS Q11) | Shakeb | Nice |
| P1 | Cursor's live logging canary | The hook script passed an offline test; Cursor isn't cleared for agent work until a live canary passes ([logging](logging.md#canary-results)) | Nazmul | Nice |

---

## Integration (needs both of us)

| # | Item | Status |
|---|---|---|
| I1 | Seeded demo end to end (B1 + F2) | Done (#24); verified signed in at 390px and 1440px |
| I2 | Frontend on the real report shape (B2 + F3) | Done (#22) |
| I3 | Missing days after an early finish (B4 + F4) | Done. The progress endpoint (#33) and completion analysis share one adherence rule; verified with backend-generated data across Dhaka/Toronto and DST. A genuine live early finish hasn't been checked |
| I4 | Day boundaries | Decided: a day is a rolling 24 hours from `started_at`; times shown in the viewer's local time. Clients use `next_day_at`, never local midnight |
| I5 | History data source | Resolved: completed experiments, then each report |
| I6 | API contract | Done, and now automatic: `packages/contract` is generated from FastAPI and `npm run contract:check` fails on drift (#30) |
| I7 | Chart missed flag (B11 + F13) | Waiting on Shakeb |
| I8 | Scale words (B12) on web and mobile | Waiting on Shakeb; fallback copy until then |

---

## Done

### Frontend

| Item | Source | Notes |
|---|---|---|
| Your lab clean-up (D1, D3) | Week-1 review | #28 |
| Web calendar reminder | Feedback session 1 | #29; uses `next_day_at` since #33 |
| Progress from the backend on web | PRD §13 | #33: Your lab, the experiment page and the reminder |
| F2. Open the seeded completed experiment | PRD §18, TRD §28–29 | Verified against the real backend at 390px/1440px; repeat reset is stable; the real active experiment is preserved ([evidence](F2_F4_VERIFICATION.md)) |
| Blank Supabase environment values | TRD §38 | Pages load; sign-in names the missing variables (#12) |
| Onboarding: 7 questions, saved on the device, account created at the end | PRD §6, TRD §12.1 | Returning users start from their saved profile |
| Sign up, sign in and sign out with email and password | TRD §6 | A 401 returns to `/sign-in?next=…` |
| Fixed header with signed-in navigation | Week-1 polish | #18, #20 |
| Ask a question, see the proposal and prediction, start | PRD §7–9, TRD §13 | Shared flow on Your lab and `/experiments/new`; checks for an active experiment before the paid call |
| Experiment history | PRD §17, §23 | Each report loads on its own, with loading, missing, error and retry states |
| Safety block with a suggested alternative | PRD §10, TRD §15 | |
| Daily check-in from the experiment's own metrics | PRD §12, TRD §20 | Scale, number, boolean, duration; optional note; field errors |
| Experiment dashboard and timeline | PRD §11, §13 | Day X of N, phase, recorded/missed/current/future days from the progress endpoint |
| Finish an experiment, with a warning if it's early | TRD §27 | Shows the check-ins still needed |
| Lab Report | PRD §15 | Comparison, verdict, adherence, chart and other metrics from `analysis` / `chart`. **Write my report** sends one guarded `POST /report`; **Run this experiment** prefills the next proposal (#22) |
| Landing page as one scroll-driven day, fluid layout from 320px to 2560px | Week-1 polish | #18 |

### Backend

| Item | Source | Notes |
|---|---|---|
| Progress endpoint | PRD §13; mobile prerequisite | #33: owner-only, no writes, no model calls ([contract](PROGRESS_API.md)) |
| B1. Seeded demo reset | PRD §18, TRD §28–29 | #24 |
| B3. Past experiments in predictions | PRD §5.6, §16, §23; TRD §19 | #24: up to five relevant completed experiments |
| B4. Elapsed-day coverage | PRD §14 | #24: future and unobserved days are never missed and don't lower coverage |
| B2. AI narrative, `POST /report` | PRD §15, TRD §24–25 | One model call with validation; idempotent unless `?regenerate=true` (dev and testing only) |
| B5. Chart-ready data | TRD §26 | `chart` in every `LabReport` |
| Auth, profile, propose, save, list, get, start, check-ins, complete, report | TRD §6–27 | JWT checked against JWKS; user id only from the token; atomic start with one active experiment |

### Shared and process

| Item | Notes |
|---|---|
| Shared contract and brand packages | #30, #32 |
| Workflow and pair rules | #31 |

---

## V1 feature status (PRD §23)

Moved from the README. Checked against the code on **31 Oct 2026**.

| Feature | Priority | Status |
|---|---|---|
| Persona creation; natural-language question; AI-generated experiment; predictive forecast; one active experiment; short multi-day structure; manual daily check-ins; experiment timeline; lightweight N-of-1 analysis; prediction vs actual; interactive Lab Report; experiment history; prior results inform predictions; mobile-responsive web; seeded completed experiment | Must | Done |
| Notes/confounder logging; confidence explanation; suggested next experiment; safety checks; interactive charts | Should | Done |
| Dashboard primary-metric trend (PRD §11) | Required screen | Partial (F6) |
| Edit plan before start; compare experiments; share/export report; richer personal-pattern visualization | Nice | Not started |

## V2 directions

Provenance for each is in [DECISIONS.md](DECISIONS.md#v2-roadmap-inputs). None of these has a delivery date.

- **Mobile app beyond the daily loop:** Lab Report, history, starting the next experiment, onboarding ([MOBILE_PLAN.md](MOBILE_PLAN.md#what-moves-to-mobile-in-v2)).
- **Health-data integration, especially Apple Health:** PRD §25, keeping manual subjective check-ins.
- **Optional Google sign-in:** TRD §4.
- **Dedicated fitness and gym tracking:** call on 28 Oct.
- **Several active experiments at once:** call on 29 Oct.
- **Deferred engineering:** request logging and narrative-number checks (DECISIONS Q12, Q17).

---

## Report API as built

Source: `backend/app/schemas/lab_report.py`, `backend/app/api/reports.py`. All endpoints need the bearer token.

| Call | Response | Errors |
|---|---|---|
| `POST /api/experiments/{id}/complete` | `LabReport` with `narrative: null` | 409 not enough check-ins (detail has the counts), already completed, or not active |
| `POST /api/experiments/{id}/report` | `LabReport` with `narrative` filled | 409 not completed; 404 no report; 503 AI unavailable; 502 AI output invalid after retry |
| `GET /api/experiments/{id}/report` | `LabReport` (`narrative` null until written) | 404 no report yet |

A fresh `POST /report` takes about 10–11 seconds; a repeat returns the stored narrative in under a second. `?regenerate=true` is for development and testing only (Shakeb, 30 Oct). Full shape: the generated `LabReport` type in [`packages/contract`](../packages/contract/README.md).

---

## Where the code differs from the PRD/TRD

| Area | PRD/TRD says | The code does |
|---|---|---|
| Proposal AI calls | Design, then a separate prediction call (TRD §13, §17) | One call returns both, validated together |
| Jev config | `JEV_API_KEY`, `JEV_API_URL` (TRD §36, §38) | Jev runs through OpenRouter, set by `OPENROUTER_JEV_MODEL` |
| Fast model | `OPENROUTER_FAST_MODEL` (TRD §30, §38) | Not used |
| Experiment length | "Default for V1: 7 days" (PRD §8) | 3 baseline + 7 test days (TRD §11) |
| Days | Not defined | Rolling 24 hours from `started_at` (I4) |
| Finishing early | Not covered | Allowed with 2 baseline and 3 test check-ins; the UI warns first |
| Completion and the AI report | `/complete` writes the interpretation (TRD §24) | `/complete` is deterministic; `POST /report` writes the narrative |
| Report chart data | `chart` array (TRD §26) | A `chart` object: metrics, per-day points, means, predicted band |
| Day states | Calculated by clients | One endpoint, `GET …/progress` (#33) |
| Notifications | Out of V1 scope (PRD §22) | Web calendar file (#29); local mobile reminders planned for V1 after feedback |
| Sign-in methods | Email/password and magic link (TRD §6) | Email/password only |
| Deployment | Vercel and Railway (TRD §39) | Localhost only |
| Confounders | "From user notes" (PRD §14) | Notes are stored and given to the narrative writer; the analysis doesn't use them |

---

## Bugs and risks

| # | Where | What | Effect |
|---|---|---|---|
| R2 | Stored early-finish analysis | B4 fixes newly completed reports; older stored analysis isn't backfilled | Legacy reports may keep old missed days |
| R4 | `backend/app/services/progress.py` | Days are 24 hours from the start time | A late-evening start shifts every day (accepted, I4) |
| R5 | `backend/app/api/checkins.py` | Only today's check-in can be submitted | A missed day can't be filled in later, on web or mobile |
| R6 | Schedule | A real experiment needs about 5 days of check-ins before it can finish | The 5 Nov demo relies on the seed for the report, and on a real active experiment for the mobile loop |
| R7 | `frontend/tests/contracts/api-contract.test.ts` | Covers `LabReport` and `ExperimentTimeline`, not check-in fixtures | Check-in shape drift in fixtures wouldn't be caught (F8). The generated types themselves are drift-checked |
| R8 | `frontend/tests/e2e/onboarding-experiment.spec.ts` | Keyboard-only onboarding test skipped: Chromium leaves the time fields empty | Keyboard path through the sleep step isn't covered automatically |
| R9 | `frontend/components/experiments/experiment-flow.tsx` vs `frontend/lib/report/copy.ts` | Two `signedPercent` functions; only one rounds | "+7.5%" on the proposal, "+8%" on the report (F12) |
| R10 | `frontend/components/auth-panel.tsx`, `frontend/components/backend-status.tsx`, `frontend/lib/mock/profile.ts` (via the unused `exampleProfile` export in `frontend/lib/data/profile.ts`) | Not used anywhere | Dead code (F12) |
| R12 | `backend/app/services/report_writer.py` | Narrative numbers aren't checked against the analysis (deferred) | A model could misquote a figure in prose; the web never uses narrative numbers as data |
| R13 | `apps/mobile` (planned) | Phone-to-backend networking, Expo Go limits, workspace versions | See [MOBILE_PLAN.md](MOBILE_PLAN.md#dependencies-and-risks) |

---

## Coming back on day 3 and day 7

**In the code:** Your lab shows **Check in for day N** or **Done for today** with the next opening time; the web offers a calendar event for the next day (#29); the timeline shows recorded, missed and coming days; test days start on day 4 with "Did you make the change today?"; the Lab Report is the payoff. **Built, iPhone verified:** the local next-day reminder (MB4).

---

## Suggested features: how we make sure it helps

> **Suggestions by Claude for Nazmul to decide on.** Not in the PRD or TRD, and not commitments. Each builds on what we already have: predictions before results, deterministic analysis, the Lab Report and past experiments as context. Common habit trackers count streaks; none of these do.

| # | Feature | Why it helps learning stick | Rough effort | Before Thursday? |
|---|---|---|---|---|
| S6 | **Your own guess.** Before the AI forecast is revealed, the person enters a primary-metric guess (31 Oct approval). The report then shows three things side by side: the AI's prediction, theirs, and what happened | Committing to a guess makes the result a surprise or a confirmation about your own judgement. That's how calibration is learned, and it's the "learning that sticks" theme made literal | Medium: one stored number per experiment (a migration, announced first), a step before the report on web, a third marker on the comparison | Yes, if chosen by Monday |
| S7 | **What you now know about yourself.** One page that gathers the conclusion of every finished experiment ("A walk after dinner: likely signal, energy +21%") with its signal strength | Turns one-off reports into a personal evidence base that grows, and it's the same data the AI already uses as context, made visible to the person | Small: history and reports already exist; a new web page reading them | Yes |
| S8 | **Your normal, on day 4.** When the baseline ends, show the person's own baseline for each metric (31 Oct approval): "On normal days your energy was 5–6. Now let's see if the walk moves it" | A concrete reason to come back on day 4, and it makes the test days' question personal before any result exists | Small: the baseline values are in the check-ins; one card on Today (web and mobile) | Yes |
| S9 | **Run it again to be sure.** When the result is a *possible* signal or unclear, the report offers the same experiment again, explaining why one more run separates signal from noise | Teaches the idea that one short test isn't proof, which our honest wording already says, and turns it into an action | Small: a report button that prefills the same question with a note; the prediction already uses past results | Yes |
| S10 | **Keep it or drop it, then a two-week check.** After the report, the person decides to keep or drop the habit. Two weeks later, one question asks whether they still do it and whether it still helps | Measures whether the learning changed behaviour, the real test of "does it help". The answer feeds future predictions | Medium to large: a stored decision and a scheduled follow-up (best as a mobile reminder) | Decision step only; the follow-up after Thursday |

**If we pick two for Thursday:** S6 (most innovative, and the clearest answer to "how do we make sure it helps") and S8 (small, and it improves the daily loop on both apps).

## Mobile implementation

#35: Expo Go SDK 58 workspace, existing-account sign-in, encrypted session restoration, profile read with loading/error/offline/missing states, local-device sign-out, and web setup/lab handoff. No backend files, migrations or paid AI endpoints are changed. [Setup and test boundaries](../apps/mobile/README.md). Real-device verification is recorded separately from mocked tests. Today and Check-in are implemented together on `feat/mobile-today-checkin` with separate red/green commits: authoritative day states, foreground refresh, all metric types, prefill, retained answers on failure/offline, and automatic Today refresh after saving. Unsaved drafts are in memory only. The local reminder, Settings and read-only Progress are built on `feat/mobile-reminders-progress`; the real-iPhone reminder, cold-start tap, real Progress and cancellation checks passed before its PR. Native tests mock notifications and the API. There are no new backend files, env settings, migrations or paid calls.
