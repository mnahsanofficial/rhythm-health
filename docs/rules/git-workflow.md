# Git workflow

## Branches

- One branch per feature, cut from the latest `main`: `feat/…`, `fix/…`, `docs/…`, `test/…`, `chore/…`.
- Never commit to `main` directly.
- Before you start, check the other person's open PRs and branches. Don't change files they're working on. If you have to, say so in your PR description.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), as the history already uses them: `type(scope): subject`. The subject is imperative and lowercase, with no trailing period.

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Scope: `frontend` for `frontend/`, `logs` for session-log-only commits. Leave the scope out for backend work, as the history does.
- Examples from this repo:
  - `feat(frontend): add the daily check-in screen`
  - `feat: complete experiments with deterministic analysis`
  - `fix(frontend): prevent duplicate experiment saves`
- A few deliberate commits per PR, each one a step someone can review on its own.
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
- The other person reviews before merging when the PR touches their area or shared files (`AGENTS.md`, `README.md`, the API contract).

## Refresh main before opening a PR

This is a required handover for every agent, even if the branch started from the latest main:

1. Run `git fetch origin` before opening the PR.
2. Give the person the exact command `git merge origin/main` to run on the feature branch. The person runs the merge; the agent does not run it. Never rebase or force-push.
3. If the merge reports conflicts, show every conflicted file and the conflicting changes, then wait for direction before resolving them.
4. After the merge, rerun frontend lint, typecheck, the full unit/component and Playwright suites, and the production build. Check the changed pages in a browser at mobile, tablet and desktop widths. Report failures and fix them before proceeding.
5. Only after those checks pass, open the PR with `gh`. Publication must be authorized; opening a PR never authorizes merging it.

## Merging

- **Merge commits only.** Never squash or rebase-merge. Squashing collapses the code and log history that shows who did what, and we're rated individually.
- Never force-push a shared branch, and never rewrite someone else's commits.
- Delete the branch after merging if you like. The merge commit keeps its history.
