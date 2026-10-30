# API contracts: frontend and backend

The frontend (Next.js) talks to the backend (FastAPI) over JSON. Supabase Auth handles sign-in in the browser. The frontend never talks to the database, OpenRouter or Jev directly (TRD §2.3).

## Who owns what

- **The backend owns semantics:**
  - lifecycle and ownership;
  - day and phase;
  - validation;
  - analysis and signal classification;
  - prediction accuracy.
- **The frontend owns presentation.** It never recalculates a result the backend already returns (TRD §43–44).
- **Backend validation is the real check** (TRD §34). Frontend validation is only there to help the user.

## Requests

- **Base URL:** `NEXT_PUBLIC_API_URL`, all paths under `/api`. The client trims a trailing slash.
- **Auth:** protected routes send `Authorization: Bearer <supabase access token>`.
- **Never send a `user_id` or `profile_id`.** The backend takes the user from the verified token (TRD §2.6). Request schemas use `extra="forbid"`, so unknown fields are rejected.
- **Check-in bodies carry no day or phase.** The backend works them out from `started_at`.

## Errors

The backend sends `detail` in four shapes, and `frontend/lib/api/client.ts` handles all of them:

| Shape | Example |
|---|---|
| A string | `"Experiment not found"` |
| FastAPI validation | `[{ "msg": "…", "loc": [...] }]` |
| Check-in field errors | `[{ "field": "morning_energy", "message": "Must be between 1 and 10" }]` |
| An object with data | `{ "message": "Not enough check-ins…", "baseline_checkins": 1, … }` (409 from `/complete`) |

- Every failure becomes an `ApiError(status, message, fieldErrors, detail)`. Status `0` means the server couldn't be reached.
- Screens show the message; nothing fails silently (see [UI quality](ui-quality.md)).
- If you add a new error shape, handle it in `parseDetail` first.

## Types and data layer

- **Shared types:** `@rhythm-health/contract` derives types from FastAPI OpenAPI. `frontend/lib/types/api.ts` is a compatibility re-export; data functions and fixtures import the package directly. Regenerate after a backend schema change; do not edit generated types.
- **Data layer:** screens call `frontend/lib/data/*`, never `lib/api/client.ts` or `lib/mock/` directly. A 404 that means "none yet" (profile, report) comes back as `null`.
- **Sample data:** lives in `frontend/lib/mock/`, and only the home page uses it, labelled as sample.

## The contract test

- `packages/contract/openapi.json` is a generated snapshot of the backend's OpenAPI schema.
- `api-contract.test.ts` checks the frontend's test fixtures against it.

To refresh the snapshot after a backend schema change, run from the repository root (after `cd backend && uv sync`):

```bash
npm run contract:generate
npm run contract:check
```

Then run root `npm test`. The freshness check exports the actual local API with an isolated interpreter, blocks env-file reads and network connections, and compares both generated files without writing. No running API or credentials are needed. See [`packages/contract/README.md`](../../packages/contract/README.md) for defaults and the current OpenAPI gaps.

## Changing the contract

- **Backend changes** (new fields, endpoints, error shapes) are Shakeb's. If the frontend needs one, write a short request in your PR or an issue: what, and why. Don't edit `backend/` yourself.
- **Shapes both sides depend on:** agree the JSON shape before either side builds. The AI report fields in TRD §25 are the current example.
