# 2. A monorepo with contract and brand packages

**Status:** Accepted. **Date:** 30–31 Oct 2026 ([#30](https://github.com/mnahsanofficial/rhythm-health/pull/30), [#32](https://github.com/mnahsanofficial/rhythm-health/pull/32)). **Decided by:** Nazmul.

## Context

Mobile was about to become a second client of the same API. Hand-written types and copied colours in two apps would drift apart without anyone noticing, especially with two people and several agents working at once.

## Decision

One repository with npm workspaces: `frontend`, `apps/*` and `packages/*`.

- **`packages/contract`:** TypeScript types generated from FastAPI's OpenAPI schema. `npm run contract:check` fails if they're out of date.
- **`packages/brand`:** numeric tokens in `tokens.json`, generating web CSS and native values. `npm run brand:check` fails on drift.

The backend stays a separate `uv` project in the same repo.

## Alternatives

- **Separate repositories.** Cleaner ownership, but every API change would need coordinated PRs across repos.
- **Zod schemas shared by both sides,** as in 8x's template. This gives runtime checks, but our source of truth is Python, so it would mean defining every shape twice.
- **Copying types by hand.** No tooling, and exactly the drift we wanted to avoid.
- **Moving `frontend/` to `apps/web`.** Matches the template, but it's churn with no gain for users.

## Consequences

- A backend schema change needs `npm run contract:generate`, and CI catches a forgotten one.
- Types are compile-time only, so nothing checks at runtime that a response matches.
- React and Expo versions have to coexist in one lockfile, which limits upgrades.
- Root contract checks import FastAPI, so CI and new contributors need `uv sync` as well as `npm ci`.
