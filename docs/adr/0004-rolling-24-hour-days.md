# 4. Rolling 24-hour days

**Status:** Accepted. **Date:** 29 Oct 2026 ([DECISIONS Q7](../DECISIONS.md#questions-for-shakeb)).
## Context

An experiment needs one rule for "which day is it". Two clients, people in different time zones and daylight-saving changes all make calendar days easy to get subtly wrong, and a client that calculates its own day would eventually disagree with the server.

## Decision

A day is a rolling 24 hours from `started_at`. The backend alone works it out and returns it through `GET /api/experiments/{id}/progress` ([contract](../PROGRESS_API.md)), including `next_day_at`. Clients show times in local time and never calculate a day.

## Alternatives

- **Calendar days in the person's time zone.** This matches how people think, but needs a stored time zone, has to handle travel and daylight saving, and can give a very short first day.
- **Calendar days on the phone.** Simple per client, but clients would disagree, and results could be changed by changing the phone's clock.

## Consequences

- One tested rule, with no profile time zone. It was checked across Dhaka and Toronto, including the 1 Nov clock change.
- Starting late in the evening shifts every day: day 2 opens the next evening. We accepted this for V1.
- A missed day can't be filled in later, because only today's check-in can be saved.
- The cap's day (UTC) is a separate rule, because it's about spend rather than experiments.
