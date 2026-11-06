# Monitoring

Runbook, 6 Nov 2026. Owner: Nazmul. **Shared migration and live drill are pending approval.** Source code is not evidence of live delivery.

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

## Local verification, 6 Nov

557 backend tests and 272 web tests pass; root tests (including 707 mobile tests), lint, types, contract/brand freshness, web production build and both native bundle exports pass. All disposable migration scripts pass, including explicit client denial/service-role grant checks for `app_events`. Redacted Gitleaks scans found no leaks. The browser suite passed 82 tests before its shared Chromium cache was removed; a worktree-local browser reran the remaining 81: 80 passed, one existing keyboard-navigation skip. The disabled web drill page was also checked by hand and returned 404. Further browser checks are left to CI at Nazmul's request. No paid AI calls or shared database writes were made. CI and the live drill below are still pending.

## Failure drill, 6 Nov

**Pending: not run and not Sentry-confirmed.** Final attribution, only after evidence: “run by the agent, Sentry confirmed by Nazmul”.

After explicit migration approval/application and sign-up/sign-in by Nazmul to a clearly named test account, launch only our own backend:

```sh
backend/.venv/bin/python backend/scripts/monitoring_drill.py backend \
  --env-file <existing-backend-env-file> --port 8106 --case <case>
```

The launcher reads env values into its child process, never edits files or stops other servers, replaces the OpenRouter key with a fake value, and routes every provider call to an ephemeral loopback stub. Cases: `ai-down` (500), `ai-timeout` (250 ms timeout), `ai-invalid` (invalid JSON), `db-down`, `cap`, `event-fail`, `happy`. Provider 500 gets at most one transport retry per logical call; read timeout gets none. Jev's existing fallback is an additional logical call, distinguishable by task logs. No paid AI call is needed or permitted.

Use `web --env-file <existing-web-env-file> --port 3106` and visit `/dev/failure-drill`. Mobile: `mobile --env-file <existing-mobile-env-file> --port 8107 --api-url http://<Mac-Wi-Fi-address>:8106`, then open this worktree's Expo Go bundle. Tap Settings → **Trigger monitoring test error** only when instructed. The backend/web gate requires development and `DEV_FAILURE_DRILL=1`; off returns 404. The mobile button requires development and `EXPO_PUBLIC_DEV_TOOLS=1`. Close only our drill processes afterwards.

| Failure / trigger | User result | Matching redacted log / request_id | ai_calls / app_events | Sentry title / confirmation |
|---|---|---|---|---|
| 1. GET `/api/dev/failure-drill` | Pending | Pending | No writes expected | Unhandled backend error — pending |
| 2. Normal propose, `ai-down` | Pending | `ai_http_error` expected; pending ID | `error` expected | AI provider unavailable — pending |
| 3. Normal propose, `ai-timeout` | Pending | `ai_timeout` expected; pending ID | `timeout` expected | AI provider timeout — pending |
| 4. Normal propose, `ai-invalid` | Pending | `ai_invalid_output` expected; pending ID | `invalid` expected | AI output invalid — pending |
| 5. `db-down`, health + protected read | Pending | Pending | No writes expected | Database unavailable — pending |
| 6. Bad check-in; `cap` propose | 422/429 expected; pending | Info/warn request logs; pending IDs | No provider/event rows expected | No issue expected; pending |
| 7. Normal check-in, `event-fail` | Successful save expected; pending | `app_event_not_recorded`; pending ID | Check-in saved; event absent expected | No crash expected; pending |
| 8. Web dev page → button | Pending | Client event, no backend ID | No writes expected | Rhythm web failure drill — pending |
| 9. Mobile Settings → button | Awaiting phone tap | Client event, no backend ID | No writes expected | Rhythm mobile failure drill — pending |
| Happy path: one normal check-in | Pending | Pending | saved/updated; possibly baseline_completed | No issue expected |

Actual log lines, request IDs, scalar usage rows with identity aliases, metrics output and Nazmul's dashboard confirmations will replace the pending entries. Fake-DB/in-memory-Sentry tests do not count as the live drill.
