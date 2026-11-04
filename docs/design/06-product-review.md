# 6. Product review of the Rhythm mobile app

Date: 4 Nov 2026. Build: `d56a77b` on Expo web at 390 × 844, light and dark. Every request was mocked and all other traffic blocked: no paid calls, no database writes. [`tools/review/walk.mts`](../../tools/review/walk.mts) re-runs the walk (Ana, Raj, Mei and the states). Only the cited screens are kept here; light is shown, and `dark-*` files sit beside them.

Passes used: `/design:design-critique`, `/design:ux-copy`, `/design:accessibility-review`, Nielsen's 10 heuristics.

**Not covered by a browser:** VoiceOver, real Dynamic Type, the reminder prompt, native haptics and the Expo Go splash. Motion was judged from code and tokens, not frames. These need the iPhone check. The large-text screens are a simulation at about 135%.

## Findings, ranked

Severity: blocker / major / minor. Effort: S / M / L.

| # | Finding | User impact | Sev | Eff | Fix | Screen |
|---|---|---|---|---|---|---|
| 1 | Lab Report opens with "Prediction vs reality" and a Reveal button; the plain result is about two screens down. The report is 5.4 screens and 361 words. | Mei can't tell what happened. The climax of the demo reads as a form. | blocker | M | One plain sentence first, then the chart, then the details. | [report](06-product-review/light-mei-09-report-first-look.jpg) |
| 2 | When all days are done, Today has no button: link, then "See results", then "Yes, finish". After day 10 the page says "You can finish early." | The payoff takes three taps, and the wording is wrong on the demo path. | blocker | S | "See your results" on the card, in one step. | [today](06-product-review/light-mei-05-today-ended.jpg), [detail](06-product-review/light-mei-04-detail-last-day__full.jpg) |
| 3 | "Try a sample" sits under the guess and plan screens when nothing is running, next to "Ask something else". | Ana sees an unrelated choice in the middle of a paid plan. Embarrassing in the demo. | blocker | S | Hide sample controls once a plan or guess is open. | [guess](06-product-review/light-ana-06-guess.jpg) |
| 4 | No day-3 moment. The celebration says "Day 3 recorded, 7 days left"; the reminder says "Day 4 of 10 is open". | Raj doesn't know the change starts tomorrow, so day 4 can be missed. This is the retention moment. | major | S | "Baseline done. Your test starts tomorrow: [change]." Reminder follows. | [celebration](06-product-review/light-raj-day3-03-celebration.jpg) |
| 5 | On baseline days Today shows "Keep your usual routine" with "Walk for 20 minutes" as the largest text. | Raj may start walking early, which spoils the baseline and the result. | major | S | Say "Starts on day 4: walk for 20 minutes", smaller, with "Change nothing yet" as the lead. | [today](06-product-review/light-raj-day3-04-today-baseline-done.jpg) |
| 6 | No line anywhere says where data goes or that the AI only proposes. The speaker switches between "We predict" and "AI forecast". | A skeptical Ana has no reason to trust it (suspicion 8), and health data raises the stakes. | major | S | One line on sign-up and the plan: "Your check-ins stay in your account. The AI proposes a plan and a prediction; you decide, and your data decides the result." Needs your wording check. | [plan](06-product-review/light-ana-07-plan.jpg) |
| 7 | Starter chips read "What small change could help with: better morning energy?" for goals without a set question. | Machine-sounding sentence on Ana's first real screen. | major | S | Write a question for every onboarding goal; drop the template. | [ask](06-product-review/light-ana-05-today-empty-ask.jpg) |
| 8 | History puts the calibration card first, so the list starts below the fold. "Off by 8 points" is jargon. | Mei has to scroll past it to reach past reports. | minor | S | List first, or collapse the card. "8 points away". | [history](06-product-review/light-mei-13-history.jpg) |
| 9 | Error and empty states are uneven: raw "Service unavailable" from the server, and Progress's "Nothing running yet." has no action. | Dead ends, and backend wording shown to people. | minor | S | Own wording per screen; add "Ask a question" to the empty Progress. | [error](06-product-review/light-state-history-error.jpg), [empty](06-product-review/light-state-progress-offline-never-loaded.jpg) |
| 10 | Onboarding fits but the scene takes about a third of the screen, so goals and habits scroll under the sticky bar (1.3 screens). "R" avatar and menu show during setup. Two goals share a moon icon. | Options hidden with no cue, on an otherwise strong flow. | minor | M | Shrink the scene on long lists. Give each goal its own icon. | [goals](06-product-review/light-ana-03-onboard-5-goals.jpg) |

Also noted, below the top 10:
- "3 logged" on Today is cryptic.
- Settings mention Expo Go, and "Send test reminder" shows in dev builds, which includes a Metro demo. **Check this before the demo.**
- The × on the Day 10 screen opens the Lab Report rather than leaving.
- The heading sits right against the Today card, with no gap.
- Landing dots are 36 × 48, under the 44 target.
- Two animation libraries are in use (`Animated` and Reanimated), with the same tokens.

## Your suspicions

| # | Question | Answer |
|---|---|---|
| 1 | Next action on Today in 3 seconds? | **Yes** on a check-in day. **No** when all days are done (finding 2). |
| 2 | Lab Report leads with a sentence? | **No** (finding 1). |
| 3 | Guess, plan, Day 10 still too much text? | Day 10 is good. Plan is fine at 1.6 screens. Guess is short but cluttered (finding 3). |
| 4 | Icon and splash ours? | **Ours.** Expo Go on a phone is unchecked. |
| 5 | Day-3 moment and reminder copy? | **Missing** (finding 4). The rest of the reminder copy makes sense. |
| 6 | Empty, error, offline states? | All present, none broken. Wording and actions vary (finding 9). |
| 7 | Consistency? | Header, × and ‹ follow a clear rule. Tabs and buttons match, and motion uses shared tokens. Exceptions are in "Also noted". |
| 8 | Trust line? | **Missing** (finding 6). |
| 9 | Onboarding? | Feels designed and fits, except long lists (finding 10). Animation still needs a look on the phone. |
| 10 | Embarrassing in the demo? | Findings 1, 2 and 3, and the dev button in Settings. |

## Pass summaries

**Critique.** Calm, consistent, and clearly its own product; dark mode holds up. The biggest opportunity is hierarchy on long pages: the Today card works, but the Lab Report and experiment page (about 3 screens) give everything the same weight.

**Copy.** Direct and short in most places. Issues: findings 5, 6, 7 and 8; "baseline" and "normal days" for one idea; "logged" and "recorded"; "sample" and "example"; and "Signal", which is jargon.

**Accessibility (WCAG 2.1 AA, automated audit on every screen, both themes).** Every control has a name. All targets reach 44 except the landing dots. No text is under 13 px. The only contrast flags were false positives on text over the illustrations. Reduce Motion stops the landing carousel and hides Pause. At simulated large text, Today's main action stays above the fold. Manual VoiceOver is still needed.

**Nielsen's 10.**
- Pass: visibility of status (1), consistency (4), error prevention (5), recognition over recall (6).
- Partial: match with the real world (2, jargon), user control (3, the Day 10 ×), flexibility (7), minimalism (8, Lab Report), error recovery (9, raw server text).
- Gap: help and documentation (10, no trust or data line).

## Scene treatment

Worth it, in this order; each is one moment rather than a whole screen:
1. Lab Report result, at the top.
2. Day-3 "Baseline done".
3. Day 10 "All 10 days are done."

Leave Today, History and Progress plain, since they're read daily and should stay quick.

## PR plan (before 14:00, 5 Nov)

| Order | PR | Status |
|---|---|---|
| 1 | This review and `tools/review` | Now |
| 2 | Lab Report leads with a sentence (1) | Pre-approved |
| 3 | One-step finish from Today (2) | Pre-approved |
| 4 | Day 3 moment and reminder (4) | Pre-approved |
| 5 | Hide samples during a plan (3), and baseline wording (5) | Needs your OK |
| 6 | Trust line (6) and goal questions (7) | Needs your OK |
| Later | 8, 9, 10 and scene treatment | After the demo unless you say otherwise |
