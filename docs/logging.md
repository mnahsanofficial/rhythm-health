# Agent session logging

Every agent session on this repo writes `.claude-logs/<timestamp>_<session-id>.md`: user prompts and final responses only, in the format from the 8x guide ([`agent-logging-setup.md`](agent-logging-setup.md), saved verbatim as pasted). `.claude-logs/` is committed, never gitignored.

All agents write to that one folder, per 8x: no per-agent folders. The `agent:` frontmatter line, present only in Codex and Cursor logs, tells them apart.

## The rule: a new session for each task, and at least each day

**Start a new agent session for each task, and never keep one open across days.** A log file is one session, named by the moment it started. A session left open for days becomes one huge file under its first date: that's how five days of work ended up looking like two sessions on 28–29 Oct (see [What went wrong](#what-went-wrong-audit-1-nov)). Short sessions also mean fewer automatic conversation summaries and background-task notices in the log.

`npm test` runs `npm run logs:check`, which fails on any drift from the guide's format, a wrong or `unknown` `github_user`, an empty prompt or an agent-generated prompt. Format drift means a wrong file name, frontmatter key or key order, header block, entry marker, entry field or field order, or any value that doesn't match when recomputed with the script's own functions.

## What's installed

| Agent | Hook config (committed) | Script | Events |
|---|---|---|---|
| Claude Code | `.claude/settings.json` | `scripts/claude-log-hook.py`, which runs `scripts/extract-log.py`, the guide's script plus one reading change (see Deviations; sha256 `939d8138…257a`) | `UserPromptSubmit`, `Stop` |
| Codex | `.codex/hooks.json` | `scripts/extract-log-codex.py` | `UserPromptSubmit`, `Stop` |
| Cursor | `.cursor/hooks.json` | `scripts/extract-log-cursor.py` | `beforeSubmitPrompt`, `afterAgentResponse`, `stop` |

The Codex and Cursor scripts share `scripts/agent_log_common.py`. It imports the guide script's helpers and renders the same format, plus one extra frontmatter line, `agent: codex|cursor`. It also resolves `github_user` for all three agents (see below).

Checks: `scripts/check-logs.mjs` (run by `npm run logs:check`) and `scripts/check_log_format.py` (the exact format), with registered authors in `scripts/log-authors.json` and the listed exceptions for old logs in `scripts/log-waivers.json`. The hook and checker tests are in `scripts/tests/` (`npm run logs:test`).

## Deviations from the guide

**Project hooks, not global ones.** The guide installs hooks in `~/.claude/settings.json`, which would log every Claude Code session on the machine, including unrelated work repos. Here the hooks live in the project's `.claude/settings.json` instead:

```
cd "$CLAUDE_PROJECT_DIR" && python3 "$CLAUDE_PROJECT_DIR/scripts/claude-log-hook.py"
```

Anyone who clones the repo gets the same logging. The `cd` is there because Claude Code runs hooks in the session's *current* directory, which moves when the agent `cd`s.

**One change to how the guide script reads transcripts (4 Nov, approved by Nazmul).** The guide's script skipped two kinds of prompt a person really sent: prompts sent with an image, whose transcript entry is a list rather than a string, and prompts queued while the agent was working, which the transcript stores as a `queued_command` attachment. It now keeps the text of both, never image data, and only when the entry's `origin.kind` is `human`, so CI events, task notifications and interrupts are still not captured as new prompts. Only `is_user_prompt` and `extract_clean_log` differ from the guide, plus two small helpers. Everything that writes the output is identical, and `scripts/tests/test_log_format.py` checks that against the guide's text.

This recovered 7 prompts across 4 logs (`94c5e335`, `758cdbea`, `3f4138de`, `f678fe6b`), which were regenerated. Because the script keeps the last reply before each prompt, the 5 replies just before those prompts came back with them, later `num=` values moved and the stats recomputed. No existing prompt or reply changed. Shakeb's 3 Claude logs (`ec52fa30`, `6242a36e`, `ec9382b8`) can't be regenerated here, because their transcripts are on Shakeb's machine.

**Extra frontmatter lines.** Codex and Cursor logs add `agent:` right after `project:`, the only way to tell agents apart. The approved backfill `01a18219` also has `backfilled`, `backfilled_at` and `backfill_reason`, listed in `scripts/log-waivers.json`. The format check rejects any other key.

**A thin wrapper around the guide script.** `scripts/claude-log-hook.py` doesn't change what's written; it only makes sure the guide script logs the right session with the right name:

1. Claude Code passes the firing session's `transcript_path` on stdin. The guide script ignores it and logs whichever transcript changed last, so the wrapper touches that file first to make it the latest.
2. It runs the guide script with Homebrew on `PATH` and `GITHUB_USER` set. The guide script reads `GITHUB_USER` before calling `gh`. The wrapper resolves it with `gh api user`, falling back to gh's local active account (`gh config get -h github.com user`) when the API can't be reached, so attribution doesn't become `unknown` offline or in a sandbox. It never hard-codes a name.
3. It prints nothing and never fails the turn.

## Per-agent notes

- **Claude Code.** Project hooks fire for both events in the desktop app's Code tab (checked) and in the CLI once the folder is trusted (same settings file; run the canary if you use the CLI). Nothing to do per session.
- **Codex.** Hooks are on by default, but project hooks run only after the project is trusted and the hook is approved in `/hooks`. Approval is tied to the hook's hash, so any edit to `.codex/hooks.json` turns it off silently until it's re-approved. The script reads the rollout transcript from the hook payload, and fills in from the payload if the transcript lags. It logs only sessions a person drives: it skips Codex Desktop's background suggestions job (which fires the hooks with a generated "Generate 0 to 3 hyperpersonalized suggestions…" prompt and has no rollout) and approval-reviewer sub-agents (`source: subagent`). It never logs the AGENTS.md or environment text Codex injects.
- **Cursor.** Cursor gives the prompt and final response text directly in the hook payloads. The script keeps a per-conversation state file at `.git/agent-log-state/` (never committed) and re-renders the log on each event.

## Sessions in a worktree

**The problem.** The guide's script takes `project:` from the current folder's name, and finds its transcript in the Claude Code folder derived from that path. A session in `.claude/worktrees/<name>/` has its transcript under that worktree's folder, so the hook either logs another session, or writes `project: <name>`, or logs nothing for this one. The script mustn't change, so the session's log needs a little help.

**The workaround.** Run the unmodified script through a folder alias named `Health`, from a scratch folder, and regenerate before each commit:

```bash
WT="$PWD"                                 # the worktree's root
SESSION=<session id>                      # the transcript's file name, without .jsonl
SD="$HOME/.claude/projects/$(printf '%s' "$WT" | tr '/.' '--')"
ALIAS="$(mktemp -d)/Health"
ln -sfn "$WT" "$ALIAS"
ln -sfn "$SD" "$HOME/.claude/projects/$(printf '%s' "$ALIAS" | tr '/' '-')"
echo "{\"transcript_path\":\"$SD/$SESSION.jsonl\"}" | CLAUDE_PROJECT_DIR="$WT" CLAUDE_CWD="$ALIAS" python3 scripts/claude-log-hook.py
```

This adds one symlink in `~/.claude/projects/`, and nothing in the repo except the log. Keep the same alias for the whole session.

**How to check it's right:**

```bash
head -8 .claude-logs/*<session id>*.md
```

```bash
npm run logs:check
```

The first must show `project: Health`, your `author`, `github_user` and `git_email`, and there must be exactly one file for the session. The second must pass. If the hook did write `project: <worktree name>` first, regenerating through the alias corrects the same file, because the script reuses a session's existing log.

**One last thing.** A log can't contain the turn that commits it, so end each session with the [End of session](../AGENTS.md#end-of-session) step.

## Teammate setup

Pulling the repo brings the hooks, but each person's machine decides whether logs get written, and whose name is on them. Do this once per clone (Mac or Linux; the hook commands are shell commands).

1. **Clone** `https://github.com/mnahsanofficial/rhythm-health` (you need collaborator access). Work from that clone, not an older one.
2. **Git identity, inside the clone.** The logs record these values:
   ```bash
   git config user.name "Your Name"
   git config user.email "you@example.com"
   ```
3. **GitHub CLI:** `gh auth status` must show *your* account as active. `github_user` comes from gh's active account. Add your `git_email` → GitHub login to `scripts/log-authors.json`, or `npm test` will fail on your first log.
4. **`python3`** must be on your PATH (`python3 --version`).
5. **Claude Code:** start sessions at the repo root, not a subfolder, and accept the folder-trust prompt. Start a new session for each task, and at least each day.
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
| 5 | Claude Code, desktop app, after the 1 Nov fix | `LOG CHECK — Claude Code, Nazmul`, in a new session while another session was open in the same folder | Pass. Own file, `2026-11-01_15-09-53_bf9929b6….md`, written by `claude-log-hook.py`: prompt 1 and its response, `author: Md Nazmul Ahsan`, `github_user: mnahsanofficial`, `git_email: mnahsanofficial@gmail.com`, `session_status: complete`. The other session's text isn't in it, and `npm run logs:check` passes |

Expected lag: Claude Code saves a prompt to its transcript just after `UserPromptSubmit` fires, so the newest prompt lands in the log at that turn's `Stop`. A turn that crashes before `Stop` loses its last prompt.

## Ways logging can stop silently

- Codex hooks don't run until they are approved (`/hooks`), and the approval is lost after any edit to `.codex/hooks.json`. Until then Codex works normally and logs nothing.
- Codex changes its transcript format between versions; it isn't a stable interface. After a Codex update, check that a new `agent: codex` log appears.
- The wrong `gh` account becomes active. `github_user` records gh's active account; `npm run logs:check` catches a login that doesn't match the author's email.
- `git config user.email` isn't set locally in the clone, so it falls back to global or `unknown`.
- Two Claude Code sessions in the same folder: fixed since 1 Nov. The wrapper marks the firing session's transcript as the newest before the guide script runs, so each hook updates its own session's file (tested in `scripts/tests/test_agent_logging.py`).

## What went wrong (audit, 1 Nov)

8x scored our logs 3.8/15. Their review saw two sessions from 28–29 Oct: a one-line canary, and a Codex log whose only "prompt" was 21,557 characters of generated text. We had worked with agents every day. The audit compared every log with the transcripts on Nazmul's Mac.

| What was wrong | Evidence | What changed |
|---|---|---|
| **Sessions stayed open for days**, so each became one huge file under its first date | Claude Code `94c5e335` (desktop app) holds prompts from 28 Oct to 1 Nov in a 416 KB file named 28 Oct; Codex `01a184b2` holds 28 Oct to 1 Nov (251 KB, named 29 Oct). Every day's work was there, filed under the first day | The rule above: a new session for each task, at least each day |
| **Codex logged a background job as a session** | Four Codex logs (`01a18743`, `01a18dcd`, `01a18df2`, `01a192f4`) contain only Codex Desktop's suggestions prompt ("Generate 0 to 3 hyperpersonalized suggestions…"), with no rollout and no reply. `01a18743` is the one 8x saw | The Codex extractor skips it and reviewer sub-agents; `logs:check` rejects generated prompts. The four files stay unedited, listed in `scripts/log-waivers.json` |
| **Attribution could read `unknown`** | `github_user` came only from `gh api user` with a 5-second timeout. Codex `01a184b2` flipped between `unknown` and `mnahsanofficial` from one rewrite to the next | Offline fallback to gh's active account in all three agents; `logs:check` rejects `unknown` and mismatched logins |
| **Two sessions in one folder could log each other** | The guide script picks the most recently modified transcript, not the one that fired | The Claude Code wrapper marks the firing transcript first |

What was already right: the format matches the guide in every log (same frontmatter fields and `CLAUDE_LOG_ENTRY` blocks; Codex and Cursor add `agent:`), the guide script was byte-identical at that date, Codex's real prompts are captured exactly (99 of 99 in `01a184b2`, with no injected AGENTS.md text), no log has an empty prompt, and no log is stranded on an unmerged branch.

Still in the logs, by decision: the guide script records Claude Code's automatic conversation summaries and background-task notices as prompts (10 of 91 in `94c5e335`). They stay, because the guide's script writes them; shorter sessions make them rare.

**Missing-session audit and approved backfill:**

- Codex `01a18219-c8cd-7b30-8246-43f2497fc36a` (28 Oct 10:41 UTC / 16:41 Dhaka, one prompt): Maham (8x) approved backfilling this missing session on 1 Nov 2026 because the Codex hooks were not yet approved on 28 Oct (canary #3). The current Codex extractor generated the log from its original transcript, with the filename and displayed date set to the original session start. Added only `2026-10-28_16-41-30_01a18219-c8cd-7b30-8246-43f2497fc36a.md`, marked with `backfilled: true`, a UTC `backfilled_at`, and the approval reason. No existing log was edited, renamed or deleted as part of this backfill.
- Shakeb's sessions after 29 Oct 20:09: his newest log ends there, although he worked on #21 and #24 afterwards. His transcripts are on his machine.
