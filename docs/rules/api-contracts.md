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

- **Shared types:** `frontend/lib/types/api.ts` mirrors the Pydantic schemas in `backend/app/schemas/`. When a backend schema changes, update this file in the same PR or the next one.
- **Data layer:** screens call `frontend/lib/data/*`, never `lib/api/client.ts` or `lib/mock/` directly. A 404 that means "none yet" (profile, report) comes back as `null`.
- **Sample data:** lives in `frontend/lib/mock/`, and only the home page uses it, labelled as sample.

## The contract test

- `frontend/tests/contracts/openapi.json` is a snapshot of the backend's OpenAPI schema.
- `api-contract.test.ts` checks the frontend's test fixtures against it.

To refresh the snapshot after a backend schema change, run from `backend/`:

```bash
uv run python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > ../frontend/tests/contracts/openapi.json
```

Then run `npm test` in `frontend/`.

## Changing the contract

- **Backend changes** (new fields, endpoints, error shapes) ship with the feature that needs them, by whoever builds it. If that's the other person's area, tell them in the team chat when the PR opens (see the [pair rule](pair-rule.md)), and refresh the contract snapshot in the same PR.
- **Shapes both sides depend on:** agree the JSON shape before either side builds. The AI report fields in TRD §25 are the current example.
