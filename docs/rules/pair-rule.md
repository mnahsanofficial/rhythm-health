# Pair rule

Nazmul and Shakeb build Rhythm together and are each rated on their own work.

## V2 work is split by feature, not by layer

Both of us work across the frontend, the backend and the database. A feature's branch carries everything it needs: UI, API, schema and tests.

- Before you start, check the other person's open PRs and branches, and don't change files they're actively working on. If you have to, say so in your PR description.
- **If your PR changes the other person's area, tell them in the team chat when the PR opens:** what changed and why.
- **Never apply a database migration to the shared Supabase project without telling the other person first.** It affects them immediately.
- After an API schema change, regenerate the shared contract in the same PR (see [API contracts](api-contracts.md)).
