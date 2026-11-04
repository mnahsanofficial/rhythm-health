# 3. UX copy review

Skill: `/design:ux-copy`. Source: button, link, error and empty-state strings pulled from `frontend/components`, `frontend/app`, `frontend/lib` and `apps/mobile/src` on 4 Nov 2026 (28 web labels matched by pattern, 58 mobile, about 45 errors). This is a review of written strings, so it's **evidence** of what the product says, and an **assumption** about how people read it until the hallway test runs. Dynamic labels were not all captured, so treat the tables as the main cases, not every string.

Our rules still apply: sentence case, real numbers, no "unlock", "journey", "discover" or "transform" (`DESIGN.md`); four signal labels unchanged; "pattern, not proof" kept (`docs/rules/health-content.md`).

## House rules for labels

1. **Buttons: verb first, 3 words or fewer where possible.** The rest of the sentence goes in a caption next to the button, which is where the detail belongs.
2. **One name for one thing.** It's "Your lab", "Lab Report", "check-in".
3. **Going back names the destination:** `← Your lab` as a link, "Back to your lab" as a button. One spelling each. *Changed while building: a button reads better with the words.*
4. **Retry is always "Try again".** The sentence above it says what was kept.
5. **Errors: what happened, then what to do.** No "Something went wrong" alone.

## Buttons to shorten

Labels change, behaviour doesn't. Browser and unit tests that look up these names change with them, in the same commit, and the PR says so.

| Now | Proposed | Note | Where |
|---|---|---|---|
| Continue without saving my guess | Skip my guess | Caption: "You can still see the AI prediction." | Mobile, proposal |
| Send a test reminder in 10 seconds | Send test reminder | Caption: "Arrives in 10 seconds." Dev-only | Mobile, settings |
| Run your first experiment | Start an experiment | Caption already says how long | Landing, web and mobile |
| Retry keeping my answers | Try again | Sentence above: "Your answers are kept." | Mobile, onboarding |
| Reload today's check-in | Try again | Same pattern | Combined check-in |
| Reveal the AI prediction | Show prediction | | Personal guess |
| Change today's answers | Edit answers | | Today |
| Back to your experiment / Go to your experiment | ← Your experiment | One pattern | Check-in, report |
| Back to Your lab / Back to your lab / Go to Your lab | ← Your lab | Three spellings today | Several |
| Back to home | ← Your lab | Same destination, different name | Check-in, summary |
| Back to Today | ← Today | Mobile | Mobile |
| Finish and see results | See results | | Mobile, finish |
| Save today's check-in | Save check-in | | Check-in |
| Design my experiment | Design experiment | | Ask a question |
| Check in for day 4 / Check in for today | Check in | Day shown just above it | Today |
| Yes, I made the change | Yes | Question is right above it. Web already says this | Mobile, check-in |
| Retry answers / Retry reminder / Retry | Try again | | Mobile |

## Copy to fix

| Now | Proposed | Why |
|---|---|---|
| Results unlock soon. | Results after {n} more check-ins. | Breaks our banned-word rule, and gives no number. The string is in `experiment-detail.tsx:214` |
| "Skip" on a disabled, required step | "Continue" (disabled) | Says something the step doesn't allow. `onboarding-flow.tsx:187`, see accessibility finding A9 |
| Something went wrong. / Something went wrong. Please try again. | Couldn't load this. Try again. | Says what and what to do |
| Request failed | Couldn't reach the server. Check your connection and try again. | Never show this raw |
| We couldn't reach the server. Check your connection. / Couldn't reach the server. | Couldn't reach the server. Check your connection and try again. | One sentence for one failure |
| Couldn't save your experiment. Please try again. / Couldn’t save… (curly) | Couldn't save your experiment. Try again. | Two copies; one apostrophe differs |
| We couldn't load this report. | Couldn't load this report. Try again. | Same form as the others |
| Couldn't finish the experiment. | Couldn't finish the experiment. Try again. | Add the next step |

## What's already good, so keep it

- "Couldn't save your check-in. Your answers are kept; try again." says what was kept.
- "Your experiment was saved, but it couldn't be started. Try again." is honest about a partial state.
- "About a minute to set up. You sign up at the end." and "Day 4 closes Thursday 4:00 PM.": real numbers, and it says what will happen.
- "A short personal experiment shows a pattern, not proof." Must stay.
- "Not today" for a skipped change: kind, and counts as an answer.

## Empty states

Pattern: what this is, why it's empty, the one next step.

| Screen | Status | Proposed |
|---|---|---|
| Home, no experiment | Good: the question form is the empty state | Keep |
| History, none finished | Check in build | "Your finished experiments land here." with `Ask a question` |
| Report, not written yet | Good: "Your results are in. We can write them up in plain words…" | Keep; shorten to two lines |
| Next test, before report | Good | Keep |
| Offline | Today says cached data is offline, Check-in disabled | "You're offline. Check-ins need a connection." on mobile and web |

## Terms

Use: **Your lab**, **Lab Report**, **check-in**, **baseline** in the data, "normal days" in sentences, **test days**, **prediction** ("forecast" also appears; pick prediction in UI). Spelling: British English where it already appears ("Analysing", "recognised"). It stays consistent.

## Scope for the build

Button and error strings change with each screen's PR, not all at once, so a test failure points at one screen. Any string rendered by the backend (signal labels, safety messages) doesn't change here.

## Phone landing carousel and sign-in

Skill: `/design:ux-copy`. Added 4 Nov 2026 after an iPhone check, with Strava's sign-up carousel as the pattern: one line per slide under a picture of the app, the same two ways in on every slide. The pattern is the reference; the words, colours and screens are ours. How well people read these is an **assumption** until the hallway test runs.

### Recommended copy

| Element | Copy | Note |
|---|---|---|
| Slide 1 | Stop guessing. Test one habit. | Shortens the web's headline |
| Slide 2 | See the prediction before day one. | The order is the product's promise |
| Slide 3 | Check in each day in about 30 seconds. | Keeps "about": it's an estimate |
| Slide 4 | Compare the prediction with what happened. | The Lab Report, in plain words |
| Slide 4's picture | Likely signal. A pattern, not proof. | Must stay |
| Every picture | Example | Sample data is labelled |
| Main action | Start an experiment | Same as the web |
| Quiet action | Sign in | Same as the web. Our term, not "Log in" |
| Password toggle (spoken only) | Show password / Hide password | The eye has no visible words |
| Sign-up hint | At least 6 characters. | Same as the web. Explains why the button stays disabled |
| Switching forms | New here? Create an account / Already have an account? Sign in | A link inside the sentence |
| Going back | ← Back | The header already says Rhythm |

### Alternatives considered

| Instead of | Alternative | Why not |
|---|---|---|
| Start an experiment | Join for free | Says nothing about what happens next, and makes a pricing promise we haven't made |
| Stop guessing. Test one habit. | Your habits, tested. | Reads as a tagline, and loses the web's voice |
| Check in each day in about 30 seconds. | Check in in 30 seconds. | Drops "about", and doubles "in" |
| Compare the prediction with what happened. | See if it worked. | Promises a yes or no; a short experiment shows a pattern, not proof |

### Rationale

Someone opening the app wants to know what it does before committing. Four lines, read in order, tell the whole loop: a question, a prediction first, a daily check-in, then the comparison. No line needs the one before it, because a slide can arrive at any time.

### Localization notes

Keep lines under 44 characters in English so they hold two lines at 320 wide. "Signal" and "pattern" are the product's terms: translate them the same way as in the Lab Report.

