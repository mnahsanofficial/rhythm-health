# 8x feedback tracker

Every piece of feedback from the 8x calls: what we did, where it is, and what's left. Audited on **4 Nov 2026** against `main` at `a4aa237` (after #89), then updated for #91 and #92.

**How it was checked:** by reading the code and tests on `main` and the CI logs from the last full run. "Done" means it exists in code with tests. The app wasn't run for this audit. Items marked *per records* rely on PR records rather than a new check of the live database. iPhone results are in each PR.

**The feedback itself** was supplied by Nazmul; there are no call transcripts in the repo.

**Status:** **Done**, **Partial** (what's missing is stated) or **Missing**.

## Product

| Feedback | Status | PRs | Mobile | Web | Where to see it | What's left |
|---|---|---|---|---|---|---|
| Move to mobile | **Done** | [#35](https://github.com/mnahsanofficial/rhythm-health/pull/35)–37, #45–54, #78–88 | Yes | n/a | [`apps/mobile/`](../apps/mobile/) | |
| Sign-in and sign-up on mobile | **Done** | #35, #45 | Yes | Yes | Landing, then Sign up. [`auth-form.tsx`](../apps/mobile/src/auth-form.tsx) | |
| Lab Report on mobile | **Done** | #47, #83, #86 | Yes | Yes | Finish an experiment, or History, then Explore a completed example. [`lab-report.tsx`](../apps/mobile/src/lab-report.tsx) | Plain first sentence and new verdict wording are [mobile only](ARCHITECTURE.md#8-deliberate-web-and-mobile-differences) |
| A landing page unique to the app | **Done** | #18, #54, #64, #67, #92 | Carousel | Scrolling day story | Signed out. [`landing.tsx`](../apps/mobile/src/landing.tsx), [`day-story.tsx`](../frontend/components/landing/day-story.tsx) | |
| Retention | **Partial** | #29, #37, #38, #79, #85, #87 | Yes | Calendar file | Reminders, Day 3 "your test starts tomorrow", celebration, first-run guide, "your normal" on day 4 | Two-week follow-up isn't built. Most of this is mobile only, on purpose |
| "You can't cover every habit; let users set their own, with AI validation" | **Partial** | #4, #13, #45, #46 | Yes | Yes | Any free-text question on Ask; add-your-own habits and goals in onboarding. [`proposal.py`](../backend/app/services/proposal.py), [`safety.py`](../backend/app/services/safety.py) | Validation checks safety only. The classifier's intent label isn't used, so a question that isn't about a habit still gets a plan (C4 below). Plans can't be edited before starting (F10) |
| "What does a user learn after 10 days?" | **Partial** | #39, #75, #80, #83, #86 | Yes | Report and guess history | Lab Report's first sentence, the guess against the prediction, Day 10 choice, "Habits I kept", guess history | The Day 10 choice and "Habits I kept" are mobile only, on purpose |
| Multiple experiments | **Done** | #55, #58, #80 | Yes | Yes | Up to 3 active, overlap in the report, one combined check-in, comparison on Progress. [Decision](DECISIONS.md#several-active-experiments--4-nov-2026) | No warning when two experiments test the same thing |
| Top-notch UI, in light and dark, with motion | **Partial** | #59–64, #67, #78–88, #92 | Yes | Yes | [Review](design/06-product-review.md), [screenshots](screenshots/), [motion rules](rules/ui-motion.md) | Finding 10 and the scene treatment are [after the demo](REMAINING_WORK.md#after-the-demo). VoiceOver and real large text need an iPhone |
| No long buttons | **Done** | #60–64 | Yes | Yes | 320px maximum, in [DESIGN.md](../DESIGN.md#buttons), with design tests on both | Deliberate exception: form actions and sticky actions may fill the width on a phone (#64) |

## Infrastructure and process

| Feedback | Status | PRs | Where to see it | What's left |
|---|---|---|---|---|
| Create our own Supabase | **Done** *per records* | #56 | [Decision](DECISIONS.md#new-supabase-project--4-nov-2026) | Shakeb needs the new values |
| Run the migration | **Done** *per records* | #56, #71, #80 | All 11 files in [`supabase/migrations/`](../supabase/migrations/) are recorded as applied | |
| Logs on main, in the guide's format | **Done** | #41, #65, #68, #69, #77, #89 | [`.claude-logs/`](../.claude-logs/), `npm run logs:check` in CI, [logging](logging.md) | Shakeb's three older logs can't be regenerated here |

## Architecture review

| Gap | Status | PRs | Where to see it | What's left |
|---|---|---|---|---|
| CI | **Done** | #70, #91 | [`ci.yml`](../.github/workflows/ci.yml): lint with no warnings, types, tests, build, browser suite, secret scan over all of history, migration check and commit messages | The check models Supabase on plain Postgres |
| Monitoring | **Partial** | #72 | [`monitoring.py`](../backend/app/monitoring.py): request logs, `/api/health`, optional Sentry on backend and web | Mobile has no error reporting (after the demo) |
| AI cost cap | **Done** | #71 | [`ai_limit.py`](../backend/app/services/ai_limit.py), [ADR 7](adr/0007-ai-calls-and-daily-cap.md) | |
| Async | **Done** | #73 | [`openrouter.py`](../backend/app/integrations/openrouter.py), [ADR 8](adr/0008-async-openrouter-client.md) | Database reads still use worker threads |
| Large files | **Done** | #74 | Largest backend file is 196 lines; [`file-size.test.ts`](../frontend/tests/architecture/file-size.test.ts), [`test_code_standards.py`](../backend/tests/test_code_standards.py) | Web `lab-report.tsx` is 486 lines |
| Logic in routes | **Partial** | #74 | [`completion.py`](../backend/app/services/completion.py) | `save_experiment` still builds its data in the route |
| Typed dicts | **Done** | #74 | [`rows.py`](../backend/app/schemas/rows.py) | Types document shapes; nothing checks them at runtime |
| Template reuse | **Partial** | #76 | [Comparison](TEMPLATE_COMPARISON.md), [ADR 12](adr/0012-ci-discipline-no-prettier.md) | We didn't start from it. CI discipline is adopted (#91); shared `Card` and `Input` aren't built |

## M0 full-app plan

| Milestone | Status | PR | Note |
|---|---|---|---|
| M1: sign-up and onboarding | **Done** | #45 | |
| M2: proposal flow | **Done** | #46 | |
| M3: finish and Lab Report | **Done** | #47 | |
| M4: history and completed demo | **Done** | #48 | |
| M5: icon, splash, accessibility | **Partial** | #49 | Icon and splash are ours, in light and dark. Expo Go shows its own launch screen, so the real splash needs a standalone build. VoiceOver and real large text are unchecked |
| P1–P4: web parity | **Done** | #51–54 | |

## Open items from this audit

| # | Item | Status |
|---|---|---|
| C1 | History shows the list first, with "8 points away" wording | **Done** ([#92](https://github.com/mnahsanofficial/rhythm-health/pull/92)) |
| C2 | Progress offers Ask when nothing is running, and an outage shows our own wording | **Done** (#92) |
| C3 | Landing dots reach the 44 target | **Done** (#92) |
| C4 | A soft check when a question isn't about a habit, with "Continue anyway" | **Open, awaiting Nazmul's iPhone check** ([#93](https://github.com/mnahsanofficial/rhythm-health/pull/93)). Moves to after the demo if it isn't ready by 13:00 on 5 Nov |

Everything else is listed in [REMAINING_WORK](REMAINING_WORK.md#after-the-demo).
