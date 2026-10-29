# Experiment history

Mocked Chromium captures at 390 × 900 and 1440 × 900. Experiments, auth and reports are fixtures; no paid model calls or database writes.

- `before`: newest-first ordering, forecast and observed result readable together.
- `during`: oldest-first selected; existing rows move to their new positions.
- `after`: settled chronological order with keyboard focus retained on the sort control.

Regenerate from `frontend/`: `CAPTURE_UI_MOTION=1 npm run test:e2e -- experiment-history`.

Reordering uses a 280ms transform on the settle curve. Entries retain their identities and report state; there is no entrance fade on every row. Reduced motion changes order immediately. Native radio controls support keyboard selection. Seeded records are labelled Sample experiment even if no report is ready. History loading skeletons are static.

Self-review: removed the repeated rounded-card shell from each experiment. Divider rows and clear forecast/observation columns make comparison easier. Loading, missing and failed report states remain explicit; missing reports do not hide completed experiments.
