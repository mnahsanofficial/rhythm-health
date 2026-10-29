# Environment setup

Two env files, one per app, copied from the committed examples:

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example  backend/.env.local
```

Both point at the **same** Supabase project. `.gitignore` ignores every `.env*` file except `.env.example`, so `.env.local` is never committed.

**Never print, echo, `cat` or paste a value**, and never ask an agent to. To check a variable, check it by name and say "set" or "not set". See [`docs/rules/secrets.md`](rules/secrets.md).

Get the real values from your teammate, privately. Never in a prompt, an issue, a PR or anywhere else these logs or the repo can see.

## frontend/.env.local

Read in `frontend/lib/api/client.ts` and `frontend/lib/auth/supabase.ts`. Next.js puts every `NEXT_PUBLIC_` variable in the browser bundle, so **nothing secret ever gets that prefix**.

| Variable | What it's for | Where to get it | Secret? |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the FastAPI backend | `http://localhost:8001` locally, already filled in `.env.example`. Unset, it falls back to the same | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, for sign-in in the browser | Supabase → Project Settings → API | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key, for sign-in in the browser | Supabase → Project Settings → API → anon / public key | No (public by design; RLS protects the data) |

Fill in both Supabase values before signing in. If either is missing or blank, the app still loads and the sign-in page names the variable that needs to be set. Authentication remains unavailable until both values are configured.

## backend/.env.local

Every variable is a field of `Settings` in `backend/app/config.py`, read from `backend/.env.local`. A blank model variable falls back to its default.

| Variable | What it's for | Where to get it | Secret? |
|---|---|---|---|
| `APP_ENV` | Environment name | Leave blank locally (defaults to `development`). Nothing reads it yet | No |
| `CORS_ORIGINS` | Comma-separated origins allowed to call the API | Leave blank locally (defaults to `http://localhost:3000`). Set to the real frontend origin when deployed; no wildcard (TRD §40) | No |
| `SUPABASE_URL` | Supabase project URL, for the database and for checking sign-in tokens | Supabase → Project Settings → API | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access from the backend. **Bypasses RLS** | Supabase → Project Settings → API → service_role key | **Yes. Backend only, never in the frontend** |
| `SUPABASE_JWT_ISSUER` | Expected `iss` of sign-in tokens | Optional. Defaults to `$SUPABASE_URL/auth/v1` | No |
| `OPENROUTER_API_KEY` | Calls to the reasoning model and Jev through OpenRouter | OpenRouter → Keys | **Yes. Backend only. Each call costs money** |
| `OPENROUTER_REASONING_MODEL` | Model for experiment design and prediction | Optional. Defaults to `anthropic/claude-sonnet-5.5` | No |
| `OPENROUTER_JEV_MODEL` | Jev classifier model (category, intent, risk) | Optional. Defaults to `typesafe/jev-router` | No |

Without the Supabase values, protected routes answer 503 ("Auth is not configured"). Without the OpenRouter key, `/api/experiments/propose` answers 503 ("AI service unavailable").

To check the backend's values work, without printing them:

```bash
curl http://localhost:8001/health/supabase   # {"status":"ok"} when SUPABASE_URL and the service-role key work
```

## Test-only variables

| Variable / file | What it's for | Secret? |
|---|---|---|
| `frontend/.env.test` | Fake Supabase and API values for `npm test` and `npm run test:e2e`. Committed on purpose; never put real values in it | No |
| `NEXT_DIST_DIR` | Build output folder (`frontend/next.config.ts`). Playwright sets it to `.next-playwright`, so its dev server doesn't clash with yours | No |

## Where the code differs from TRD §38

- The TRD lists `JEV_API_KEY` and `JEV_API_URL`. The code calls Jev through OpenRouter instead, using `OPENROUTER_API_KEY` and `OPENROUTER_JEV_MODEL`.
- The TRD lists `OPENROUTER_FAST_MODEL`. Nothing uses a fast model yet.
