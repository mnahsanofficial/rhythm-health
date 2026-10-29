# UI motion evidence

Baseline audit: `4d54a84`, from main `cac55a4`. Final screens use mocked auth and API responses at **390px** and **1440px**. Samples are labelled. These images document visual checks and animation frames; they are not snapshot tests.

| Screen | 390px baseline | 390px final | 1440px baseline | 1440px final | Animation frames and notes |
|---|---|---|---|---|---|
| Check-in | [Before](before/390/check-in.png) | [After](check-in/390/answers-after.png) | [Before](before/1440/check-in.png) | [After](check-in/1440/answers-after.png) | [Answer progress and save confirmation](check-in/README.md) |
| Personal dashboard | [Audit dashboard](before/390/dashboard.png) | [Personal home](dashboard/390/after.png) | [Audit dashboard](before/1440/dashboard.png) | [Personal home](dashboard/1440/after.png) | [Recorded-day selection](dashboard/README.md) |
| Proposal | [Before](before/390/prediction-preview.png) | [After](proposal/390/after.png) | [Before](before/1440/prediction-preview.png) | [After](proposal/1440/after.png) | [Question, wait and forecast arrival](proposal/README.md) |
| Onboarding habits | [Before](before/390/onboarding-habits.png) | [After](onboarding/390/habits-after.png) | [Before](before/1440/onboarding-habits.png) | [After](onboarding/1440/habits-after.png) | [Choices, constraints and rhythm arrival](onboarding/README.md) |
| Onboarding summary | [Before](before/390/onboarding-summary.png) | [After](onboarding/390/summary-after.png) | [Before](before/1440/onboarding-summary.png) | [After](onboarding/1440/summary-after.png) | [Summary before/during/after](onboarding/README.md) |
| Lab Report | [Before](before/390/lab-report.png) | [After](report/390/after.png) | [Before](before/1440/lab-report.png) | [After](report/1440/after.png) | [Prediction-versus-reality reveal](report/README.md) |
| Public landing | [Before](before/390/landing.png) | [After](landing/390/after.png) | [Before](before/1440/landing.png) | [After](landing/1440/after.png) | [Sample habit selection](landing/README.md) |
| History | [Before](before/390/history.png) | [After](history/390/after.png) | [Before](before/1440/history.png) | [After](history/1440/after.png) | [Chronological reorder](history/README.md) |

The dashboard audit image shows the prior experiment dashboard; final dashboard images show the new signed-in home entry point. Baseline and final report fixtures can differ. These are design comparisons, not a pixel regression or a claim that each fixture represents one real person's experiment.

Each screen directory contains `before`, `during` and `after` frames. Check-in and onboarding include separate frames for their additional interactions. `after/` and `during/` at this index level retain the earlier overnight sleep-duration regression captures.

Reference research captures are retained in [references/](references/): [Karma](https://www.karma.business/) and [8x Research](https://8xresearch.com/), at both widths. The direction borrows attention to hierarchy, spacing and visible product behavior; Rhythm's subject, palette, copy and layouts remain its own.

## Reproducing the evidence

From `frontend/`, run `CAPTURE_UI_MOTION=1 npm run test:e2e`. Services are mocked. Individual screen READMEs show narrower commands. The existing overnight-summary E2E cases also write their historical screenshots on ordinary runs.

Capture helpers suppress Next.js's development overlay, which can cover mobile controls. They wait for real UI states and settled motion where an after frame requires it. Intermediate frames are evidence of movement and may vary slightly with browser scheduling.

## What was deliberately left out

- Ambient loops, automatic carousels, global page fade-ups and confetti.
- Animated dimensions, delayed controls and fabricated AI progress.
- Count-ups through intermediate health estimates; final values remain honest.
- A new backend contract, generated report text, or invented findings where content is pending.
- Real paid proposal/completion calls and shared-database writes during this work.

The two signature moments are the completed personal rhythm and the Lab Report comparison. Other motion stays small and follows an interaction or a real state change.
