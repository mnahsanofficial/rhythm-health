# Rhythm mobile — daily loop

Expo SDK 58, Expo Router, React 19.3 and React Native 0.88.1. The app supports existing-account sign-in, encrypted session restoration, profile loading, Today and the native daily Check-in. Local next-day reminders, Settings and read-only Progress complete the V1 daily loop. Setup, proposals, finishing, reports, history and the demo stay on the web.

## Install and run

From the repository root, with Node 22.18+:

```bash
npm ci
(cd backend && uv sync)
```

Create `apps/mobile/.env.local` locally with these names, never a service-role key:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`

Use the web app's same public Supabase project settings. On the phone, the API URL must use the Mac's Wi-Fi address and backend port 8001, not localhost. Never paste values into chat/logs or commit the file. Missing/blank or invalid URL settings show only the variable name in the app.

Start the backend so the phone can reach it:

```bash
cd backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

In another terminal, from the repository root:

```bash
npm run start --workspace=@rhythm-health/mobile
```

Update Expo Go from the App Store/Google Play. Keep the phone and Mac on the same Wi-Fi, scan Metro's QR code, and allow local-network access. On iPhone use Camera to scan. Enter your own real credentials; agents must not enter them. Test sign-in → Today → enter your own real check-in → Done for today → fully close/reopen. Never save invented health data to the shared account. Sign out affects this device only.

The local-only web handoff uses the API setting's hostname with port 3000. Run the Next.js app there for those links. A future hosted setup will need a separate agreed web location; this does not guess one. Native requests do not need CORS changes. Expo web preview uses in-memory session storage only, is not the persistence test, and may need its origin added to local backend CORS for real requests.

## SDK and template decisions (31 Oct 2026)

- Apple's [store listing](https://apps.apple.com/us/app/expo-go/id982107779) lists Expo Go 58.0.5 with SDK 58 support; Expo's [SDK 58 Android download](https://expo.dev/go?device=true&platform=android&sdkVersion=58) points to Google Play. The Oct 15 [release post](https://expo.dev/changelog/sdk-58) predates that rollout. These modules work in Expo Go; no development build is required.
- Reviewed [8x template apps/mobile](https://github.com/8xsocial/template-monorepo/tree/ec30efdd7b1d8f9604950e54d1802376216651e1/apps/mobile). Follow its Router entry, npm workspace, `app`/`lib` layout and Jest/React Native Testing Library conventions. Its SDK 55 pins, analytics, subscriptions, native custom plugins, NativeWind and example features are not copied. SDK 58 [automatically handles npm monorepos](https://docs.expo.dev/guides/monorepos/); no legacy Metro resolver overrides are needed.
- Dependencies follow Expo 58.0.21's `bundledNativeModules.json`. React/React DOM remain 19.3.0 in both apps. Web Vitest/Playwright remain separate from native Jest.

## Auth and storage

[Supabase's native guidance](https://supabase.com/docs/guides/auth/quickstarts/react-native) supplies the session options and foreground token refresh. Every product request carries the user's Bearer token. `GET /api/profile`, typed as shared `Profile`, gates the daily loop: 404 means web setup, 401 clears the session and returns to sign-in, and server/network failures offer retry. Sign-out uses `scope: local`, so it does not sign out the web browser.

Sessions and refresh tokens stay in Expo SecureStore. The adapter splits Unicode safely into bounded encrypted values and switches between two slots only after all new chunks exist. Interrupted refreshes retain the old complete session; pending counts allow sign-out to remove partial writes. Storage errors are shown, not logged or replaced with plaintext persistence. See [SecureStore's size and persistence caveats](https://docs.expo.dev/versions/latest/sdk/securestore/). Expo Go uses project-scoped native storage; native reinstall behavior differs by platform. Web preview intentionally keeps nothing across reloads.

## Today and Check-in

[Today](src/today.tsx) loads `GET /api/experiments?status=active`, then `GET /api/experiments/{id}/progress`. The response owns the day, phase, recorded state and next opening; the app formats returned timestamps in the phone's timezone. It refreshes on foreground and after a save. No active experiment offers a web link. Ended experiments link to finishing on the web; completed ones link to the report. Cached data stays labelled offline, with Check-in disabled; this is an in-memory cache, not an offline database.

[Check-in](src/checkin.tsx) reads `GET /api/experiments/{id}/checkins` to prefill today, including false and zero. It supports scale, signed number, duration in minutes and yes/no inputs, plus the test-day change question and an optional note. Known scale endpoints have words; unknown keys use Low / High until B12 lands. Save rechecks the authoritative progress before `POST /api/experiments/{id}/checkins`. The body is shared `CheckinInput`, with no day, phase or user ID. A stale day cannot be submitted by the form; the backend remains authoritative if a boundary passes during the request.

A failed save keeps the raw answers, shows field/server errors and offers explicit retry. Double taps are ignored. Offline answers remain in the open form; unsaved drafts do **not** survive closing the form, signing out or terminating the app. A successful write returns to Today and rereads progress. If that read fails, the message says the check-in was saved and Retry repeats only the read. A small confirmation tick uses shared timing and skips its opacity animation with reduced motion; confirmation text appears immediately.

Steps 2 and 3 shipped together in #36; steps 4 and 5 are combined on `feat/mobile-reminders-progress`, each with separate red/green commits. No paid endpoints, backend changes or migrations are involved.

## Reminders and Settings

[Reminder service](src/lib/reminders.ts) uses SDK-matched `expo-notifications` for **local** notifications, supported in [Expo Go](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/). There are no push tokens or notification-server credentials. After a recorded check-in, an explanation offers opt-in; the OS is asked only after an explicit tap. Settings also has the toggle and device-only sign-out. Denied permission has an Open phone Settings action; Today and Check-in still work.

The only real trigger is the API's `next_day_at` as an absolute date, not a repeating calendar time or a phone-calculated opening. The title names the returned next day and total only ("Day 5 of 10 is open"), never the question. Preferences are per account in SecureStore; Expo web preview keeps them in memory and cannot schedule notifications. Fixed daily/test IDs and a serialized queue prevent stacking and cancel a late scheduling result after sign-out. The service reconciles after successful progress refreshes on foreground and after saving. It cancels on opt-out, sign-out, no active experiment, an ended/completed experiment or no next opening, including the last day. A failed cancellation remains visible even after sign-out and offers retry. Offline restoration preserves an existing pending reminder for the same opted-in account until fresh progress is available; foreign-account reminders are removed. Retrying preference loading keeps any server progress already loaded.

Taps are captured on cold start and while open, held through sign-in/profile loading or being offline, and resolved against fresh owner-scoped progress. They open the **current** Check-in, including prefilled recorded answers. A different account or an inactive experiment cannot open stale private content. No day is taken from the notification. A change in the returned experiment/day remounts the form, so yesterday's unsaved draft is never copied into a newly opened day. Setup, finishing and results stay on the web.

Local-only limits: an experiment finished on the web while the phone app is closed cannot be known until its next successful refresh. OS permission, Focus and delivery settings may affect when a banner appears; the scheduled instant is still exactly the API timestamp. No server push is added.

### iPhone test without waiting a day

In Expo Go, sign in and open **Settings → Daily reminders**. Enable them and allow notifications. Tap **Send a test reminder in 10 seconds**, lock the phone, then tap the notification. It should open today's Check-in; no need to save again. Repeat while force-closing the app before delivery to check cold start. To check cancellation, schedule another test and turn reminders off before ten seconds; it should not arrive. The test uses a one-off ten-second interval solely in `__DEV__`; its button and action are unavailable in production, with the button label absent from both production native exports.

## Progress

[Progress](src/progress.tsx) reuses the authoritative timeline loaded by Today. Recorded/missed/remaining counts, day numbers, baseline/test phases and all five states come from that endpoint. Each row names its state and has a distinct symbol, so colour is not the only cue. The latest recorded day opens by default. Tapping a recorded row opens its read-only answers **under that row**, using `GET /checkins`. False, zero, the test-day answer and notes remain visible. Missing answers are described honestly; loading, errors/retry, expired sessions and offline cached data are handled. No recorded days avoids the answers read. Unsaved drafts and cached progress/answers are not an offline database.

No extra progress animation or delayed information is added; reduced-motion and large system text retain the same content, wrapping rows and minimum touch targets.

## Checks

From root:

```bash
npm test
npm run lint
npm run typecheck
npm run test:e2e
npm run build
npm run export --workspace=@rhythm-health/mobile
```

For just the app: `npm test --workspace=@rhythm-health/mobile`. Tests use Expo's Jest preset, accessible queries and fake auth/network/storage; they do not load real env files or call Supabase/OpenRouter. No snapshots or sleeps. Static loading blocks match content; no looping animation is added. Text scales with the system; controls use minimum heights and wrap rather than clipping scaled text. All colours, typography and layout sizes come from the brand package.

## Verification record

Nazmul reported all five iPhone Expo Go checks passed on 31 Oct 2026: sign in, profile visible, fully close/reopen, session retained, sign out. This used his real account and a read-only profile call, with no invented health data or paid AI calls. Mocked Expo web previews at 390px and 1440px were visually inspected; [screenshots](../../docs/screenshots/mobile-sign-in/) contain fake accounts/profile data, not his account. They do not claim Android device verification.

The SDK check also requires mobile TypeScript `~6.0.3`; it is isolated from the web's TypeScript 5. Native iOS/Android exports use fake public settings and dotenv disabled. npm's audit currently reports 48 findings, including three high findings propagated through Expo CLI's Zod dependency. Its suggested automatic fix downgrades Expo to SDK 54, incompatible with the store Expo Go requirement; no forced downgrade or incompatible transitive-major override is applied. Review compatible upstream fixes before distribution. The app's behavior tests remain independent of those developer-tool dependencies.

Storage operations are serialized by the adapter, including concurrent refresh writes, without the SDK's deprecated custom `lock` option. Supabase 2.118 uses its [built-in refresh coordination and commit guard](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/migrations/lockless-coordination.md).

Step 1 checks after the main refresh at `70adf46`: clean root install, Expo dependency check, workspace lint/typecheck, 157 web / 28 mobile / 11 brand / 6 contract unit tests, iOS and Android exports, and the web production build passed. Playwright finished with 76 passed and its one existing keyboard-onboarding skip. No backend/migration files or env files are included.

## Today / Check-in verification (31 Oct 2026)

55 native tests cover Today, foreground refresh, server-owned phases and boundaries, all four answer types, prefill, validation, 422/503 errors, expired sessions, offline draft retention, duplicate-tap prevention, stale days, and refresh-only retry after a successful write. The two features have separate failing-test and implementation commits. [Browser screenshots](../../docs/screenshots/mobile-today-checkin/) use intercepted auth/API responses at 390px, 768px and 1440px, never shared data. Nazmul reported all iPhone checks passed: sign in → Today → save his real daily answers → Done for today → fully close/reopen with the saved state intact. This is a genuine user-entered check-in, not test data. No Android device was available; browser evidence alone does not prove native behavior.

Final Today/Check-in checks after the main refresh at `35bb30d`: root lint/typecheck, contract/brand freshness, 157 web / 55 mobile / 11 brand / 6 contract tests, 243 backend tests, web production build, Expo dependency compatibility, and iOS/Android exports passed. Playwright: 76 passed and the same existing keyboard-onboarding skip. No dependency changes, backend files, migration or env files are included; no paid requests were made. Backend tests ran from an empty temporary directory, and native exports used fake public configuration with dotenv disabled.

## Reminders / Progress verification (31 Oct 2026)

Implementation checks: 93 native tests, lint and typecheck pass; root clean install and Expo compatibility pass. Native exports use fake public settings with dotenv disabled. Browser previews at 390px, 768px and 1440px use fake API/auth reads only; [screenshots](../../docs/screenshots/mobile-reminders-progress/). Notifications/preferences are mocked in automation, including cold-start/auth gating, race cancellation and the same UTC trigger in Dhaka/Toronto across Nov 1. Nazmul reported all real-iPhone checks passed: the test reminder opens today's Check-in, Progress shows his real days/answers, switching off cancels the test, and a cold-start tap works. No agent supplied invented health data or account credentials. A sign-in-interposed notification tap is covered by mocked integration tests; no separate physical signed-out tap or Android check is claimed. Web preview cannot verify native notifications. Final checks after fetching/merging main at `874ce4f`: 157 web / 93 mobile / 11 brand / 6 contract unit tests (267 total), 243 backend tests, lint/typecheck, contract/brand freshness, web production build and both native exports passed. Playwright: 76 passed, one existing keyboard-onboarding skip (6.6 minutes). Clean root `npm ci` and Expo dependency compatibility passed. Backend tests ran from an empty temporary directory with mocked services; native exports used fake public settings and dotenv disabled. No backend, migration or env files changed; no paid calls.
