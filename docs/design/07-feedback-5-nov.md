# 7. Feedback from the 5 Nov demo call

Maham (8x) watched the mobile app on the demo call on 5 Nov 2026. The quotes come from Nazmul's notes of the call, and there's no transcript in the repo. The synthesis is [round 3 in 04-synthesis.md](04-synthesis.md#round-3-the-8x-demo-call-n1-outside-reviewer).

## What she said

- "The main thing with the whole application is cognitive overload."
- "There's too much text written in too many different places, and a lot of it is not readable because it's grey."
- "The today check-in screen is asking you so many questions on one screen. Maybe it asks you one question, you answer that, then the second question."
- "Day 1 of 10 baseline, and underneath it says 'Day 1 recorded'. Not important. Maybe just a check somewhere to show it's recorded."
- "'Spend 10 minutes outdoors in natural daylight': we don't need it on the screen. You can click it and see it on the next screen."
- "The screen which shows you the experiment, there was too much text there."
- "People are used to skimming. Structure the information so it's digestible for a first-time user."
- "How are you ensuring the experiments are actually going to help someone?"

## What we changed

| She said | What changed | PR |
|---|---|---|
| Too many questions on one screen | One question per screen, with auto-advance, Back and a review | [#102](https://github.com/mnahsanofficial/rhythm-health/pull/102) |
| "Day 1 recorded" isn't important | A check icon on the day | [#103](https://github.com/mnahsanofficial/rhythm-health/pull/103) |
| The small change needn't be on screen | One "Today's change ›" row that opens a sheet | [#103](https://github.com/mnahsanofficial/rhythm-health/pull/103) |
| Too much text on the experiment screen | Status, next action and timeline, with the rest behind rows; the plan is 4 short steps | [#103](https://github.com/mnahsanofficial/rhythm-health/pull/103), [#104](https://github.com/mnahsanofficial/rhythm-health/pull/104) |
| Too much text, everywhere | A word budget per screen, enforced by a test | [#102](https://github.com/mnahsanofficial/rhythm-health/pull/102) to [#105](https://github.com/mnahsanofficial/rhythm-health/pull/105) |
| Grey isn't readable | Grey is for short captions only, enforced by a test. The token didn't change, because it already passed AA | [#105](https://github.com/mnahsanofficial/rhythm-health/pull/105) |
| How do you ensure it helps? | The plan says "Your check-ins decide, not the AI", and the report opens "How we know ›". We make no promise that a change helps | [#106](https://github.com/mnahsanofficial/rhythm-health/pull/106) |

## Word counts

Counted by rendering each screen in the test suite with fixture data: words containing a letter, without the tab bar or brand name, including text below the fold. "After" is the budget in `apps/mobile/__tests__/word-budget.test.tsx`, so a screen can be under it. Real AI text will vary.

| Screen | Before | After | Plan target |
|---|---|---|---|
| Today, due | 40 | 26 | 25 |
| Today, recorded | 31 | 23 | 25 |
| Today, two running | 54 | 42 | 40 |
| Check-in, test day | 55 on one screen | 15 change, 12 per question, 20 review | Same |
| Check-in, baseline day | 36 on one screen | 12 per question, 20 review | Same |
| Combined check-in | 77 on one screen | 16 per step, 25 review | Same |
| Ask | 69 | 41 | 40 |
| Guess | 27 | 15 | 15 |
| Plan | 60 on one screen | 12 change, 16 reveal, 25 days | 12, 15, 25 |
| Experiment screen | 137 | 35 | 35 |
| Lab Report | 371 | 50 (62 after Compare) | 50 |
| Progress | 101 with a day open | 40 | 40 |
| History, one row | 62 | 30 | 30 |

**Over target:** Today by 1 and 2 ("Closes …" and "Also running" were kept), Ask by 1, and the reveal by 1 ("to" in "+8% to +15%" counts as a word).

## Before and after

Expo web, 390 wide, sample data, every call mocked.

| | Before | After, light | After, dark |
|---|---|---|---|
| Today | <img src="../screenshots/mobile-calm-today/due-light.png" width="170" alt="Today before"> | <img src="../screenshots/mobile-feedback-5-nov/today/1-due-light.png" width="170" alt="Today after, light"> | <img src="../screenshots/mobile-feedback-5-nov/today/1-due-dark.png" width="170" alt="Today after, dark"> |
| Check-in | <img src="../screenshots/mobile-checkins/light/21-checkin.png" width="170" alt="Check-in before"> | <img src="../screenshots/mobile-feedback-5-nov/checkin/2-question-light.png" width="170" alt="Check-in after, light"> | <img src="../screenshots/mobile-feedback-5-nov/checkin/2-question-dark.png" width="170" alt="Check-in after, dark"> |
| Plan | No saved screenshot of the one-screen plan | <img src="../screenshots/mobile-feedback-5-nov/plan/3-reveal-light.png" width="170" alt="Reveal, light"> | <img src="../screenshots/mobile-feedback-5-nov/plan/3-reveal-dark.png" width="170" alt="Reveal, dark"> |
| Lab Report | <img src="../screenshots/mobile-lab-report/390-2-report-revealed.png" width="170" alt="Lab Report before"> | <img src="../screenshots/mobile-feedback-5-nov/screens/4-report-light.png" width="170" alt="Lab Report after, light"> | <img src="../screenshots/mobile-feedback-5-nov/screens/4-report-dark.png" width="170" alt="Lab Report after, dark"> |

The full set is in [`docs/screenshots/mobile-feedback-5-nov/`](../screenshots/mobile-feedback-5-nov/), made with `apps/mobile/scripts/capture-feedback.cjs`.

## What this doesn't show

No outside user has tried it, so we don't know yet whether a first-time user finds it easier, or whether one question per screen stays quick by day 7. Nazmul's full iPhone pass is on the morning of 6 Nov. The web app keeps its old screens.


## Nazmul's iPhone test, the evening of 5 Nov

Nazmul tested `main` on an iPhone and found one root cause: the AI's long sentences were on screen everywhere, as headings, in lists and cut off in rows. Headings ran to six lines, and half of each screen stayed empty below them.

### What changed

The backend now writes short words ([#111](https://github.com/mnahsanofficial/rhythm-health/pull/111)), and the phone shows them ([#112](https://github.com/mnahsanofficial/rhythm-health/pull/112)). The web keeps the long text.

| Screen | Before | After |
|---|---|---|
| Progress, Example | The question repeated for every metric | The question once, then "Morning energy 5.7 → 6.3 +11%" |
| Progress, running | The full question, a 5×2 grid, a monospace sentence | "Evening walk", a row of 10 small dots, "1/10". The question is behind a tap |
| The change | A six-line heading | "Walk 5 km after dinner", with the rest under Details, and a scene |
| The guess | "What will happen?" and a cut-off question | "Your guess", a − / + stepper, a live bar from -100 to +200, and a scene |
| The reveal | "How energetic do you feel about 1 hour after waking? is likely to go up" | "Morning energy is likely to go up", with your guess as a marker on the bar |
| Your 10 days | A strip, and the rest empty | The ring of 3 normal and 7 test days, with the sun on day 1 |
| Review | Cut-off questions | "Morning energy 10/10", "Minutes to fall asleep 90 min", and a calm scene |
| Check-in questions | The full question as the heading | The short label as the heading, the question in small text under it |

### Word budgets

Tightened in `apps/mobile/__tests__/word-budget.test.tsx`: guess 15 → 12, days 25 → 22, Progress 40 → 30, check-in review 20 → 16. The reveal stays at 16, because the agreed sentence already fills it. The change stays at 12.

### Before and after

Before is the iPhone, with real AI text. After is Expo web, 390 wide, with the same sentences and every call mocked.

| | Before | After, light | After, dark |
|---|---|---|---|
| Progress | <img src="../screenshots/mobile-short-labels/before/1-progress-example.png" width="170" alt="Progress before, on an iPhone"> | <img src="../screenshots/mobile-short-labels/1-progress-light.png" width="170" alt="Progress after, light"> | <img src="../screenshots/mobile-short-labels/1-progress-dark.png" width="170" alt="Progress after, dark"> |
| The change | <img src="../screenshots/mobile-short-labels/before/2-change.png" width="170" alt="The change before, on an iPhone"> | <img src="../screenshots/mobile-short-labels/2-change-light.png" width="170" alt="The change after, light"> | <img src="../screenshots/mobile-short-labels/2-change-dark.png" width="170" alt="The change after, dark"> |
| The guess | <img src="../screenshots/mobile-short-labels/before/3-guess.png" width="170" alt="The guess before, on an iPhone"> | <img src="../screenshots/mobile-short-labels/3-guess-50-light.png" width="170" alt="The guess after, light"> | <img src="../screenshots/mobile-short-labels/3-guess-50-dark.png" width="170" alt="The guess after, dark"> |
| The reveal | <img src="../screenshots/mobile-short-labels/before/4-reveal.png" width="170" alt="The reveal before, on an iPhone"> | <img src="../screenshots/mobile-short-labels/4-reveal-light.png" width="170" alt="The reveal after, light"> | <img src="../screenshots/mobile-short-labels/4-reveal-dark.png" width="170" alt="The reveal after, dark"> |
| Your 10 days | <img src="../screenshots/mobile-short-labels/before/5-days.png" width="170" alt="Your 10 days before, on an iPhone"> | <img src="../screenshots/mobile-short-labels/5-days-light.png" width="170" alt="Your 10 days after, light"> | <img src="../screenshots/mobile-short-labels/5-days-dark.png" width="170" alt="Your 10 days after, dark"> |
| Review | <img src="../screenshots/mobile-short-labels/before/6-review.png" width="170" alt="Review before, on an iPhone"> | <img src="../screenshots/mobile-short-labels/6-review-light.png" width="170" alt="Review after, light"> | <img src="../screenshots/mobile-short-labels/6-review-dark.png" width="170" alt="Review after, dark"> |

The check-in pages, new and edit, including the change and a typed number, are in [`docs/screenshots/mobile-short-labels/`](../screenshots/mobile-short-labels/) as `7-*.png`, made with `apps/mobile/scripts/capture-short-labels.cjs`.

### What this doesn't show

- **Not seen on a phone yet.** This machine has no Xcode, so no simulator could run. The iOS bundle builds, and tests render every step with the native renderer, but the #108 scenes on a real native build are for Nazmul's iPhone check.
- **The prompt hasn't met the real model.** No paid call was made, so the first real plan is the check on what it writes.
- **No end date on Your 10 days.** The plan response has no dates until the experiment starts, and the phone doesn't work out days itself, so the line isn't shown.
- **Today, the experiment screen and History still show the full question.** They weren't in this feedback.
