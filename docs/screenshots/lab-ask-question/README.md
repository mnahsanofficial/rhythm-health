# Ask directly from Your lab

Requested by Shakeb in the Oct 29 call. The signed-in home page now uses the same question form and proposal → prediction → save → start flow as `/experiments/new`. The active experiment summary can be restored with Close question; today's check-in and the timeline remain available while the form is open. Accounts without a profile still get the setup action.

All captures use isolated fake Supabase auth and API responses from the typed frontend fixtures. No real model calls or writes to the shared project were made. The mock start returns day 1 of 10; these screenshots are not real account records.

## Final layout

Selected by Nazmul, then refined to keep the action at the top: **Test another habit** has a moss-green fill and paper text, aligned to the right of “Day X of N” within the experiment column. It is not pushed to the far edge of the page. It replaces the day/question/intervention summary in that same top area with the shared question form. **Close question** restores the summary. Today’s check-in and the timeline stay available in both views. The compact active-lab form omits the starter sidebar; the empty lab and dedicated question page retain it. Opening focuses the field, closing restores focus to the button, and the draft survives closing/reopening. There is no reveal animation to delay interaction; the native button uses the existing transform press feedback and reduced-motion rule.

| Width | No active experiment | Active lab | Question opened in place | Proposal from home |
|---|---|---|---|---|
| 390 | [Form](390/no-experiment.png) | [Lab](390/active-lab.png) | [Question](390/active-question.png) | [Preview](390/preview.png) |
| 768 | [Form](768/no-experiment.png) | [Lab](768/active-lab.png) | [Question](768/active-question.png) | [Preview](768/preview.png) |
| 1440 | [Form](1440/no-experiment.png) | [Lab](1440/active-lab.png) | [Question](1440/active-question.png) | [Preview](1440/preview.png) |

The earlier bottom-of-page disclosure and inline comparison were discarded. These are the selected design's screenshots only.

## Temporary backend limit

The current backend still allows only one active experiment (PRD §5.3; TRD §27, §34). `/propose` itself does not enforce that limit, so the frontend must check before spending money.

- The shared `ExperimentFlow` calls `findCreationBlocker()` before proposing and again before saving. Lookup failure stops the paid request and offers Retry.
- Home passes its already loaded active experiment so opening the form immediately explains the limit and disables submission. The submit handler also rejects a blocked submission.
- When Shakeb lifts the limit, remove the temporary blocker checks and notice/disabled state from this shared flow. Proposal, forecast, save and start need no new endpoint.
- The home dashboard currently selects the first active experiment. Showing several simultaneously needs a separate dashboard list/selection change. Confirm the backend start route and database unique index both permit several before changing the frontend limit. Keep 409 handling for server conflicts.

## Test evidence

Before product changes, the home behavior tests reported **7 failed, 8 passed**: the missing question textbox and Test another habit control caused the failures. No import/setup failure was counted as the red proof.

The top-area refinement first failed because the button followed the experiment summary. The next browser regression first failed because the action was 51px above the day and had a transparent background; it now verifies same-row alignment, containment in the experiment column, and the green/light colour pair. The behavior regression also checks that the form replaces the summary, retains today’s check-in and the timeline, omits the starter sidebar, and restores the summary on close.

The new behavior tests cover native 5–500-character validation and counter, whitespace, the shared proposal/save/start payloads and ordering, retaining the active check-in, draft preservation and focus, active-experiment blocking (including a new experiment started elsewhere), and retry after an active lookup failure. Browser tests add pending prediction, service failure/retry, normal/reduced motion and mobile/tablet/desktop layouts.

Recreate captures with `CAPTURE_LAB_ASK=1 npm run test:e2e -- tests/e2e/lab-ask-question.spec.ts` from `frontend/`. These are visual evidence, not snapshot tests.

## Verification

- `npm test`: 106 passed across 20 files.
- Post-main handover on 2026-10-30, product code `bd0faa9` with main `7685a89` included: full `npm run test:e2e` passed 66 tests with one existing skipped keyboard/time-input test. No new skips. Normal/reduced motion at 390, 768 and 1440px and the full layout-width matrix passed.
- Button alignment/fill refinement: 13 browser checks passed for home, the shared question flow and the full layout-width matrix; 106 unit tests, lint and typecheck also passed.
- `npm run lint` and `npm run typecheck`: passed.
- Post-main production build, with fake frontend test variables: passed, all 12 pages generated. Lint, typecheck and all 106 unit tests also passed again. Separate browser inspection of home and `/experiments/new` at 390, 768 and 1440px found no page errors or hydration warnings.
- Browser inspection: 390, 768 and 1440px, with normal and reduced motion. The broader layout suite also passed from 320 through 2560px and at 200% zoom.
- Paid AI calls: 0. Shared Supabase writes: 0.

The remaining skipped test predates this change: Chromium keyboard input leaves onboarding's time fields empty. This feature's keyboard open/close/focus and draft-preservation checks pass.
