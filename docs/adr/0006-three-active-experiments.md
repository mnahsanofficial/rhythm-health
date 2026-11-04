# 6. Up to three active experiments, with overlap shown

**Status:** Accepted. **Date:** 4 Nov 2026 ([#55](https://github.com/mnahsanofficial/rhythm-health/pull/55), [decision](../DECISIONS.md#several-active-experiments--4-nov-2026)). **Decided by:** Nazmul, after 8x asked for it.

## Context

People have more than one habit they're curious about, and 8x asked for several experiments at once. But two changes running together make it harder to say which caused a result, and that's the honesty the product depends on.

## Decision

Allow up to three active experiments per profile.

- **The limit sits in the database,** in a trigger with a per-profile lock, so two simultaneous starts can't both pass. `POST /propose` checks it first, before any paid call. Clients read `GET /api/experiments/capacity` and never hold the number.
- **Overlap is shown, not hidden.** Python works it out at completion and stores it with the analysis, using only the other experiment's test days and this experiment's recorded days.
- **Overlap doesn't change the verdict.** The report says it plainly, and "likely signal" stays as it is.

## Alternatives

- **Stay at one.** The cleanest science, but it didn't match the feedback.
- **No limit.** Simple, but daily check-ins become a chore, and overlap makes results meaningless.
- **Cap the verdict when experiments overlap.** More cautious, but it's a further analysis rule with no evidence behind it, added the day before the demo.
- **A limit in application code only.** Two requests at the same moment could both pass.

## Consequences

- One reminder per experiment, so up to three a day.
- A shared check-in was needed to avoid answering twice ([decision](../DECISIONS.md#one-check-in-across-experiments--4-nov-2026)).
- Nothing warns when a new question tests the same thing as a running one.
- Samples use a slot too, which can surprise someone ([ADR 5](0005-samples-flagged-never-counted.md)).
