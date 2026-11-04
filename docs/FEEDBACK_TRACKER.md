# 8x feedback tracker

Every piece of feedback from the 8x calls: what we did, where it is, and what's left. Audited on **4 Nov 2026** against `main` at `a4aa237` (after #89), then updated for #91, #92, #93 and #95, and for the [live check](#live-check-of-the-question-flow).

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
| "You can't cover every habit; let users set their own, with AI validation" | **Done** | #4, #13, #45, #46, #93 | Yes | Simple version | Any free-text question on Ask; add-your-own habits and goals in onboarding. AI classification and safety rules first, then a [soft check](../backend/app/services/habit_check.py) when a question isn't about a habit | Plans can't be edited before starting (F10, after the demo) |
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
| C4 | A soft check when a question isn't about a habit, with "Continue anyway" | **Done** ([#93](https://github.com/mnahsanofficial/rhythm-health/pull/93)). Automated tests fake the classifier; live labels are checked by hand on an iPhone |

## Live check of the question flow

**Checked by Claude on Expo web against the live API and classifier on 4 Nov; not yet on an iPhone.** At 390 × 844, on a backend run from this repo at `main` after #95, using Nazmul's own account, which he signed in himself. No test account was created, and no experiment was started or changed. [Screenshots](screenshots/live-check-4-nov/).

| Check | Result | Classifier labels | Paid calls |
|---|---|---|---|
| "Does a walk after dinner help me sleep?" | **Pass.** Planning screen showed the ring, sun and three steps. Plan arrived in 29.7 s | `sleep`, `question`, `low` | 2 |
| "What's the capital of France?" | **Pass.** Soft check appeared in 1.8 s, with a rewording | `other`, `question`, `low` | 1 |
| Continue anyway on that question | **Works, but see below.** Plan arrived in 12.6 s, about phone use before bed, with no link to the question | `other`, `question`, `low` | 2 |
| "How can I be more productive?" | **Pass.** No soft check. A plan in 13.3 s about writing down priorities | `focus`, `question`, `low` | 2 |
| "Should I stop taking my medication to sleep better?" | **Pass.** Blocked in 2.0 s. Use this instead filled the box with "Does a consistent wake time improve my morning energy?" | `sleep`, `question`, `blocked` | 1 |
| Tap × during a planning wait | **Pass.** Leave sheet appeared. Leave returned to an empty Ask, and the late answer (12.2 s) was dropped. One request in the network log, no second call | `sleep`, `question`, `low` | 2 |
| Duplicate key, two experiments on day 1 | **Pass, mocked.** No "same key" warning on Today or the combined check-in. React's production web build doesn't show this warning, so this is a Jest test | n/a | 0 |

**Paid calls: 10 of the 10 allowed,** confirmed against `ai_calls`: 6 classification and 4 design, all `ok`.

**What this showed:**
- **The time was wrong.** The 4 full plans took 12.2 to 29.7 seconds, so the planning screen now says "Usually 10–30 seconds." Four plans is a small sample.
- **The intent label alone wouldn't have caught France.** Jev labelled it `question`, so the soft check depends on the category `other` as well.
- **Continue anyway doesn't warn that the plan has changed subject.** The AI answers an off-topic question with an unrelated habit plan. It's honest once you read the plan, but it isn't what was asked. Listed in [after the demo](REMAINING_WORK.md#after-the-demo).

**Not covered:** a real iPhone, VoiceOver, real large text, reminders, and how smooth the animation is on a device.

Everything else is listed in [REMAINING_WORK](REMAINING_WORK.md#after-the-demo).
