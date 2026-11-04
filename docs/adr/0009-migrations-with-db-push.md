# 9. Migrations through `supabase db push`

**Status:** Accepted. **Date:** 4 Nov 2026 ([#56](https://github.com/mnahsanofficial/rhythm-health/pull/56), [decision](../DECISIONS.md#new-supabase-project--4-nov-2026)). **Decided by:** Nazmul.

## Context

Migrations had been pasted by hand into the Supabase SQL editor, so there was no record of what had been applied. 8x asked for the #39 migration to be run, and the old project's dashboard belonged to Shakeb, who wasn't available. So the app moved to a new project on Nazmul's account, where nothing was applied yet.

## Decision

- Plain SQL files in `supabase/migrations/`, each with a rollback in `supabase/rollbacks/`, and a check on disposable Postgres for new ones.
- Apply with `supabase db push`, after a dry run, so `supabase_migrations.schema_migrations` records what's been applied.
- **A person decides.** Tell the other person first, and agents ask before applying. CI never applies a migration to the shared project.

## Alternatives

- **The SQL editor.** No tooling, and no record, which is what caused the problem.
- **Prisma with a deploy workflow,** as in 8x's template. Automatic, but it conflicts with announcing changes to a database two people share, and we don't use Prisma.
- **Keep the old project.** No move needed, but nobody available could apply anything.

## Consequences

- We can list exactly what's applied.
- The new project started empty, so nothing carried over: accounts and experiments stayed behind, and everyone signed up again. Shakeb's env files need the new values.
- A migration merged after being applied leaves the project's history briefly ahead of `main`, so the merge should follow soon after.
- Disposable tests must model Supabase's default privileges, or they'll miss what the real project does ([ADR 11](0011-rls-and-deferred-grants.md)).
