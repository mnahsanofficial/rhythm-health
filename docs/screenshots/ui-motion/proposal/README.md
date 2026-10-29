# Proposal and prediction

Chromium frames at 390 × 900 and 1440 × 900. All auth and API responses are mocked from the existing typed fixtures. No real proposal requests, paid model calls or shared-database writes.

- `question.png`: question entry and goal-based starters.
- `before.png`: request held open; the AI wait explains what goes into the response.
- `during.png`: forecast arriving with the finished proposal.
- `after.png`: settled preview with review caution, plan, timeline, metrics and forecast.

Regenerate from `frontend/`: `CAPTURE_UI_MOTION=1 npm run test:e2e -- proposal-motion`.

The waiting list describes work, without marking stages complete or inventing percentage progress. Only this AI wait uses a pulsing skeleton. The range settles using scaleX over 480ms; its actual numeric endpoints are always available as text. The endpoints fade to full opacity over 280ms without counting through invented estimates. Reduced motion shows the final forecast immediately.

Self-review: removed the entry form and starter sidebar from the preview state. They repeated an action the user had already completed and crowded the plan. “Ask something else” returns to the question field and restores keyboard focus. On desktop, the original forecast sits beside the plan; on phones, the plan leads into the forecast and start decision.
