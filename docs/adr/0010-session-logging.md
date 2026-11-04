# 10. Session logging, and the one change to how it reads transcripts

**Status:** Accepted. **Date:** 28 Oct 2026, with the reading change on 4 Nov ([#41](https://github.com/mnahsanofficial/rhythm-health/pull/41), [#69](https://github.com/mnahsanofficial/rhythm-health/pull/69)). **Decided by:** Nazmul, following 8x's guide. Full detail: [logging](../logging.md).

## Context

8x rates each person from their agent session logs, and scored our first set 3.8 out of 15. Their guide gives a script and a format. The logs are public, and the audit showed they had to be complete and attributed correctly.

## Decision

- **The guide's script, in the guide's format,** in `.claude-logs/`, committed. Never gitignored, edited or deleted.
- **Project hooks** in `.claude/settings.json`, not global ones, so unrelated work on the same machine isn't logged.
- **A thin wrapper** that makes sure the session that fired gets logged, under the right name.
- **One reviewed change to reading.** The guide's script skipped prompts a person really sent: those sent with an image, and those queued while the agent was working. It now keeps their text, only when the entry says a human sent it. Everything that writes the output is unchanged, and a test compares it against the guide's text.
- **`npm run logs:check`** in CI fails on any drift, a wrong author, or a generated prompt.

## Alternatives

- **The script exactly as given.** Fully by the book, but real prompts were missing from the record, including 7 across 4 logs.
- **The template's `SessionEnd` hook and its own script.** A newer approach, but 8x asked us to match the guide, so the guide wins. [Worth confirming](../TEMPLATE_COMPARISON.md) which they score.
- **Global hooks,** as the guide says. Simple, but they'd log every session on the machine.

## Consequences

- Logs can be checked by a machine, and nothing depends on remembering to do it.
- We carry a deviation, recorded here and pinned by a test.
- **Worktrees need a workaround.** The script takes the project name from the folder, so a worktree session needs a folder alias named `Health` ([how](../logging.md#sessions-in-a-worktree)).
- A log PR can't contain its own last turn, so each session ends with a final logs PR.
