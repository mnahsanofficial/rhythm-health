# Docs index

**Reviewing the project?** Read these three first: [ARCHITECTURE](ARCHITECTURE.md), the [ADRs](adr/README.md), and the [feedback tracker](FEEDBACK_TRACKER.md).

## Status and decisions

| Doc | What it's for |
|---|---|
| [FEEDBACK_TRACKER.md](FEEDBACK_TRACKER.md) | Every piece of 8x feedback: status, PRs and where to see it |
| [REMAINING_WORK.md](REMAINING_WORK.md) | What's left, after-the-demo items, known risks, and where the code differs from the PRD and TRD |
| [DECISIONS.md](DECISIONS.md) | Product and scope decisions, with dates and reasons |
| [adr/](adr/README.md) | One short record per architecture decision |

## How it's built

| Doc | What it's for |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System, data model and flow diagrams, trust boundaries, failure modes, and what we'd change at 10x |
| [PROGRESS_API.md](PROGRESS_API.md) | The one source of day states, counts and the next opening |
| [MOBILE_PLAN.md](MOBILE_PLAN.md) | The mobile plan, M0 to M5, and web parity |
| [`apps/mobile/README.md`](../apps/mobile/README.md) | Running the mobile app, and how each milestone was checked |
| [ENV_SETUP.md](ENV_SETUP.md) | Every environment variable, by name, and which are secret |
| [`packages/contract/README.md`](../packages/contract/README.md) | How the shared API types are generated |
| [`packages/brand/README.md`](../packages/brand/README.md) | How the shared design tokens are generated |

## Features: contract and evidence

| Doc | What it's for |
|---|---|
| [PERSONAL_GUESS.md](PERSONAL_GUESS.md) | Your own guess, before the AI forecast, and its rollout |
| [ACTIVE_SAMPLE.md](ACTIVE_SAMPLE.md) | The labelled active sample experiment |
| [SCALE_WORDS_CHART_DAYS.md](SCALE_WORDS_CHART_DAYS.md) | Words for each end of a scale, and missed-day flags on the chart |
| [F2_F4_VERIFICATION.md](F2_F4_VERIFICATION.md) | Evidence from the 30 Oct check of the demo and early finish |
| [UI_MOTION_REVIEW.md](UI_MOTION_REVIEW.md) | The motion review, with screenshots |
| [screenshots/](screenshots/) | Screenshots for each feature PR, in light and dark where themed |

## Design

| Doc | What it's for |
|---|---|
| [`DESIGN.md`](../DESIGN.md) | Tokens, components and the "Ours, not AI-default" rules |
| [design/01-user-research.md](design/01-user-research.md) | User research |
| [design/02-accessibility.md](design/02-accessibility.md) | Accessibility audit |
| [design/03-ux-copy.md](design/03-ux-copy.md) | UX copy review |
| [design/04-synthesis.md](design/04-synthesis.md) | What the research adds up to |
| [design/05-design-system.md](design/05-design-system.md) | Design system audit |
| [design/06-product-review.md](design/06-product-review.md) | Mobile product review, with ranked findings |

## Product

| Doc | What it's for |
|---|---|
| [`PRODUCT.md`](../PRODUCT.md) | The product in a page |
| [`PRD.md`](../PRD.md), [`TRD.md`](../TRD.md) | Original requirements and technical design. They describe the plan; differences are in [REMAINING_WORK](REMAINING_WORK.md#where-the-code-differs-from-the-prd-and-trd) |

## How we work

| Doc | What it's for |
|---|---|
| [`AGENTS.md`](../AGENTS.md) | Entry point for every coding agent |
| [rules/git-workflow.md](rules/git-workflow.md) | Branches, commits, PRs and merging |
| [rules/pair-rule.md](rules/pair-rule.md) | Splitting by feature, and announcing shared-database changes |
| [rules/secrets.md](rules/secrets.md) | Where secrets live |
| [rules/api-contracts.md](rules/api-contracts.md) | How the apps and FastAPI talk |
| [rules/testing.md](rules/testing.md) | The suites, and red before green |
| [rules/ui-quality.md](rules/ui-quality.md) | States, accessibility and sample data |
| [rules/ui-motion.md](rules/ui-motion.md) | Motion rules |
| [rules/health-content.md](rules/health-content.md) | No calorie counting, weight targets or medical claims |
| [logging.md](logging.md) | How session logs work, including in a worktree |
| [agent-logging-setup.md](agent-logging-setup.md) | 8x's logging guide, saved as pasted |
| [TEMPLATE_COMPARISON.md](TEMPLATE_COMPARISON.md) | This repo against 8x's template |
