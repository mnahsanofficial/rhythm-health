# Prediction versus reality

Mocked Chromium captures at 390 × 900 and 1440 × 900. Auth, experiment, report and daily records are fake. No paid model calls, report generation or database writes.

- `before`: the original prediction is visible and the observed result is ready to reveal.
- `during`: the measured result and its marker enter after pressing Reveal my result.
- `after`: the comparison is settled, including range membership and backend prediction accuracy.

Regenerate from `frontend/`: `CAPTURE_UI_MOTION=1 npm run test:e2e -- lab-report-learning`.

The reveal uses a 480ms settle with opacity and 10px translation. It never counts through intermediate estimates. The original forecast is fixed. Replay uses the already-loaded comparison; no network request is made. Keyboard focus stays on the button, and a polite status announces whether the result is inside or outside the predicted range. Reduced motion shows the final state immediately.

The comparison is the first report section. Missing written takeaways and next-experiment content use explicit waiting states. Existing calculated results remain available below it.

Self-review: removed the verdict's surrounding card treatment so it does not compete with the comparison. No confetti, ambient animation or delayed buttons. The score retains the explanation that accuracy is not scientific confidence.
