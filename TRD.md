# Technical Requirements Document

## 1. Purpose

This document defines the technical architecture for **Rhythm Health Lab**.

The system allows an authenticated user to:

1. create a lightweight personal profile,
2. ask a question or state a goal,
3. receive an AI-designed personal experiment,
4. receive a prediction before the experiment begins,
5. complete a baseline phase,
6. complete an intervention phase,
7. log short daily check-ins,
8. analyze the experiment using deterministic backend logic,
9. compare prediction against observed results,
10. generate an interactive Lab Report,
11. use previous experiments as context for future predictions.

The architecture should remain simple, secure, and easy to understand while preserving clear engineering boundaries.

---

# 2. Technical principles

## 2.1 Keep the system small

The product is implemented as:

- one Next.js frontend
- one FastAPI backend
- Supabase Auth
- one PostgreSQL database through Supabase
- one AI gateway through OpenRouter
- one classification integration through Jev

There are no additional infrastructure services in V1.

## 2.2 AI proposes; backend logic measures

AI is responsible for:

- experiment design
- prediction reasoning
- explanation
- personalized interpretation
- next-experiment suggestions

Python is responsible for:

- validation
- experiment state
- metric calculations
- adherence calculations
- comparison of baseline vs intervention
- effect calculations
- prediction error
- signal classification

The LLM must not independently decide whether an experiment succeeded.

## 2.3 Product APIs over implementation APIs

The frontend interacts with product-level actions such as:

- propose experiment
- start experiment
- submit check-in
- complete experiment
- retrieve report

The frontend does not directly orchestrate Jev, OpenRouter, or analysis internals.

## 2.4 Structured AI output only

All AI-generated application data must conform to validated JSON schemas.

Free-form model responses must not be parsed using ad hoc string parsing or regex.

## 2.5 One active experiment

V1 supports one active experiment per user.

This simplifies:

- state management
- daily check-ins
- analysis
- interpretation
- the user experience

## 2.6 Backend-authoritative security

The frontend never sends a trusted `user_id`.

FastAPI derives the authenticated user from the verified Supabase JWT.

---

# 3. System architecture

```text
┌──────────────────────────┐
│       Next.js Web        │
│                          │
│ UI / Charts / Forms      │
│ Supabase Auth client     │
└─────────────┬────────────┘
              │
              │ Supabase Auth
              ▼
┌──────────────────────────┐
│      Supabase Auth       │
│                          │
│ Email/password           │
│ Magic link               │
└─────────────┬────────────┘
              │ JWT
              ▼
┌──────────────────────────┐
│      FastAPI Backend     │
│                          │
│ JWT validation           │
│ Experiment orchestration │
│ Prediction orchestration │
│ Analysis engine          │
│ Safety logic             │
│ Report generation        │
└───────┬─────────┬────────┘
        │         │
        │         ├───────────────┐
        │         │               │
        ▼         ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Supabase DB │ │ OpenRouter  │ │ Jev         │
│ PostgreSQL  │ │ LLM         │ │ Classifier  │
└─────────────┘ └─────────────┘ └─────────────┘
```

---

# 4. Technology stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Supabase JS client for authentication
- charting library chosen by UI implementation team
- native `fetch` for backend communication

Deployment:

**Vercel**

## Backend

- Python
- FastAPI
- Pydantic
- Supabase Python client or direct database access
- JWT verification for Supabase Auth
- standard Python statistics/math utilities

Deployment:

**Railway**

## Database

- Supabase PostgreSQL
- no Prisma
- SQL migrations stored in the repository

## Authentication

- Supabase Auth
- email/password
- magic link

Optional later:

- Google OAuth

## AI

AI requests go through:

**OpenRouter**

Model IDs remain configurable through environment variables.

Recommended initial reasoning model:

```text
anthropic/claude-sonnet-5.5
```

Recommended lightweight model:

```text
anthropic/claude-haiku-5.5
```

The exact models must be swappable without application-code changes.

## Classification

**Jev**

Jev is used for:

- experiment category classification
- intent classification
- lightweight risk classification
- optional prior-experiment relevance classification

Jev does not calculate predictions or final experiment outcomes.

---

# 5. Repository structure

```text
/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── types/
│   │   └── utils/
│   └── public/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │
│   │   ├── api/
│   │   │   ├── profile.py
│   │   │   ├── experiments.py
│   │   │   └── demo.py
│   │
│   │   ├── auth/
│   │   │   └── supabase.py
│   │
│   │   ├── schemas/
│   │   │   ├── profile.py
│   │   │   ├── experiment.py
│   │   │   ├── prediction.py
│   │   │   ├── checkin.py
│   │   │   └── report.py
│   │
│   │   ├── services/
│   │   │   ├── experiment_designer.py
│   │   │   ├── predictor.py
│   │   │   ├── safety.py
│   │   │   ├── analysis.py
│   │   │   └── report_generator.py
│   │
│   │   ├── repositories/
│   │   │   ├── profiles.py
│   │   │   ├── experiments.py
│   │   │   ├── checkins.py
│   │   │   └── reports.py
│   │
│   │   ├── integrations/
│   │   │   ├── openrouter.py
│   │   │   ├── supabase.py
│   │   │   └── jev.py
│   │
│   │   └── demo/
│   │       ├── profile.json
│   │       ├── experiment.json
│   │       └── checkins.json
│   │
│   └── tests/
│
├── supabase/
│   └── migrations/
│
├── PRD.md
└── TRD.md
```

---

# 6. Authentication

V1 uses Supabase Auth.

Supported methods:

- email/password
- magic link

The frontend handles sign-in/sign-up through Supabase.

After authentication, Supabase provides an access token.

Every protected backend request includes:

```http
Authorization: Bearer <supabase_access_token>
```

FastAPI validates the token and extracts the authenticated user's Supabase user ID from the JWT `sub` claim.

---

# 7. Backend auth dependency

Protected FastAPI routes use a shared authentication dependency.

Conceptually:

```python
current_user = Depends(get_current_user)
```

`get_current_user`:

1. reads the `Authorization` header,
2. extracts the Bearer token,
3. verifies the Supabase JWT,
4. validates expiry and issuer,
5. extracts `sub`,
6. returns the authenticated user ID.

The backend must never trust a `user_id` sent in request JSON.

---

# 8. User ownership model

Supabase Auth owns identity.

Application data links to that identity through the profile.

```text
auth.users
    ↓
profiles.user_id
    ↓
experiments.profile_id
    ↓
daily_checkins.experiment_id
    ↓
experiment_reports.experiment_id
```

Only `profiles` needs a direct reference to `auth.users`.

This avoids duplicating `user_id` across every table.

---

# 9. Database security

RLS must be enabled for all user-owned application tables.

The database should enforce that users can only access their own records.

Required principles:

- no service-role key exposed to frontend
- frontend only receives Supabase public/anon key
- service-role key remains backend-only
- all frontend-accessible tables have RLS enabled
- backend queries are always scoped to the authenticated user

Even if FastAPI uses elevated database credentials, ownership checks remain mandatory in the backend.

---

# 10. Experiment lifecycle

An experiment has four states:

```text
draft
  ↓
proposed
  ↓
active
  ↓
completed
```

## Draft

Initial state.

May contain only the original question.

## Proposed

Contains:

- hypothesis
- intervention
- metrics
- duration
- success criteria
- prediction

## Active

User accepted the experiment.

Once active:

- prediction becomes immutable
- experiment definition becomes immutable
- baseline phase begins

## Completed

Experiment has finished.

A completed experiment may have an associated generated report.

No separate `analyzed` state is required.

---

# 11. Experiment phases

Normal experiments contain:

```text
baseline
intervention
```

Default:

```text
baseline_days = 3
intervention_days = 7
```

Both are configurable.

Development/demo experiments may use shorter durations such as:

```text
baseline_days = 1
intervention_days = 2
```

Every check-in explicitly stores its phase.

---

# 12. Database model

V1 uses four primary application tables.

---

## 12.1 profiles

```text
profiles
--------
id UUID PRIMARY KEY
user_id UUID UNIQUE REFERENCES auth.users(id)

age_range TEXT
usual_sleep_hours NUMERIC
usual_sleep_schedule JSONB
activity_level TEXT
goals JSONB
regular_habits JSONB
constraints JSONB

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Example:

```json
{
  "age_range": "25-34",
  "usual_sleep_hours": 8,
  "usual_sleep_schedule": {
    "bedtime": "23:30",
    "wake_time": "07:30"
  },
  "activity_level": "lightly_active",
  "goals": [
    "better morning energy",
    "better focus"
  ],
  "regular_habits": [
    "coffee around 9 AM",
    "late dinner"
  ],
  "constraints": [
    "cannot exercise before work"
  ]
}
```

---

## 12.2 experiments

```text
experiments
-----------
id UUID PRIMARY KEY
profile_id UUID REFERENCES profiles(id)

status TEXT
question TEXT
category TEXT

hypothesis TEXT
intervention JSONB

baseline_days INTEGER
intervention_days INTEGER

metrics JSONB
success_criteria JSONB
prediction JSONB

started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ

is_seeded BOOLEAN DEFAULT FALSE

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

## 12.3 daily_checkins

```text
daily_checkins
--------------
id UUID PRIMARY KEY
experiment_id UUID REFERENCES experiments(id)

phase TEXT
day_number INTEGER

intervention_completed BOOLEAN

metric_values JSONB
note TEXT

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Unique constraint:

```text
UNIQUE(experiment_id, day_number)
```

---

## 12.4 experiment_reports

```text
experiment_reports
------------------
id UUID PRIMARY KEY
experiment_id UUID UNIQUE REFERENCES experiments(id)

analysis JSONB
interpretation JSONB
learnings JSONB
next_experiment JSONB

created_at TIMESTAMPTZ
```

---

# 13. Experiment proposal flow

User submits:

```text
Does walking after dinner improve my sleep?
```

Request:

```text
POST /api/experiments/propose
```

Backend flow:

```text
verify authenticated user
        ↓
load profile
        ↓
Jev classification
        ↓
safety evaluation
        ↓
load relevant previous experiments
        ↓
OpenRouter experiment design
        ↓
validate JSON
        ↓
OpenRouter prediction
        ↓
validate JSON
        ↓
return complete proposal
```

---

# 14. Jev classification

Input:

```json
{
  "question": "Does walking after dinner improve my sleep?"
}
```

Expected output:

```json
{
  "category": "sleep",
  "intent": "behavior_change",
  "risk": "low"
}
```

Possible categories:

```text
sleep
energy
focus
exercise
nutrition
stress
routine
other
```

Possible risk levels:

```text
low
review
blocked
```

`blocked` stops experiment generation.

---

# 15. Safety pipeline

Safety runs before experiment generation.

Examples of blocked or review-worthy requests:

- extreme sleep restriction
- medication changes
- dangerous fasting
- intentionally harmful exercise
- unsafe substance use

Flow:

```text
Jev classification
      ↓
backend rules
      ↓
optional LLM safety assessment
      ↓
decision
```

Example response:

```json
{
  "allowed": false,
  "reason": "This experiment would involve unsafe sleep restriction.",
  "suggested_alternative": "Test whether moving your bedtime 30 minutes earlier affects morning energy."
}
```

---

# 16. AI experiment designer

Input context:

```text
user question
profile
Jev classification
relevant previous experiment summaries
product constraints
```

Output must validate against an `ExperimentProposal` Pydantic schema.

Example:

```json
{
  "question": "Does walking after dinner improve my morning energy?",
  "hypothesis": "Light evening activity may improve sleep quality and next-morning energy.",
  "intervention": {
    "action": "Walk for 20 minutes",
    "timing": "Within one hour after dinner",
    "frequency": "daily"
  },
  "baseline_days": 3,
  "intervention_days": 7,
  "metrics": [
    {
      "key": "morning_energy",
      "label": "Morning energy",
      "type": "scale",
      "min": 1,
      "max": 10,
      "primary": true
    }
  ],
  "success_criteria": {
    "primary_metric": "morning_energy",
    "minimum_change_percent": 10
  }
}
```

---

# 17. Predictive engine

Prediction inputs:

- profile
- experiment proposal
- available baseline information
- relevant prior completed experiments
- general behavioral reasoning

Example output:

```json
{
  "target_metric": "morning_energy",
  "direction": "increase",
  "expected_change_min": 8,
  "expected_change_max": 15,
  "confidence": "moderate",
  "reasoning": "The intervention adds light evening activity without reducing sleep opportunity.",
  "uncertainty_factors": [
    "bedtime consistency",
    "caffeine timing",
    "experiment adherence"
  ]
}
```

Valid confidence values:

```text
low
moderate
high
```

Predictions should use ranges instead of false precision.

---

# 18. Prediction immutability

Before experiment start:

```text
prediction may be regenerated
```

After:

```text
POST /api/experiments/{id}/start
```

the following become immutable:

- hypothesis
- intervention
- metrics
- success criteria
- prediction
- phase durations

---

# 19. Personal learning context

V1 uses structured retrieval only.

No embeddings.

Relevant prior experiments may be selected using:

- experiment category
- primary metric
- intervention type
- goal

Example:

```text
WHERE category = current_category
AND status = completed
ORDER BY completed_at DESC
LIMIT 5
```

These summaries are passed to the predictive model.

---

# 20. Daily check-ins

The backend determines expected phase and experiment day.

Example:

```text
Days 1–3  → baseline
Days 4–10 → intervention
```

The frontend renders fields from the experiment metric definition.

Supported V1 metric types:

```text
scale
number
boolean
duration
```

Example:

```json
{
  "key": "morning_energy",
  "label": "Morning energy",
  "type": "scale",
  "min": 1,
  "max": 10
}
```

---

# 21. Analysis engine

Analysis is deterministic Python.

Inputs:

```text
experiment
prediction
daily check-ins
```

The engine calculates:

- adherence
- baseline mean
- intervention mean
- absolute change
- percentage change
- variability
- direction consistency
- simple effect size where appropriate
- prediction error

The system must not describe these calculations as clinical significance.

---

# 22. Signal classification

Possible classifications:

```text
likely_signal
possible_signal
unclear
probably_noise
```

Classification logic lives in one backend module.

The LLM may explain the classification but cannot override it.

---

# 23. Prediction accuracy

Prediction accuracy represents how close the forecast was to the observed result.

It is not scientific confidence.

Example:

```text
predicted midpoint =
(expected_change_min + expected_change_max) / 2
```

Compare that midpoint to the observed percentage change and map the normalized error to a bounded:

```text
0–100%
```

display score.

The exact formula must live in the analysis service and have unit tests.

---

# 24. Report generation

Flow:

```text
raw check-ins
      ↓
Python analysis
      ↓
structured facts
      ↓
OpenRouter interpretation
      ↓
Pydantic validation
      ↓
experiment_reports
```

The LLM explains calculated results rather than generating the calculations itself.

---

# 25. Report schema

Example:

```json
{
  "summary": "Your morning energy improved during the intervention.",
  "interpretation": "The improvement was consistent and close to the original prediction.",
  "personal_learnings": [
    "Evening movement appears positively associated with your morning energy."
  ],
  "confounders": [
    "Two intervention days had unusually late bedtimes."
  ],
  "next_experiment": {
    "question": "Does walking immediately after dinner work better than walking later?",
    "reason": "Timing may explain some of the remaining variation."
  }
}
```

---

# 26. Chart-ready data

The report endpoint returns chart-ready datapoints.

Example:

```json
{
  "chart": [
    {
      "day": 1,
      "phase": "baseline",
      "primary_metric": 5.4,
      "intervention_completed": false
    },
    {
      "day": 4,
      "phase": "intervention",
      "primary_metric": 6.8,
      "intervention_completed": true
    }
  ]
}
```

The backend owns semantics.

The frontend owns visualization.

No separate chart API is required.

---

# 27. API surface

Base path:

```text
/api
```

All routes below require authentication unless explicitly stated otherwise.

---

## Authentication

Authentication itself is handled by Supabase Auth rather than FastAPI.

Frontend operations include:

```text
sign up
sign in
magic link
sign out
restore session
```

---

## Profile

### GET `/api/profile`

Returns the authenticated user's profile.

### PUT `/api/profile`

Creates or updates the authenticated user's profile.

No `user_id` is accepted in the request.

---

## Experiments

### POST `/api/experiments/propose`

Request:

```json
{
  "question": "Does walking after dinner improve my sleep?"
}
```

Backend derives the user from the token.

Response:

```json
{
  "proposal": {},
  "prediction": {},
  "safety": {
    "allowed": true
  }
}
```

### POST `/api/experiments`

Persist an accepted proposal.

Initial state:

```text
proposed
```

### GET `/api/experiments`

Returns only experiments belonging to the authenticated user.

Optional:

```text
?status=active
```

### GET `/api/experiments/{id}`

Returns the experiment only if it belongs to the authenticated user.

### POST `/api/experiments/{id}/start`

Starts the experiment.

Actions:

- verify ownership
- ensure no other active experiment exists
- freeze experiment definition
- set `status = active`
- set `started_at`

### POST `/api/experiments/{id}/checkins`

Submit or update the current day's check-in.

### GET `/api/experiments/{id}/checkins`

Return check-ins for an owned experiment.

### POST `/api/experiments/{id}/complete`

Actions:

```text
verify ownership
↓
validate experiment completeness
↓
run deterministic analysis
↓
generate interpretation
↓
persist report
↓
mark completed
```

### GET `/api/experiments/{id}/report`

Returns the completed Lab Report.

---

# 28. Demo endpoint

### POST `/api/demo/reset`

Requires authentication.

Creates or resets seeded demo data for the **currently authenticated user only**.

It creates:

- seeded profile values where appropriate
- completed experiment
- baseline check-ins
- intervention check-ins
- experiment report

The seeded data uses exactly the same schemas and tables as normal experiments.

---

# 29. Seeded experiment

Recommended seeded experiment:

```text
Does walking after dinner improve morning energy?
```

Configuration:

```text
3 baseline days
7 intervention days
20-minute evening walk
primary metric: morning energy
secondary metric: sleep quality
```

Prediction:

```text
expected improvement: 8–15%
confidence: moderate
```

Observed:

```text
~11% improvement
classification: likely_signal
```

---

# 30. OpenRouter integration

Use one shared backend client.

Conceptually:

```python
ai.complete(
    task="experiment_design",
    schema=ExperimentProposal,
    context=context
)
```

Model configuration lives in environment variables:

```text
OPENROUTER_API_KEY=
OPENROUTER_REASONING_MODEL=
OPENROUTER_FAST_MODEL=
```

Model IDs must not be scattered throughout the application.

---

# 31. AI task routing

## Reasoning model

Use for:

- experiment design
- prediction
- final report interpretation
- next-experiment generation
- optional safety reasoning

## Fast model

Optional uses:

- lightweight summaries
- short transformations
- labels

If no meaningful fast-model workload exists, V1 may use only the reasoning model.

---

# 32. Structured-output validation

Every AI call follows:

```text
OpenRouter response
      ↓
JSON
      ↓
Pydantic validation
      ↓
valid?
├── yes → continue
└── no → retry once
```

If the second attempt fails:

- log the failure
- return a safe application error
- persist nothing malformed

---

# 33. External-service failure handling

## OpenRouter unavailable

Return a retryable product error.

Do not persist partial experiments.

## Jev unavailable

Fallback:

```text
backend rules
↓
OpenRouter classification if needed
```

Jev should not make low-risk product flows unavailable.

## Supabase unavailable

Return normal API failure.

Frontend should preserve unsent form state where practical.

## Authentication session expired

Frontend attempts normal Supabase session refresh.

If refresh fails:

- redirect to sign-in
- preserve current destination where practical

---

# 34. Validation rules

Backend validation is authoritative.

Examples:

- scale values stay within bounds
- check-in belongs to active experiment
- experiment belongs to authenticated user
- completed experiment rejects new check-ins
- only one active experiment per user
- durations must be positive
- prediction cannot change after start
- report cannot be generated for another user's experiment

Frontend validation exists for UX only.

---

# 35. RLS requirements

Enable RLS on:

```text
profiles
experiments
daily_checkins
experiment_reports
```

Conceptually:

## Profiles

User may access:

```text
profiles.user_id = auth.uid()
```

## Experiments

Access is allowed only when:

```text
experiment.profile_id
belongs to profile where user_id = auth.uid()
```

Equivalent ownership rules apply to check-ins and reports through their parent experiment.

---

# 36. Secrets

Frontend may contain:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

Frontend must never contain:

```text
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
JEV_API_KEY
```

These remain backend-only.

---

# 37. Logging

Minimum structured fields:

```text
request_id
user_id
profile_id
experiment_id
operation
duration_ms
status
error_type
```

AI-specific:

```text
task
model
latency
validation_retry
```

Do not log full check-in notes, persona details, tokens, or other sensitive personal contents by default.

---

# 38. Environment variables

Frontend:

```text
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Backend:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_ISSUER=

OPENROUTER_API_KEY=
OPENROUTER_REASONING_MODEL=
OPENROUTER_FAST_MODEL=

JEV_API_KEY=
JEV_API_URL=

CORS_ORIGINS=
APP_ENV=
```

---

# 39. Deployment

## Frontend

Vercel.

## Backend

Railway.

Health endpoint:

```text
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

## Database/Auth

Supabase.

---

# 40. CORS

Allow only:

- local frontend development origin
- production Vercel origin

No wildcard CORS in production.

---

# 41. Testing strategy

## Unit tests

### Analysis engine

Test:

- baseline mean
- intervention mean
- percentage change
- missing data
- adherence
- effect calculations
- prediction error
- signal classification

### Experiment lifecycle

Test:

- valid state transitions
- one active experiment per user
- immutable prediction after start
- completed experiments reject check-ins

### Auth/ownership

Test:

- unauthenticated request rejected
- user cannot fetch another user's experiment
- user cannot submit check-in to another user's experiment
- user cannot fetch another user's report

### Safety

Test blocked experiment categories.

### AI schemas

Test malformed outputs are rejected.

---

# 42. Integration tests

Main backend flow:

```text
authenticated user
→ profile
→ propose experiment
→ save experiment
→ start
→ baseline check-ins
→ intervention check-ins
→ complete
→ report
```

External AI services should be mocked for deterministic integration tests.

---

# 43. Frontend responsibility boundary

Frontend owns:

- Supabase auth UI/session
- forms
- interactions
- responsive layouts
- timeline rendering
- progress states
- charts
- Lab Report presentation
- loading/error states

Frontend does not own:

- experiment analysis
- prediction calculation
- safety decisions
- signal classification
- experiment lifecycle rules
- authorization decisions

---

# 44. Backend responsibility boundary

Backend owns:

- authenticated request validation
- data ownership
- persistence
- experiment lifecycle
- AI orchestration
- classification
- safety
- prediction
- analysis
- report data
- seeded data

---

# 45. Explicit non-goals

V1 does not include:

```text
organizations
teams
roles/permissions beyond user ownership
Redis
background workers
queues
WebSockets
GraphQL
microservices
vector databases
embeddings
LangChain
LangGraph
generic agent framework
custom-trained ML models
Apple Health
Google Health Connect
multiple simultaneous experiments
medical diagnosis
clinical statistical claims
```

---

# 46. Implementation sequence

## Phase 1 — Foundation

- repo structure
- Next.js
- FastAPI
- Supabase project
- Supabase Auth
- auth screens
- backend JWT verification
- database migrations
- RLS
- profile API

## Phase 2 — Experiment creation

- Jev integration
- safety service
- OpenRouter client
- proposal schema
- prediction schema
- propose endpoint
- experiment persistence

## Phase 3 — Active experiment

- lifecycle rules
- start endpoint
- day/phase calculation
- check-in API
- experiment retrieval

## Phase 4 — Analysis

- deterministic analysis engine
- signal classification
- prediction comparison
- completion flow

## Phase 5 — Lab Report

- AI interpretation
- learnings
- next experiment
- chart-ready output
- report endpoint

## Phase 6 — Seeded demo

- seeded user experiment data
- completed example
- demo reset endpoint

## Phase 7 — Reliability

- tests
- auth/ownership tests
- invalid AI response handling
- external-service errors
- end-to-end verification

---

# 47. Core technical thesis

The architecture follows one rule:

**AI proposes. Python measures. The user learns.**

Supabase Auth establishes identity.

PostgreSQL protects and stores personal data.

OpenRouter handles reasoning.

Jev handles narrow classification.

FastAPI owns correctness, orchestration, and authorization.

Next.js owns the experience.

The system should remain simple enough to understand quickly while keeping personal experiment data isolated by user.