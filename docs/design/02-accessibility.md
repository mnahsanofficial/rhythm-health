# 2. Accessibility audit

Skill: `/design:accessibility-review`. Standard: WCAG 2.1 AA. Date: 4 Nov 2026.

## What this covers, and what it doesn't

| Surface | How it was checked | Evidence level |
|---|---|---|
| Web, 390px and 1440px | Script run in the browser against the app with mocked API data: every text colour pair, every control's size, heading sizes, labels and names. Screens: landing, sign-in, onboarding (start, step, summary), empty home, Today, ask a question, experiment, check-in, Lab Report, history, demo. Plus looking at the screenshots | **Measured** |
| Web keyboard | Tab walk on one onboarding step only | **Measured, one screen** |
| Mobile | Reading `apps/mobile/src`, plus saved Expo-web screenshots from 31 Oct onward in `docs/screenshots/mobile-*` | **Source review. Not run on a device** |
| iOS simulator | Not available: this Mac has Command Line Tools only, no Xcode | **Not done** |
| VoiceOver, TalkBack, NVDA | Not run | **Not done** |
| Kept screenshots | They didn't reach this session: no image in the request and no file in the repo | **Not done** |

## Summary

**Critical: 0. Major: 6. Minor: 7.**

The good news: no text pair failed AA on any measured screen, all web controls are at least 44px, no control is missing a label or name, and at 200% zoom and all widths layout is already checked by `layout-widths.spec.ts`. The problems are mostly about boundaries, hierarchy and missing dark mode, not broken basics.

## Findings

### Perceivable

| # | Issue | WCAG | Severity | Where | Fix |
|---|---|---|---|---|---|
| A1 | Control borders are nearly invisible: `line` is 1.31:1 on `oat` and 1.42:1 on `paper`. Text inputs, choice rows and scale buttons rely on it to show they are controls | 1.4.11 | 🟡 Major | Web and mobile, all forms | A separate `border-control` token at 3:1 or more; keep `line` for dividers only |
| A2 | Landing hero text sits on a translucent card, with the moon and scene showing through at 390px. The script can't measure this, and it can vary as the scene scrolls. It also breaks our own "no glass" rule | 1.4.3 | 🟡 Major | `landing` hero | Solid `surface` behind text |
| A3 | No dark mode at all: no web `dark:` theme, no use of `useColorScheme` on mobile. 8x asked for it, and people using dark mode get a bright screen at bedtime, in a sleep app | Not a WCAG failure | 🟡 Major | Everywhere | See `05-design-system.md` |
| A4 | Rhythm ring labels are 11px at 1440px; one label is 13px | 1.4.4 advisory | 🟢 Minor | Onboarding panel | Move to `caption` or mark as decorative when the same data is written as text |
| A5 | `sun` is 1.51:1 on `oat` and 1.65:1 on `paper`, used as the selected day's ring in the timeline | 1.4.11 | 🟢 Minor | Timeline | Already paired with a shape; keep a second cue, and add an `ink` inner ring |
| A6 | Disabled primary at 40% opacity: looks washed out, and its label reads as an available option (see A9) | Exempt from 1.4.3 | 🟢 Minor | Onboarding step | Disabled style with clear contrast, and no label that invites a tap |

### Operable

| # | Issue | WCAG | Severity | Where | Fix |
|---|---|---|---|---|---|
| A7 | Several filled primary buttons on one screen compete: Today has "Test another habit" and "Check in for day 4"; the Lab Report has "Reveal my result" and "Write my report" | Not a WCAG failure; hurts scanning | 🟡 Major | Today, Lab Report, web and mobile | One filled primary per screen |
| A8 | Buttons span the column: "Create account" 795px (55% of a 1440 window), "Sign in" 448px at 1440. On mobile, 74 of 79 `Action` uses stretch to full width, including secondaries such as "Back to Today" and "Not today" | Not a WCAG failure; this is 8x's feedback | 🟡 Major | Summary, sign-in, all mobile | Button rules in `05-design-system.md` |
| A10 | Mobile: some labels cap font scaling at 1.2× (`maxFontSizeMultiplier`), reasonable for chart ticks and timeline marks. Check it hasn't spread to text people need | 1.4.4 advisory | 🟢 Minor | `day-chart`, `progress`, `proposal`, `lab-report`, `checkin` | Allow only on tick marks with a written equivalent |
| A11 | Mobile: the four files that animate (onboarding, Today, forecast, Lab Report) each check Reduce Motion themselves. New motion must use one shared hook | 2.3.3 (AAA), our own rule | 🟢 Minor | Mobile | Shared `useMotionPreference` |
| A12 | Mobile has no visible press state on some secondaries beyond a tint; there's no focus style on web-preview | 2.4.7 (preview only) | 🟢 Minor | `ui.tsx` | Press state on all `Action`s |

### Understandable

| # | Issue | WCAG | Severity | Where | Fix |
|---|---|---|---|---|---|
| A9 | On a required onboarding step the disabled button says "Skip". It can't be used, and that step can't be skipped, so the label is wrong. Optional steps do allow it | 3.3.2 | 🟡 Major | `onboarding-flow.tsx:187` | Say "Continue" when disabled. Copy-only; the step's rules don't change |
| A13 | "1 Low" and "10 High" don't line up with the ends of the scale at wide widths: "10 High" sits about 160px left of button 10. Likely the `p` 48ch cap | 1.3.1 | 🟢 Minor | Check-in at 1440px | Allow the scale's end-label row to fill the row |

### Robust

No failures measured: every input has a label and every control has a name. Native controls keep their roles (`Action` sets `accessibilityRole` and state). Screen reader output itself wasn't tested.

## Colour contrast

Current tokens, computed from `tokens.json`:

| Foreground | Background | Ratio | Needed | Pass |
|---|---|---:|---:|---|
| ink | oat | 14.35 | 4.5 | ✅ |
| muted | oat | 5.37 | 4.5 | ✅ |
| muted | paper | 5.85 | 4.5 | ✅ |
| muted | moss-tint | 4.93 | 4.5 | ✅ |
| muted | night-tint | 4.81 | 4.5 | ✅ |
| moss | oat | 5.68 | 4.5 | ✅ |
| moss | moss-tint | 5.21 | 4.5 | ✅ |
| paper | moss | 6.19 | 4.5 | ✅ |
| night | night-tint | 8.94 | 4.5 | ✅ |
| clay | clay-tint | 7.65 | 4.5 | ✅ |
| line (control border) | oat | 1.31 | 3 | ❌ A1 |
| line (control border) | paper | 1.42 | 3 | ❌ A1 |
| sun (selected-day ring) | oat | 1.51 | 3 | ❌ A5 |

## Keyboard

Onboarding step, measured with Tab:

| Element | Gets focus | Indicator |
|---|---|---|
| Radio group (arrow keys inside) | Yes, one stop | 2px outline |
| Back | Yes | 2px outline |
| Disabled button | Skipped, as expected | None |
| Skip to content, logo, Sign in | Yes, on wrap-around | 2px outline |

The rest of the keyboard paths are covered by existing behaviour tests but were not re-walked here.

## Motion

Web: `prefers-reduced-motion` is handled globally in `globals.css` and by `MotionConfig`. Landing replaces its scene with stills. Mobile: see A11.

## Priority fixes

1. **A1 control borders**: affects everyone filling in a form, worst in bright light.
2. **A8 and A7 button width and hierarchy**: 8x's direct feedback.
3. **A3 dark mode**: 8x's direct feedback.
4. **A2 hero text on a solid surface**: first screen of the demo.
5. **A9 the disabled "Skip"**: on the demo path, one-line fix.

## Re-audit: PR 1, dark mode and theme controls

Run on 4 Nov 2026 with `/design:accessibility-review`, using the same browser script in dark mode.

**Measured:** 13 web screens at 390px and 1440px in dark: no text below AA, no control under 44px, no missing label or name. All token pairs are now a unit test in `packages/brand/tests/themes.test.mjs`.

**Found and fixed in this PR:**
- Landing headline invisible in dark: text in the light illustration region inherited the dark page's light text. Fixed in `globals.css`, with a browser test.
- Mobile header: theme button floated mid-bar before sign-in.

**Theme controls:**
- Web: named button (`Theme: System`), native radios in a labelled group, Escape closes and returns focus, clicking outside closes. 44px targets.
- Mobile: radios with role, name and checked state, 48pt targets. The header button says its state and what it changes to.

**Still open, not new:** A1 (control borders), A2 (landing card), A9 (disabled "Skip"), A7 and A8 (buttons) are fixed with their screens in PR 2 and PR 3.

**Not checked:** VoiceOver and TalkBack; native rendering on a device (no simulator here, so the iPhone list in the PR covers it); text over the landing scene, which the script can't measure.

## Re-audit: PR 2, web demo path

Run on 4 Nov 2026 with `/design:accessibility-review`, on 13 screens at 390px and 1440px, light and dark.

**Fixed from the first audit:** A1 (control edges now 3:1 or more), A2 (solid landing card), A7 and A8 (one primary, buttons fit their words), A9 (no "Skip" on a required step), A13 (scale ends line up). Rules are now measured by `tests/e2e/design-rules.spec.ts`.

**Found and fixed in this pass:** disabled primary text was 4.11:1 on its fill. WCAG exempts disabled controls, but it's now 5.85:1 anyway.

**Result:** no text under AA, no target under 44px, no missing label or name, in either mode.

**Not checked:** screen readers; landing text over the moving scene is on a solid card now, so it's measured against the card.
