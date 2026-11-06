# Monitoring

Runbook, 6 Nov 2026. Owner: Nazmul. **Shared migration and failure drill verified on 6 Nov; Sentry confirmed by Nazmul. Merged in #118.** Source code is not evidence of live delivery.

| Signal | Where to look | Data |
|---|---|---|
| Backend, web and mobile JS errors | The three Sentry projects | Fixed diagnostic title, environment, release SHA, backend request ID; no answers, tokens, URLs, arbitrary exception text, stacks, user context or breadcrumbs |
| Requests/provider failures | Backend stdout, JSON lines | `request_id`, route template, status, latency_ms, method, process-local profile hash; provider error code and retry attempt |
| AI usage | `ai_calls`, service role only | Kind, model, status (`ok`, `retry`, `invalid`, `error`, `timeout`), latency, profile FK; no prompts/responses |
| Product actions | `app_events`, service role only | Profile FK, fixed event name, optional experiment FK, timestamp; no free text/properties |
| Seven-day metrics | `npm run metrics:summary` at repo root | Python computes event counts, UTC daily active profiles and check-in completion; read-only, no individual IDs printed |
| Health | `GET /api/health` | Cheap `profiles?select=id&limit=1` query, `db: up/down`, AI config presence boolean; HTTP 503 when DB is down |

**Trace:** copy the failed response's `X-Request-ID`, match its JSON request/provider logs, then search Sentry for `request_id:<value>` with the matching environment and release. Client-supplied IDs are ignored; CORS exposes the header. Profile hashes use a random process HMAC key and cannot be joined across restarts. Expected 422/429 responses stay in info/warn logs and do not report. Unexpected 500 responses have a fixed friendly message. Reporting failures never block an action.

**Counting:** events are written after successful backend actions, excluding samples. A first recorded day is `checkin_saved`, replacements are `checkin_updated`. `baseline_completed` means all baseline days are recorded. `report_written` means the AI narrative was saved; deterministic analysis is part of `experiment_completed`. `soft_check_shown` means the backend returned it, not proof it rendered. Event inserts and previous-day lookups are best effort, warning on failure. Concurrent saves can misclassify telemetry; these are approximate operational counters, not an audit ledger.

**Metrics:** event counts use the trailing seven days; DAU shows seven UTC calendar dates including today. Completion is distinct recorded experiment/day pairs ÷ scheduled days opened during the trailing window, including today's open day, capped at duration and early completion. Updates cannot inflate it; no eligible days gives `null`. Queries page at 500 rows and select scalar columns only, never answers. Reads across tables are not a transactional snapshot. Deletes cascade out of analytics history.

**Configuration and coverage:** DSNs are optional; blank means no reporting. Backend uses `APP_ENVIRONMENT` and `SENTRY_RELEASE` (git HEAD fallback); web/mobile embed the SHA at build/config time. In packaged deployments set the deployed SHA explicitly. Expo-pinned `@sentry/react-native` captures JS errors in Expo Go with native capture disabled. Native crashes need a development/native build. Server reports use Next's explicit request-error hook; automatic HTTP/process-session collection is off. Browser session/tracing integrations are filtered out. No replay, profiling, source-map uploads, lossless telemetry, background-job monitoring or paid-provider happy-path verification is configured. The strict event allowlist deliberately removes exception stacks/text; diagnose with request ID, failure code and the release's source.

**Alerts:** this repo configures no Sentry notification rules, uptime scheduler, on-call routing or retention policy. Existing dashboard rules and notification delivery are unverified. Until configured, manually check Sentry and `/api/health`.

## Shared migration, 6 Nov

Applied with Supabase CLI `db push --db-url`, after a dry run listed only `20261106000000_app_events.sql`. `--skip-vault` was set; roles and seeds were not included. Nazmul approved the SQL and confirmed Shakeb was notified.

Read-only SQL verification: `public.app_events` exists; RLS enabled; zero client policies; non-owner grants are exactly `service_role: INSERT, SELECT`; **0 rows before test-account use**. Columns are `id`, `profile_id`, `event_name`, `experiment_id`, `created_at`. Migration history records version `20261106000000`, name `app_events`. The `ai_calls_status_check` includes `timeout`. No smoke-test row was inserted.

## Local verification, 6 Nov

559 backend tests and 273 web tests pass; root tests (including 707 mobile tests), lint, types, contract/brand freshness, web production build and both native bundle exports pass. All disposable migration scripts pass, including explicit client denial/service-role grant checks for `app_events`. Redacted Gitleaks scans found no leaks. The browser suite passed 82 tests before its shared Chromium cache was removed; a worktree-local browser reran the remaining 81: 80 passed, one existing keyboard-navigation skip. The disabled web drill page was also checked by hand and returned 404. Further browser checks are left to CI at Nazmul's request. No paid AI calls or shared database writes were made. The live drill below is complete. The PR browser/CI checks remain the final merge gate.

## Failure drill, 6 Nov

**run by the agent, Sentry confirmed by Nazmul**. Nazmul performed the physical Expo Go tap. All nine cases passed; the intentional Expo Go red error screen is the expected JS failure, not a new regression.

Live release: `440772474ff39e76c835f7db3dbbdaca7b77633d`; environment `development`. The agent used its own worktree backend on **8106**, web on **3106**, and Expo/Metro on **8107**. Flags were child-process environment variables only. No existing server or env file was changed. Every provider request went to an ephemeral loopback stub with a fake provider key; **0 paid AI calls**. The migration was approved and applied before the drill. All subsequent writes were normal signed-in test-account application actions. No direct seed/update SQL was used.

The sample is excluded from analytics. A clearly labelled non-sample **Monitoring drill** experiment was therefore proposed using a fixed local-stub reply, then saved and started through normal authenticated endpoints. Check-ins used synthetic values only in that test account. Test-account identifiers below are aliases; no answers or personal identifiers are included.

| Case / trigger | User-facing result | Request ID(s) | New usage rows | Sentry result, confirmed by Nazmul |
|---|---|---|---|---|
| 1. GET `/api/dev/failure-drill` | 500 — Something went wrong. Please try again. | `0e073c6951534a708c48dad170acf8f8` | No AI/event rows | **Unhandled backend error** |
| 2. Propose; local stub returns 500 | 503 — AI service unavailable, please try again | `207a717bf0024fabb07fdd28a5ba8485` | 4 AI rows: `error`; no events | **AI provider unavailable** |
| 3. Propose; local stub exceeds 250 ms | 503 — same friendly retry message | `165e20c2a2864282bad196aff613ae8c` | 2 AI rows: `timeout`; no events | **AI provider timeout** |
| 4. Propose; local stub returns invalid JSON | 502 — Could not generate a valid experiment, please try again | `24c5e1d1a4d14d539e59f9d7f76c2b8f` | 2 AI rows: `invalid`; no events | **AI output invalid** |
| 5. Bad DB URL in own process; health + protected read | 503; health `db: down`; protected read: Database unavailable | `3862e1877f804777b99bffb9c93caf6f` / `171b16be98b5485bbc3515251ceb0b23` | No AI/event rows | **Database unavailable**, both IDs |
| 6a. Invalid check-in JSON | 422 — Some answers need another look. | `7f9b880301e94c9999f25ac230d14da5` | No rows; no provider call | **No event**; confirmed absent |
| 6b. `AI_DAILY_LIMIT_PROPOSE=0` | 429 — daily limit / come back tomorrow | `36bdce79bb99455c9c50efd46fbc0006` | No rows; no provider call | **No event**; confirmed absent |
| 7. `DEV_EVENT_WRITE_FAILURE=1`; normal check-in POST | 200; check-in persisted despite analytics failure | `b297c4bd00e94aa08b1111fe2bc22d5f` | Day 1 baseline check-in exists; no event/AI row | **No event/crash**; confirmed absent |
| 8. Web dev-page throw button | Intentional JS error / Next dev issue badge | N/A — client-side error | No rows | **Rhythm web failure drill** |
| 9. Expo Go: You → Daily reminders → trigger button | Intentional Uncaught Error red screen, `failure-drill.tsx:7:19` | N/A — device JS error | No rows | **Rhythm mobile failure drill** |
| Happy path: normal web review → Update check-in | 200; **Day 1 recorded.** | `a6f8768dc97c416c93997ebdd09ad251` | 1 `checkin_updated` event; no AI row | No error expected; successful normal flow |

Transport retry evidence: provider 500 produced attempt 0 and attempt 1 for classification, then the same for the existing classification fallback (four local calls). Timeouts produced **attempt 0 only** for each of those two logical calls: **no read-timeout retry** and no second retry. Invalid provider JSON was recorded as invalid for each logical call. Model names in `ai_calls` came from configuration; they do not imply a paid provider was contacted.

### Matching logs (redacted)

Only safe diagnostic fields are shown; route parameters are templates, never raw experiment/profile IDs. Backend error events were confirmed with the same request IDs, environment and release, and without bodies, tokens or health answers.

**1:**

```json
{"event": "request", "request_id": "0e073c6951534a708c48dad170acf8f8", "method": "GET", "route": "/api/dev/failure-drill", "status": 500, "latency_ms": 6, "profile_hash": null, "level": "warning"}
```

**2:**

```json
{"event": "ai_http_error", "message": "ai_http_error task=classification model=typesafe/jev-1.14 status=500 attempt=0", "level": "error", "request_id": "207a717bf0024fabb07fdd28a5ba8485"}
{"event": "request", "request_id": "207a717bf0024fabb07fdd28a5ba8485", "method": "POST", "route": "/api/experiments/propose", "status": 503, "latency_ms": 4254, "profile_hash": "6945d1588299081743d1367e", "level": "warning"}
```

**3:**

```json
{"event": "ai_timeout", "message": "ai_timeout task=classification attempt=0", "level": "error", "request_id": "165e20c2a2864282bad196aff613ae8c"}
{"event": "request", "request_id": "165e20c2a2864282bad196aff613ae8c", "method": "POST", "route": "/api/experiments/propose", "status": 503, "latency_ms": 1609, "profile_hash": "8151d792bf51edb6b7c7e8c7", "level": "warning"}
```

**4:**

```json
{"event": "ai_invalid_output", "message": "ai_invalid_output task=classification attempt=0", "level": "error", "request_id": "24c5e1d1a4d14d539e59f9d7f76c2b8f"}
{"event": "request", "request_id": "24c5e1d1a4d14d539e59f9d7f76c2b8f", "method": "POST", "route": "/api/experiments/propose", "status": 502, "latency_ms": 3243, "profile_hash": "360c5ee8a94740c514a9d9c7", "level": "warning"}
```

**5:**

```json
{"event": "request", "request_id": "3862e1877f804777b99bffb9c93caf6f", "route": "/api/health", "status": 503, "latency_ms": 16, "profile_hash": null, "level": "warning"}
{"event": "request", "request_id": "171b16be98b5485bbc3515251ceb0b23", "method": "GET", "route": "/api/profile", "status": 503, "latency_ms": 111, "profile_hash": null, "level": "warning"}
```

**6a:**

```json
{"event": "request", "request_id": "7f9b880301e94c9999f25ac230d14da5", "method": "POST", "route": "/api/checkins/today", "status": 422, "latency_ms": 276, "profile_hash": null, "level": "info"}
```

**6b:**

```json
{"event": "request", "request_id": "36bdce79bb99455c9c50efd46fbc0006", "method": "POST", "route": "/api/experiments/propose", "status": 429, "latency_ms": 860, "profile_hash": "2a94c19172ddd2457d8dc9b8", "level": "info"}
```

**7:**

```json
{"event": "app_event_not_recorded", "message": "app_event_not_recorded event_name=checkin_saved", "level": "warning", "request_id": "b297c4bd00e94aa08b1111fe2bc22d5f"}
{"event": "request", "request_id": "b297c4bd00e94aa08b1111fe2bc22d5f", "method": "POST", "route": "/api/experiments/{experiment_id}/checkins", "status": 200, "latency_ms": 707, "profile_hash": "6b0b4d2c40c4cb0f7f5a2eb2", "level": "info"}
```

**Happy:**

```json
{"event": "request", "request_id": "a6f8768dc97c416c93997ebdd09ad251", "method": "POST", "route": "/api/experiments/{experiment_id}/checkins", "status": 200, "latency_ms": 861, "profile_hash": "12b77eb2bc5c3099581c545a", "level": "info"}
```

**8 — browser console:** `Error: Rhythm web failure drill`, 6 Nov 10:49:23 UTC, in the dev page's click handler. No backend request was involved.

**9 — Expo Go / Metro console:** `ERROR [Error: Rhythm mobile failure drill]`. Nazmul also observed `Uncaught Error` at `apps/mobile/src/monitoring/failure-drill.tsx:7:19` and confirmed the matching React Native Sentry issue with the correct release/environment and no sensitive data. Native crash capture remains untested and requires a development build.

### Event rows and metrics after the happy path

Read-only verification found the following test-account `app_events` rows:

| Alias | Profile | Event | Experiment | created_at (UTC) |
|---|---|---|---|---|
| E1 | test-profile | `experiment_started` | monitoring-test | 2026-11-06T10:47:05.026152+00:00 |
| E2 | test-profile | `checkin_updated` | monitoring-test | 2026-11-06T10:52:53.366681+00:00 |

The first check-in in case 7 persisted, while its `checkin_saved` event was deliberately lost. Re-saving through the normal UI therefore correctly produced **checkin_updated**, not a second saved-day count. The monitoring test has one recorded baseline day; the sample's invented days are excluded. Existing pre-drill AI attempts were left intact; per-case row deltas above do not count those earlier attempts.

Actual `npm run metrics:summary` output (global non-sample completion, not just this test account):

```json
{
  "window_start": "2026-10-30T10:54:01.161937+00:00",
  "window_end": "2026-11-06T10:54:01.161937+00:00",
  "counts": {
    "experiment_started": 1,
    "checkin_saved": 0,
    "checkin_updated": 1,
    "baseline_completed": 0,
    "experiment_completed": 0,
    "report_written": 0,
    "outcome_chosen": 0,
    "soft_check_shown": 0,
    "safety_blocked": 0
  },
  "daily_active_users": {
    "2026-10-31": 0,
    "2026-11-01": 0,
    "2026-11-02": 0,
    "2026-11-03": 0,
    "2026-11-04": 0,
    "2026-11-05": 0,
    "2026-11-06": 1
  },
  "checkin_completion": {
    "days_recorded": 12,
    "days_elapsed": 21,
    "rate": 0.5714285714285714
  }
}
```

This is 1 active profile today, 1 experiment start, 1 check-in update, and a **12/21 = 57.1%** global completion rate. Other event counts are zero. These seven-day aggregates contain no individual answers or identifiers.

To repeat safely, use `backend/.venv/bin/python backend/scripts/monitoring_drill.py <backend|web|mobile> --env-file <existing-file> --port <isolated-port> --case <case>`. The backend cases are `crash`, `ai-down`, `ai-timeout`, `ai-invalid`, `db-down`, `cap`, `event-fail`, `happy`; `plan` returns the fixed synthetic design. Web uses port 3106 and `/dev/failure-drill`; mobile uses port 8107 plus `--api-url http://<Mac-Wi-Fi-address>:8106`. The phone control is under **You → Daily reminders**. Backend/web require development and `DEV_FAILURE_DRILL=1` (otherwise 404); the mobile button requires development and `EXPO_PUBLIC_DEV_TOOLS=1`. No direct SQL writes or paid provider calls are part of a repeat.
