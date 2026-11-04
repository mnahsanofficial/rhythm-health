# 12. Adopt CI checks from the template, but no Prettier on demo day

**Status:** Accepted. **Date:** 4 Nov 2026. **Decided by:** Nazmul. Background: [TEMPLATE_COMPARISON](../TEMPLATE_COMPARISON.md).

## Context

8x's template has repo discipline we lacked: a secret scan, migrations in CI, strict lint, a commit-message check and formatting. The final demos are on 5 Nov, with app code frozen at 14:00 Dhaka time. Docs and CI work can continue after that. Whatever we adopt mustn't make the app's diff harder to review, or block anyone at the last minute.

## Decision

**Adopt:**
- **A secret scan in CI,** because the logs are public and this is the safety net for the rule that matters most.
- **A migration check:** apply every file, then its rollback, then re-apply, on disposable Postgres.
- **`--max-warnings=0` on lint.**
- **A commit-message check on a PR's new commits only,** so old messages like "Feat/UI onboarding" don't fail it.

**Not adopting, on demo day: Prettier across the repo.** It would touch most files in one giant diff, right when reviewers are reading the code and while the last fixes are going in. It also conflicts with open branches and buries who wrote what, and we're rated individually.

## Alternatives

- **Prettier now.** Formatting would be consistent, but see above. It's still worth doing after the demo, at a quiet moment agreed with Shakeb.
- **Prettier on changed files only.** Smaller diffs, but unrelated reformatting would hide inside every fix.
- **Adopt nothing until after the demo.** Safest for the code, but the secret scan is most useful now, before reviewers read the logs.
- **Moving to the template's structure.** A rewrite, with no gain for users.

## Consequences

- **The first scan found one false positive and no secrets:** a React duplicate-key warning in a session log, quoting a record id. It's allowlisted by that exact text in [`.gitleaks.toml`](../../.gitleaks.toml). No file or folder is exempt.

- A leaked secret, a broken rollback or a new lint warning now fails CI.
- A false positive could block a last-minute fix, so the secret scan's allowlist needs to stay narrow and easy to extend.
- Formatting stays inconsistent until after the demo.
- The check only covers what we model on plain Postgres, not Supabase itself.
