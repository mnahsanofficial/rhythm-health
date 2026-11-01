# Decisions and open questions

Prepared 29 Oct 2026 from the 13 questions in the 28 Oct handoff, and updated the same day against the repo (branch `feat/report-generation`) and `docs/REMAINING_WORK.md`. “Decided” means the project requirements, the current implementation or a decision already made answer the question. “Needs Shakeb” is backend-owned or a scope decision and has no questions open.

## Questions for Shakeb

| # | Question | Answer / proposed default | Source | Status |
|---|---|---|---|---|
| Q1 | Are all six Supabase migrations applied to the shared project? | **Yes.** All six files in `supabase/migrations/` (profiles, profile grants, experiments, one-active-experiment index, daily check-ins, experiment reports) were applied to the shared project, and the profile, experiment, check-in, completion and report endpoints have been exercised against it. Any new migration still has to be applied by hand in the Supabase SQL editor and must include its own grants. | Checked in this repo's history and by live runs against the shared project; TRD §12 and §35 define the schema and RLS but not applied state. | decided |
| Q2 | Is the current pair rule and file ownership OK? | **Historical V1 decision; superseded by the current feature-based pair rule and D1 below.** Previously: check active PRs/branches, don't edit the other person's active files, `backend/` and `supabase/` are Shakeb's, and frontend needs for backend changes are written up as requests. | `AGENTS.md`; PRD §27, team ownership. | decided |
| Q3 | When will B1 be ready, and should demo reset preserve a real active experiment? | **Decided.** Sequencing: the seeded demo is the next priority after the basic backend features (B3, B4 first). Reset creates or resets only the signed-in user's seeded demo data and preserves all non-seeded experiments, including an active one. `POST /api/demo/reset` returns the bare `LabReport`, which already contains the experiment. Built on `feat/demo-reset`. | PRD §18; TRD §§28–29 (TRD §28 doesn't define this yet; see the TRD updates list). Decided by Shakeb on 29 Oct. | decided |
| Q4 | What report JSON shape will B2 use, and how many paid calls will `/complete` make? | **Answered by the implementation.** `/complete` makes **no** model call (deterministic analysis only). The narrative is written by a separate `POST /api/experiments/{id}/report`: one reasoning-model call, at most one validation retry, idempotent unless `?regenerate=true`. Responses everywhere are `LabReport` = `{ experiment, analysis, narrative \| null, chart, created_at }`, with `narrative` = `{ summary, interpretation, personal_learnings, confounders, next_experiment: { question, reason } }`. The earlier flat proposal was not used. Full shape: `docs/REMAINING_WORK.md`, "Report API as built". | `backend/app/schemas/lab_report.py`, `backend/app/api/reports.py`; PRD §15 §§7, 9; TRD §§24–25, 31. TRD still says completion generates the interpretation; see the TRD updates list. | decided |
| Q5 | Are past experiments as prediction context (B3) in scope before 5 Nov? | **Yes, in scope.** Bounded to the five most relevant completed experiments. Not built yet (B3 in `docs/REMAINING_WORK.md`, Must). | PRD §§5.6, 16, 23 (V1 "Must"); TRD §§17, 19. | decided |
| Q6 | Should B4 fix `missing_days` in backend analysis or should the frontend filter it? | **Backend.** The backend is the source of truth for `missing_days`; the frontend renders the API result and does not apply a second rule. Built as B4 on `feat/past-experiment-context`. | PRD §14 and §15 §5; TRD §§21, 24; `docs/REMAINING_WORK.md` I3. | decided |
| Q7 | Are days rolling 24-hour periods from `started_at` or calendar days in the user's time zone? | **Accepted V1 decision:** rolling 24-hour periods from `started_at`; timestamps shown in the viewer's local time zone; no profile time zone. | `backend/app/services/progress.py`; `docs/REMAINING_WORK.md` I4. | decided |
| Q8 | Is early completion with two baseline and three intervention check-ins intended? | **Current behavior stands:** completion needs `min(2, baseline_days)` baseline and `min(3, intervention_days)` intervention check-ins, and the UI warns when finishing early. Future days are excluded from missing days (Q6). The TRD doesn't state these numbers; see the TRD updates list. | `backend/app/api/reports.py`, `backend/app/services/analysis.py`; TRD §§21, 27. | decided |
| Q9 | Is one combined design/prediction call and Jev through OpenRouter intended? Should the TRD be updated? | **Yes, as built:** one validated OpenRouter design-and-prediction call; Jev classification through OpenRouter's Decisions API using `OPENROUTER_JEV_MODEL`; no standalone Jev credentials; classification and safety remain separate steps. **The TRD has not been edited yet** (see the TRD updates list). | `backend/app/services/experiment_designer.py`, `backend/app/integrations/jev.py`; TRD §§13–17, 30–31, 36, 38. | decided |
| Q10 | Should history fetch each report or should `GET /api/experiments` include a result summary? | **Decision:** list completed experiments with `GET /api/experiments?status=completed`, then fetch each item's existing `GET /api/experiments/{id}/report`. No backend endpoint or response change is needed; each report has its own loading, missing, error and retry states. Revisit a list summary only if measured latency becomes a problem. | PRD §§16–17, §19 screen 8, §23; TRD §27 already defines experiment listing and per-experiment report retrieval. Approved for F5 in the Phase 2 instructions. | decided |
| Q11 | Demo locally or deploy to Vercel/Railway? | Localhost for C2; deployment is out of scope. The 8x onboarding instruction quoted in the request says “keep it local: run and demo everything on localhost.” | 8x Playmakers onboarding instruction quoted verbatim in the user's request. The local repo has no separate copy or section number for that onboarding document. TRD §39 describes Vercel/Railway deployment, but the 8x C2 instruction sets the demo scope. | decided |
| Q12 | Are structured request logging, a full-flow integration test, and magic-link sign-in planned? | **Magic-link sign-in: skipped for V1** (email/password only). **Structured request logging: deferred**, done only if time permits. **Full-flow integration test: planned for the very end**, after all features are built and the frontend is ready. | TRD §§6, 37, 42; decided by Shakeb on 29 Oct. | decided |
| Q13 | `APP_ENV` is not read by the application. Keep it? | **Removed.** Dropped from `backend/app/config.py`, `backend/.env.example` and `docs/ENV_SETUP.md`. Existing `.env.local` files that still set it are harmless (extra variables are ignored). `TRD.md` §38 still lists it; see the TRD updates list. | `docs/ENV_SETUP.md` said nothing reads it. | decided |
| Q14 | Should the chart say which days were missed, instead of the frontend looking them up in `missing_days`? | **Yes.** The backend adds `missed: boolean` to each `chart.points` item (B11); the frontend reads it (F13). Implemented on `feat/scale-words-chart-days` with F13; [contract/evidence](SCALE_WORDS_CHART_DAYS.md). | PR #22 review; `backend/app/schemas/lab_report.py`. Decided by Shakeb on 30 Oct. | decided |
| Q15 | How long does `POST /report` take, and does the frontend need a client timeout? | About 10–11 seconds for a fresh narrative in live testing; under a second when the stored narrative is returned. **No client timeout for now**; the existing loading copy is enough unless calls get much slower. | Live testing by Shakeb; PR #22 review, 30 Oct. | decided |
| Q16 | Should people be able to regenerate a written report (`?regenerate=true`)? | **No.** Keep it out of the UI; it's for development and testing only. | PR #22 review; decided by Shakeb on 30 Oct. | decided |
| Q17 | Will the backend check that numbers quoted in the narrative match the analysis (R12)? | **Deferred**, only if time permits. The deterministic analysis stays the source of truth and the frontend never uses narrative numbers as data. | PR #22 review; decided by Shakeb on 30 Oct. | decided |

## Contracts for frontend dependencies

### B1 — seeded demo reset (decided, built)

- **Endpoint:** `POST /api/demo/reset`
- **Request:** authenticated request with `{}`; no user/profile ID in the body.
- **Response:** the bare `LabReport` of the completed seeded experiment (narrative filled). `LabReport` already embeds the experiment, so there is no `{ experiment, report }` wrapper.
- **Behavior:** create or reset only the signed-in user's seeded demo data, idempotently. Preserve all non-seeded experiments, including any active experiment. The UI opens the returned experiment through the normal screens; seed check-ins are read through the ordinary check-in endpoint.
- **Reason:** PRD §18 requires the seed to use normal product flows and structures; TRD §28 requires a reset for the authenticated user but does not define collision behavior or JSON.
- **Built as:** one stable seeded experiment per profile (same id every reset); only that profile's `is_seeded` rows are replaced; narrative is fixed text checked against the computed analysis; the frontend already uses the bare `LabReport`.

### B2 — report response (decided, built)

Replaces the earlier flat proposal. Full request/response table and shape: `docs/REMAINING_WORK.md`, "Report API as built".

- `POST /api/experiments/{id}/complete`: deterministic analysis only; returns `LabReport` with `narrative: null`.
- `POST /api/experiments/{id}/report?regenerate=false`: writes the narrative with one model call (at most one validation retry); idempotent.
- `GET /api/experiments/{id}/report`: returns `LabReport`.
- Deterministic `analysis` and its signal classification are authoritative; generated prose is validated against them and cannot change them.
- `chart` (per-day points, means, predicted band) is included, so B5 is done.

### B4 — missing days after early completion (decided, built)

- **Decided:** the backend owns the rule and the frontend displays the returned `analysis.adherence.missing_days`.
- **Rule (built):** `missing_days` contains only day numbers whose rolling 24-hour interval ended on or before `completed_at` and had no check-in. A day still in progress is not missing, and counts as covered if it was logged. Planned days that had not started are not included.
- **Coverage (decided):** after an early finish, `coverage_rate` uses elapsed days only. Future days neither count as missing nor lower coverage. `coverage_rate` = logged days / (elapsed days plus any logged in-progress day). A full-length completion is unchanged.
- **Reason:** PRD §14 and §15 §5 require adherence/timeline to describe observed, elapsed days; TRD §§21, 24 assign analysis to the backend.

## TRD/PRD updates still to make

None of these has been applied; `TRD.md` and `PRD.md` are unchanged since the first commit. They record decisions above, so they only need doing, not deciding, except where marked.

- **PRD §13 / TRD §11:** experiment days are rolling 24-hour intervals from `started_at`, shown in the viewer's local time (Q7); early completion needs `min(2, baseline_days)` baseline and `min(3, intervention_days)` intervention check-ins (Q8).
- **TRD §§13, 17, 30, 36, 38:** one combined design-and-prediction call; Jev through OpenRouter via `OPENROUTER_JEV_MODEL`; remove `JEV_API_KEY` and `JEV_API_URL` (Q9). `OPENROUTER_FAST_MODEL` is also unused.
- **TRD §§24–26:** `/complete` is deterministic; narrative comes from `POST /report`; document the `LabReport` shape, including `chart`, and the one-call, one-retry budget (Q4).
- **PRD §14 / TRD §§21, 24:** state B4's elapsed-day rule and that coverage uses elapsed days only (Q6).
- **TRD §§6, 37, 42:** mark magic-link sign-in out of V1, structured request logs deferred (time permitting), and the mocked full-flow test as the final step (Q12).
- **TRD §38 / `docs/ENV_SETUP.md`:** remove `APP_ENV` (Q13). Deployment: Q11 is decided as localhost for C2, so TRD §39's Vercel/Railway plan can be marked out of scope for this milestone.

## V2 roadmap inputs

Recorded **30 Oct 2026** from Nazmul's architecture/README documentation request, which supplied these call agreements. This is a record of that supplied decision, not an independently checked transcript; no transcript file is present in the repo. Neither item has an agreed detailed implementation contract here.

| Direction | Supplied source / status | Current implementation boundary |
|---|---|---|
| Dedicated fitness/gym tracking | Shakeb, call on **28 Oct**; agreed future direction | Current [classification](../backend/app/schemas/classification.py) accepts exercise questions, but the [schema](../supabase/migrations/) and [UI routes](../frontend/app/) implement personal experiments, not a dedicated gym-tracking feature |
| Several active experiments at once | Pair call on **29 Oct**; agreed future direction | Current [unique index](../supabase/migrations/20261028000300_one_active_experiment_per_profile.sql), [start endpoint](../backend/app/api/experiments.py), [single-experiment home](../frontend/components/home-experience.tsx) and [proposal preflight](../frontend/components/experiments/experiment-flow.tsx) still enforce or assume one active experiment; this needs a coordinated backend/database/frontend change |

## Local mobile reminders in V1 (31 Oct 2026)

**Decided by Nazmul's mobile request:** local next-day reminders and a read-only Progress screen are V1, overriding PRD §22's earlier exclusion of notifications. No remote push or reminder server. Schedule the exact progress `next_day_at`; never calculate a day boundary on the phone. Ask permission only after explicit opt-in, with the explanation offered after a check-in. Settings has opt-out and local-device sign-out. The notification names the day, not the question. Its tap opens the current Check-in after auth and fresh progress, including prefilled recorded answers. A 10-second test exists only in `__DEV__`. Source implementation: [reminders](../apps/mobile/src/lib/reminders.ts), [Settings](../apps/mobile/src/settings.tsx), [Progress](../apps/mobile/src/progress.tsx); scope: [MOBILE_PLAN](MOBILE_PLAN.md). No PRD/TRD file is edited here.

## Deadline decisions by Nazmul — 31 Oct 2026

Source: Nazmul's instructions on 31 Oct 2026 after PR #37 merged. These decisions supersede older pending/ownership entries above; they do not claim Shakeb agreed. Each is **reversible if Shakeb disagrees**. No migration is authorized to run against the shared database.

| # | Date | Decision | Reason | Reversibility |
|---|---|---|---|---|
| D1 | 31 Oct 2026 | Adopt the V2 feature split proposed in [REMAINING_WORK](REMAINING_WORK.md). Nazmul covers backend work on the critical path until Shakeb returns; keep the pair-rule notice and active-branch checks. | no reply from Shakeb since Oct 30; deadline Nov 5 | Reversible if he disagrees |
| D2 | 31 Oct 2026 | B12 scale words are optional/additive, supplied by experiment design. No migration. Old experiments return none and use Low / High. | no reply from Shakeb since Oct 30; deadline Nov 5 | Reversible if he disagrees |
| D3 | 31 Oct 2026 | Implement additive B11 chart-point `missed` flags and switch the web report to them (F13). | no reply from Shakeb since Oct 30; deadline Nov 5 | Reversible if he disagrees |
| D4 | 31 Oct 2026 | Add a user-triggered active demo with clearly labelled sample check-ins, removable and separate from real experiments. Never create it in a real account from tests. | no reply from Shakeb since Oct 30; deadline Nov 5 | Reversible if he disagrees |
| D5 | 31 Oct 2026 | Select S6: collect a primary-metric guess on web **before revealing the AI forecast**, store it with the experiment via one additive nullable reversible migration, and compare guess/AI/actual in the report. Older experiments keep working. Write/test the migration locally; Nazmul applies it himself after notifying Shakeb. | no reply from Shakeb since Oct 30; deadline Nov 5 | Reversible if he disagrees |
| D6 | 31 Oct 2026 | Reminders are V1 scope following the reviewers' daily-web-tracking feedback. Local next-opening reminders shipped in #37; PRD §22's earlier exclusion is superseded. | no reply from Shakeb since Oct 30; deadline Nov 5 | Reversible if he disagrees |

Implementation order, one PR at a time: S8 normal-day context (web/mobile, no migration) → S6 guess → B12/B11/F13 → active demo. S8 uses **each metric**, extending the original suggestion's primary-metric-only wording. S6's approved entry point is before the AI forecast, superseding the suggestion's earlier "before the report" timing. All displayed observations come from deterministic backend data, never model prose.

Proposed PRD/TRD updates: record this feature ownership/temporary backend cover; optional scale words and chart-point missed flags; the active removable sample; the nullable pre-forecast personal guess; V1 local reminders. Do not edit those source documents as part of S8.

### S6 rollout — 31 Oct 2026

Implementation of D5: the guess is signed percent change for the primary metric (−100…+200, matching the existing forecast scale); zero and fractional guesses are valid. It locks at the web AI reveal and is stored on experiment creation. Comparison/error values come from deterministic analysis. One nullable additive column, with an explicit unavailable/opt-out flow before migration. Nazmul applies it **after Sunday 1 Nov 2026, 10:00 Dhaka**, following his notice to Shakeb; agents never apply it to shared Supabase. These deadline choices remain reversible if Shakeb disagrees (no reply from Shakeb since Oct 30; deadline Nov 5). [Rollout/commands](PERSONAL_GUESS.md).

### B12/B11/F13 implementation — 1 Nov 2026

D2/D3 are implemented additively, without a migration: nullable `Metric.min_label` / `max_label` (short, nonblank words) and backend `ChartPoint.missed`. Web/native use provided words with neutral per-end fallback, and the report chart consumes point flags from stored analysis. This follows Nazmul’s deadline decision (no reply from Shakeb since Oct 30; deadline Nov 5) and remains reversible if Shakeb disagrees. [Contract and evidence](SCALE_WORDS_CHART_DAYS.md). S6’s separate migration is still unapplied as Nazmul reported; nothing in this feature applies it.
