# Public landing

Chromium at 390 × 900 and 1440 × 900. The sample profile is explicitly labelled, and the new interaction makes no API calls or storage changes. No accounts, database writes or model calls.

`before`, `during` and `after` show removing a sample habit and adding it back. Its checkmark responds over 150ms, and the corresponding ring marker arrives over 280ms using transform and opacity. No animation loops. Reduced motion shows the final state immediately. The test uses native checkbox keyboard controls, retains focus and checks the marker's accessible description.

Regenerate from `frontend/`: `CAPTURE_UI_MOTION=1 npm run test:e2e -- landing-motion`.

Self-review: removed the signed-out history link, which interrupted the primary onboarding action. Moved the example questions below the product explanation. Tightened the sample panel and prevented the desktop CTA from wrapping. Signed-in home continues to show the personal dashboard, not this sample.
