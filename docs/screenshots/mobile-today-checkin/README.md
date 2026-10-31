# Mobile Today and Check-in evidence

31 Oct 2026, Expo web preview with every external request intercepted. Account, experiment, answers and timestamps in these images are fixtures; no shared database write or paid call was made. Browser checks cover 390px, 768px and 1440px. They do not substitute for the iPhone check.

At each width:

- `today`: server-returned day, phase, question and small change.
- `checkin`, `answers`, `checkin-lower`: all four metric inputs, test-day question, note and save action. The inner native scroll container requires separate upper/lower frames.
- [Motion frames](../ui-motion/mobile-today-checkin/) (`save-before`, `save-during`, `save-after`): the confirmation tick's opacity transition, captured with a controlled browser clock. Text and actions are available immediately; no health number is animated. Reduced-motion behavior is tested separately.
- `done`: recorded day and the next opening formatted from the API timestamp.
- `loading`, `empty`, `error`, `checkin-read-error`, `save-error`: visible pending/empty states and recovery. Read retries expose the form only after loading succeeds; save retry keeps the entered answers.

Self-critique: removed the second tinted saved-confirmation card so it does not compete with Done for today. Wrapped scales keep 48pt targets instead of squeezing ten choices into one row. The app retains normal system text scaling and scrolls; physical large-text and VoiceOver checks remain additional device coverage.

Nazmul's iPhone Expo Go check passed: sign in, Today, save his real check-in, automatic Done for today, then fully close/reopen with saved state intact. No agent supplied invented answers or credentials. No Android device check is claimed.
