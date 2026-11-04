# 8. An async OpenRouter client

**Status:** Accepted. **Date:** 4 Nov 2026 ([#73](https://github.com/mnahsanofficial/rhythm-health/pull/73)). **Decided by:** Nazmul, from the architecture review.

## Context

Each AI call held a worker thread for up to 90 seconds, so a few slow calls could use up the pool and stall everyone else, including people only checking in. Reads that didn't depend on each other also ran one after another, adding their waits together.

## Decision

- The OpenRouter client uses `httpx.AsyncClient`, and `/propose`, `/complete` and both `/report` routes are async.
- **Timeouts:** connecting 5 seconds; reading 75 seconds (`OPENROUTER_TIMEOUT_SECONDS`), or 30 for Jev.
- **One retry** after a connection failure, a 429 or a 5xx. A read timeout isn't retried: the model probably ran and was paid for.
- Independent reads run together through `read_together`, for example history and running questions in `/propose`.

## Alternatives

- **More worker threads.** One line, but it only moves the limit, and each stuck call still holds a thread.
- **A background job queue.** The right answer at scale, but it needs a queue, a worker and client polling, the day before a demo.
- **A fully async database client too.** There isn't an async client in this codebase, and rewriting every repository before the demo isn't worth the risk.

## Consequences

- A slow AI call no longer blocks check-ins through the thread pool.
- Supabase reads still hold a worker thread while waiting, so a slow database can still fill the pool.
- A call taking 75–90 seconds used to succeed and now fails with a 503. If `ai_calls` shows real latencies near 75 seconds, raise the setting.
- One client per call connects more slowly than a shared one, which is small next to a model call and avoids problems across event loops.
