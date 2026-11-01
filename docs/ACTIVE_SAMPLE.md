# Active sample (PR 4)

The signed-in web lab and mobile Today offer **Try a sample experiment** when no experiment is active. This is a user-triggered database write, never an automatic sign-in seed. A profile is required, as for a real experiment.

The fixed walk-after-dinner experiment starts on day 5 of 10. Days 1–3 contain labelled sample baseline answers, day 4 is missed, and today is ready for a test-day check-in. Design, prediction and past answers are pre-written. There is no proposal call, model call or new migration.

## API and isolation

- `POST /api/demo/active` with `{}` returns the active `ExperimentOut` (201). Auth supplies the owner; extra body fields are rejected. An existing active experiment or a concurrent start returns 409. Missing profile is 409; storage failures are 503.
- The existing `experiments.is_seeded` column is true. The partial unique index allowing one active experiment per profile is unchanged. Remove the sample before starting a real experiment.
- `POST /api/demo/active/{id}/remove` requires `{"confirmed": true}`. The delete matches **profile ID + experiment ID + is_seeded=true**. Foreign/missing/real experiments return 404. Check-ins and reports cascade only from that row. Both apps ask for confirmation and allow cancellation.
- General/completed experiment listings exclude samples. The active listing includes the sample for the daily loop. Prediction context filters samples at the repository before its candidate limit, and again in the history service before reading reports or calculating the track record.
- Progress, answers and deterministic analysis are scoped to a single owned experiment; there is no path combining sample check-ins with real check-ins. Seeded experiments cannot enter the paid report writer, even through a direct regenerate request.
- The existing completed demo reset deletes only its own deterministic sample ID, so it cannot erase the active sample.

Creating the experiment and its past check-ins uses two existing repository writes. If the check-in write fails, cleanup attempts to delete only the newly created sample. A persistent storage outage can also prevent cleanup: after reconnecting, the labelled sample can be removed through the same confirmed-removal flow.

## Mobile and UI

Today, Check-in (including its saved state), Progress, the web lab and web detail explicitly label sample data. Sample answers are excluded from real history/context even if someone completes the sample through a direct API call. The sample is removable after its days end as well.

Mobile cancels daily and development test reminders for the sample, hides the reminder opt-in notice and disables Settings reminder controls. The account's reminder preference is retained for future real experiments. Stale reminder taps cannot open a sample check-in. Web calendar downloads are hidden for the sample too.

## Verification

Backend tests use in-memory repositories with external HTTP requests blocked. They cover slot conflicts, ownership, confirmation, exact deletion scope, cleanup, completed-demo coexistence, real-start-after-removal, history/context isolation, no AI, and unavailable storage. Native tests cover start/remove, failure/retry, offline controls, cancellation and reminder suppression.

Browser checks at 390px and 1440px use intercepted fake auth/API responses for start → Today → Progress → sample check-in → Done for today → cancel/confirm removal. [Screenshots](screenshots/active-sample/) include both web and Expo web preview. No new physical iPhone or Android-device verification is claimed; web preview does not establish native notification or SecureStore behavior. No paid AI call, real-account test data or shared-database test write was used.

Final checks after fetching/merging `origin/main` at `1b015f2`: root `npm test` (181 web, 108 mobile, 11 brand, 6 contract; logging checks included), root lint/typecheck, 305 backend tests, web production build and iOS/Android production exports passed. Full Playwright: 92 passed and one existing onboarding keyboard skip. Native exports used fake public settings with dotenv disabled.
