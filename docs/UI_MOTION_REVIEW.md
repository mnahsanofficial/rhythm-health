# UI motion review

## What changed

The daily loop now gives clear feedback when choices, recorded days and results change. Signed-in home focuses on the current experiment instead of public marketing and sample data. Proposal previews have room for the plan and original forecast, onboarding habits follow the day, and prediction versus reality leads the Lab Report. Public visitors can explore a labelled sample rhythm, and history supports chronological ordering.

Two correctness fixes are included: the rhythm ring no longer shows an intermediate count-up beside the final sleep duration, and reduced-motion preferences no longer change the server/client SVG markup. The latter has an explicit hydration regression test and its browser check is enabled again.

The seeded demo moved to `/demo`, linked from the personal lab. No backend or Supabase files changed. Existing data-layer endpoints remain in use; the public example is local component state and makes no request.

## Review evidence

[Before/after screens and animation frames](screenshots/ui-motion/README.md) cover 390px and 1440px. Each screen's notes record its interaction, reduced-motion behavior and a self-review removal.

The test services are fake. Browser checks cover input/selection, progress, save retries, account changes, proposal errors, report waiting states, history errors/retry, normal motion and reduced motion. No real proposal, completion, demo-reset or check-in writes were made in the shared project. Paid model calls made: **0**.

Final verification: 66 Vitest tests pass; the Playwright suite has 45 passing cases and one existing skip; lint and typecheck pass. A production build using fake frontend test variables compiles and typechecks but fails prerendering `/experiments/new`: the route awaits `searchParams` outside Suspense. That file is identical in baseline `cac55a4`; the blocker is recorded in REMAINING_WORK.md and was not changed in this motion chunk. The existing keyboard-only time-field onboarding test remains skipped because Chromium leaves the time fields empty; the other browser checks remain enabled. This does not claim a new real-account end-to-end run.

## Rules for future changes

[DESIGN.md](../DESIGN.md) records the palette, type, spacing, named timing tokens and two signature moments. [UI motion rules](rules/ui-motion.md), linked from AGENTS.md, cover action/state triggers, transform/opacity, reduced motion, hydration and evidence captures. Motion durations use seconds in `frontend/lib/motion.ts` and milliseconds in the CSS mirror.

## Remaining scope

- The production prerender blocker on `/experiments/new` needs a separate test-first fix before a green production build.
- The existing skipped keyboard time-field test needs a separate fix.
- The primary-metric trend gap noted in [REMAINING_WORK.md](REMAINING_WORK.md) remains separate from the motion work.
- Written report sections still wait for backend content where the agreed fields are absent. No medical or causal claim is substituted.
- Global page transitions, ambient motion, animated dimensions, fake progress and confetti were deliberately excluded.

Claude Code built the original UI foundation and flows. Codex implemented this branch's audit, sleep-display correction, screen refinements, motion, reduced-motion fix, regression coverage and final rules.
