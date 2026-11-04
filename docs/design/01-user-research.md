# 1. User research plan

Skill: `/design:user-research`. Written 4 Nov 2026, for the 5 Nov final demo.

**Status: one round, one person, and that person built the app.** See [Round 1](#round-1-the-builder-on-an-iphone). No outside user has been asked yet, so everything else about users below is still an **assumption**, taken from `PRODUCT.md` and `PRD.md §4`, which describe who we are building for, not who we have met. No user, quote or result in this folder is invented. Results go in the table at the end, and only real answers may replace an assumption.

## Round 1: the builder on an iPhone

**Who:** Nazmul, n=1, on 4 Nov 2026, using the mobile app in Expo Go on their own iPhone. **Read this honestly:** a builder knows what every screen is for, so a new user will probably stumble in more places, not fewer. This round finds obvious problems. It can't show how common they are, and it doesn't answer Q1–Q5 below.

Their summary: "it's hard to see what to read and what to tap."

| # | What they saw | Screen | Kind of problem |
|---|---|---|---|
| R1 | Too much grey paragraph text, all at a similar weight | All, worst on guess and proposal | Hierarchy |
| R2 | Guess and proposal are walls of text | Guess, proposal | Too much to read |
| R3 | The hypothesis repeats "the small change" right below it | Proposal | Repetition |
| R4 | A big "Sign out" button on every onboarding step | Onboarding | Wrong place: it belongs in the menu |
| R5 | The disabled Continue is almost invisible | Onboarding | Can't see the next step |
| R6 | "Enter both times." shows as an error before anything is touched | Onboarding, sleep times | Blames the user too early |
| R7 | "Choose a time" in green monospace looks broken | Onboarding, sleep times | Doesn't look like a control |
| R8 | "Half an hour less/more" buttons are long; a − / + stepper is clearer | Onboarding, hours asleep | Control doesn't fit the job |
| R9 | Six "Change …" pill buttons stacked | Onboarding, review | Repeated actions; should be rows |
| R10 | Suggestion chips look like solid buttons | Ask | Looks like the main action |
| R11 | The loading line is cut off ("This can take") | Ask | Broken text |
| R12 | Headings slide under the header | Ask, others | Layout |
| R13 | The step label ("Age", "Sleep") at the top right gets clipped | Onboarding | Broken text |

Not a finding: the blue gear is Expo Go's developer menu, not our app.

**Quality reference:** Nazmul's screenshots of Strava's save and home screens. Taken from them as a bar, not to copy: form rows with an icon, label, value and chevron; one sticky primary action; a bottom tab bar; a streak card with one action; a full-screen moment after saving. Our colours, type, shapes and words stay ours.

## The 3 tasks a new user must complete

What a new person has to get done, and what would make each one obvious without help. These are the pass marks for the next round with someone who isn't on the team.

| Task | Done when | What makes it obvious | Round 1 problems in the way |
|---|---|---|---|
| **T1. Set up my rhythm** | Profile saved, from first screen to Today | One question per screen, and the one action always in the same place at the bottom. An enabled-looking next step the moment it's answered. A review screen of rows, so changing an answer is one tap | R4, R5, R6, R7, R8, R9, R13 |
| **T2. Start my first experiment** | A question asked, my guess locked, and the experiment started | One short line on what to do. The plan as a summary first: the change, how many days, what to track. Everything else behind "Why?". The prediction is the thing to read, and Start is the thing to tap | R1, R2, R3, R10, R11, R12 |
| **T3. Do today's check-in** | Today's answers saved, and I can see what that did to my progress | Today says which day it is and offers one action. The check-in is one screen of taps. Saving is unmistakable and says how many days are left | R1; the rest is unproven until someone new tries it |

**Questions for the next round:** without help, can a new person do T1, T2 and T3 on a phone, and where do they stop for more than a few seconds? Afterwards: "what did the app want you to do on that screen?"

## Who we think our users are (assumption)

Someone already trying to improve their sleep, energy, focus, fitness, food or routines. They have tried advice from friends or social media, want evidence rather than another streak, and will do one short check-in a day on their phone.

For today, recruit 2–3 people who have tried to change a habit in the last year. They should not be on our team or have seen the app. Fellow 8x builders are fine if nobody else is around, but note it next to their answers, because they read screens like builders.

## The questions that matter

| # | Question | Why it matters to the redesign | Current assumption |
|---|---|---|---|
| Q1 | From the landing page, can someone say what this does and who it's for in 10 seconds? | Sets the landing hierarchy and the one headline | Assumption: "a personal experiment" needs showing, not explaining |
| Q2 | Do they understand what will happen and how long it takes before they start? | Decides how early "3 normal days, then 7 test days" appears | Assumption: the step rail and taking-shape panel will help |
| Q3 | Can they read a Lab Report and say in their own words what the person learned, including that it's a pattern and not proof? | This is the product's success test (`PRODUCT.md`) and the demo's climax | Assumption: prediction versus reality reads first, and the signal label is understood |
| Q4 | Can they finish a check-in without help, and does it feel short? | The daily loop is the promise: about 30 seconds | Assumption: it's fast, and no one is stuck on a scale |
| Q5 | Does it look trustworthy enough to put health habits in it? What makes it look unfinished? | This is 8x's feedback, tested on people who aren't 8x | Assumption: long full-width buttons and flat hierarchy are the main reasons |

## 5-minute hallway test

**You need:** one phone or a 390px browser window, opened at the deployed site or `/demo`, using demo samples only. One person runs it, the other writes. Don't use anyone's real health details.

**Say first (20 sec):** "We're testing the app, not you. Please think out loud. I can't help while you try things, and nothing you say can hurt our feelings."

| Time | Do | Ask, then stay quiet | Write down |
|---|---|---|---|
| 0:00–0:45 | Show the landing page for 10 seconds, then cover it | "What does this do? Who is it for?" | Q1: their exact words |
| 0:45–1:45 | Let them scroll and start the demo | "What do you think happens next, and how long will it take?" | Q2: what they say; where they hesitate |
| 1:45–3:00 | Open the sample check-in | "Log today however you like." | Q4: seconds taken; anywhere they stop or ask |
| 3:00–4:15 | Open the sample Lab Report | "What did this person learn? How sure would you be?" | Q3: their words; do they say "proved" or "pattern"? |
| 4:15–5:00 | Stop | "Would you trust this with your own habits? What looks unfinished?" | Q5: their exact words |

**Don't:** explain, defend, say "the idea is…", or ask "do you like it?". If they get stuck for 20 seconds, note it and move on.

**After each person (2 min):** both of you write the one thing that surprised you, separately, then compare.

## How to read the answers

Three people can't prove anything. They can only reveal obvious problems. If 2 of 3 trip in the same place, treat it as a real problem and fix it. If one person does, note it. Nothing here gives a percentage.

## Results

Fill in after running. Until then, every row in `04-synthesis.md` that relies on these questions stays marked as assumption.

| Person (first name or P1) | Team-adjacent? | Q1 | Q2 | Q3 | Q4 | Q5 | Surprise |
|---|---|---|---|---|---|---|---|
| Not run yet | | | | | | | |
