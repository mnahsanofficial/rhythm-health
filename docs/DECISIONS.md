# Decisions and open questions

Prepared 29 Oct 2026 from the 13 questions in the 28 Oct handoff. “Decided” means the project requirements already answer the question. “Proposed” is a frontend decision for Nazmul to approve. “Needs Shakeb” is backend-owned or a scope decision and is not settled here.

## Questions for Shakeb

| # | Question | Answer / proposed default | Source | Status |
|---|---|---|---|---|
| Q1 | Are all six Supabase migrations applied to the shared project? | **Default:** verify all six are applied before relying on the shared project; do not infer this from the README. This is a deployment-state check, not something the checked-in specification proves. | TRD §12 defines the schema and §35 defines RLS requirements; neither documents the shared project's applied migration state. | needs Shakeb |
| Q2 | Is the current pair rule and file ownership OK? | **Default:** retain the rule as written: check active PRs/branches, don't edit the other person's active files, and keep `backend/` and `supabase/` Shakeb-owned. | `AGENTS.md`, “Pair rule”; PRD §27, team ownership. | needs Shakeb |
| Q3 | When will B1 be ready, and should demo reset preserve a real active experiment? | **Default:** deliver the seeded demo before the 5 Nov demo; reset only the authenticated user's seeded/demo rows and preserve every non-seeded experiment, especially an active one. **Proposed contract:** `POST /api/demo/reset`, Supabase bearer auth, empty JSON body `{}` (no user ID); response `{ "experiment": ExperimentOut, "report": ReportOut }`. It creates or replaces the seed idempotently and never alters non-seeded records. The returned experiment ID opens the normal experiment/report screens; check-ins remain available through the ordinary check-in endpoint. | PRD §18; TRD §§28–29. The response and preservation rules are proposed details; TRD §28 currently says “creates or resets” data for the authenticated user but does not define request/response JSON or how existing active experiments are handled. | needs Shakeb |
| Q4 | What report JSON shape will B2 use, and how many paid calls will `/complete` make? | **Default:** one report-generation model call after deterministic analysis, with at most one validation retry; no Jev, experiment-design, or prediction call during completion. **Proposed canonical response:** `{ experiment_id, analysis, summary: string, interpretation: string, personal_learnings: string[], confounders: string[], next_experiment: { question: string, reason: string }, created_at }`. Keep deterministic `analysis` authoritative. This keeps TRD §25's `summary` and `personal_learnings`, while making the current schema's `interpretation` explicit and retaining `next_experiment`; replace the loose `learnings` object/list with a typed string array. This shape and call budget need Shakeb's agreement before frontend wiring. | PRD §15 §§7, 9; TRD §§24–25, 31. Current `ReportOut` in `backend/app/schemas/report.py` has nullable `interpretation`, loose `learnings`, and `next_experiment`; TRD §25 additionally shows `summary`, `personal_learnings`, and `confounders`. TRD §24 says completion generates interpretation but does not specify a model-call count. | needs Shakeb |
| Q5 | Are past experiments as prediction context (B3) in scope before 5 Nov? | **Default:** yes, bounded to the five most relevant completed experiments already specified in the remaining-work plan; it directly supports the personalization requirement. | PRD §§5.6, 16, 23; TRD §§17, 19. PRD §23 includes previous experiment context as V1 “Must”; TRD §19 describes the learning context. | needs Shakeb |
| Q6 | Should B4 fix `missing_days` in backend analysis or should the frontend filter it? | **Default:** fix it in backend analysis, so the authoritative report does not label future planned days as missed. The frontend should render the API result without inventing a second rule. | PRD §14 (analysis/adherence) and §15 §5 (timeline); TRD §§21, 24 (backend analysis/report ownership). The current bug and options are recorded in `docs/REMAINING_WORK.md` F4/B4/I3. | needs Shakeb |
| Q7 | Are days rolling 24-hour periods from `started_at` or calendar days in the user's time zone? | Rolling 24-hour periods from `started_at`; display timestamps in the viewer's local time zone. | TRD §11 defines phases/durations; `backend/app/services/progress.py:16` implements rolling periods from `started_at`; `docs/REMAINING_WORK.md` I4 records the behavior. | decided |
| Q8 | Is early completion with two baseline and three intervention check-ins intended? | **Default:** keep the current minimum (2 baseline and 3 intervention check-ins) and show the existing early-finish warning. The docs require completion validation but do not state these exact thresholds, so confirm the rule and whether future days are excluded from missing days. | TRD §§21, 27 describe deterministic analysis and `/complete` validation but do not state minimum counts; current behavior is summarized in `docs/REMAINING_WORK.md` (“Complete” and “Finishing early”). | needs Shakeb |
| Q9 | Is one combined design/prediction call and Jev through OpenRouter intended? Should the TRD be updated? | **Default:** update the TRD to match the code: one validated OpenRouter design-and-prediction call, Jev classification through OpenRouter using `OPENROUTER_JEV_MODEL`, and no standalone Jev API credentials. Keep the classification and safety checks as separate logical steps. | TRD §§13–17, 30–31, 36, 38 specify separate design/prediction stages and `JEV_API_KEY`/`JEV_API_URL`; code differences are recorded in `docs/REMAINING_WORK.md` “Where the code differs from the PRD/TRD.” | needs Shakeb |
| Q10 | Should history fetch each report or should `GET /api/experiments` include a result summary? | **Decision:** list completed experiments with `GET /api/experiments?status=completed`, then fetch each item's existing `GET /api/experiments/{id}/report`. No backend endpoint or response change is needed; each report has its own loading, missing, error and retry states. Revisit a list summary only if measured latency becomes a problem. | PRD §§16–17, §19 screen 8, §23; TRD §27 already defines experiment listing and per-experiment report retrieval. Approved for F5 in the Phase 2 instructions. | decided |
| Q11 | Demo locally or deploy to Vercel/Railway? | Localhost for C2; deployment is out of scope. The 8x onboarding instruction quoted in the request says “keep it local: run and demo everything on localhost.” | 8x Playmakers onboarding instruction quoted verbatim in the user's request. The local repo has no separate copy or section number for that onboarding document. TRD §39 describes Vercel/Railway deployment, but the 8x C2 instruction sets the demo scope. | decided |
| Q12 | Are structured request logging, a full-flow integration test, and magic-link sign-in planned? | **Default:** keep all three as TRD requirements, with the core demo loop first: implement request logging to TRD §37's minimum fields, keep the AI-mocked full-flow integration test in §42, and leave magic-link sign-in in the V1 auth scope. If time forces a cut, Shakeb should explicitly defer the item and update the TRD. | TRD §§6, 37, 42. The TRD specifies email/password and magic link, minimum structured request fields, and integration tests with external AI mocked. | needs Shakeb |
| Q13 | `APP_ENV` is not read by the application. Keep it? | **Default:** remove it from the documented required/configured variables until it controls behavior; keep local configuration simple and avoid implying it changes runtime behavior. | TRD §38 lists `APP_ENV`; `docs/ENV_SETUP.md` says it defaults to development and nothing reads it. | needs Shakeb |

## Proposed contracts for frontend dependencies

These are proposals for Shakeb, not agreed API contracts.

### B1 — seeded demo reset

- **Endpoint:** `POST /api/demo/reset`
- **Request:** authenticated request with `{}`; no user/profile ID in the body.
- **Response:** `{ "experiment": ExperimentOut, "report": ReportOut }`.
- **Behavior:** idempotently create or replace only the current user's rows marked as seeded; preserve non-seeded experiments, including any active experiment. Return the normal persisted experiment/report so the UI uses the regular report route. Use the normal check-in endpoint to inspect seed check-ins.
- **Reason:** PRD §18 requires the seed to use normal product flows and structures; TRD §28 requires a reset for the authenticated user but does not define collision behavior or JSON.

### B2 — report response

- **Endpoint:** existing `GET /api/experiments/{id}/report` and response from `POST /api/experiments/{id}/complete`.
- **Request:** existing authenticated request; no new request fields.
- **Response:** `{ experiment_id, analysis, summary, interpretation, personal_learnings, confounders, next_experiment, created_at }`; `summary` and `interpretation` are strings, `personal_learnings` and `confounders` are string arrays, and `next_experiment` is `{ question, reason }`.
- **Behavior:** deterministic `analysis` and its classification remain authoritative; generated prose explains those facts and cannot alter them. Proposed generation cost is one model call, at most one schema-validation retry; confirm before implementation.
- **Reason:** this preserves both TRD §25's example concepts and the existing report envelope while removing the current loose `learnings` shape.

### B4 — missing days after early completion

- **Endpoint:** existing `POST /api/experiments/{id}/complete`; report is read through existing `GET /api/experiments/{id}/report`.
- **Request:** no new fields.
- **Response:** keep the existing report shape; `analysis.adherence.missing_days` contains only day numbers whose rolling 24-hour interval ended on or before `completed_at` and had no check-in. Do not include planned days whose interval had not elapsed at completion. Keep the denominator/coverage calculation rule unchanged unless Shakeb proposes a separate adjustment.
- **Behavior:** backend analysis owns the rule; frontend displays the returned missing-day list.
- **Reason:** PRD §14 and §15 §5 require adherence/timeline to describe observed, elapsed days; TRD §§21, 24 assign analysis to the backend.

## Proposed PRD/TRD updates

Do not apply these without the product/backend owner's agreement.

- **PRD §13 / TRD §11:** state that experiment days are rolling 24-hour intervals from `started_at`; timestamps are displayed in the user's local time zone. State the minimum check-ins for early completion if that remains the intended behavior.
- **TRD §§13, 17, 30, 36, 38:** describe the actual proposal call count and Jev-via-OpenRouter configuration; remove obsolete `JEV_API_KEY` and `JEV_API_URL` entries if Shakeb confirms.
- **TRD §§24–25:** settle a typed report response, including the relationship between `summary` and `interpretation`, `personal_learnings` and `learnings`, and typed `next_experiment`; specify the paid-call and retry budget for `/complete`.
- **TRD §28:** specify B1 request/response JSON, reset idempotency, and preservation of non-seeded/active experiments.
- **PRD §14 / TRD §§21, 24:** specify B4's elapsed-day definition and whether the coverage denominator includes planned days after early completion.
- **TRD §§6, 37, 42:** confirm whether magic-link auth, structured request logs, and the mocked full-flow integration test remain V1 requirements or are deferred beyond the C2 demo.
- **TRD §38 / `docs/ENV_SETUP.md`:** remove or define `APP_ENV` once its status is agreed. Keep deployment for this C2 demo on localhost per the 8x onboarding instruction; TRD §39's Vercel/Railway plan should be marked out of scope for this milestone.

