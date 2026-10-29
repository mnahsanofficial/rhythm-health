@AGENTS.md

Everything in `AGENTS.md` applies to every agent on this repo, so rules go there, not here. This file only adds what is specific to Claude Code.

## Session logs

Always commit `.claude-logs/` with your changes.

- **What writes it:** the project hooks in `.claude/settings.json` (`UserPromptSubmit` and `Stop`) run `scripts/extract-log.py`. Each session writes `.claude-logs/<timestamp>_<session-id>.md`.
- **When to stage it:** the hooks record each turn when it ends, so stage `.claude-logs/` last, just before you commit.
- **Where the hooks live:** in the project's `.claude/settings.json`. Don't add them to `~/.claude/settings.json`, which would log every session on the machine.
- **Background:** [`docs/logging.md`](docs/logging.md).

## Dev servers

`.claude/launch.json` defines `frontend` (port 3000) and `backend` (port 8001), so the desktop app's preview browser can start and attach to them.
