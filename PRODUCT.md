# Product

**Rhythm Health Lab**: run personal experiments to learn which habits actually affect you.

This is a one-page summary. The full requirements are in [`PRD.md`](PRD.md) and the architecture is in [`TRD.md`](TRD.md); those two are the source of truth. What's built and what's left: [`docs/REMAINING_WORK.md`](docs/REMAINING_WORK.md).

## The problem

People try habits from generic advice (sleep more, walk after dinner, cut caffeine) but rarely know whether a habit works **for them**. Habit apps track whether you did the thing, not whether it changed the outcome you care about (PRD §1).

## What it does

The user turns a goal or a question into a small N-of-1 experiment. Before it starts, the app predicts what will happen. The user follows the habit and logs a short daily check-in. At the end, a Lab Report compares the prediction with what actually happened, and says honestly whether that was a signal or noise.

It is a tool for learning how your own behaviour affects you, not a habit tracker.

## Learning that sticks

This is the 8x theme. The learning comes from the user's own evidence, not from content:

- **Prediction before measurement.** Writing the forecast down first makes the result a surprise or a confirmation, and either one sticks (PRD §5.2).
- **Practice every day.** Each check-in is a 30-second act, not reading (PRD §5.4, §12).
- **Visible progress.** A timeline of days fills in as evidence builds up, not a streak (PRD §13).
- **A personal conclusion.** The report says what the user learned about themselves and what to test next, and completed experiments feed future predictions (PRD §15–16).

## The core loop

**Persona → Goal → Prediction → Experiment → Daily check-ins → Analysis → Lab Report → Learning → Next experiment** (PRD §3)

An experiment has 3 baseline days of normal life, then 7 test days with the change (TRD §11).

## Who it's for

Someone already trying to improve their sleep, energy, focus, fitness, food or routines, who has tried advice from friends or social media, wants evidence instead of another streak, and will do one short check-in a day (PRD §4).

## Principles

1. Evidence before advice (PRD §5.1).
2. Prediction before measurement; the prediction can't change once the experiment starts.
3. One experiment at a time.
4. Tiny daily interaction: under about 30 seconds.
5. Honest about uncertainty: likely signal, possible signal, unclear, probably noise. Never proof.
6. Learn from the user: past experiments inform new predictions.
7. No medical claims, diagnosis or treatment. In this repo, also no calorie counting or weight targets ([`docs/rules/health-content.md`](docs/rules/health-content.md)).

## V1 scope

| | |
|---|---|
| **Must have** | Persona; a question in the user's own words; AI-designed experiment; prediction; one active experiment; manual daily check-ins; timeline; lightweight N-of-1 analysis; prediction vs reality; interactive Lab Report; experiment history; past experiments as context; mobile-responsive; a seeded completed experiment |
| **Should have** | Notes for confounders; an explanation of confidence; a suggested next experiment; safety checks; interactive charts |
| **Out of scope** | Apple Health, Health Connect and wearables; diagnosis or treatment; clinical statistics; several experiments at once; social features; native apps; push notifications |

Full lists: PRD §23–24.

## How we'll know it works

A new user can:
1. create a persona and ask a question;
2. understand the proposed experiment and its prediction, then start it;
3. check in and understand their progress;
4. read a Lab Report;
5. explain what they learned, and start the next experiment.

The longer-term numbers are day 3 retention, completion rate and second-experiment starts (PRD §26).

## Who owns what

**Shakeb** owns product requirements, architecture, the backend, the experiment, prediction and analysis engines, the data model and reliability. **Nazmul** owns visual direction, interaction design, onboarding, the dashboard, check-in and Lab Report UI, motion and polish. Decisions about product behaviour are made together (PRD §27).
