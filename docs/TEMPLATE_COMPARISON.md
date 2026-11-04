# Template comparison

How this repo compares with 8x's current template, [`starter-monorepo-template`](https://github.com/8xsocial/starter-monorepo-template) at `eca0df2` (1 Nov 2026). Where it helps, this also looks at [`starter-web-template`](https://github.com/8xsocial/starter-web-template) at `63721ea` (1 Nov 2026), which the monorepo template says its standards come from.

**How this was checked:** reading both repos on 4 Nov 2026. None of their scripts were run, including `check:standards`, so this isn't a pass or fail from their gate. Our side is `main` plus the then-open code standards PR (#74).

## The main difference

We didn't start from either template. The first commit here is a README, and the app was built up from there. The largest difference follows from that: the template's backend is Next.js API routes with Prisma, while ours is a separate FastAPI service with Supabase's REST API. Most of what we'd adopt is repo discipline, and none of it needs that changed.

## What we match

| Area | Both repos |
|---|---|
| Monorepo | npm workspaces, `apps/*` and `packages/*`, Node 22.18+ |
| Shared packages | One `brand` package and one `contract` package |
| Mobile | Expo Router, `react-native-reanimated`, Jest |
| Web | Next.js, Motion, `@supabase/supabase-js` |
| Agent rules | `AGENTS.md` as the main file, `CLAUDE.md` importing it, rules in `docs/rules/` |
| Product docs | `PRODUCT.md`, `DESIGN.md`, `docs/ENV_SETUP.md` |
| Session logs | `.claude-logs/`, committed |
| TypeScript | `strict: true` |
| CI | Runs on pull requests, with typecheck, lint, tests and a web build, and a newer push cancels the older run |
| Monitoring | Optional Sentry (web template) |

## Where we differ, and why

| Area | Template | Ours | Why |
|---|---|---|---|
| Web location | `apps/web` | `frontend/` | Set up before the mobile app existed. Moving it is churn with no user benefit |
| Backend | Next.js routes, Prisma | `backend/`, FastAPI, Python | Analysis is in Python, and the pair split started by layer |
| Migrations | Prisma schema, deployed by a workflow | Plain SQL in `supabase/migrations/`, applied by hand after approval | The pair rule needs a person to announce each change to the shared database |
| Contract | Zod schemas, parsed at runtime on both sides | Types generated from FastAPI's OpenAPI, with a drift check | FastAPI is the source of truth. **Trade-off:** we get no runtime check that a response matches |
| Brand | TypeScript presets, one accent, derived roles, a contrast test | `tokens.json` with light and dark themes, generated CSS | Our palette was designed by hand. **Trade-off:** contrast isn't enforced by a test on the tokens |
| Web components | `Container`, `PageShell`, `Nav`, `Footer` and others; web template adds `ui/` with `button`, `card`, `badge`, `input`, `label`, `textarea`, `toast`, `icons` | `components/ui/` holds only `button.ts` and `count-up.tsx`; the rest are feature components | We never adopted them. Cards and inputs repeat their classes across screens |
| Mobile components | `components/ui/` with `Button`, `Card`, `EmptyState`, `Skeleton`, `Sheet`, `Text` and others | One `src/ui.tsx`, plus feature screens in `src/` | Same reason. The README's `app`/`lib` layout claim is only partly true, since ours has `src/` |
| Styling on mobile | NativeWind | `themedStyles()` and native tokens | Expo Go on SDK 58 without custom native setup |
| Versions | Expo 55, Next 15 in the monorepo; Next 16 in the web template | Expo 58, Next 16 | We're newer. See `apps/mobile/README.md` |
| Web monitoring | `@sentry/nextjs`, with server and edge config | `@sentry/browser`, loaded on demand | Avoided changing the build config before the demo. We get no server capture or source maps |
| Mobile extras | RevenueCat, PostHog, i18n, OTA updates, `@sentry/react-native`, TanStack Query | None | Out of scope for a 10-day habit experiment. Mobile has no error reporting at all |
| Logging | `pino` with a shared wrapper | Python `logging`, one JSON line per request | Different runtime. Same idea, without their redaction wrapper |
| Session logs | `SessionEnd` hook, its own `log-session.py` | `UserPromptSubmit` and `Stop`, the 8x guide's script with one reading change | 8x asked us to match the guide's format, so `docs/agent-logging-setup.md` wins here. **Worth confirming with 8x** which one they score |

## Scripts and checks

| Check | Template | Ours |
|---|---|---|
| Commit message check | Hook and CI job | None. Conventional Commits by convention only |
| Secret scan | `pre-commit` hook and CI | None. We rely on the rules in `docs/rules/secrets.md` |
| Lint strictness | One root ESLint config, `--max-warnings=0`, `no-explicit-any` and `no-console` as errors | Per-workspace configs on framework defaults |
| Format check | Prettier, `format:check` | No Prettier config |
| Env check | `check:env`, with a Zod env schema | None on web. Pydantic settings on the backend |
| Standards gate | `check:standards` | None |
| RLS check | `check:rls` | None. Disposable-database scripts for individual migrations |
| Migrations in CI | A Postgres service job | Not in CI. Those scripts are run by hand |
| TypeScript extras | `noUncheckedIndexedAccess`, `noImplicitOverride` | Not set |
| AI review | `claude-code-review.yml` | None |
| Ours only | | Browser suite in CI, `contract:check`, `brand:check`, `logs:check`, `pytest` |

## What we'd adopt after the demo

**Updated 4 Nov:** items 1, 2 (`--max-warnings=0` only) and 4 are being adopted in CI ahead of the demos, and item 3 stays after the demo, as [ADR 12](adr/0012-ci-discipline-no-prettier.md) explains. The rest happens after the freeze. In order, smallest and safest first:

1. **Secret scan and commit-message hooks, plus their CI job.** This repo's logs are public, and a scan is the safety net for the rule that matters most.
2. **`--max-warnings=0` and `no-explicit-any` as errors.** Expect some cleanup first.
3. **Prettier with `format:check`.** A one-time formatting commit that touches most files, so agree a quiet moment with Shakeb first.
4. **Migration scripts in CI,** using a Postgres service job as the template does. This is what would have caught the `ai_calls` grants, if it models Supabase's default privileges.
5. **The missing core rule files:** `code-quality`, `commits`, `deployment`, `logging`, `migrations`, `pull-requests`.
6. **Audit with `check:standards --root`** against this repo, once someone has read the script. It would replace this table's reading with a real result.
7. **Shared `Card`, `Input` and `EmptyState` on web, and split `src/ui.tsx` on mobile.** This also clears the red alert box repeated across 10 files.
8. **A contrast test on our brand tokens,** taken from the template's approach.
9. **`noUncheckedIndexedAccess`.** Valuable, but it will surface many type errors.

## What we wouldn't adopt

- **Prisma and Next.js API routes:** a rewrite of the backend, for no user-facing gain.
- **Automatic migration deploys:** they conflict with the pair rule while two people share one database.
- **RevenueCat, i18n, NativeWind:** nothing here needs them.
- **Moving `frontend/` to `apps/web`:** only worth doing as part of a larger restructure.
