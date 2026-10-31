# Your own guess (S6)

The person commits a signed percentage-change guess for the primary metric **before** the AI forecast is mounted on web. Zero means no change, negative means lower, positive means higher. The bounds are −100 to +200, matching the forecast's existing scale. Decimal input (including a decimal comma) works. Revealing the AI freezes that guess for this proposal; starting saves it. Asking something else discards it. Entry remains web-only; the mobile daily loop is unchanged.

Sources: [guess form](../frontend/components/experiments/personal-guess.tsx), [shared proposal/start flow](../frontend/components/experiments/experiment-flow.tsx), [request schema](../backend/app/schemas/proposal.py).

## Contract and rollout

- `POST /api/experiments/propose` adds `personal_guess_available: boolean`. The backend first probes the optional column with an owner-scoped, zero-row query, before any paid AI work. The AI still makes its existing forecast independently; the guess is not sent to the design model. The response already contains the AI forecast, but the UI does not mount it until the guess is committed.
- `POST /api/experiments` accepts optional nullable `personal_guess_percent`. Non-null values must be finite JSON numbers in [−100, +200]; booleans and strings are rejected. It is stored only during creation; there is no guess-edit endpoint. Responses add `personal_guess_percent`, default null for old rows.
- Before the migration or while PostgREST's schema cache lags, the proposal flag is false. Web explains “Your own guess is unavailable right now. You can still start without one.” Saving without a guess **omits the column**, so the existing database keeps working. Older servers without the flag also keep their existing flow.
- If the column disappears after a successful probe, a submitted guess gets **409** with `detail: {code: "personal_guess_unavailable", message: "…"}`. Nothing is silently dropped or saved. The entered guess remains visible, with retry and an explicit “Continue without saving my guess” option. Once a save succeeds, failed starts reuse the saved ID rather than inserting duplicates.
- Only PostgREST missing-column codes `PGRST204`/`42703` naming this experiment column trigger compatibility behavior. Other database errors remain 503; readiness failures stop before AI work.

Sources: [API](../backend/app/api/experiments.py), [repository probe](../backend/app/repositories/experiments.py), [error mapping](../backend/app/integrations/supabase.py), [generated shared contract](../packages/contract/openapi.json), [rollout tests](../backend/tests/test_personal_guess_rollout.py).

## Deterministic report comparison

`Analysis.personal_guess` is null for old experiments, otherwise:

```json
{
  "guessed_change_percent": -12.5,
  "observed_change_percent": 20.5,
  "error_points": 33
}
```

`error_points` is observed minus guess, computed in the backend alongside the existing primary-metric analysis. The report displays its absolute distance. With a zero/missing baseline or missing test average, observed percentage and error are null; the report explains why a comparison is unavailable. No invented zero or recalculation in the browser. Old stored analysis JSON still parses with the new field's null default.

The Lab Report compares **Your guess / We predicted / You saw**. The existing reveal/replay action brings in the actual observation; the guess uses a diamond, and the actual uses a circle, so colour is not the only distinction. Reduced motion shows the same information immediately. Comparison numbers come from the deterministic analysis, never narrative text. Display retains up to two decimals for the guess; observed/AI figures retain the report's existing whole-percent presentation. No extra paid call is introduced.

Sources: [analysis schema](../backend/app/schemas/analysis.py), [analysis service](../backend/app/services/analysis.py), [completion test](../backend/tests/test_completion.py), [report comparison](../frontend/components/report/prediction-vs-reality.tsx), [report page](../frontend/components/report/lab-report.tsx).

## Migration: Nazmul runs this, not an agent

**Not before Sunday 1 Nov 2026, 10:00 Asia/Dhaka (04:00 UTC).** This is the notice time Nazmul gave Shakeb. No shared migration has been applied by Codex. The application is safe to deploy before it.

Forward: [20261031000000_personal_guess.sql](../supabase/migrations/20261031000000_personal_guess.sql). It adds one nullable double-precision column and a bounds constraint, leaves existing rows/policies/grants untouched, and requests a PostgREST schema-cache reload. Reapplying the file is safe.

From the repository root, use the **Session pooler** host and user shown in Supabase Dashboard → Connect (port 5432). `psql` asks for the database password privately. Do not use the anon/service-role API key as that password. Do not paste any connection values into chat or logs.

Exact apply command, for Nazmul's local zsh terminal after the notice time:

```bash
read "RHYTHM_DB_HOST?Session-pooler host from Dashboard Connect: "
read "RHYTHM_DB_USER?Session-pooler database user from Dashboard Connect: "
PGSSLMODE=require psql -X -W \
  --host="$RHYTHM_DB_HOST" --port=5432 \
  --username="$RHYTHM_DB_USER" --dbname=postgres \
  --set=ON_ERROR_STOP=1 \
  --file=supabase/migrations/20261031000000_personal_guess.sql
unset RHYTHM_DB_HOST RHYTHM_DB_USER
```

Run **only this file**, rather than replaying the repository's earlier migrations with `supabase db push`. If the command errors, stop and retain the error without connection secrets. Once applied, the next proposal will offer the guess step when the schema cache sees the column.

Rollback: [rollback SQL](../supabase/rollbacks/20261031000000_personal_guess.sql). The same command with `--file=supabase/rollbacks/20261031000000_personal_guess.sql` removes only the optional column (and its constraint); it **discards stored guesses**, so export them first if they need preserving. Existing experiments/check-ins/reports remain; already-stored analysis JSON retains historical comparisons. The application returns to the no-guess flow. The rollback is outside `migrations/` deliberately.

## Local verification (no shared services)

```bash
python3 backend/tests/migrations/check_personal_guess.py
```

Requires local PostgreSQL binaries in PATH or Homebrew PostgreSQL 18. The check starts a disposable cluster with **no TCP listener**, an explicit temporary Unix socket and a clean process environment (no inherited `PG*` connection settings). It bootstraps local auth roles, applies the six existing migrations, verifies null rollout/data preservation, valid/invalid/non-finite numbers, unchanged RLS/grants, owner-only reads, idempotence, rollback and reapply, then destroys the cluster. It never reads app env files or connects to an existing database.

Behavior coverage: [API tests](../backend/tests/test_experiments.py), [analysis tests](../backend/tests/test_analysis.py), [rollout tests](../backend/tests/test_personal_guess_rollout.py), [component flow](../frontend/tests/experiments/new-experiment.test.tsx), [report](../frontend/tests/report/prediction-reveal.test.tsx), [Playwright](../frontend/tests/e2e/personal-guess.spec.ts). Screenshots at 390px/1440px and reveal frames live in [personal-guess evidence](screenshots/personal-guess/). Everything in automation uses synthetic data and mocked API/auth; no shared writes or paid AI requests.

Verification on 31 Oct 2026, after refreshing main at `b2100cc`: backend **279 passed**; root suites passed **three consecutive runs** (web **175**, mobile **97**, brand **11**, contract **6** per run); full Playwright **86 passed, 1 existing keyboard-onboarding skip**. Lint, typecheck, production build, contract/brand freshness and disposable local PostgreSQL validation passed. Browser flow/screenshots used intercepted APIs at 390px and 1440px, with both motion preferences. **0 real paid AI calls; 0 shared database writes.** Shared migration and a real-account guess save remain for Nazmul after the notice time; no live migration verification is claimed.
