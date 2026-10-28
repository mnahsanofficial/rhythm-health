# Product Requirements Document

## Product name

Working title: **Rhythm Health Lab**

## Product statement

**Run personal experiments to learn which habits actually affect you.**

The product helps users turn a personal goal or question into a small, structured N-of-1 experiment.

Before the experiment begins, the product predicts what is likely to happen.

The user then follows the habit, logs short daily check-ins, and collects evidence.

At the end, the product compares the prediction against the observed result and generates an interactive lab report showing:

- what was predicted
- what actually happened
- whether the result appears meaningful or mostly noise
- what the user learned about themselves
- what they should test next

The product is not primarily a habit tracker.

It is a tool for learning how your own behavior affects you.

---

# 1. Problem

People regularly try to improve their health and routines using generic advice:

- sleep more
- exercise after dinner
- stop caffeine earlier
- meditate
- eat breakfast
- wake up earlier
- reduce screen time

The problem is that users rarely know whether a habit actually works **for them**.

Most habit apps measure whether someone completed a behavior.

They do not answer:

> Did this behavior actually change the outcome I cared about?

Users therefore repeat habits based on assumptions, trends, or advice rather than evidence from their own lives.

There is also little feedback between expectation and reality.

A user may believe:

> “Sleeping seven hours instead of eight will make me more productive.”

But they normally have no structured way to:

1. predict the outcome,
2. test the change,
3. measure what happened,
4. compare prediction against reality,
5. learn from the result.

---

# 2. Opportunity

Create a product that turns personal behavior change into a learning process.

Instead of saying:

> “Build this habit.”

The product says:

> “Here is what we predict will happen. Let’s test it.”

The user becomes both the participant and the learner.

Over time, completed experiments create a growing model of the user’s own behavior.

Early predictions rely heavily on the user's persona and general behavioral assumptions.

Future predictions increasingly use evidence from the user's previous experiments.

The long-term product vision is a **personal behavioral model built through experiments**.

---

# 3. Core product loop

The complete product loop is:

**Persona → Goal → Prediction → Experiment → Daily Check-ins → Analysis → Lab Report → Learning → Next Experiment**

Every major product feature should support this loop.

---

# 4. Target user

## Primary user

A person who is actively trying to improve some aspect of their lifestyle but does not know which behaviors actually help them.

Typical characteristics:

- curious about self-improvement
- already thinks about sleep, fitness, energy, productivity, food, stress, or routines
- has tried habits based on advice from social media, friends, or health content
- is willing to complete one short daily check-in
- wants evidence rather than another habit streak

Example user:

> A 27-year-old software engineer wants more energy in the morning. They sleep roughly eight hours, exercise irregularly, and often feel tired after waking. They want to know whether walking after dinner actually improves sleep and morning energy.

---

# 5. Product principles

## 5.1 Evidence before advice

The product should help the user test assumptions rather than simply tell them what habit to follow.

## 5.2 Prediction before measurement

Every experiment must have an explicit prediction before it starts.

This makes the final comparison meaningful.

## 5.3 One experiment at a time

V1 supports one active experiment.

This reduces confounding variables and keeps the experience understandable.

## 5.4 Daily interaction should be tiny

A normal daily check-in should take less than approximately 30 seconds.

## 5.5 Be honest about uncertainty

The product must distinguish between:

- strong signal
- possible signal
- unclear result
- likely noise

It should not present a short personal experiment as scientific proof.

## 5.6 Learn from the user

Completed experiments should become useful context for future predictions.

## 5.7 Avoid medical claims

The product provides behavioral experimentation and personalized observations.

It does not diagnose conditions or provide medical treatment recommendations.

---

# 6. Persona

Before starting experiments, the user creates a lightweight persona.

## Required fields

- age range
- usual sleep duration
- usual sleep schedule
- activity level
- primary goals
- regular habits
- relevant constraints

Example:

**Age:** 25–34  
**Sleep:** ~8 hours  
**Activity:** Lightly active  
**Goals:** Better morning energy, better focus  
**Regular habits:** Coffee at 9 AM, late dinner, phone before bed  
**Constraints:** Cannot exercise before work

The persona should feel conversational and lightweight rather than like a medical intake form.

---

# 7. Starting an experiment

The user can start from either a goal or a direct question.

Examples:

> I want more energy in the morning.

> Does walking after dinner improve my sleep?

> Would reducing my sleep from eight hours to seven improve my productivity?

> Does stopping caffeine after 2 PM help me fall asleep faster?

> Does exercising in the morning improve my focus?

The system should turn the input into something measurable and testable.

---

# 8. AI experiment designer

Once the user submits their goal or question, AI creates a proposed experiment.

The proposal should contain:

## Experiment question

Example:

> Does a 20-minute walk after dinner improve my sleep and morning energy?

## Hypothesis

Example:

> Walking after dinner may improve sleep quality and lead to higher morning energy.

## Intervention

Example:

> Walk for at least 20 minutes within one hour after dinner.

## Primary metric

Example:

> Morning energy score, rated 1–10.

## Secondary metrics

Example:

- perceived sleep quality
- sleep onset time
- total sleep duration

## Duration

Default for V1:

**7 days**

The system may recommend another duration when appropriate, but the initial product should optimize around short experiments.

## Daily check-in

The experiment defines exactly what the user records.

Example:

- Did you complete the walk?
- What time did you go to bed?
- How would you rate sleep quality?
- How energetic do you feel this morning?

## Success criteria

Example:

> Morning energy improves by at least 10% without a meaningful reduction in sleep duration.

---

# 9. Predictive engine

Before the user begins the experiment, the system generates a personalized forecast.

The prediction is based on:

- persona
- current baseline
- stated goal
- proposed intervention
- relevant habits
- constraints
- previous experiments, when available
- general behavioral priors

## Prediction output

The forecast should contain:

### Expected direction

Example:

> Morning energy is likely to improve.

### Expected magnitude

Example:

> Expected improvement: approximately 8–15%.

Predictions should generally be expressed as ranges rather than false precision.

### Confidence

Example:

**Moderate confidence**

### Reasoning

Example:

> Your current activity level is relatively low, and the intervention adds light movement without reducing your sleep opportunity.

### Factors that may affect the prediction

Example:

- inconsistent bedtime
- caffeine timing
- experiment adherence
- unusually stressful days

The user sees the prediction before starting the experiment.

Once the experiment begins, that original prediction becomes immutable.

---

# 10. Safety layer

If the user's proposed intervention appears unreasonable, potentially harmful, or unsuitable for lightweight self-experimentation, the product should not blindly generate an experiment.

Example:

> “I want to sleep three hours per night for a week.”

The product should explain that the proposed change is not appropriate for this kind of experiment and suggest a safer alternative.

The system should also avoid presenting predictions as medical outcomes.

---

# 11. Experiment dashboard

Once the experiment begins, the user gets an experiment dashboard.

The dashboard should show:

- experiment title/question
- day X of N
- current intervention
- today's check-in state
- adherence
- primary metric trend
- original prediction
- experiment timeline

Example:

**Does walking after dinner improve my sleep?**

Day **4 / 7**

Prediction:

> Morning energy +8–15%

Adherence:

> 3 / 4 days completed

The dashboard should make progress obvious without prematurely declaring whether the experiment is working.

---

# 12. Daily check-in

The daily check-in is the primary returning behavior.

It should require as little effort as possible.

Example flow:

**Did you complete your 20-minute walk?**

Yes / No

**How would you rate last night's sleep?**

1–10

**How energetic do you feel this morning?**

1–10

**Anything unusual yesterday?**

Optional short note.

Once submitted, the day is recorded.

The user can see their experiment timeline update immediately.

---

# 13. Experiment timeline

The experiment should visually show all days.

Example:

Day 1 ✓  
Day 2 ✓  
Day 3 ✕  
Day 4 ✓  
Day 5 Today  
Day 6 —  
Day 7 —

Each completed day should expose its recorded metrics.

The timeline helps users understand that the experiment is accumulating evidence rather than simply building a streak.

---

# 14. Analysis engine

Once enough experiment data exists, the system analyzes the result.

V1 should use a lightweight N-of-1 analysis rather than pretending to provide rigorous clinical statistics.

The engine should consider:

- adherence
- baseline values
- experiment-day values
- mean/median change
- direction consistency
- variability
- obvious outliers
- missing days
- potential confounders from user notes
- prediction vs observed result

## Analysis result categories

The system should classify the outcome into understandable language.

### Likely signal

The observed change is consistent and meaningfully different from baseline.

### Possible signal

The result moved in the expected direction but evidence is limited.

### Unclear

The data does not clearly support or reject the hypothesis.

### Probably noise

Changes were inconsistent or too small relative to normal variation.

The system should never claim that the experiment proves causality.

---

# 15. Interactive Lab Report

The Lab Report is the primary result experience.

It should feel more like the conclusion of an experiment than a normal analytics dashboard.

## Section 1 — The question

> Does walking after dinner improve my sleep?

## Section 2 — What we predicted

Example:

**Predicted**

Morning energy  
**+8–15%**

Confidence  
**Moderate**

## Section 3 — What actually happened

Example:

**Observed**

Morning energy  
**+11%**

Sleep quality  
**+7%**

## Section 4 — Prediction vs reality

A prominent visual comparison:

**Prediction:** +12%  
**Observed:** +11%

or:

Predicted range:  
8% ───────────── 15%

Observed:  
─────────● 11%

## Section 5 — Interactive chart

Show experiment data over time.

The chart should allow the user to explore:

- intervention days
- skipped days
- daily outcome
- baseline
- predicted outcome/range
- observed trend

Hovering or tapping a day reveals its values and note.

## Section 6 — Signal or noise

Example:

**Likely signal**

> Your morning energy improved consistently on intervention days. The improvement was close to the original prediction and larger than your normal day-to-day variation.

Or:

**Unclear**

> Your energy improved, but sleep timing and inconsistent adherence make it difficult to separate the effect from normal variation.

## Section 7 — What we learned about you

This should use personal language.

Example:

> Evening movement appears to be positively associated with your next-morning energy.

> Your bedtime consistency may matter more than the duration of your walk.

## Section 8 — Prediction accuracy

Example:

**Prediction accuracy: 91%**

This does not represent scientific confidence.

It represents how close the forecast was to the observed outcome.

## Section 9 — What to test next

Example:

> Keep the 20-minute walk, but test whether doing it immediately after dinner works better than doing it later.

CTA:

**Run this experiment**

This creates the next learning loop.

---

# 16. Personal learning model

Every completed experiment contributes to the user's experiment history.

For V1, this can be lightweight.

Store:

- hypothesis
- intervention
- metrics
- prediction
- observed outcome
- result classification
- adherence
- relevant notes

Future experiment predictions should receive previous relevant experiment outcomes as context.

Example:

Experiment 1:

> Evening walking improved morning energy by 11%.

Later:

> “Would exercising after work improve my focus?”

The system can use prior evidence that the user responds positively to evening physical activity.

The product therefore becomes more personalized as experiments accumulate.

---

# 17. Experiment history

Users should be able to view previous experiments.

Each experiment should show:

- experiment question
- date
- result
- prediction
- observed outcome
- signal classification

Example:

**Walk after dinner**

Prediction: +12% energy  
Observed: +11%

**Likely signal**

---

# 18. Seeded completed experiment

The product should support seeded historical experiment data.

This allows a completed experiment to be explored without waiting for a real multi-day experiment to finish.

The seeded experiment should use the same product flows and data structures as a real completed experiment.

Example:

**Experiment**

Does walking after dinner improve morning energy?

Days 1–7 contain realistic sample check-ins.

The user should be able to open the completed experiment and explore the full Lab Report.

---

# 19. Main screens

V1 requires:

1. Persona onboarding
2. Home / experiment dashboard
3. Create experiment
4. AI experiment proposal
5. Prediction preview
6. Active experiment dashboard
7. Daily check-in
8. Experiment history
9. Interactive Lab Report

---

# 20. Homepage

For a new user:

Primary message:

**Stop guessing what works for you. Test it.**

CTA:

**Run your first experiment**

Supporting examples:

- Does walking after dinner improve my sleep?
- Does less caffeine improve my focus?
- Does waking earlier actually improve my productivity?

For a returning user, the homepage becomes the active experiment dashboard.

---

# 21. Mobile-first design requirement

The product is a responsive web application designed mobile-first.

The daily loop must work particularly well on a phone because check-ins happen throughout normal life.

Desktop can provide a richer Lab Report experience.

Priority:

1. mobile daily check-in
2. mobile experiment dashboard
3. desktop/mobile Lab Report
4. responsive experiment creation

---

# 22. Notifications

Push notifications are out of scope for initial V1.

The product may visually show when today's check-in is due.

Reminder infrastructure can be added later.

---

# 23. V1 scope

## Must have

- persona creation
- natural-language experiment question
- AI-generated experiment
- predictive forecast
- one active experiment
- short multi-day experiment structure
- manual daily check-ins
- experiment timeline
- lightweight N-of-1 analysis
- prediction vs actual comparison
- interactive Lab Report
- experiment history
- previous experiment context available to future predictions
- mobile-responsive experience
- seeded completed experiment

## Should have

- notes/confounder logging
- prediction confidence explanation
- suggested next experiment
- safety checks around inappropriate experiments
- interactive charts

## Nice to have

- edit AI-generated experiment before starting
- compare experiments
- share/export Lab Report
- richer visualization of personal patterns

---

# 24. Explicitly out of scope for V1

- Apple Health integration
- Google Health Connect
- wearables
- automatic sleep/activity ingestion
- medical diagnosis
- treatment recommendations
- real clinical significance testing
- multiple simultaneous experiments
- social features
- public profiles
- coaching marketplace
- native mobile apps

---

# 25. V2

The clearest V2 is health-data integration.

## Apple Health

Possible metrics:

- sleep duration
- sleep stages
- steps
- workouts
- resting heart rate
- heart-rate variability

Manual logging remains available for subjective metrics such as:

- energy
- mood
- focus
- cravings
- perceived sleep quality

Automatic data collection reduces user effort while preserving the experiment model.

---

# 26. Success metrics

The core loop is successful if a new user can:

1. create their persona,
2. state a goal or question,
3. understand the proposed experiment,
4. understand what the product predicts,
5. begin the experiment,
6. complete a daily check-in,
7. understand experiment progress,
8. read a completed Lab Report,
9. explain what they learned about themselves,
10. start or understand the next recommended experiment.

## Longer-term metrics

- experiment start rate
- Day 3 experiment retention
- experiment completion rate
- daily check-in completion
- percentage of completed experiments producing a clear learning
- second-experiment start rate
- number of completed experiments per user

---

# 27. Team ownership

## Shakeb — Product + Engineering

Owns:

- product requirements
- technical architecture
- backend
- experiment model
- predictive engine
- AI experiment generation
- data model
- analysis engine
- product logic
- testing and reliability

## Nazmul — UI/UX

Owns:

- visual direction
- information hierarchy
- interaction design
- responsive layouts
- onboarding design
- experiment dashboard UI
- check-in UI
- Lab Report presentation
- visual polish
- motion and transitions

Product behavior and experience decisions are collaborative.

---

# 28. Product thesis

The product is built around one idea:

**People should not have to guess which habits work for them.**

Give the system a goal.

Let it predict what will happen.

Test the change in real life.

Measure the result.

Compare expectation with reality.

Learn something about yourself.

Then run a better experiment.