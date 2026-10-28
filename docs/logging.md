# Agent session logging

Every agent session on this repo writes `.claude-logs/<timestamp>_<session-id>.md`: user prompts and final responses only, in the format from the 8x guide ([`agent-logging-setup.md`](agent-logging-setup.md), saved verbatim as pasted). `.claude-logs/` is committed, never gitignored.

## What's installed

| Agent | Hook config (committed) | Script | Events |
|---|---|---|---|
| Claude Code | `.claude/settings.json` | `scripts/extract-log.py`, the guide's script byte for byte (sha256 `440fc039…a735`) | `UserPromptSubmit`, `Stop` |
| Codex | `.codex/hooks.json` | `scripts/extract-log-codex.py` | `UserPromptSubmit`, `Stop` |
| Cursor | `.cursor/hooks.json` | `scripts/extract-log-cursor.py` | `beforeSubmitPrompt`, `afterAgentResponse`, `stop` |

The Codex and Cursor scripts share `scripts/agent_log_common.py`. It imports the guide script's helpers and renders the same format, plus one extra frontmatter line, `agent: codex|cursor`.

## The one deviation from the guide

The guide installs hooks in `~/.claude/settings.json`, which would log every Claude Code session on the machine, including unrelated work repos. Here the hooks live in the project's `.claude/settings.json` instead, and point at the in-repo script:

```
cd "$CLAUDE_PROJECT_DIR" && python3 "$CLAUDE_PROJECT_DIR/scripts/extract-log.py"
```

Anyone who clones the repo gets the same logging. The `cd` is there because Claude Code runs hooks in the session's *current* directory, which moves when the agent `cd`s. The script derives the transcript location from its cwd and exits silently if that's wrong.

## Per-agent notes

- **Claude Code.** Project hooks fire for both events (per the hooks docs). Nothing to do per session.
- **Codex.** Hooks are on by default, but project hooks run only after the project is trusted and the hook is approved in `/hooks`. Approval is tied to the hook's hash, so any edit to `.codex/hooks.json` turns it off silently until it's re-approved. The script reads the rollout transcript from the hook payload, and fills in from the payload if the transcript lags.
- **Cursor.** Cursor gives the prompt and final response text directly in the hook payloads. The script keeps a per-conversation state file at `.git/agent-log-state/` (never committed) and re-renders the log on each event.

## Canary results

| # | Agent | Canary | Result |
|---|---|---|---|
| 1 | Claude Code | `CAPTURE TEST — Playmakers C2, Nazmul` | pending |
| 2 | Claude Code (2nd session) | | pending |
| 3 | Codex | | pending |
| 4 | Cursor | | pending |

## Ways logging can stop silently

- Codex hook approval is lost after any edit to `.codex/hooks.json`.
- The wrong `gh` account becomes active. `github_user` records whatever `gh api user` returns.
- `git config user.email` isn't set locally in the clone, so it falls back to global or `unknown`.
- Two Claude Code sessions run in the same folder at once. The guide script logs whichever transcript changed most recently, so a hook can write the other session's file. Each session's own next hook rewrites its own file.
