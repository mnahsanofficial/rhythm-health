# Git workflow

## Branches

- One branch per feature, cut from the latest `main`: `feat/…`, `fix/…`, `docs/…`, `test/…`, `chore/…`.
- Never commit or push to `main` directly.
- Before you start, check the other person's open PRs and branches, and follow the [pair rule](pair-rule.md).

## What agents may do

Claude Code, Codex and Cursor may commit, push their own branches and open PRs directly. They perform the required `origin/main` merge into their own feature branch. The people review and merge PRs.

- **Agents never merge PRs**, never force-push, and never push to `main`.
- Every agent commit includes `.claude-logs/`.
- Cursor may only be used as an agent if its sessions are logged to `.claude-logs/`. Check this before its first use, with the canary in [`docs/logging.md`](../logging.md#teammate-setup).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), as the history already uses them: `type(scope): subject`. The subject is imperative and lowercase, with no trailing period.

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Scope: `frontend` for `frontend/`, `logs` for session-log-only commits. Leave the scope out for backend work, as the history does.
- Examples from this repo:
  - `feat(frontend): add the daily check-in screen`
  - `feat: complete experiments with deterministic analysis`
  - `fix(frontend): prevent duplicate experiment saves`
- A few deliberate commits per PR, each one a step someone can review on its own. For behavior changes, commit the tests after confirming the intended failure (red), then commit the implementation after the checks pass (green).
- Every commit includes `.claude-logs/`. Never an env file.

## Session logs

`.claude-logs/` is committed with the work it records. Hooks write it, so:

- never gitignore it, edit it, or delete files from it;
- never change `scripts/extract-log.py` (the 8x guide's script, byte for byte).

If a session's log changes after your last commit, add a `chore(logs): …` commit to the same branch before merging. Setup and per-agent details are in [`docs/logging.md`](../logging.md).

## Pull requests

- Open the PR when the work is done and tested by hand.
- Description:
  - what changed;
  - how you tested it by hand (screens, widths, which calls were real and which were mocked);
  - anything you couldn't check;
  - any requests for the other person.
- A PR that changes what people see says which screens and widths you checked.
- If the PR changes the other person's area, tell them in the team chat when it opens (see the [pair rule](pair-rule.md)).

## Refresh main before opening a PR

Before opening any PR:

1. Fetch: `git fetch origin`.
2. Merge the latest main into your feature branch: `git merge origin/main`. Never rebase. Resolve conflicts before running checks. For session-log conflicts, keep the newer complete copy unchanged; do not combine or rewrite exchanges.
3. Rerun the checks: frontend lint, typecheck, the full unit and Playwright suites and the production build, plus `uv run pytest` if the backend changed.

Open the PR only when they pass. Opening a PR never authorizes merging it.

## Merging

- **Merge commits only.** Never squash or rebase-merge. Squashing collapses the code and log history that shows who did what, and we're rated individually.
- Only people merge PRs. Agents may merge `origin/main` into their own feature branch for the required refresh above.
- Never force-push, and never rewrite someone else's commits.
- Delete the branch after merging if you like. The merge commit keeps its history.
