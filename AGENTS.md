# Agent instructions

The one instructions file for every agent on this repo (Claude Code, Codex, Cursor). `CLAUDE.md` imports it; Codex and Cursor read it directly.

Context: 8x Playmakers C2, track "Health habits" (fitness, sleep, food), theme "Learning that sticks". Built by a pair, Nazmul and Shakeb, each rated on their own work.

## Session logs

Always commit `.claude-logs/` with your changes.

- Hooks write it automatically (see `docs/logging.md`). Never gitignore it, edit it, or delete files from it.
- Don't change `scripts/extract-log.py`. It is the 8x guide's script, byte for byte.

## Workflow

- Branch per feature off `main` (`feat/…`, `fix/…`, `chore/…`). Never commit to `main` directly.
- Open a PR with a short description: what changed and how you tested it by hand.
- Merge with a merge commit. Never squash or rebase-merge. Squashing collapses the code and log history that shows who did what, and we're rated individually.

## Pair rule

Don't change files the other person is actively working on (check their open PRs and branches). If you have to, say so in your PR description.

## Product principles

- Small daily sessions, a few minutes each.
- Practice, not just content: the user does something every session.
- Visible progress.
- A reason to come back on day 3 and on day 7.
- Mobile-first. Check every screen at 390px wide.
- Test every flow by hand in the browser. Don't trust that generated code works.

## Secrets

- Secrets go in `.env.local` only. It's gitignored. `.env.example` lists the variable names, never the values.
- Never print, echo, or paste a secret value, not even in a response. These logs are public.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
