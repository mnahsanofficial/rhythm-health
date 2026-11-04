# 4. Research synthesis

Skill: `/design:research-synthesis`. Combines `01-user-research.md`, `02-accessibility.md` and `03-ux-copy.md`. Date: 4 Nov 2026.

**Participants so far: 1, the builder.** Round 1 is Nazmul testing on their own iPhone (`01-user-research.md`). The outside hallway test hasn't run. This skill's usual "X of Y" counts and user segments are left out on purpose, because one builder can't support them.

## How to read the labels

| Label | Means |
|---|---|
| **Feedback** | 8x said it in the last feedback call, as relayed by Nazmul. Not independently seen here |
| **Measured** | Computed or measured on the running web app, or from tokens, on 4 Nov |
| **Source** | Read directly in the code or our own saved screenshots |
| **Judgement** | A designer's opinion from looking at the screens. Could be wrong |
| **Assumption** | What we think users do or feel. Unproven until the hallway test answers it |
| **Round 1** | Seen by Nazmul on a real iPhone on 4 Nov. One person, who built it. Real evidence that something is broken; no evidence of how many people it affects |

## Round 1: the phone (n=1, the builder)

**Method:** self-test on an iPhone in Expo Go | **Participants:** 1, not independent | **Date:** 4 Nov 2026

The earlier audits checked the phone app from source and Expo web, and it passed: contrast, target sizes and names were all fine. On a real phone, Nazmul still found it hard to see "what to read and what to tap". **Passing an audit didn't mean it was easy to use.** The P-list below is about craft; this is about whether a person knows what to do.

### Themes

| Theme | What was seen | Implication |
|---|---|---|
| **Nothing leads** | Grey paragraphs at similar weight; solid suggestion chips competing with the action; a disabled action that nearly disappears; a big Sign out in the flow (R1, R4, R5, R10) | One heading, one line, one action. `muted` is for captions. Exits move to You |
| **Too much to read before acting** | Guess and proposal are walls of text; the hypothesis repeats the change (R2, R3) | Summary first, reasons behind Why? `03-ux-copy.md` cuts the words on these screens |
| **Controls don't look like what they are** | "Choose a time" in green monospace; long half-hour buttons; six stacked Change pills (R7, R8, R9) | `FormRow`, `Stepper`. Familiar patterns, so there's less to learn |
| **It looks broken** | Clipped step label, cut-off loading line, headings under the header, an error before touching anything (R6, R11, R12, R13) | Fix first. They cost trust in an app that asks about health habits |
| **No reason to come back yet** | From the brief, not from a finding: no tab bar, no moment after saving, no answer to "what happens after 10 days?" | **Assumption** that these help on day 3 and day 7. Worth building for the demo, but unproven |

### Insights and opportunities

| # | Insight | Opportunity | Basis | Impact | Effort |
|---|---|---|---|---|---|
| R-A | People can't find the next step | Sticky primary action on every flow | **Round 1**, A7 | High | Med |
| R-B | Sections are hidden in a menu | Tab bar: Today, Progress, Ask, History, You | **Round 1** quality bar; **Judgement** | High | Med |
| R-C | Text volume hides what matters | Half the words, details collapsed | **Round 1** | High | Med: touches tests that look up strings |
| R-D | Forms read as a pile of buttons | `FormRow`, `Stepper`, time row | **Round 1** | High | Low |
| R-E | Saving a check-in feels like nothing happened | Celebration; Today card with one action | **Assumption**, from the brief | Med | Med |
| R-F | Nothing says what happens after day 10, or across experiments | Finish flow and Progress tab | **Assumption**, from the brief | High for the demo | High: endpoint, contract, probably a migration |
| R-G | A health app can be honest and still feel rewarding | Facts as the reward: "Day 4 recorded", never fake praise | **Judgement**; `health-content.md` | Med | Low |

### Recommendations

1. **Fix the demo path's readability and navigation first (R-A to R-D).** Round 1 supports these, and they lift every later screen.
2. **Then check-ins (R-E).** The daily loop is the promise, but this rests on an assumption, so it comes after what was actually observed.
3. **Then Progress and day 10 (R-F).** It has the most risk per screen. Metric keys come from the AI, which reuses them only when a metric measures the same thing, so comparing across experiments can only compare same-key metrics, and has to say so.
4. **Run the hallway test with someone who isn't us** on the 3 tasks in `01-user-research.md`. That's the biggest gap in this evidence, and it's cheap.

### Limits of round 1

One person, who built it and knows the flows, so problems are probably understated. No screen reader or large text. The Strava screenshots set a quality bar; they aren't evidence about our users.

## Summary (from the 4 Nov review, before round 1)

The basics are sound: text contrast, tap sizes, labels and error states pass. What's missing is confidence and hierarchy. Screens have competing primary buttons and long full-width controls, headings are similar in weight to the sections below them, and there's no dark mode. Mobile lags the web: nearly every button is full-width. The redesign should raise the craft and keep the structure, because the flows and the honest copy are already the product's best asset.

## Prioritised problems

| # | Problem | Basis | Evidence | Impact | Effort |
|---|---|---|---|---|---|
| P1 | Long full-width buttons look unprofessional | **Feedback**; **Measured** "Create account" 795px and "Sign in" 448px at 1440px; **Source** 74 of 79 mobile `Action`s stretch | A8 | High | Med |
| P2 | No light and dark mode | **Feedback**; **Source** no dark theme on web or mobile | A3 | High | High on mobile: 194 static `COLORS` uses in 20 files |
| P3 | More than one filled primary on key screens, so the next step isn't clear | **Measured** Today has 2, Lab Report has 2 | A7 | High | Low |
| P4 | Motion feels thin; the app doesn't feel interactive beyond the two signature moments | **Feedback**; **Source** mobile uses only the core `Animated` API, in four files | A11 | High | Med |
| P5 | Screens look alike and hierarchy is flat: the Lab Report stacks equal-weight cards, against our own "cards only for a decision or comparison" rule | **Judgement**, from screenshots; **Source** `DESIGN.md` | | High | Med |
| P6 | Control borders are close to invisible, 1.31:1 and 1.42:1 | **Measured** | A1 | Med | Low |
| P7 | Landing hero is text on a translucent card over a moving scene | **Judgement** plus **Source**; breaks our "no glass" rule | A2 | Med; first demo screen | Low |
| P8 | Button labels are long and back links are named 5 ways | **Source** | Copy review | Med | Low, plus test updates |
| P9 | "Skip" on a disabled required step; "Results unlock soon" breaks our own word rule | **Source** | A9; copy review | Med | Low |
| P10 | Web check-in scale labels misaligned at wide widths | **Measured** in screenshot | A13 | Low | Low |
| P11 | Mobile hasn't been checked on a device for this review, and no simulator on this Mac | **Source** | 02 | Risk | iPhone check per PR |

## Ideas taken from the quality reference

The Kept screenshots did not reach this session, so these come only from the brief's description of them, and nothing was compared by eye.

| Idea | We already have | What to do, from our own subject |
|---|---|---|
| A panel that takes shape as you answer | Onboarding's rhythm ring, "Your rhythm so far" | Make it the signature on web and bring it to mobile; do the same for the proposal, where the plan's days fill in |
| A step rail | A thin segmented bar and "01 / 07" | Named steps along the day: morning-to-night, at wide widths; compact on phones |
| Suggestion chips under fields | Chip picker in onboarding | Add under the question field. Text must come from existing app content, not new health claims |
| Big, confident type | Fluid display sizes, but with steps close together | Wider gap between display and section title |
| One accent used sparingly | Moss, used for links, fills, tints and eyebrows | Moss fills only on the primary action; tints quieter |

## Principles for the redesign

1. **The experiment's shape is always visible.** Days, phase and what's next. *From the product, not users.*
2. **One primary action per screen, and it fits its words.**
3. **Motion explains a change.** It answers a tap or shows a real state change. Never decoration, never fake progress.
4. **Honest numbers stay still.** Health estimates and results never animate through values that didn't happen.
5. **Our subject is the decoration.** Day-to-night light, the ring, the 10-day timeline.
6. **Dark mode is night, not a colour inversion.** The app's own night blue family, gentle for bedtime use. *Assumption that it's used at bedtime.*
7. **Every state is designed in both modes**: loading, empty, error, offline.
8. **Same product on both platforms**, native in feel, tokens shared.

## Conflicts with our current rules

| The brief asks for | Current rule | Proposed resolution |
|---|---|---|
| "Number count-up" motion | `ui-motion.md`: "do not animate through intermediate health estimates" | Count up **counts only** (days recorded, check-ins). Results, predictions and percentages don't. Follows principle 4 |
| Elevation | `DESIGN.md`: no decorative shadows | Elevation by surface colour and one border in both modes; one soft shadow token only for things that float (menus) |
| More motion, an "interactive" feel | `DESIGN.md`: no global page entrance effects | Keep that rule. Screen transitions are directional and short; no fade-up on sections |

## Still unknown (hallway test)

- Q1–Q5 in `01-user-research.md`. Priorities P5, P7 and principle 6 depend most on the answers.
- If people struggle to read the Lab Report (Q3), that matters more than any item on this list. It should jump to the top.

## Limits

No outside users. 8x's feedback is second-hand here. Round 1 is the only time mobile has been judged on a device. No assistive-technology testing. The priorities are a designer's judgement of impact and effort, not measured.
