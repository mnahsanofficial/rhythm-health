# Check-in feedback

Screens captured in Chromium at 390 × 900 and 1440 × 900 with mocked API and auth responses. No shared database writes or paid model calls.

The original screen is in `../before/{390,1440}/check-in.png`.

- `answers-before`: unanswered check-in.
- `answers-during`: selecting an answer updates the count and moves the progress bar.
- `answers-after`: all required answers filled; progress settled.
- `saved-before`: failed save with answers preserved, ready to retry.
- `saved-during`: successful retry brings in the tick and today's day marker.
- `saved-after`: recorded day, numbered timeline and immediately available next actions.

Capture command from `frontend/`: `CAPTURE_UI_MOTION=1 npm run test:e2e -- checkin-feedback`.
Intermediate frames capture motion after the triggering action; final frames wait for the visible state to settle. These are evidence images, not snapshot assertions.

Feedback uses transform and opacity only: 150ms choice response and 280ms progress/confirmation on the settle curve. Reduced motion sets the final state immediately. The skeleton is static; nothing loops. Native radio keyboard behavior and focus outlines remain intact. Successful saving moves focus to the confirmation heading.

Self-review: removed the extra encouragement sentence beside the counter. “Note optional” gives useful information in the same space. The count reflects actual valid answers, including “Not today”; it does not imply that following the intervention is required for a useful check-in.
