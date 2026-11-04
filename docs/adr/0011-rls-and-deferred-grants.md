# 11. Row-level security now, tighter grants later

**Status:** Accepted, with a known gap. **Date:** 4 Nov 2026 ([#71](https://github.com/mnahsanofficial/rhythm-health/pull/71), [#80](https://github.com/mnahsanofficial/rhythm-health/pull/80)). **Decided by:** Nazmul.

## Context

The public anon key ships in every client, so anyone can call PostgREST directly with it. The database has to hold on its own, whatever the backend does.

While applying migrations on 4 Nov, read-only checks of the shared project showed that Supabase's default privileges give `anon` and `authenticated` every privilege on new tables, even though our migrations grant only what's needed. `ai_calls` was fixed straight away. `experiments` was found to have them too, including `DELETE` and `TRUNCATE`.

## Decision

- **Row-level security is the control we rely on.** It's on for all five tables. People can read only their own rows and write only their own profile; other writes go through the backend's service role. `ai_calls` has no policy, so nothing but the service role reaches it.
- **`ai_calls` has its grants revoked** ([migration](../../supabase/migrations/20261104100100_ai_calls_service_role_only.sql)).
- **Tightening the other tables is deferred until after the demo.** Only `experiments` was checked; the other tables probably match, since the cause is the same.

## Alternatives

- **Revoke on every table now.** The right end state. But a wrong revoke the day before a demo could break live sign-ins, and row-level security already refuses these writes.
- **Change Supabase's default privileges.** Fixes future tables too, but it's the same risk, on a setting that's less visible in the repo.
- **Leave it, without recording it.** Rejected: a known gap should be written down.

## Consequences

- **The remaining risk is `TRUNCATE`,** which row-level security doesn't cover. We haven't tested whether it can be reached through the API; PostgREST has no truncate operation, so we expect not, but that's untested. Removing that doubt is the point of the follow-up.
- Reads and writes through the anon key are blocked by policies, and disposable tests model this. Only [`check_ai_calls.py`](../../backend/tests/migrations/check_ai_calls.py) models the default privileges so far.
- **After the demo:** one migration revoking from `anon` and `authenticated` everything the app doesn't use, then a check in CI ([REMAINING_WORK](../REMAINING_WORK.md#after-the-demo)). It's a shared-database change, so announce it first.
