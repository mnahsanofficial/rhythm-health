# Shared API contract

`@rhythm-health/contract` is the web/mobile API type source. FastAPI's local OpenAPI schema is exported to `openapi.json`; pinned `openapi-typescript` generates `src/generated.ts`. `src/index.ts` exports familiar names without duplicating model fields. There is no API transport, auth client or experiment/date logic here.

From the repository root, after root `npm ci` and backend `uv sync`:

```bash
npm run contract:generate
npm run contract:check
npm test --workspace=@rhythm-health/contract
```

Generation uses `backend/.venv/bin/python -I`, an empty temporary cwd and a restricted environment. A Python audit hook rejects env-file reads and network connections. It imports the current API for `app.openapi()` only: no server, shared database or paid model call. Backend files are never changed. `check` regenerates in memory and rejects missing/stale schema or types without changing the checkout. Root `npm test` includes this gate.

Both clients can import:

```ts
import type { Experiment, CheckinInput, paths } from "@rhythm-health/contract";
```

The frontend's `lib/types/api.ts` remains a compatibility re-export. Data functions and MSW fixture types import the package directly. AJV fixture tests read `@rhythm-health/contract/openapi.json`; generated types are compile-time only, not runtime validation.

## Serialization and OpenAPI limits

- Raw `components`, `paths` and `operations` match OpenAPI, including optional fields.
- Named response aliases use `Serialized<T>`: FastAPI's current routes include model defaults in serialized responses, so these fields are present (possibly null). Request aliases retain optionality, including baseline check-in fields. This is a type declaration, not a runtime normalizer. Revisit it if Shakeb adds response exclusions.
- Runtime form choices/limits retain their existing values. Schema-backed ones are checked against OpenAPI in frontend contract tests. `MAX_NUMBER` and `MAX_DURATION_MINUTES` come from `backend/app/services/checkins.py`; OpenAPI cannot express these dynamic metric rules.
- Signal reasons are `string[]` in the backend schema; the shared type preserves that, rather than declaring a narrower union. The web uses a readable explanation-unavailable fallback for unknown or blank reason codes, preserving the backend's classification without inventing an interpretation.
- `/complete` returns a structured 409 detail without declaring its schema. `NotEnoughCheckins` is the existing supplemental type, explicitly sourced to `backend/app/api/reports.py`, rather than claimed as generated.

Request for Shakeb: publish the structured `/complete` 409 response model in OpenAPI so its supplemental type can also be generated. The per-day progress endpoint is now implemented and generated as `ExperimentTimeline` / `ExperimentDay`; see the [progress contract](../../docs/PROGRESS_API.md). Both web and mobile should consume its states and boundaries rather than calculating days.
