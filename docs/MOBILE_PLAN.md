# Mobile app plan

The plan for `apps/mobile/`, an Expo app for the daily loop. Written **31 Oct 2026** against `main` at `082a878` (after #33). Step 1 shipped in #35 and Today/Check-in in #36. Reminders and Progress (steps 4 and 5) are built together on `feat/mobile-reminders-progress`, as requested by Nazmul, with separate red/green commits and an iPhone check before PR creation. Setup and verification: [`apps/mobile/`](../apps/mobile/README.md). Status and dates: [REMAINING_WORK.md](REMAINING_WORK.md#plan-to-thursday-5-nov).

> **Sprint update, 2 Nov:** the [Full app](#full-app) section supersedes the web-only limits below. The original daily-loop plan is retained as implementation history.

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


## Full app

**M0 plan, 2 Nov 2026; final demos Thursday 5 Nov.** A person must be able to create an account, set up their rhythm, design and run an experiment, finish it and read the Lab Report entirely in the mobile app. Today, Check-in, Progress, local reminders and the active sample already exist; replace their web hand-offs with native destinations. Web features are frozen: bug fixes only. Health integrations remain outside this sprint.

All backend APIs already exist. Endpoint names and types below are checked against [`packages/contract/src/generated.ts`](../packages/contract/src/generated.ts) and its [public exports](../packages/contract/src/index.ts). `{id}` means the owned experiment ID, not an ID supplied by a notification. Supabase Auth is separate from the FastAPI contract. Product calls carry the current Bearer token; no service-role key or phone-calculated experiment days.

### Missing screens, contracts and acceptance

Every row includes initial loading, recoverable network/server error with explicit retry, offline messaging and disabled writes, and expired-session routing back through sign-in. Retain entered answers on recoverable failures; prevent duplicate submissions. A 404 must distinguish missing profile/report from an inaccessible experiment. Never present a failed request as an empty list. Cached data must be labelled; do not promise persisted offline drafts without implementing and testing them.

| Screen / step | Existing endpoints and shared types | Specific states | Done means |
|---|---|---|---|
| **Sign up** | Supabase `auth.signUp({email,password})`, `signInWithPassword`; then `GET /api/profile` → `Profile` | Invalid email, required fields, password under six characters; submitting; auth rejection; confirmation email sent with no session; signed in; storage failure | Match web `AuthForm` validation and copy, show/hide password, sign-in switch and confirmation message. No profile write until a session exists. New users continue to native onboarding; returning users with a profile reach Today. Session survives restart in existing SecureStore. |
| **Onboarding: seven questions → rhythm summary → save** | `GET /api/profile`; `PUT /api/profile` with `ProfileInput` → `Profile`; shared age/activity choices and bounds | Missing profile (404) starts setup; existing profile prefills; required/optional steps, Back, Skip, summary edits; invalid sleep schedule; saving; 422 fields; save failure with answers retained; saved | Match web questions, choices, validation and copy for age, sleep/wake schedule, actual sleep, activity, goals, optional habits and constraints. Validate overnight time-in-bed plausibility and sleep bounds as the web does. Summary edits return to summary. Save only complete valid input; successful save refreshes the profile gate and enters Today without a web link. Preserve the draft through confirmation/sign-in; scope any persisted draft safely and clear it on successful save or account change. |
| **Ask a question** | `GET /api/experiments?status=active` → `Experiment[]`; `POST /api/experiments/propose` → `ProposeResponse` (request via generated `operations`) | Empty/invalid trimmed question (5–500 characters); checking active slot; blocked by active experiment; proposing; safety refusal/redirect; incomplete response; 422/502/503; explicit retry | Match web safety copy and suggestions. Check the active slot before the paid request and stop on a failed check. One explicit submit makes at most one in-flight proposal request. No auto-submit from navigation or suggested-question prefill. |
| **Proposal → your guess → reveal** | Reuse `ProposeResponse`, `ExperimentProposal`, `Prediction`; no extra request for reveal | Allowed plan; safety-blocked plan; missing proposal/prediction; guess available/unavailable; invalid/zero/signed guess; locked guess; forecast revealed | Explain the change, baseline/test lengths, measures and success rule. Capture the primary-metric guess before rendering the AI forecast, lock it on reveal, and match web range/validation (−100 to +200 percent, including zero, signed values and comma decimals). Honour `personal_guess_available`; show honest unavailable copy and allow the existing no-guess path. Changing the question clears the old proposal and guess. |
| **Start experiment** | Recheck active slot; `POST /api/experiments` with `SaveExperimentRequest` → `Experiment`; `POST /api/experiments/{id}/start` → `Experiment`; then existing progress read | Saving draft; starting; active-slot 409; `personal_guess_unavailable`; saved-but-not-started; retry; active | Save the proposal, prediction, category and locked `personal_guess_percent` when supported. Retain the saved ID so a failed start retries start rather than creating another draft. Offer explicit continue-without-guess only on the matching error. Land on Today and server-owned progress; reconcile reminders. |
| **Finish** | `GET /api/experiments/{id}`, `/progress`, `/checkins` as needed; `POST /api/experiments/{id}/complete` → `LabReport`; `NotEnoughCheckins` for documented 409 detail | Active/ended; confirmation/cancel including early finish; completing; insufficient baseline/test counts; already completed; error/retry | Match web finish eligibility and confirmation. Explain minimum counts from the backend error; never fabricate or backfill days. Completion is deterministic and free, opens the saved report even without a narrative, and cancels the reminder. Recover ambiguous failures by reading current state before retrying. |
| **Lab Report: prediction vs reality vs guess** | `GET /api/experiments/{id}/report` → `LabReport`, `Analysis`, `PredictionComparison`, `PersonalGuessComparison` | Loading; report not yet available; missing phase/baseline zero; old report without guess; no primary comparison; ready | Show AI range, actual change and original guess with units and honest unavailable explanations. Use server analysis, not a second native calculation. Include adherence, missed days and secondary measures. |
| **Lab Report: chart and signal or noise** | Same report: `ChartData`, `ChartPoint`, `ChartMetric`, `Signal` | Empty/sparse points; missing days; early-finish unobserved days; prediction band unavailable; each signal classification/reason | Draw the returned baseline/test phases, daily values, predicted band and day states without joining gaps into invented observations or compressing the calendar. Show signal verdict/reasons and “A short personal experiment shows a pattern, not proof.” Provide a readable text alternative and non-colour cues. |
| **Lab Report: written report** | Explicit `POST /api/experiments/{id}/report` → `LabReport`, `ReportNarrative`; never `regenerate=true` | Narrative absent; “Write my report”; writing; stored narrative; 404/409/502/503/network failure; retry; seeded report | Writing is optional and paid. Keep deterministic results visible on failure; don't repeat the call on mount/foreground. Render summary, interpretation, personal learnings, confounders and next question. Seeded reports use stored sample narrative and never request paid writing. |
| **“Run this experiment”** | Report narrative's `next_experiment`; `GET /api/experiments?status=active`; then the M2 flow | No narrative/suggestion; checking slot; existing active experiment; failed check; prefilled question | Prefill the suggested question in native Ask, without a paid call until explicit submit. Existing active experiment links to Today; M2 checks again before proposing. “Ask your own question” remains available when no narrative exists. |
| **History and past experiment detail** | `GET /api/experiments?status=completed` → `Experiment[]`; owned detail/progress/check-ins and report reads | Loading; empty; list; read failure; offline cache; missing/foreign experiment; old report without narrative/guess | Open any completed real experiment's native report, return to history and start a new question. Display completed dates/status honestly; samples remain excluded by the API. Older records degrade gracefully. |
| **Completed demo** | Explicit `POST /api/demo/reset` → `LabReport`; subsequent owned experiment/report reads | Explanation before reset; preparing/resetting; ready seeded report; reset error/retry; active real/sample coexistence | Native demo entry opens a labelled completed sample with comparison, chart, verdict and stored narrative. Reset affects only the completed demo, never the active sample or real experiment. No proposal/report-writing call; never misrepresent seeded answers as the person's data. Active sample start/remove remains the existing separate flow. |

### Risks checked now and remaining gates

- **Email confirmation:** the web's [`AuthForm`](../frontend/components/auth/auth-form.tsx) requires email and a password of at least six characters. It handles `data.session === null` with “We've sent a link to {email}. Open it to confirm your account, then sign in here.” and switches to sign-in; it does not configure `emailRedirectTo` or a native callback. A read-only `/auth/v1/settings` check on 2 Nov returned `disable_signup=false` and `mailer_autoconfirm=true`: email sign-up is enabled and confirmation is currently not required. No setting was changed and no account was created. Still treat confirmation as possible, preserve onboarding answers through the return to sign-in, and support both session/no-session responses in tests. Nazmul must verify new-account behavior on his iPhone in M1 (and the link destination if confirmation is enabled later); the agent must not create accounts or change shared auth configuration. Automatic app deep-link confirmation is not required to return manually to mobile sign-in.
- **Charts in Expo Go:** Expo documents [`react-native-svg` as included in Expo Go](https://docs.expo.dev/versions/latest/sdk/svg/). The installed Expo 58 manifest (`node_modules/expo/bundledNativeModules.json`) expects **15.16.0**; mobile has not yet added this dependency. Plan a small SVG chart using these primitives, installed with the SDK-compatible Expo installer in M3, rather than a chart stack requiring custom native modules. Verify root lockfile compatibility, native exports and an actual iPhone Expo Go chart before claiming it works. Text alternatives, gap handling and large text are acceptance criteria, not later extras.
- **Paid AI:** proposal (`POST /api/experiments/propose`) and narrative (`POST /api/experiments/{id}/report`) are paid; finish, reads, save/start and demo reset are not. Proposal may use multiple model calls; report writing returns stored narrative without another call unless regeneration is explicitly requested. Use explicit taps, duplicate-tap guards, no background retries and no regeneration. All automated tests fake Supabase/Auth/HTTP/SecureStore and proposal/report responses; backend tests fake Supabase/OpenRouter with external requests blocked. No real env files, shared-database writes or paid calls in tests. Hand checks use intercepted writes and clearly labelled fixtures; only Nazmul enters his real account/health answers. Record any deliberate real paid calls and their count in the PR.
- **Native assets:** app icon and OS launch splash cannot be fully assessed inside Expo Go's host branding. M5 prepares valid config/assets and export evidence; distinguish that from a standalone installed-app launch test. Fonts already have Expo-compatible dependencies; verify loading, fallback/error and text scaling rather than adding a new font stack.
- **Schedule and ownership:** Shakeb is away until Tuesday 3 Nov and has approved backend changes. Prefer existing APIs; any necessary backend change includes regenerated contract where applicable and a **For Shakeb** summary in its PR. Follow the pair rule for team-chat notice and announce any shared migration before applying it; none is planned. No new web feature work.

### PR order and review gates

| PR | Scope and demo | Target / gate |
|---|---|---|
| **M0 — docs** | This plan only, plus this session's log. | Open PR, give Nazmul the short plan, then wait for his OK before M1. |
| **M1 — sign up + onboarding** | Account creation, confirmation handling, seven questions/summary and profile save; replace missing-profile web hand-off. | First after OK (Mon 2–Tue 3 Nov). Separate failing-test and green implementation commits. Nazmul tests a new account on his iPhone **before the PR opens**. Then fetch, merge latest `origin/main`, rerun every required check, commit/push/open PR and stop. |
| **M2 — proposal flow** | Ask → proposal → guess → reveal → save/start → Today, including active-slot and partial-save recovery. | Tue 3 Nov; explicit paid actions mocked in tests. Independent reviewable PR after M1. |
| **M3 — finish + Lab Report** | Deterministic finish, three-way comparison, SVG chart, signal/noise, optional written report and native “Run this experiment”. | Tue 3–Wed 4 Nov; iPhone chart and finish/report flow evidence. |
| **M4 — history + completed demo** | Past results and a full labelled completed demo; keep active sample separate. | Wed 4 Nov; demo reaches the report without waiting for experiment days. |
| **M5 — polish** | App icon, splash, existing fonts, accessibility, navigation and state consistency across the full app. | Wed 4–Thu 5 Nov before demos. Final mobile-only walkthrough, 44pt targets, large text, reduced motion and screen-reader order. No deferred core screen. |

For M1–M5, write behavior tests first, confirm the intended failure and commit red separately before green. Use shared contract types and numeric brand tokens. Every API state must remain actionable; minimum 44pt targets, system text scaling and reduced motion apply from M1, not only M5. Check changed flows by hand in mocked browser previews at 390px and desktop width and state which native behaviors still need the phone. Native day/phase logic continues to come only from progress.

Before each PR, fetch and merge latest `origin/main` (no rebase), resolve conflicts and rerun root `npm test` (logs, contract/brand freshness and all workspace suites), `npm run lint`, `npm run typecheck`, the full `npm run test:e2e` and `npm run build`. Native implementation PRs also run both-platform `npm run export --workspace=@rhythm-health/mobile`; dependency changes require root `npm ci` and Expo compatibility checks. Run isolated, mocked `uv run pytest` whenever backend changes. Include the session log, actual validation evidence and any limitations. People review and merge with merge commits; agents never merge PRs.

## Web parity

**Added 4 Nov 2026, at Nazmul's request after M5.** The target is the web's 390px layout: same header, navigation, screen order and copy. M2–M5 behaviour and paid-call guards don't change.

| PR | Scope |
|---|---|
| **P1: header and navigation** | Pinned header with the web's dial mark; account panel with Your lab, History, Demo, the email, Update your rhythm and Sign out; Demo as its own section; medium font weight; "← Your lab" back links. |
| **P2: Your lab and experiment page** | Your lab in the web's order, the Today card, the circle timeline inline, Test another habit, and a native experiment page with Finish and the original forecast. |
| **P3: check-in, onboarding, question flow** | Answered bar and confirmation screen, onboarding progress bar, and remaining copy differences. |
| **P4: signed-out landing** | How it works, example questions and the start section, plus 390px web and mobile screenshots for every screen. |

**Deliberate differences:** Daily reminders in the account panel replace the web's calendar button, because the phone has local notifications. The landing page's scrolling day story stays web-only for the 5 Nov demos.

## Several active experiments

**Added 4 Nov 2026.** Today keeps its one-experiment screen and lists a card each for two or three. Each experiment has its own reminder (`rhythm.next-day.<experiment id>`) that opens its own check-in. The limit comes from the backend. [Decision](DECISIONS.md#several-active-experiments--4-nov-2026).

With two or more real experiments due, Your lab offers one check-in for all of them ([decision](DECISIONS.md#one-check-in-across-experiments--4-nov-2026)). Samples keep their own.
