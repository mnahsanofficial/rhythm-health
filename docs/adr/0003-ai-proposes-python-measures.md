# 3. AI proposes, Python measures

**Status:** Accepted. **Date:** 28–30 Oct 2026 ([#7](https://github.com/mnahsanofficial/rhythm-health/pull/7), [#21](https://github.com/mnahsanofficial/rhythm-health/pull/21); [DECISIONS Q4](../DECISIONS.md#questions-for-shakeb)).
## Context

The whole point of Rhythm is an honest answer about your own habit. If a model calculated the result, it could flatter the person, hide a weak signal or simply get the arithmetic wrong, and nobody could check it. Health claims raise the stakes.

## Decision

- **The AI proposes:** the plan, the forecast and the wording of the report.
- **Python measures:** phase means, change, signal or noise, adherence, overlap, calibration and day states, all in `services/analysis/` and related services.
- **Finishing makes no AI call.** `/complete` saves the analysis; `POST /report` is a separate, optional step.
- **The model's verdict must match.** The writer echoes the signal class, and it's rejected if that differs from the saved analysis.
- **Clients read structured values,** and never parse prose for a number.

## Alternatives

- **Let the model analyse the check-ins.** Less code and richer text, but untestable and not repeatable.
- **Python only, with no AI.** Fully honest, but it can't design a plan for any question a person asks.
- **Check every number in the prose against the analysis.** Stronger, and deferred ([Q17](../DECISIONS.md#questions-for-shakeb)).

## Consequences

- Finishing and reading results keep working when the AI is down.
- Analysis is plain tested code, with its thresholds in one place.
- The forecast is still model-generated, and prose can still misquote a figure, since prose numbers aren't checked. They're display only and never feed a chart.
- A short experiment only shows a pattern, so reports must say "pattern, not proof" ([health content](../rules/health-content.md)).
