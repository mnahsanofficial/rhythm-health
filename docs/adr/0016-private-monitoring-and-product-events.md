# 16. Private error reporting and in-house product events

Date: 6 Nov 2026. Status: Accepted. Shared migration applied 6 Nov after approval; the live failure drill and dashboard/phone acceptance are complete.

8x identified missing error reporting and usage analytics. #72 added request logs and optional backend/web Sentry, but DSNs were unset and mobile was uncovered.

Use Sentry only for errors across all three apps, with an allowlist in `before_send`/`beforeSend`: fixed diagnostic title, environment, release SHA and backend request ID. Drop arbitrary error text, stacks, requests, user/extra fields and breadcrumbs. Report caught provider/database failures explicitly; expected 4xx responses stay in logs. Return the generated request ID even on unexpected errors. Write JSON request logs with a process-local HMAC profile hash, never raw IDs.

Keep usage in service-role-only `app_events`, fixed event names and foreign keys, no text or arbitrary properties. Record after successful backend actions; analytics failure cannot change their outcome. Compute read-only seven-day metrics in Python. Add timeout to `ai_calls`. Apply a reviewed migration only after explicit approval, with a rollback.

Alternatives: third-party usage analytics increases disclosure risk; raw exception reporting can leak answers/tokens; client analytics duplicates retries and trusts client lifecycle/day calculations; triggers make analytics failures part of primary writes. Accept best-effort approximate counters rather than a queue/outbox for this scope.

Costs: reduced diagnostics without stacks, events lost/misclassified under failures or concurrency, extra DB reads, no configured alerts/source-map uploads. Expo Go only captures JS; native crashes need a development build. The live failure drill and dashboard/phone confirmation were completed before the PR; CI remains the merge gate. [Runbook](../MONITORING.md).
