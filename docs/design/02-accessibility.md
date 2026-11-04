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

## Re-audit: PR 3, mobile demo path

Run on 4 Nov 2026 with `/design:accessibility-review`, from source, the existing `accessibility.test.tsx` audit, and Expo web at 390px in both modes.

**Fixed from the first audit:** A1 (edges now `control`), A7 and A8 (measured on Expo web: one filled primary per screen, each fits its words), A11 (new motion uses `ReduceMotion.System`), A12 (actions have a press state and scale).

**Found and fixed in this pass:** suggestion chips were 44pt; they're now 48pt, the app's own rule. Disabled actions no longer fade their words.

**Still not checked:** VoiceOver and TalkBack; anything on a real device, including Reanimated motion and Reduce Motion (no simulator on this Mac). See the iPhone list in the PR.

## Re-audit: PR 4, remaining screens

Run on 4 Nov 2026 with `/design:accessibility-review`. Web: the same browser measurement rules on demo and history (`design-rules.spec.ts`). Mobile: `accessibility.test.tsx` and Expo web at 390px.

**Fixed:** demo and history button edges, faint secondaries on sample controls, and "discovery" removed. Being offline is now a polite notice on the warning colour, not an error.

**Found while building:** on the mobile Lab Report and proposal, renaming a button to "Back to your lab" gave it the same name as the back link above it, so a screen reader couldn't tell them apart. It stays "Go to your lab" there.

**Still not checked:** screen readers and real devices.

## Mobile audit: round 1 (light and dark)

Run on 4 Nov 2026 with `/design:accessibility-review`, before the mobile readability work. Standard: WCAG 2.1 AA, plus our own 48pt target rule.

| Checked | How | Evidence level |
|---|---|---|
| Token contrast, both modes | Computed from `packages/brand/src/tokens.json` | **Measured** |
| Roles, names, targets | `accessibility.test.tsx` and `design-rules.test.tsx`: 45 tests pass on the current screens | **Measured, in tests** |
| Clipping, hierarchy, broken controls | Nazmul's iPhone, round 1 | **Seen on a device, by one person** |
| Layout causes, dark mode behaviour | Reading `apps/mobile/src` | **Source review** |
| Screens rendered in dark | Not done for this audit; Expo web screenshots come with each PR | **Not done** |
| VoiceOver, Dynamic Type, Reduce Motion, keyboard on a device | No simulator: this Mac has Command Line Tools only | **Not done. Goes on each PR's iPhone list** |

**Critical: 0. Major: 6. Minor: 5.** Colour tokens pass. What's failing is how they're used, and text that gets cut off.

### Perceivable

| # | Issue | WCAG | Severity | Where | Fix |
|---|---|---|---|---|---|
| M1 | Text is clipped: "This can take…" and the step label. Likely cause, unconfirmed: `body` sets `flexShrink: 1` on every `Text`, so text can shrink inside a limited parent instead of growing | 1.4.4 | 🟡 Major | `ui.tsx`, `proposal.tsx`, `rails.tsx` | Remove the shrink from `Copy`, and allow it only in rows that wrap. Confirm on the iPhone |
| M2 | The time picker hard-codes `themeVariant="light"` but takes its text colour from the theme. In dark mode that asks for light text on a light spinner, and the picker doesn't match the screen | 1.4.3 | 🟡 Major | `time-field.tsx` | Pass the current mode |
| M3 | The disabled primary is `surface` on `background` with a `border` edge of 1.31:1 (1.55:1 in dark), so it nearly vanishes. WCAG exempts disabled controls, but people can't find the next step | Exempt; R5 | 🟡 Major | `ui.tsx` | `accent-tint` fill, `muted` text (4.93:1 light, 6.15:1 dark), no edge, and a line saying what unlocks it. Not `muted` on `border`, which is only 4.11:1 in light |
| M4 | Main content in `muted`. It passes (5.37:1 and 8.26:1), but when everything is secondary nothing leads | Passes; R1 | 🟡 Major | Proposal, guess, Today, report | `text` for anything you need to act. `muted` only for captions and metadata |
| M5 | Selected day uses `sun` as its only ring: 1.51:1 on light. Still open from A5 | 1.4.11 | 🟢 Minor | `progress.tsx` | `text` ring, with the sun inside it |
| M6 | Past and upcoming days differ by a `line` edge at 1.31:1, with solid or dashed as the only other cue | 1.4.11 | 🟢 Minor | `checkin.tsx`, saved screen | Use `control` for the edge. The spoken name already says logged or not |

### Operable

| # | Issue | WCAG | Severity | Where | Fix |
|---|---|---|---|---|---|
| M7 | Nothing keeps the action on screen: on long steps it's below the fold, and only onboarding has `KeyboardAvoidingView` | 2.4.3 | 🟡 Major | All flows | `StickyAction` in `Frame`, with the keyboard handled once, for every flow |
| M8 | Hours asleep uses two long buttons, and nothing tells a screen reader it's one adjustable value | 4.1.2 | 🟢 Minor | `onboarding.tsx` | `Stepper`: role `adjustable`, increment and decrement actions, 48pt buttons that keep today's spoken names |
| M9 | Sections are only reachable through a menu | 2.4.5 advisory | 🟢 Minor | `app-header.tsx` | Tab bar with role `tablist`, each `tab` with selected state. Five tabs at 390 wide leave 78pt each, so labels may cap at 1.3× with the icon and the spoken name as the equivalent; everything else keeps scaling |

### Understandable

| # | Issue | WCAG | Severity | Where | Fix |
|---|---|---|---|---|---|
| M10 | "Enter both times." is shown and announced before anyone has touched the screen | 3.3.1 | 🟡 Major | `onboarding.tsx` | Say nothing until both are set; the disabled action carries a hint |
| M11 | Six "Change …" buttons announce the same action, and the value is separate from its button | 2.4.6 | 🟢 Minor | `onboarding.tsx` | `FormRow`: one button per row, spoken as "Sleep, 23:00 to 07:00" with the hint "Change" |

### Rules for what's new

| New thing | Must do |
|---|---|
| Celebration | Tap to skip. Nothing shown only there: Today has the same facts afterwards. Reduce Motion gets a still version. With VoiceOver on, it announces, moves focus and **waits for a tap instead of closing by itself** (2.2.1). The haptic is extra, never the only signal |
| Coach marks | Skippable from every step, focus moves to the mark, works with large text, never blocks Skip |
| "Why?" and "More" | Role `button`, `expanded` state, 48pt, opens in place |
| Sticky action | Never covers an input with the keyboard open. At large text the label wraps |

### Colour contrast: pairs this work relies on

| Pair | Needs | Light | Dark |
|---|---:|---:|---:|
| text on background | 4.5 | 14.35 | 15.81 |
| muted on background | 4.5 | 5.37 | 8.26 |
| muted on surface | 4.5 | 5.85 | 7.46 |
| text on accent-tint | 4.5 | 13.17 | 11.76 |
| accent on background | 4.5 | 5.68 | 8.87 |
| control on background (row and stepper edges) | 3 | 3.59 | 4.68 |
| control on surface | 3 | 3.92 | 4.23 |
| border on background (dividers only) | none | 1.31 | 1.55 |
| marker on background (never alone) | 3 | 1.51 ❌ | 10.82 |

`marker` is the sun in the celebration. In light mode it needs a `text` outline, as `05-design-system.md` already requires.

### Priority fixes

1. **M1 clipped text and M7 the sticky action:** the two that make screens look broken on the demo path.
2. **M3, M4, M10:** what to read and what to tap, which is what Nazmul asked about.
3. **M2 dark time picker:** one line, in the first setup step.
4. **The rest** come along with `FormRow`, `Stepper` and the tab bar.
