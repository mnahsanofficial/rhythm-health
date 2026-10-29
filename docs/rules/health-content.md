# Health content

Rhythm runs behavioural experiments and gives personal observations. It doesn't diagnose or treat anything (PRD §5.7, §24). This applies to UI copy, AI prompts, sample data, seed data and docs.

## Never

- **Calorie counting:** no calories, portions, macros or food amounts anywhere: not in questions, habits, metrics or sample data. Habits describe routines ("Late dinner"), never amounts.
- **Weight targets:** no goal weights, BMI or body measurements.
- **Medical claims:** no "treats", "cures", "diagnoses" or "clinically proven", and no medication advice.
- **Proof language:** a short N-of-1 experiment shows a **pattern, not proof**. Don't say it "proves" anything, and never call prediction accuracy scientific confidence (PRD §5.5, §14, §15).

## Always

- Use the four signal labels as the backend returns them:
  - Likely signal
  - Possible signal
  - Unclear
  - Probably noise

  Their wording is in `frontend/lib/report/copy.ts`.
- Show predictions as ranges with a confidence level, not single numbers (PRD §9).
- When the safety layer blocks a request, show its reason and its safer alternative (PRD §10).

## Safety lives in the backend

`backend/app/services/safety.py` blocks:
- extreme sleep restriction;
- medication changes;
- dangerous fasting or food restriction;
- exercise that risks injury;
- unsafe substance use.

It checks both the user's question and the AI's proposal. The frontend never makes its own safety decisions; it shows the backend's (TRD §43).

## Onboarding

The profile asks about sleep, activity, goals, habits and constraints only. Onboarding says so: "Nothing medical, and no weights or calories."
