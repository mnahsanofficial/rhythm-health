# 5. Samples flagged `is_seeded`, never counted

**Status:** Accepted. **Date:** 29–31 Oct 2026 ([DECISIONS Q3 and D4](../DECISIONS.md), [ACTIVE_SAMPLE](../ACTIVE_SAMPLE.md)). **Decided by:** Shakeb (completed sample) and Nazmul (active sample).

## Context

A real experiment takes 10 days, so a reviewer can't reach a Lab Report in one sitting. We need sample data in a real account, but invented answers must never pass as someone's evidence or influence their real results.

## Decision

Samples are ordinary rows with `is_seeded = true`, created only when a person asks.

- **Never counted as results:** they're left out of completed history, prediction context, calibration and a real report's overlap, because their answers are invented.
- **Always labelled** on screen.
- **Removable, and separate:** resetting replaces only that profile's seeded rows, and leaves real experiments alone. Making one needs no AI call.
- **They do count toward the three active slots,** because they do use a slot on screen.

## Alternatives

- **A separate demo account.** The cleanest data, but it wouldn't show a person's own flow, and a shared password is a risk.
- **Separate sample tables.** No risk of mixing, but every screen would need a second data path.
- **Fixtures only in the client.** Nothing in the database, but it wouldn't exercise the real API.

## Consequences

- Reports, charts and check-ins use the normal code, so the demo tests the real path.
- Every query for real results must remember the filter. `backend/app/repositories/experiments.py` holds it, and tests cover it, but a new query could forget it.
- A sample has an invented guess, so its report can show the three-way comparison. It stays out of the calibration list, and appears only as a labelled example.
