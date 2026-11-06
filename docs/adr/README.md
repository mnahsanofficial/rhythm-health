# Architecture decision records

One short record for each real decision: the situation, what we chose, what else we considered, and what it costs. They were written together on 4 Nov 2026, from decisions made during the build, so each one gives the date of the decision itself and links to where it was recorded at the time. Status is **Accepted** unless it says otherwise.

| # | Decision |
|---|---|
| [1](0001-mobile-first-with-expo.md) | Mobile first, with Expo |
| [2](0002-monorepo-contract-and-brand.md) | A monorepo with contract and brand packages |
| [3](0003-ai-proposes-python-measures.md) | AI proposes, Python measures |
| [4](0004-rolling-24-hour-days.md) | Rolling 24-hour days |
| [5](0005-samples-flagged-never-counted.md) | Samples flagged `is_seeded`, never counted |
| [6](0006-three-active-experiments.md) | Up to three active experiments, with overlap shown |
| [7](0007-ai-calls-and-daily-cap.md) | The `ai_calls` table and a daily cap |
| [8](0008-async-openrouter-client.md) | An async OpenRouter client |
| [9](0009-migrations-with-db-push.md) | Migrations through `supabase db push` |
| [10](0010-session-logging.md) | Session logging, and the one change to how it reads transcripts |
| [11](0011-rls-and-deferred-grants.md) | Row-level security now, tighter grants later |
| [12](0012-ci-discipline-no-prettier.md) | Adopt CI checks from the template, but no Prettier on demo day |
| [13](0013-one-question-per-screen-checkin.md) | One question per screen in the check-in |
| [14](0014-text-budget-and-its-test.md) | A text budget, enforced by a test |
| [15](0015-content-rich-web-focused-mobile.md) | Content-rich web, focused mobile |

| [16](0016-private-monitoring-and-product-events.md) | Private error reporting and in-house product events (acceptance pending) |

The system they add up to is in [ARCHITECTURE.md](../ARCHITECTURE.md). Smaller product decisions are in [DECISIONS.md](../DECISIONS.md).
