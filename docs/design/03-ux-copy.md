# 3. UX copy review

Skill: `/design:ux-copy`. Source: button, link, error and empty-state strings pulled from `frontend/components`, `frontend/app`, `frontend/lib` and `apps/mobile/src` on 4 Nov 2026 (28 web labels matched by pattern, 58 mobile, about 45 errors). This is a review of written strings, so it's **evidence** of what the product says, and an **assumption** about how people read it until the hallway test runs. Dynamic labels were not all captured, so treat the tables as the main cases, not every string.

Our rules still apply: sentence case, real numbers, no "unlock", "journey", "discover" or "transform" (`DESIGN.md`); four signal labels unchanged; "pattern, not proof" kept (`docs/rules/health-content.md`).

## House rules for labels

1. **Buttons: verb first, 3 words or fewer where possible.** The rest of the sentence goes in a caption next to the button, which is where the detail belongs.
2. **One name for one thing.** It's "Your lab", "Lab Report", "check-in".
3. **Going back names the destination:** `‹ Your lab` as the one link at the top of a detail page, "Go to your lab" as a button. Flows close with a × instead, and main sections have no back control. If closing would lose something, the sheet says "Leave without saving?" with one line on what's lost, and the buttons say Stay and Leave. Steps within a flow go by "Previous". *Changed 4 Nov: replaces the scattered "Back" buttons; the pattern is in `DESIGN.md`.*
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
| Back to your experiment / Go to your experiment | ‹ Your experiment on detail pages; Go to your experiment as a button | One pattern | Check-in, report |
| Back to Your lab / Back to your lab / Go to Your lab | ‹ Your lab on detail pages; Go to your lab as a button | One pattern | Several |
| Back to home | Go to your lab | Same destination, different name | Check-in, summary |
| Back to Today | ‹ Your lab | Mobile | Mobile |
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
| Leaving sign in | × in the header, named Close | Same as every flow |

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

## Mobile: half the words

Skill: `/design:ux-copy`. Added 4 Nov 2026 after round 1 (R1–R3 in `01-user-research.md`). Applies to `apps/mobile` only; the web is frozen. The table covers guidance only: buttons and answers aren't counted, and neither is text that comes from the AI or the backend.

**The rule for each screen:** one heading, one line of guidance, one action. Anything else goes behind **Why?** (reasons) or **More** (details). Nothing a person must know to act goes behind a tap.

**Stays visible, however short the screen gets:** the predicted range and its confidence; "Fixed once you start" before starting; "A short personal experiment shows a pattern, not proof." on results; the Example label on samples; signal labels, unchanged; what an error kept.

### Recommended copy

<!-- copy-table -->
| Screen | Now | Proposed | Behind Why? or More |
|---|---|---|---|
| Setup, start | First, your rhythm. Seven quick questions. When you usually sleep and wake, and how much of that is sleep. How much you move, and what you'd like to change. The habits you already have, like coffee or late dinners. Nothing medical, and no weights or calories. Your answers stay on this device until you save your rhythm. | First, your rhythm. Seven quick questions, nothing medical. | More: sleep, movement, goals and habits. No weights or calories. Answers stay on this device until you save. |
| Setup, age | How old are you? A range is enough. It helps us start with sensible predictions. | How old are you? A range is enough. | |
| Setup, sleep | When do you usually sleep? On a normal workday. Rough times are fine. Pick your usual bedtime and wake time. Enter both times. | When do you sleep? On a normal workday. Rough is fine. | "That's 8 h in bed." appears only once both times are set |
| Setup, hours | How much of that is actual sleep? Most people sleep a little less than they're in bed. A guess is fine. Our guess from 8 h in bed. Change it if it's off. | How much of that is sleep? Our guess, from 8 h in bed. | |
| Setup, movement | How much do you move on a typical day? No need to be exact. This helps us suggest changes that fit. | How much do you move? Roughly is fine. | |
| Setup, goals | What would you like to improve? Pick up to three. Your first experiment will start from one of these. | What do you want to improve? Pick up to three. | |
| Setup, habits | What do you already do most days? Pick any that sound like you, or add your own. Pick what is already part of your day. | What do you do most days? Pick any, or add your own. | |
| Setup, limits | Anything that limits what you can change? So we don't suggest experiments that won't fit your life. Skip if nothing comes to mind. Your experiment should fit your life. These help us choose a manageable change. | Anything limiting you? Skip if nothing comes to mind. | |
| Setup, review | Here's your rhythm. Your experiments start from here. Your 24-hour rhythm, midnight at the top. A few answers are missing. Use Change to fill them in. | Here's your rhythm. Tap a row to change it. | |
| Ask | A little curiosity, a little evidence. Ask a question. What have you been wondering about your daily habits? Let's turn it into something you can test. 5–500 characters. One small change at a time. First a plan. Then a prediction. You decide whether to begin. | Ask a question. What do you want to test? One small change at a time. | |
| Ask, waiting | Finding a small change you can test… Your plan and forecast will arrive together. This can take a little while. A suitable question. Check that this fits a small habit experiment. A plan for your day. Shape one change around your routine. An honest forecast. Estimate a range, including what is uncertain. | Finding a small change you can test… This can take a little while. | |
| Guess | Before the AI has its say. What do you think will happen? The small change. Your guess. Percent change from your normal days. Negative means down, 0 means no change, positive means up. For example, +10 means 10% higher. Choose between -100 and +200. Your guess locks when you reveal the AI prediction. It is saved if you start the experiment, so your report can compare both with what happens. | What do you think will happen? Change from your normal days. +10 means 10% higher. | Why?: it locks when you see the prediction, so your report can compare both. |
| Plan | Your question. The hypothesis. The small change. When. How often. A 10-day timeline. 3 baseline, 7 test. What we'll notice. Primary. We look for a change of at least 10% in sleep. The original forecast. Confidence. Things that may affect the result. This plan and prediction become fixed once you start. Your original forecast stays in place so you can compare it with what happens. | Your plan. The change. 3 normal days, then 7 test days. We predict. Confidence. Fixed once you start. | Why?: hypothesis, reasoning, what may affect it, what we track, the change we look for. |
| Today, check-in due | Today's check-in is waiting. A test day: tell us whether you made the change, then how it went. About 30 seconds. Day 4 closes Thursday 4:00 PM. Your small change. | Day 4 of 10. Closes Thursday 4:00 PM. About 30 seconds. | |
| Today, done | Done for today. Day 4 is recorded. Day 5 opens Thursday 4:00 PM. | Day 4 recorded. Day 5 opens Thursday 4:00 PM. | |
| Check-in | Today's check-in. A test day. Tell us whether you made the change, then how it went. Note optional. Ready to record. Anything unusual yesterday? (optional) In minutes. | Today's check-in. Test day: tell us how it went. Anything unusual? (optional) | Normal days: "Normal day: change nothing, just notice." |
| Saved | Day 4 recorded. Check-in saved. 4 of 10 days logged. 6 to go. | Day 4 recorded. 6 days left. | |
| History | What you've learned. Your experiment history. Look back at your predictions and the patterns your experiments found. | Your history. What your experiments found. | |
| Sample | Try the daily loop with a sample. Sample answers never become your real experiment data. Fixed design and prediction, with no AI calls. Reminders are off for this sample. Remove the sample to free up a slot for a real experiment. | Try a sample. It never counts as your data. | More: fixed plan, no AI calls, no reminders. Removing it frees a slot. |
| Demo | Explore a sample experiment. See how a completed experiment becomes a Lab Report. The demo uses labelled sample data. See a completed example. A sample experiment and its Lab Report, built from invented check-ins. It's never added to your own results and makes no AI calls. Opening it again resets the sample. | See a finished example. Invented check-ins, never added to your results. | |
| Reminders | Daily reminders. A reminder when the next day opens, not another thing to remember. At the next opening returned by your experiment. The lock screen shows the day, never your habit question. | Daily reminders. When the next day opens. The lock screen never shows your question. | |
| Lab Report | Your question, put to the test. Prediction vs reality. Change from baseline. Locked before you saw the AI forecast. Recorded before your experiment began. Measured from your recorded days. How close the forecast was to the measured change. This is not scientific confidence. A short personal experiment shows a pattern, not proof. | Prediction vs reality. Change from your normal days. A short personal experiment shows a pattern, not proof. | Why?: when each number was recorded, and what accuracy means. |
<!-- /copy-table -->

### New words

| Element | Copy | Note |
|---|---|---|
| Tabs | Today, Progress, Ask, History, You | Replaces "Your lab" on the phone. The web keeps "Your lab" while it's frozen, so back links on mobile become "‹ Today" |
| Disabled next step, with a hint | Pick one to continue. | Above the disabled button. Says what unlocks it. Shown instead of an error |
| Time row, empty | Choose | Plain text, muted, with a chevron. No longer green monospace |
| Today card | Day 4 of 10, then one action: Check in now | The line under it says when the day closes, from the server |
| Today card, missed days | 3 logged, 1 missed | A plain count. No apology, no warning colour |
| Celebration | Day 4 recorded / 6 days left | The last day: "That was the last day." |
| First-run guide | Example · Step 1 of 3 / Skip | Three one-line marks, on an example that's never saved |
| Finish flow | Keep this habit / Try a variation / Test something new | The result comes first, in one sentence from the existing signal copy |
| Progress note | Changing several things over time means this shows trends, not proof. | Must stay visible |

### Alternatives

| Instead of | Alternative | Why not |
|---|---|---|
| Day 4 of 10. Closes Thursday 4:00 PM. | Day 4 of 10 · check in tonight | **"Tonight" can be false.** A day closes at a time set by when the experiment started, which might be 4 PM. It only works if we confirm when people should check in |
| Day 4 recorded | Nice work! / Great job! | Praise for filling in a form is the fake praise the brief rules out, and it's Strava's line |
| 3 logged, 1 missed | Don't break your streak! | Shame. A streak isn't what this app measures |
| 6 days left | Almost there! | Not true on day 4 |

### Rationale

Someone opens this for 30 seconds a day. They need what's happening, then what to do. The reasons are still true and still there, but they don't compete with the action.

### Localization notes

Tab labels must fit 78pt at 390 wide, so keep them to one short word. Keep "normal days" and "test days" together as terms. "Tonight" doesn't translate safely across time zones anyway; the server's time does.

