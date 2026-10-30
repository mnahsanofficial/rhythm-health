# Agent session logging

Every agent session on this repo writes `.claude-logs/<timestamp>_<session-id>.md`: user prompts and final responses only, in the format from the 8x guide ([`agent-logging-setup.md`](agent-logging-setup.md), saved verbatim as pasted). `.claude-logs/` is committed, never gitignored.

All agents write to that one folder, per 8x: no per-agent folders. The `agent:` frontmatter line, present only in Codex and Cursor logs, tells them apart.

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

## Teammate setup

Pulling the repo brings the hooks, but each person's machine decides whether logs get written, and whose name is on them. Do this once per clone (Mac or Linux; the hook commands are shell commands).

1. **Clone** `https://github.com/mnahsanofficial/rhythm-health` (you need collaborator access). Work from that clone, not an older one.
2. **Git identity, inside the clone.** The logs record these values:
   ```bash
   git config user.name "Your Name"
   git config user.email "you@example.com"
   ```
3. **GitHub CLI:** `gh auth status` must show *your* account as active. `github_user` comes from `gh api user`; without `gh` it reads `unknown`.
4. **`python3`** must be on your PATH (`python3 --version`).
5. **Claude Code:** start sessions at the repo root, not a subfolder, and accept the folder-trust prompt. Run one session per checkout at a time.
6. **Codex:** trust the project, then approve the hooks with `/hooks` (Codex CLI). Unapproved hooks are skipped without any warning.
7. **Cursor:** don't use its agent here until its live canary passes. The hook script passed an offline test on 31 Oct (see Canary results), but that doesn't prove Cursor runs the hooks.
8. **Canary**, once per agent you'll use: send `CAPTURE TEST — Playmakers C2, <your name>`. After the reply, check:
   ```bash
   ls -t .claude-logs | head -3
   ```
   A new file should hold your prompt and the reply, with your `author`, `github_user` and `git_email` in the frontmatter (Codex and Cursor logs also say `agent:`). No file means that agent isn't logging. Don't use it for project work until it is.

## Canary results

| # | Agent | Canary | Result |
|---|---|---|---|
| 1 | Claude Code | `i merged the PR: CAPTURE TEST — Playmakers C2, Nazmul` | Pass. Prompt 6 and response 6 in `2026-10-28_14-55-21_94c5e335….md`, written by the hooks with no manual run. Frontmatter: `author: Md Nazmul Ahsan`, `github_user: mnahsanofficial`, `git_email: mnahsanofficial@gmail.com`. |
| 2 | Claude Code (2nd session) | `CAPTURE TEST 2 — Playmakers C2, Nazmul` | Pass. Own file, `2026-10-28_16-18-53_04fdfec2….md`, with prompt 1 and response 1 and the same frontmatter. The first session's file contains none of it. |
| 3 | Codex Desktop (CLI 0.165) | `CAPTURE TEST 2 — Playmakers C2, Nazmul` | **Fail: no log written.** The project is trusted, but the hooks were never approved, so they didn't run. Separately, 0.165 changed its transcript format (`item_completed` `UserMessage`/`AgentMessage`), which the adapter now handles; tested against this session's transcript, outside the repo. Re-run after approving the hooks. |
| 4 | Cursor | Offline only, 31 Oct: the three hook events (`beforeSubmitPrompt`, `afterAgentResponse`, `stop`) fed to `scripts/extract-log-cursor.py` in a scratch repo | Script pass: one log with `agent: cursor`, the author fields, the prompt and the reply. **Live canary in the Cursor app not run yet**, so Cursor is still not cleared for agent use |

Expected lag: Claude Code saves a prompt to its transcript just after `UserPromptSubmit` fires, so the newest prompt lands in the log at that turn's `Stop`. A turn that crashes before `Stop` loses its last prompt.

## Ways logging can stop silently

- Codex hooks don't run until they are approved (`/hooks`), and the approval is lost after any edit to `.codex/hooks.json`. Until then Codex works normally and logs nothing.
- Codex changes its transcript format between versions; it isn't a stable interface. After a Codex update, check that a new `agent: codex` log appears.
- The wrong `gh` account becomes active. `github_user` records whatever `gh api user` returns.
- `git config user.email` isn't set locally in the clone, so it falls back to global or `unknown`.
- Two Claude Code sessions run in the same folder at once. The guide script isn't told which session fired the hook, so it re-renders whichever transcript changed most recently. Content never mixes, because each file is built only from its own transcript. But a session's hook can update the other session's file instead of its own, so its newest turn is missing until its next hook. If that session ends while the other one keeps going, its last turn stays missing until someone sends it another message. Safest habit: one Claude Code session per checkout at a time.
