# 5. Design system proposal

Skill: `/design:design-system`. Built from `04-synthesis.md`. Date: 4 Nov 2026. **Proposal: not built yet.** All values go in `packages/brand/src/tokens.json`, then `npm run brand:generate`.

The identity stays: Fraunces, Instrument Sans and Geist Mono; moss, night, oat and sun; "a day's light".

## Colour

Two themes under `themes.light` and `themes.dark`. **Light is today's palette**, so the light app keeps its look, except for the new `control` border and `warning`. **Dark is night**: built from the `night` blue hue rather than grey, with moss and sun lifted to stay readable.

| Token | Role | Light | Dark |
|---|---|---|---|
| `background` | Page | `#f6f3ec` oat | `#10161f` |
| `surface` | Cards, inputs | `#fffdf8` paper | `#18202b` |
| `raised` | Menus, things above a surface | `#ffffff` | `#212b38` |
| `text` | Main text | `#1b2421` ink | `#eef0ea` |
| `muted` | Secondary text | `#5c6661` | `#a8b1ad` |
| `border` | Dividers only | `#dcd6ca` line | `#2e3945` |
| `control` | **New.** Edges of inputs and choices | `#857f72` | `#76838f` |
| `accent` | The primary action, links, focus | `#2f6b4f` moss | `#7cc4a0` |
| `accent-press` | Primary hover and press | `#24563f` | `#94d2b2` |
| `on-accent` | **New.** Text on `accent` and chart fills | `#fffdf8` | `#0e1a15` |
| `accent-tint` | Soft decision backgrounds | `#e3ece5` | `#1c3329` |
| `success` / `success-tint` | Saved, likely signal | `#2f6b4f` / `#e3ece5` | `#8fd0b0` / `#1c3329` |
| `warning` / `warning-tint` | **New.** Offline, partial states | `#7a5200` / `#f8eccd` | `#e8c068` / `#3a2f14` |
| `danger` / `danger-tint` | Errors, was clay | `#7a2e1f` / `#f7e4df` | `#f0a595` / `#3c1f19` |
| `night-text` / `night-tint` | Forecast panels | `#263a6b` / `#e4e7f0` | `#b4c4ee` / `#222d47` |
| `chart-1` | Baseline, predicted range | `#263a6b` | `#9db2ea` |
| `chart-2` | Test days | `#2f6b4f` | `#7cc4a0` |
| `chart-3` | Third series | `#a8741a` | `#e8c068` |
| `chart-band` | Predicted band | `#e4e7f0` | `#26324d` |
| `marker` | Daylight marker, never text | `#f2c14e` | `#f2c14e` |

**Illustration colours** (the landing scene's sky, skin, furniture) stay fixed in both modes. The scene already runs from day to night.

### WCAG AA: computed, both modes

Every pair below passes. Script output on 4 Nov; it becomes a `brand` unit test in PR 1, so a token change can't quietly fail AA.

| Pair | Needs | Light | Dark |
|---|---:|---:|---:|
| text on background / surface / raised | 4.5 | 14.35 / 15.64 / 15.90 | 15.81 / 14.28 / 12.46 |
| muted on background / surface / raised | 4.5 | 5.37 / 5.85 / 5.95 | 8.26 / 7.46 / 6.51 |
| muted on accent-tint / night-tint | 4.5 | 4.93 / 4.81 | 6.15 / 6.23 |
| muted on danger-tint | 4.5 | 4.85 | 6.82 |
| accent as text on background / surface / accent-tint | 4.5 | 5.68 / 6.19 / 5.21 | 8.87 / 8.01 / 6.60 |
| on-accent on accent / accent-press | 4.5 | 6.19 / 8.34 | 8.72 / 10.30 |
| on-accent on chart-1 fill | 4.5 | 10.87 | 8.49 |
| night-text on night-tint / surface | 4.5 | 8.94 / 10.87 | 7.87 / 9.43 |
| success on success-tint | 4.5 | 5.21 | 7.60 |
| warning on warning-tint / background | 4.5 | 5.89 / 6.24 | 7.62 / 10.52 |
| danger on danger-tint / background / surface | 4.5 | 7.65 / 8.47 / 9.23 | 7.50 / 9.10 / 8.22 |
| control on background / surface / raised | 3 | 3.59 / 3.92 / 3.98 | 4.68 / 4.23 / 3.69 |
| chart-1 on surface | 3 | 10.87 | 7.80 |
| chart-2 on surface | 3 | 6.19 | 8.01 |
| chart-3 on surface | 3 | 3.99 | 9.51 |

`marker` is 1.51:1 on light `background`, so it must always sit with an `ink` or `text` ring and can't be the only cue. `border` is deliberately faint and is only for dividers, never the edge of a control.

## Type

| Role | Token | Web | Native | Font |
|---|---|---|---|---|
| Display | `display` | 44–72 (was 44–60; applied with the landing page in PR 2) | 44 | Fraunces |
| Display, small | `display-sm` | 36–44 | 36 | Fraunces |
| Heading | `headline` | 28–32 | 28 | Fraunces |
| Section title | `title` | 22–24 | 22 | Fraunces |
| Lead | `lead` | 18 | 18 | Instrument Sans |
| Body | `body` | 16 | 16 | Instrument Sans |
| Caption | `caption` | 14 | 14 | Instrument Sans |
| Numbers | any size | Same size | Same size | Geist Mono, tabular |

One size change, the display maximum. The confidence comes from using these better: one display heading per screen, then a real step down. Native text scales with the system setting.

## Spacing, radii, elevation

**Spacing:** existing `xs 4, sm 8, md 16, lg 24, xl 32, xxl 48`, plus `section 64` for gaps between page sections.

**Radii:** `card 20`, `pill 999`, plus **`control 14`** for inputs and scale buttons. Inputs at 20 look like bubbles (`judgement`).

**Elevation:** by surface, not shadow.

| Level | Treatment | Use |
|---|---|---|
| 0 | `background` | Page, rows, sections |
| 1 | `surface` + 1px `border` | A decision or a comparison |
| 2 | `raised` + 1px `border` | Pinned bars, popovers |
| 3 | `raised` + `shadow-float`; in dark, the border alone | Menus only |

`shadow-float` is the only shadow token.

## Buttons

| Rule | Detail |
|---|---|
| Height | At least 48pt everywhere (`LAYOUT.primaryAction`) |
| Web and tablet | Fits its content, up to `button-max: 320`. Never fills a wide column |
| Phone (under 640 wide) | Full width for the primary pinned at the bottom, a form's submit, and the phone landing's main action. Anything else fits its content. *Changed after the iPhone check on 4 Nov: a fitted submit under full-width fields looked unfinished* |
| Per screen | One `primary` (filled accent). All others are `secondary` (outline in `control`) or `quiet` (text) |
| Labels | Three words or fewer where possible; see `03-ux-copy.md` |
| States | Default, hover, press (scale 0.98, `press`), focus ring, busy (label changes and stays disabled), disabled (surface fill and muted text, not faded accent) |

**Choices aren't buttons.** Yes / Not today, scale numbers and answer rows are selections, so they may fill their row. They're how the check-in stays quick to tap.

Screens with a second filled button today:

| Screen | Stays primary | Becomes |
|---|---|---|
| Today | Check in | "Test another habit" → `secondary` |
| Lab Report | Reveal my result, until revealed. Then Write my report | The other one is `secondary` while the first is the next step |

## Motion

Web uses `motion/react`, mobile uses `react-native-reanimated`, and times come from `MOTION_DURATION_MS`. All use `--ease-settle`. Transform and opacity only. **No new duration tokens.**

| Name | Purpose | Duration | Web | Mobile |
|---|---|---|---|---|
| `screen` | Keeps your place when moving between screens | `panel` 200 | 6px + fade on navigation | Same, keyed by screen in `mobile-app.tsx`, which has a single route today |
| `step` | Shows direction through a flow | In `step` 350, out `panel` 200 | Existing | New |
| `choice` | Confirms the tap landed | `press` 150 | Existing CSS | New |
| `count` | Makes real progress visible | `response` 280 | **Counts only**: days recorded, answered | Same |
| `shape` | The panel builds from your answers | Each part `response` 280, complete `reveal` 480 | Existing ring, plus proposal days | New |
| `success` | Marks a saved check-in | `response` 280 | Tick and today's marker | New |
| `reveal` (kept) | Prediction versus reality | `reveal` 480 | Existing | Move from `Animated` |

**Never animated through values:** predictions, measured change, accuracy, or any health estimate. They appear at their final value (`docs/rules/ui-motion.md`).

**Reduced motion:** final state immediately, opacity at most, controls available throughout. Web uses `useReducedMotion()` and media queries, as now. Mobile uses Reanimated's `useReducedMotion()` through a shared hook. Both get tests.

**Reanimated:** `react-native-reanimated` 4.7.1 and `react-native-worklets` 0.13.0 are the versions Expo 58 pins in `bundledNativeModules.json`. Reanimated is only there transitively today, so it becomes a direct dependency, and the PR says "restart Metro with --clear". Confirm the Babel setup and Expo Go support against current docs in PR 1, before relying on it.

## Theme switching

- **Default:** follows the system. **Choices:** Light, Dark, System. **Remembered per device**, not per account: no backend change.
- **Web:** the choice goes in `localStorage`. A small inline script in `<head>` sets `data-theme` before first paint, so there's no flash, and semantic tokens are CSS variables that switch on it. `themeColor` follows, and `color-scheme` is set so form controls match. Check `frontend/node_modules/next/dist/docs/` first, as our Next version differs.
- **Mobile:** `ThemeProvider` reads `useColorScheme` and the saved choice in `expo-secure-store`, already a dependency, with no new storage package. `StatusBar` follows. Screens use `useTheme()` and `useThemedStyles()`.
- **Where:** web header button for everyone, opening a small menu. Mobile has the full control in the account menu, and a button in the header before sign-in. *Changed while building: one place on each platform, so it isn't repeated on a screen.*

**Migration, so that no merge leaves a half-themed app:**
- **Web:** existing Tailwind names keep working as aliases (`bg-oat` resolves to `background`), so all screens theme at once without touching files Shakeb may be editing. `text-paper` on moss is the one exception: 31 uses move to `text-on-accent`, because `paper` becomes a dark surface in dark mode.
- **Mobile:** 194 `COLORS` uses in 20 files, plus shared `styles` used by 23 files, are read at import, so they can't react to a theme. PR 1 converts them mechanically to `useThemedStyles`: colour only, no layout. The default context is light, so tests can render without a provider.

## Components

| Component | Web | Mobile | Used on |
|---|---|---|---|
| `Button` (primary, secondary, quiet) | **New** shared | Restyle `Action` | All |
| `PinnedAction` | Restyle existing bar | **New** | Check-in, onboarding, proposal on phones |
| `ThemeControl` | **New** | **New** | Header, account panel, Settings |
| `StepRail` | **New**, replaces progress bar | **New** | Onboarding, proposal |
| `TakingShapePanel` | Restyle "Your rhythm so far" | **New** | Onboarding, proposal |
| `SuggestionChips` | **New**, moves "Start with a hunch" under the field. **Same strings as now, no new health content** | **New** (uses `EXAMPLES`) | Ask a question |
| `DayTrack` | Restyle timeline | Restyle `progress` | Today, experiment |
| `ChoiceRow`, `ScaleInput` | Restyle with `control` | Same | Check-in, onboarding |
| `TextField` | Restyle with `control`, `control` radius | Same | Sign-in, ask, note |
| `Notice` (error, warning, offline) | Restyle alerts | Restyle `Alert` | All |
| `Skeleton` | Theme existing | Theme existing | All |
| `ChartTheme` | Theme `day-chart`, ring | Same | Report, onboarding |
| `CountUp` | **New** | **New** | Today, check-in |

## Screens, in order

**Demo path:** 1 Landing, 2 Sign-in, 3 Onboarding, 4 Today, 5 Proposal (ask, waiting, plan), 6 Check-in, 7 Lab Report.

**After:** 8 Experiment detail, 9 History, 10 Demo entry, 11 Combined check-in, 12 Settings (mobile), 13 Finish, and any remaining empty states.

Each has loading, empty, error and offline designed in both modes.

## Professional review

I reviewed this proposal against the audit and our rules, and changed three things:

| Checked | Result |
|---|---|
| Is there a separate "accent text" colour? | Removed it. `accent` passes as text everywhere it's used, so a second token only added work |
| Does a shadow scale fit "no decorative shadows"? | Cut to one token, for menus only |
| Do new durations help? | None added. All six motions fit existing tokens |

Risks left, none resolved by this document:

| Risk | Level | Handling |
|---|---|---|
| The demo machine or phone may be in dark mode, so dark gets seen first | High | Rehearse in both. Set the toggle before going on stage |
| PR 1's mechanical mobile change touches every screen a day before the demo | High | Colour only; full mobile tests and an iPhone check before asking for review. If it fails on device, only the theme PR is reverted |
| No simulator here, so native animation and pinned bars are unverified until someone runs them on an iPhone | High | iPhone checklist in each PR. **Needs Nazmul or Shakeb's phone** |
| A pinned bar on native must not hide fields under the keyboard | Med | Keep `KeyboardAvoidingView`; specific iPhone check |
| Copy changes break tests that find buttons by name | Med | Update in the same commit, and say so in the PR |
| A screen transition could shift focus or slow the browser suite | Med | Web transition on content only; focus rules unchanged; full suite on each PR |
| Dark colours were chosen by contrast maths, not seen on screen | Med | Screenshots in PR 1 may change them; any change re-runs the AA test |
| `DESIGN.md` says no global page entrance effects | Low | `screen` is a narrow exception on navigation. PR 1 updates `DESIGN.md` and `ui-motion.md`, including count-up rules |

Not checked: the Kept reference by eye, real users, and native rendering.

## Mobile rules (added after round 1)

Skill: `/design:design-system`. Added 4 Nov 2026. **These apply to `apps/mobile`; the web is frozen.** They add to the rules above and replace them where they conflict, which the "Changes" table lists. Values come from `@rhythm-health/brand`. Components are new or restyled in `apps/mobile/src`.

### Type hierarchy

A screen reads in this order, and no two levels look the same.

| Level | Style | Colour | Rule |
|---|---|---|---|
| 1. Heading | `headline` 28, Fraunces | `text` | One per screen. Replaces `display-sm` 36 in flows, where questions wrap to three or four lines |
| 2. Guidance | `body` 16, Instrument Sans | `text` | One short line. Not grey: it's what to do |
| 3. Section title | `title` 22, Fraunces | `text` | Only on screens with more than one section |
| 4. Value or answer | `lead` 18 or `body` medium | `text` | What you came to read |
| 5. Caption | `caption` 14 | `muted` | Metadata only: times and units |
| Numbers | Same size as the level, Geist Mono | `text` | **Not green by default.** Green means you can tap it |

Rules that follow:
- `muted` never carries something you need in order to act.
- `accent` as text only for links. No green eyebrows, no green monospace on controls.
- No eyebrow above the heading unless you need it, such as "Example".
- Text never clips. `Copy` doesn't shrink, and rows wrap.

### Form rows

`FormRow`: **icon, label, value, chevron**. It's one button, used on review and settings. This is how a list of six things stops being six buttons.

| Part | Spec |
|---|---|
| Height | At least 48pt, grows with text |
| Icon | 24pt, in `text`, from our own `Icon` set (`react-native-svg`, no new dependency). Hidden from screen readers |
| Label | `body`, `text` |
| Value | `body`, `muted` when empty ("Choose"), `text` when set. Wraps under the label at large text instead of clipping |
| Chevron | `muted`. Only when tapping goes somewhere; a `Switch` takes its place for on and off |
| Edge | `surface` fill and `control` edge with `control` radius; or grouped in one card with `border` dividers |
| Spoken | "Sleep, 23:00 to 07:00", role `button`, hint "Change" |
| States | Pressed: `accent-tint`. Disabled while saving |

Variants share the layout. `TimeRow` opens the native picker in a sheet and follows the current mode. `Stepper` is label, − value +, with 48pt round buttons, role `adjustable`, and increment and decrement actions.

**Errors appear after interaction.** Until someone has touched a field, a disabled action with a hint is enough.

### Sticky bottom action

`StickyAction` is the one primary action in a flow. It sits outside the scroller, so content can't push it off screen.

| Rule | Detail |
|---|---|
| Structure | `Frame` is header, scroller, then footer, all inside one `KeyboardAvoidingView`. A screen fills the footer through context; it doesn't lay itself out |
| Keyboard | `behavior="padding"` on iOS; Android resizes the window itself. `keyboardShouldPersistTaps="handled"`, so the first tap on the action works. The tab bar and bottom inset step aside while the keyboard is open |
| Safe area | Footer pads to the bottom inset, and drops it while the keyboard is open |
| Look | `background` fill, `border` top edge, full-width button |
| Secondary | "Previous" and the like go beside it, or as a quiet link above it. Never two filled buttons |
| Disabled | `accent-tint` fill, `muted` text, and a caption above saying what unlocks it |
| On tab screens | Ask only, above the tab bar, because typing there is the start of a flow. Elsewhere the action sits in a card and the tab bar owns the bottom |

### Tab bar

Today, Progress, **Ask** (centre), History, You.

| Rule | Detail |
|---|---|
| Height | At least 56pt plus the bottom inset. Each tab at least 48pt tall |
| Tab | Icon 24pt, label `caption`. Selected: `accent` icon and label, medium weight, plus a filled icon. Colour is never the only cue |
| Ask | Same size as the others, in a filled `accent` circle. It doesn't float above the bar, and doesn't count as the screen's primary |
| Shown on | The five tab screens. **Hidden in flows** (setup, check-in, guess, plan, celebration): a flow has its own sticky action and × |
| Moves to You | Account, Update your rhythm, Daily reminders, theme, See an example, Sign out. The header keeps only the logo, and the × in flows |
| Spoken | Role `tablist`, each `tab` with selected state. Label may cap at 1.3× text; the icon and spoken name stay |

### Celebration

Full screen, after saving a check-in. It's the third signature moment, after the rhythm ring and prediction versus reality.

| Part | Spec |
|---|---|
| Picture | The rhythm ring, drawn large. The sun (light) or moon (dark) rises along it to the share of days recorded. In light mode the sun has a `text` outline |
| Words | "Day 4 recorded", then "6 days left". Counts come from the server's refreshed progress: if it isn't back yet, show only the day |
| Background | Solid, from our own tokens. No confetti, no thumbs, nothing borrowed |
| Several experiments | One check-in for several says "2 check-ins recorded" and each one's day. The marker follows the first listed, as decoration; the words carry the facts |
| Updating | The same celebration as saving |
| Sample | Says "Example" |
| Haptic | `expo-haptics` light impact, once, when the screen appears. Ignores failure |
| Time | `reveal` 480 for the rise, held to 2 seconds in total, then Today. Needs **one new token, `celebration: 2000`**, which reverses "no new duration tokens" and adds one unused variable to the generated web CSS, with no visible web change |
| Tap | Anywhere skips |
| Reduce Motion | Still ring at its final position, words at once, same 2 seconds |
| VoiceOver | Announces the words, moves focus there, and waits for a tap |
| Honest | The same for every saved day: never bigger for a good answer, because that would nudge the data |

### Disclosure

`Disclosure` ("Why?" or "More"): a quiet text button with a chevron that opens in place, closed by default. The chevron rotates over `press`. No height animation, per `ui-motion.md`.

### Changes to the rules above, for mobile

| Rule above | On mobile now |
|---|---|
| Heading `display-sm` in flows | `headline` |
| Disabled: surface fill and muted text | `accent-tint` fill and muted text |
| Sections in the account menu | Tab bar, and You |
| "No new duration tokens" | One: `celebration` |
| "Your lab" (`03-ux-copy.md`) | "Today" on the phone |

### Risks

| Risk | Level | Handling |
|---|---|---|
| Keyboard behaviour can't be tested here: no simulator, and Expo web has no keyboard | High | First item on every iPhone list. Tests cover structure only |
| Moving screens into tabs touches `today.tsx`'s navigation state, including the paid proposal that must stay mounted | High | Tests first. The existing "stays mounted" tests must keep passing untouched |
| Tests look up the strings being cut | Med | Update them with each screen, and say so in the PR |
| Five tabs at 320 wide with large text | Med | Test at 320; capped label |

### Onboarding template

One layout for every step. From the top: header, progress bar with "2 of 7 · Sleep", scene, question, one line, controls, sticky action.

| Rule | Detail |
|---|---|
| Pinned | The bar and scene sit above the scroller (`PinnedTop`), so nothing covers them. The scene steps aside while the keyboard is open |
| Scene height | 35% of the screen on start and hours, 33% on age, 30% on the rest, 22% on Limits, 17% on Review, and 24% on phones under 700 high. Never over a third on Review |
| Fit | No scrolling on an 844-high iPhone, status bar and home area included, except Goals and Habits. Measured with `PHONE_INSETS=1` |
| Space | Controls centre in what's left, so a short step has no gap at the bottom |
| Scroll padding | The sticky bar floats over the scroller, and the content's bottom padding equals its measured height. This holds on every screen |
| Copy | Continue on every step, also when editing. "Save my rhythm" only on Review. One line under each question |
| Scene | Drawn with `react-native-svg` in tokens, hidden from screen readers. Every fact is also in words |
| Morph | Layers crossfade in place. The ring stays on across Sleep, Hours and Review, so its arc changes rather than swaps |
| Motion | The question slides over `step` (350), the right way round. The bar fills over `step`. The scene follows an answer over `response` (280). Choices scale over `press`, with a light haptic |
| Reduce Motion | Everything is simply there, with no movement |

Hour labels on the ring don't grow with text size, because the picture has a fixed shape. The rows and values below do, and carry the same facts.
