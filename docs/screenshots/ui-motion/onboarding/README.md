# Onboarding rhythm and choices

Mocked Chromium captures at 390 × 900 and 1440 × 900. No real accounts, database writes or model calls.

- `habits-before`, `habits-during`, `habits-after`: grouped daily habits, selecting a chip and the resulting selection count.
- `constraints`: chosen limits with a live count explaining how the plan will fit daily life.
- `summary-before`, `summary-during`, `summary-after`: final optional step, the personal rhythm arriving, and settled summary with immediately available save controls.

Regenerate from `frontend/`: `CAPTURE_UI_MOTION=1 npm run test:e2e -- onboarding-motion`.

Habit choices are grouped into morning, afternoon and evening; custom habits get their own group. Native checkbox labels retain keyboard behavior. The tick has reserved space and animates only opacity/transform for 150ms. Step slides are skipped with reduced motion. Skip remains available on empty optional steps; going back keeps selected answers.

The completed arc arrives once over 480ms and new habit markers over 280ms. Both use transform and opacity; SVG geometry and sleep values are final immediately. CSS media queries control motion so the server and browser produce identical marker markup. The React hydration regression reproduces differing server/browser motion preferences explicitly.

Self-review: removed the old 1.3-second delay and stagger from summary rows and account controls. The ring gets the arrival; the user can read, edit or save immediately. Ordinary skeletons are static.
