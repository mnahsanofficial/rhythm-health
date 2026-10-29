# Personal dashboard

Chromium captures at 390 × 900 and 1440 × 900, with fake auth and API responses. The original homepage is recorded under `../before/`. No paid model calls or database writes.

- `before.png`: personal experiment and timeline, before selecting a recorded day.
- `during.png`: recorded answers entering after a day selection.
- `after.png`: settled answers, with the same surrounding layout.
- `done-today.png`: today's check-in is recorded; the primary action becomes editing it.

From `frontend/`, regenerate with `CAPTURE_UI_MOTION=1 npm run test:e2e -- home-dashboard`.

Motion only follows day selection: a 6px transform and opacity transition over 200ms. Reduced motion shows the final panel immediately. The timeline reserves space for answers so opening a day does not move the navigation. Loading skeletons are static. Counts come from check-ins; an intervention answer of “Not today” still counts as recorded but not followed.

Self-review: removed the desktop check-in card's stretched height. The question and daily action now keep their own proportions. Removed all sample rhythm, example questions and marketing sections from signed-in home. The seeded example remains available through the small Demo navigation link at `/demo`.
