# Mobile app plan (V1)

The plan for `apps/mobile/`, an Expo app for the daily loop. Written **31 Oct 2026** against `main` at `082a878` (after #33). Step 1 shipped in #35 and Today/Check-in in #36. Reminders and Progress (steps 4 and 5) are built together on `feat/mobile-reminders-progress`, as requested by Nazmul, with separate red/green commits and an iPhone check before PR creation. Setup and verification: [`apps/mobile/`](../apps/mobile/README.md). Status and dates: [REMAINING_WORK.md](REMAINING_WORK.md#plan-to-thursday-5-nov).

## Why mobile

Reviewers on the 30 Oct feedback call said daily tracking doesn't make sense on a website for a 10-day experiment. People have to remember to open a site every day, so they drop off, and a missed day weakens the result. A phone app with a daily reminder fixes the part of Rhythm that happens every day. The parts that happen once (setting up, designing the experiment, reading the report) work fine on the web for now.

The web calendar reminder (#29) is a stopgap until the app's reminder works.

## V1 scope, nothing more

The app does the **daily loop** for an experiment that's already running:

1. Sign in (same account as the web).
2. **Today:** what to do today.
3. **Check-in:** today's answers, about 30 seconds.
4. **Progress:** the days so far.
5. **Daily reminder:** a local notification when the next day opens.

**Stays on the web in V1:** onboarding, asking a question and starting an experiment (the paid proposal), finishing an experiment, the Lab Report (including writing the narrative, also paid), history and the demo reset. When the app needs one of these, it says so and links to the web.

**The app makes no paid AI calls.** Every endpoint it uses is a database read or write.

## Shared code it must use

- **Types:** `@rhythm-health/contract` ([packages/contract](../packages/contract/README.md)). Use `Profile`, `Experiment`, `ExperimentTimeline`, `ExperimentDay`, `Checkin` and `CheckinInput`. Never hand-write API types; after a backend change, run `npm run contract:generate`.
- **Design tokens:** `@rhythm-health/brand` ([packages/brand](../packages/brand/README.md)). Use `COLORS`, `FONT_FAMILIES`, `NATIVE_TYPOGRAPHY`, `SPACING`, `RADII`, `LAYOUT` and `MOTION_DURATION_MS`. No literal colours or font sizes in screens.
- **Design rules:** [DESIGN.md](../DESIGN.md), especially "Ours, not AI-default", which was written for both apps.

## Screens

All calls send the Supabase access token as `Authorization: Bearer …`, exactly as the web does ([API contracts](rules/api-contracts.md)). Every screen has loading, error and empty states ([UI quality](rules/ui-quality.md)). "Offline" means the phone has no connection.

### 1. Sign in

- **Shows:** email and password fields and a Sign in button. A note: "New here? Set up your rhythm on the web first", with a link to the web app.
- **Calls:** Supabase Auth email/password sign-in with the public anon key, then `GET /api/profile`.
- **States:** busy while signing in; wrong password or unreachable service as a plain error; offline as "No connection". A missing profile (404) shows "Finish setting up on the web" with the link.
- **Done means:** a person signs in with the same account as the web, the session survives an app restart, and Sign out works.

### 2. Today (the home screen)

- **Shows:** the question, the small change, "Day 4 of 10" and the phase (normal day or test day). Then one action:
  - **Check in for day N**, if today isn't recorded yet;
  - **Done for today**, with "Day N+1 opens {time}" from `next_day_at`;
  - **Your results are ready**, with a link to the report on the web, once the experiment is complete. An ended but unfinished experiment links to finishing on the web first.
- **Calls:**
  - `GET /api/experiments?status=active`;
  - `GET /api/experiments/{id}/progress`, which supplies the day, phase, states, counts and `next_day_at`.
  - Refresh on opening, on returning to the foreground, and after a check-in ([PROGRESS_API.md](PROGRESS_API.md)).
- **States:** loading skeleton; no active experiment ("Start your next experiment on the web"); error with Try again; offline showing the last loaded data, marked "Offline, last updated {time}", with check-in disabled.
- **Done means:** the screen never calculates days itself. Day, phase, "done for today" and the next opening all come from the progress response.

### 3. Check-in

- **Shows:**
  - one input per `experiment.metrics` item: scale, number, yes/no or duration;
  - on test days, "Did you make the change today?";
  - an optional note.
  - Scales name both ends in words ([DESIGN.md](../DESIGN.md) rule 4). Use optional backend `min_label` / `max_label` from experiment design, with neutral "Low / High" per absent end; never infer meanings from a metric key. [B12 contract](SCALE_WORDS_CHART_DAYS.md).
- **Calls:**
  - `GET /api/experiments/{id}/checkins`, to prefill today's answers if they're already recorded;
  - `POST /api/experiments/{id}/checkins` with a `CheckinInput`, which records or replaces **today only**.
- **States:** busy while saving, with a double tap ignored; per-field errors from a 422; other errors with Try again and the answers kept; offline keeps the answers on the phone and disables Save, with "You're offline; your answers are kept".
- **Done means:**
  - all four metric types work;
  - the test-day question appears only on test days;
  - after a save, Today shows Done for today. Rescheduling the reminder is added in step 4.

### 4. Progress

- **Shows:** every planned day as recorded, missed, today, coming up or not observed, from `days[].state`. Counts: "4 of 10 recorded", plus missed and remaining. Tapping a recorded day shows its answers and note.
- **Calls:** `GET /api/experiments/{id}/progress`, plus the check-ins list for the answers.
- **States:** loading, error with retry, offline with the last loaded data.
- **Done means:**
  - day states come only from the response, and the app never infers missed days;
  - phase labels use `baseline` / `test`;
  - the screen holds at small phone sizes and with large system text.

### 5. Daily reminder

- **What it is:** a **local** notification scheduled on the phone for `next_day_at` ("Day 5 is open. Your check-in takes about 30 seconds."). No push server is needed.
- **Scheduling:** reschedule whenever progress loads. Cancel it when there's no next day (`next_day_at` is null), the experiment ends, or the person signs out.
- **Content:** the day only, never the habit question, because notifications show on the lock screen (the same rule as the web calendar event).
- **Tapping it:** opens the Check-in screen for the current day, prefilled if already recorded (Nazmul's 31 Oct request). Fresh progress and ownership are checked after auth; the tap never supplies the day.
- **States:** ask for notification permission after the first check-in, not on first launch. If permission is refused, Today shows "Reminders are off" with a way to turn them on in Settings.
- **Done means:** the notification fires at the next day's opening time in the phone's time zone, including across the 1 Nov DST change in America/Toronto, and tapping it opens the right screen.

## What moves to mobile in V2

Reading the Lab Report (a compact view of the comparison, verdict and chart), experiment history, starting the next experiment from the report's suggestion (a paid proposal, guarded the same way as the web), and onboarding. Health-data integration (PRD §25) also belongs on mobile.

## Dependencies and risks

| # | Risk or dependency | What to do | Owner |
|---|---|---|---|
| M1 | **The phone must reach the backend.** `localhost` on a phone is the phone itself | Run the backend with `--host 0.0.0.0`, put the Mac's local-network address in the app's API URL setting, keep both on the same Wi-Fi, and allow the connection through the macOS firewall. A tunnel is the fallback when the Wi-Fi blocks devices from seeing each other | Nazmul |
| M2 | **CORS.** Native requests aren't subject to CORS, but Expo's web preview is | No backend change for the phone. If we use Expo web, add its origin to `CORS_ORIGINS` in `backend/.env.local` (a local setting, not code) | Nazmul |
| M3 | **Expo Go limits.** Only libraries bundled in Expo Go work; no custom native code | Local notifications and font loading work in Expo Go; remote push isn't needed for V1. Check every library against the current Expo docs before adding it | Nazmul (Codex) |
| M4 | **npm workspace versions.** The web uses React 19.3; the Expo SDK may pin a different React or React Native | Keep the app's versions in `apps/mobile/package.json` exactly as the Expo SDK requires. Prove root `npm ci`, the web build and the web tests still pass in the same PR | Nazmul (Codex) |
| M5 | **Session storage.** Supabase on React Native needs persistent storage for the session | Use Supabase's documented React Native setup. Never put a service-role key in the app: only the public anon key and API URL, as `EXPO_PUBLIC_…` values in `apps/mobile/.env.local` | Nazmul |
| M6 | **Scale words for check-in metrics.** Built with B12 on `feat/scale-words-chart-days` | Optional `min_label` / `max_label` from design; Low / High on each missing end. No migration. [Contract/evidence](SCALE_WORDS_CHART_DAYS.md) | Nazmul, under the 31 Oct deadline decision |
| M7 | **Only today's check-in can be saved** (R5). A missed day can't be filled in later | Say so on Progress ("Missed days can't be filled in") rather than offering it | Decided; no work |
| M8 | **Demo data for Monday.** The mobile loop needs an *active* experiment with recorded days; the demo reset creates only a *completed* one | Demo with a real active experiment. Never write invented check-ins to the shared database. An active sample was selected by Nazmul on 31 Oct as PR 4, user-triggered/labelled/removable; it is built on `feat/active-demo-seed`, with no migration ([contract and verification](ACTIVE_SAMPLE.md); [deadline decisions](DECISIONS.md#deadline-decisions-by-nazmul--31-oct-2026)) | Nazmul; critical-path backend cover until Shakeb returns |
| M9 | **8x's Expo template.** Reviewers said a template is already provided | Start from it if it fits our workspace (M4); record where it came from in the app's README | Nazmul |
| M10 | **Reminders differ from the PRD.** PRD §22 kept notifications out of V1 | Local reminders are now V1 scope after the feedback. Record it in DECISIONS.md when the app lands | Nazmul and Shakeb |

## Build order, with something to demo by Monday 2 Nov

Each step is a small PR, with tests first and a demo under one minute when it works. Exceptions approved 31 Oct: steps 2/3 shipped together in #36; steps 4/5 ship together in `feat/mobile-reminders-progress`, with separate red/green commits per feature.

1. **Scaffold and sign in** (Sat 31 Oct):
   - `apps/mobile` as an npm workspace, with the contract and brand packages wired in;
   - env values by name;
   - Supabase sign-in and `GET /api/profile`.
   - Demo: sign in on a phone with Expo Go.
2. **Today** (Sat 31 Oct–Sun 1 Nov): the active experiment and progress. Demo: Today shows the real day and the next opening.
3. **Check-in** (Sun 1 Nov): all metric types, the test-day question, the note and saving. Demo: a 30-second check-in that flips Today to Done for today.
4. **Daily reminder** (Sun 1 Nov): local notification at `next_day_at`; tapping it opens the check-in. Demo: a development-only test notification after 10 seconds, opening the check-in. Production uses only `next_day_at`.
5. **Progress** (Mon 2 Nov morning, if time): the day states and answers. Demo: the timeline fills in after a check-in.

**For the Monday call:** steps 1–4 working on a real phone against the local backend. Step 5 can follow on Tuesday.
