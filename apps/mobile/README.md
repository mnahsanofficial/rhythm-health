# Rhythm mobile — step 1

Expo SDK 58, Expo Router, React 19.3 and React Native 0.88.1. This first PR supports existing-account sign-in, encrypted session restoration, read-only profile loading, local-device sign-out and a web handoff. Today, Check-in, reminders and Progress are separate follow-up PRs; they are not implemented here.

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

Update Expo Go from the App Store/Google Play. Keep the phone and Mac on the same Wi-Fi, scan Metro's QR code, and allow local-network access. On iPhone use Camera to scan. Enter your own real credentials; agents must not enter them. Test sign-in → profile, close/reopen the app to check persistence, then Sign out. No check-in is written by this step.

The local-only web handoff uses the API setting's hostname with port 3000. Run the Next.js app there for those links. A future hosted setup will need a separate agreed web location; this does not guess one. Native requests do not need CORS changes. Expo web preview uses in-memory session storage only, is not the persistence test, and may need its origin added to local backend CORS for real requests.

## SDK and template decisions (31 Oct 2026)

- Apple's [store listing](https://apps.apple.com/us/app/expo-go/id982107779) lists Expo Go 58.0.5 with SDK 58 support; Expo's [SDK 58 Android download](https://expo.dev/go?device=true&platform=android&sdkVersion=58) points to Google Play. The Oct 15 [release post](https://expo.dev/changelog/sdk-58) predates that rollout. These modules work in Expo Go; no development build is required.
- Reviewed [8x template apps/mobile](https://github.com/8xsocial/template-monorepo/tree/ec30efdd7b1d8f9604950e54d1802376216651e1/apps/mobile). Follow its Router entry, npm workspace, `app`/`lib` layout and Jest/React Native Testing Library conventions. Its SDK 55 pins, analytics, subscriptions, native custom plugins, NativeWind and example features are not copied. SDK 58 [automatically handles npm monorepos](https://docs.expo.dev/guides/monorepos/); no legacy Metro resolver overrides are needed.
- Dependencies follow Expo 58.0.21's `bundledNativeModules.json`. React/React DOM remain 19.3.0 in both apps. Web Vitest/Playwright remain separate from native Jest.

## Auth and storage

[Supabase's native guidance](https://supabase.com/docs/guides/auth/quickstarts/react-native) supplies the session options and foreground token refresh. Every product request carries the user's Bearer token. The only product endpoint in this PR is `GET /api/profile`, typed as shared `Profile`; 404 means web setup, 401 clears the session and returns to sign-in, and server/network failures offer retry. Sign-out uses `scope: local`, so it does not sign out the web browser.

Sessions and refresh tokens stay in Expo SecureStore. The adapter splits Unicode safely into bounded encrypted values and switches between two slots only after all new chunks exist. Interrupted refreshes retain the old complete session; pending counts allow sign-out to remove partial writes. Storage errors are shown, not logged or replaced with plaintext persistence. See [SecureStore's size and persistence caveats](https://docs.expo.dev/versions/latest/sdk/securestore/). Expo Go uses project-scoped native storage; native reinstall behavior differs by platform. Web preview intentionally keeps nothing across reloads.

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

The SDK check also requires mobile TypeScript `~6.0.3`; it is isolated from the web's TypeScript 5. Native iOS/Android exports use fake public settings and dotenv disabled. npm's audit currently reports 52 findings, including three high findings propagated through Expo CLI's Zod dependency. Its suggested automatic fix downgrades Expo to SDK 54, incompatible with the store Expo Go requirement; no forced downgrade or incompatible transitive-major override is applied. Review compatible upstream fixes before distribution. The app's behavior tests remain independent of those developer-tool dependencies.
