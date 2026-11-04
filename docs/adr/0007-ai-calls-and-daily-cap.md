# 7. The `ai_calls` table and a daily cap

**Status:** Accepted. **Date:** 4 Nov 2026 ([#71](https://github.com/mnahsanofficial/rhythm-health/pull/71)). **Decided by:** Nazmul, from the architecture review.

## Context

Nothing limited what one account could spend on AI, and nothing showed what was being spent.

## Decision

- Every OpenRouter call writes one row to `ai_calls`: profile, kind, model, status, latency and time, never the prompt or response.
- `/propose` and `POST /report` check a per-person daily cap before paid work, and answer 429 with `code: ai_daily_limit`. Defaults: 5 proposals (`AI_DAILY_LIMIT_PROPOSE`) and 3 reports (`AI_DAILY_LIMIT_REPORT`).
- Only `service_role` can read or write the table.

**What counts:** finished attempts, `ok` and `invalid`. A retry is the first half of an attempt, and an `error` never reached a model. A stored report comes back free, even at the cap. Days run on UTC.

## Alternatives

- **OpenRouter's account limit alone.** It protects the budget, but one person could use it all up, and it says nothing about who spent what.
- **Rate limiting at a gateway.** There isn't one, and it counts requests, not paid attempts.
- **Counting in memory or Redis.** Faster, but it's lost on restart or needs another service.

## Consequences

- We can see spend and latency by reading one table.
- **It fails open.** If usage can't be read, the call goes ahead, so a tracking problem doesn't stop the app. The cost is that the cap is off during a database problem.
- **Jev isn't capped,** because it runs on every question. Someone could keep sending blocked questions, paying only for that cheap call.
- **Two requests at the same moment can both pass.** A double tap costs one extra call at most, so there's no lock.
- It's per person, so it doesn't limit total spend across many accounts ([10x](../ARCHITECTURE.md#what-wed-change-at-10x-users)).
