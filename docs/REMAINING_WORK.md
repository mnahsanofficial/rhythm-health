# Remaining work

Updated **4 Nov 2026**, against `main` after #89. Final demos are on **Thu 5 Nov**, and app code freezes at **14:00 Dhaka time**. What's done, and where to see it, is in the [feedback tracker](FEEDBACK_TRACKER.md). This file is what isn't done.

The history of this list is in git. V2 is split by feature: both of us work across frontend, backend and database ([pair rule](rules/pair-rule.md)).

## Before the freeze

| # | Item | Rule |
|---|---|---|
| C4 | A soft check when a question isn't about a habit, with "Continue anyway" ([#93](https://github.com/mnahsanofficial/rhythm-health/pull/93)) | Waits for Nazmul's iPhone check. If it isn't ready by 13:00 on 5 Nov, it moves below |

**Check before the demo:** email confirmation in the Supabase dashboard, and that `EXPO_PUBLIC_DEV_TOOLS` isn't set, so "Send test reminder" stays hidden.

## After the demo

Decided by Nazmul on 4 Nov. None of these are needed for the demo.

### Product

| # | Item | Why it's open |
|---|---|---|
| F10 | Edit the AI's plan before starting | A person can only ask again |
| S10 | The two-week follow-up: are you still doing it, and does it still help? | The Day 10 choice is stored, but nothing follows it up |
| | Day 10 × opens the Lab Report rather than leaving | Small, and it's clear enough for the demo |
| | A warning when a new question tests the same thing as a running one | [Decision](DECISIONS.md#several-active-experiments--4-nov-2026) left it out |
| | Scene treatment on the Lab Report result, Day 3 and Day 10 | [Product review](design/06-product-review.md#scene-treatment) |
| | Onboarding: shrink the scene on long lists, and give each goal its own icon | Review finding 10 |
| | One word for each idea: "baseline" or "normal days", "logged" or "recorded", "sample" or "example" | Review copy pass |
| | Bring web level with mobile: first sentence in the report, verdict wording, Day 3, Day 10 choice and trust line | [Frozen on purpose](ARCHITECTURE.md#8-deliberate-web-and-mobile-differences) |
| F6 | Primary-metric trend on the web experiment page | Recorded values show per day only |
| F11 | Share or export a Lab Report | Not started |
| | Apple Health and other health data | PRD §25 |
| | Dedicated fitness and gym tracking | Call on 28 Oct |

### Engineering

| # | Item | Why it's open |
|---|---|---|
| | Mobile error reporting | Crashes on phones are invisible today |
| | Tighten database grants | [ADR 11](adr/0011-rls-and-deferred-grants.md). A shared-database change, so announce it first |
| F12 | Delete dead web files: `auth-panel.tsx`, `backend-status.tsx`, `lib/mock/profile.ts` | Unused; harmless for the demo |
| | Finish moving logic out of routes: `save_experiment` | [Tracker](FEEDBACK_TRACKER.md#architecture-review) |
| | Prettier across the repo, at a quiet moment agreed with Shakeb | [ADR 12](adr/0012-ci-discipline-no-prettier.md) |
| | Shared web `Card`, `Input` and `EmptyState`; split mobile `src/ui.tsx` | [Template comparison](TEMPLATE_COMPARISON.md) |
| | Standalone build, to check the real icon and splash | Expo Go shows its own launch screen |
| B10 | Hosting | Localhost is the C2 target ([Q11](DECISIONS.md#questions-for-shakeb)). See [10x](ARCHITECTURE.md#what-wed-change-at-10x-users) |
| B8 | One live full-flow test | Tests are all mocked by design |
| R12 | Check numbers in report prose against the analysis | [ADR 3](adr/0003-ai-proposes-python-measures.md) |
| F8 | Contract fixtures for check-ins | Generated types are drift-checked; fixtures aren't |
| | Add the Cursor live logging canary | [Logging](logging.md#canary-results). Cursor isn't cleared until it passes |
| | Update PRD and TRD to match the code | [List](DECISIONS.md#trdprd-updates-still-to-make) |

## Known risks

| # | Where | What | Effect |
|---|---|---|---|
| R2 | Stored analysis | Early-finish rules aren't backfilled onto older reports | Old reports may keep old missed days |
| R4 | `services/progress.py` | Days are 24 hours from the start time | A late-evening start shifts every day. Accepted ([ADR 4](adr/0004-rolling-24-hour-days.md)) |
| R5 | `api/checkins.py` | Only today's check-in can be saved | A missed day can't be filled in later |
| R6 | Schedule | A real experiment needs about 5 days of check-ins before it can finish | The demo uses samples for the report |
| R8 | Web browser suite | Keyboard-only onboarding test is skipped, because Chromium leaves the time fields empty | That path isn't covered automatically |
| R12 | `services/report_writer.py` | A model could misquote a figure in prose | Display only; never used as data |
| R14 | `services/ai_limit.py` | The cap fails open, and two requests can both pass | [ADR 7](adr/0007-ai-calls-and-daily-cap.md) |
| R15 | Shared Supabase | Shakeb's env files may still point at the old project | Shakeb needs the new values, sent privately |

## Where the code differs from the PRD and TRD

| Area | PRD or TRD says | The code does |
|---|---|---|
| Proposal AI calls | Design, then a separate prediction call (TRD §13, §17) | One call returns both, validated together |
| Jev config | `JEV_API_KEY`, `JEV_API_URL` (TRD §36, §38) | Jev runs through OpenRouter, set by `OPENROUTER_JEV_MODEL` |
| Fast model | `OPENROUTER_FAST_MODEL` (TRD §30, §38) | Not used |
| Experiment length | "Default for V1: 7 days" (PRD §8) | 3 baseline and 7 test days (TRD §11) |
| Days | Not defined | Rolling 24 hours from `started_at` |
| Finishing early | Not covered | Allowed with 2 baseline and 3 test check-ins; the app warns first |
| Completion and the AI report | `/complete` writes the interpretation (TRD §24) | `/complete` is deterministic; `POST /report` writes the narrative |
| Report chart data | `chart` array (TRD §26) | A `chart` object: metrics, per-day points, means and predicted band |
| Day states | Calculated by clients | One endpoint, `GET …/progress` |
| Active experiments | One (PRD §23) | Up to three |
| Platform | Responsive web (PRD) | Mobile is the product; web features are frozen |
| Notifications | Out of V1 scope (PRD §22) | Local mobile reminders; a calendar file on web |
| Sign-in methods | Email and password, and magic link (TRD §6) | Email and password only |
| Deployment | Vercel and Railway (TRD §39) | Localhost only |
| Confounders | "From user notes" (PRD §14) | Notes go to the narrative writer; the analysis doesn't use them |

## Suggested features: how we make sure it helps

Suggestions by Claude that Nazmul chose between on 31 Oct. They're kept here because they answer 8x's "what will you do to make sure this actually helps?".

| # | Feature | Status |
|---|---|---|
| S6 | **Your own guess,** locked before the AI forecast | Done (#39, mobile #46), with guess history in #75 |
| S7 | **What you now know about yourself,** gathering every finished result | Partly: History and the Progress comparison (#80) |
| S8 | **Your normal, on day 4** | Done (#38) |
| S9 | **Run it again to be sure** | Partly: "Try a variation" on Day 10 (#80) |
| S10 | **Keep it or drop it, then a two-week check** | The choice is done (#80); the follow-up is after the demo |

## Report API

Source: [`api/reports.py`](../backend/app/api/reports.py). Full shape: the generated `LabReport` type in [`packages/contract`](../packages/contract/README.md).

| Call | Response | Errors |
|---|---|---|
| `POST /api/experiments/{id}/complete` | `LabReport` with `narrative: null` | 409 not enough check-ins, already completed or not active |
| `POST /api/experiments/{id}/report` | `LabReport` with `narrative` filled | 409 not completed; 404 no report; 429 daily cap; 503 AI unavailable; 502 AI output invalid after retry |
| `GET /api/experiments/{id}/report` | `LabReport` (`narrative` null until written) | 404 no report yet |
| `POST /api/experiments/{id}/outcome` | The saved choice | See [`api/experiments.py`](../backend/app/api/experiments.py) |

A fresh `POST /report` takes about 10–11 seconds, and a repeat returns the stored narrative in under a second. `?regenerate=true` is for development and testing only.
