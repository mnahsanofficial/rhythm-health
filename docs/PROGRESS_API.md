# Experiment progress contract

`GET /api/experiments/{id}/progress` is the read-only source of day states for web and the planned mobile Progress screen. It accepts the user's Bearer access token, never a user/profile ID or request body. It makes no model call or database write and needs no migration.

Sources: [route](../backend/app/api/experiments.py), [response models](../backend/app/schemas/progress.py), [timeline assembly](../backend/app/services/timeline.py), [existing rolling-day calculation](../backend/app/services/progress.py) and [shared adherence rule](../backend/app/services/analysis.py).

## Response

The generated `ExperimentTimeline` type is exported by [`@rhythm-health/contract`](../packages/contract/src/index.ts). `progress` has the same `ExperimentProgress` shape as the existing experiment endpoints. Example: a three-day experiment, with day 1 recorded and day 2 open:

```json
{
  "progress": {
    "state": "in_progress",
    "day_number": 2,
    "phase": "intervention",
    "phase_day": 1,
    "phase_days": 2,
    "total_days": 3,
    "days_remaining": 1,
    "started_at": "2026-10-31T16:00:00Z",
    "ends_at": "2026-11-03T16:00:00Z"
  },
  "next_day_at": "2026-11-02T16:00:00Z",
  "recorded_days": 1,
  "missed_days": 0,
  "remaining_days": 2,
  "days": [
    { "day_number": 1, "phase": "baseline", "state": "recorded" },
    { "day_number": 2, "phase": "test", "state": "current" },
    { "day_number": 3, "phase": "test", "state": "future" }
  ]
}
```

- `days` is ordered and includes every planned day. Its phases are `baseline` / `test`. The embedded existing summary retains `baseline` / `intervention` for compatibility.
- `recorded`: a check-in exists, including when today's check-in is already recorded. The current day remains identifiable by `progress.day_number`.
- `missed`: the rolling interval finished without a check-in. The endpoint delegates to the same adherence function as completion analysis.
- `current`: the open day has no check-in yet.
- `future`: an unobserved planned day in an experiment that has not finished. Before starting, every day is future.
- `not_observed`: an unrecorded day not counted as missed when the experiment completed early. This also includes the partially elapsed, unlogged completion day. Later requests use `completed_at`, so time passing cannot turn these days into missed days.
- `remaining_days` counts `current` plus `future` entries. It includes an unrecorded open day, unlike the existing `progress.days_remaining`, which counts days *after* the current one. Unobserved days after completion count in neither missed nor remaining.
- `next_day_at` is the next rolling-day opening in UTC. It is null before starting, on the last day, after the planned end, and after completion. Clients format timestamps locally; they do not infer boundaries from local midnight or add calendar days. The last day's end remains available as `progress.ends_at`.
- Existing completed rows with no `completed_at` retain the analysis service's legacy fallback: all planned intervals are considered elapsed. This endpoint does not backfill old rows or rewrite reports.

## Errors and ownership

| HTTP status | Meaning |
|---|---|
| 401 | Missing or invalid/expired authentication |
| 404 | Missing experiment **or another user's experiment**, with the same `Experiment not found` detail; also used when the caller has no profile and therefore cannot own any experiment |
| 422 | Invalid experiment UUID |
| 503 | Profile, experiment or check-in repository unavailable |

Ownership is resolved before check-ins are read, using [`owned_experiment`](../backend/app/api/deps.py). This route maps its missing-profile case to 404 without changing the existing endpoints. Responses are point-in-time reads; there is no server push or polling added here. The web reloads progress on page load/navigation and retry. Mobile should refresh on foreground and after check-in writes.

## Web integration and verification

[`getExperimentProgress`](../frontend/lib/data/experiments.ts) supplies [Your lab](../frontend/components/home-experience.tsx), [experiment detail](../frontend/components/experiments/experiment-detail.tsx), and their shared [timeline / today card](../frontend/components/experiments/experiment-progress.tsx). They use returned states and counts; calendar reminders use `next_day_at`. Loading keeps the page skeleton visible, errors offer retry, and 401 redirects to sign-in without presenting guessed progress. Completed detail no longer fetches a report merely to find missed days. Check-in submission still relies on the existing backend-derived experiment summary; it never calculates elapsed days in the browser.

- [Backend tests](../backend/tests/test_progress_endpoint.py): fixed clocks, auth/ownership, configured lengths, phase changes, first/last day, ended/completed states, early completion, repository failures, and Asia/Dhaka / America/Toronto across the Nov 1 DST change.
- [MSW/component tests](../frontend/tests/experiments/progress-endpoint.test.tsx): endpoint-owned states even when the experiment summary is stale; pending/error/retry/expired-session behavior. [Calendar test](../frontend/tests/experiments/today-card.test.tsx) deliberately supplies a boundary that differs from the cached experiment to catch client-side recomputation.
- [Backend-generated fixtures](../frontend/tests/support/generate_early_finish_reports.py) are checked against OpenAPI and reused by [timezone browser cases](../frontend/tests/e2e/early-finish-days.spec.ts). Regenerate from root without env files or external services:

  ```bash
  backend/.venv/bin/python frontend/tests/support/generate_early_finish_reports.py > /tmp/early-finish-reports.json
  cp /tmp/early-finish-reports.json frontend/tests/support/early-finish-reports.json
  ```

- [Lifecycle browser cases](../frontend/tests/e2e/progress-endpoint.spec.ts): 390px, 768px and 1440px. Manual Chromium inspection also covered home, loading, retry, recorded-day selection, not-started, active, ended and early-completed detail at these widths; [screenshots](screenshots/progress-endpoint/) use fake services, never shared accounts.

Live shared-database behavior was not exercised in this change; no health data or accounts were written, and there were zero paid AI requests. Existing report chart semantics and APIs are unchanged. The mobile app itself belongs in the next PR after this contract is merged.

Final verification on 31 Oct 2026 after fetching and merging `origin/main` at `65bc328` (already up to date): lint, typecheck, production build and contract/brand freshness passed; 243 backend, 157 frontend, 11 brand and 6 contract tests passed. Both full Playwright runs finished with 76 passed and the same one existing keyboard-onboarding skip. All relative documentation links and the example response model were checked. Every feature commit includes the automatic session log, and no env file is included.
