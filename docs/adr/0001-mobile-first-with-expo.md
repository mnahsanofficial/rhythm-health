# 1. Mobile first, with Expo

**Status:** Accepted. **Date:** 30 Oct 2026 for the daily loop; 2 Nov 2026 for the full app. **Decided by:** Nazmul, after 8x's feedback. Plan: [MOBILE_PLAN](../MOBILE_PLAN.md).

## Context

The first version was a website. At the 30 Oct call, 8x said tracking something daily on a website doesn't make sense for a 10-day experiment: people have to remember to open a site, they drop off, and a missed day weakens the result. The backend and web loop already worked, and there were six days left.

## Decision

Build the product as an Expo app (`apps/mobile`, Expo Router, SDK 58) run through Expo Go. A person can do everything there: sign up, onboard, propose, check in, finish and read the Lab Report. Reminders are local notifications. Web features are frozen, with bug fixes only.

## Alternatives

- **Keep it responsive web, with email reminders.** Least work, but it doesn't answer the feedback, and it needs a server to send email.
- **Native Swift.** Best iPhone feel, but it can't share TypeScript types or tokens, and the team couldn't finish it in time.
- **A web view around the site.** Fast, but it keeps a website's feel, and notifications would still need native code.
- **Daily loop only on mobile.** This was the first step. It was replaced on 2 Nov, because sending people to a website for the report broke the flow.

## Consequences

- Each screen exists twice, and web falls behind on purpose ([the differences](../ARCHITECTURE.md#8-deliberate-web-and-mobile-differences)).
- Expo Go limits us to bundled native modules, and shows its own launch branding, so the real splash needs a standalone build to confirm.
- Local notifications need no server, but can't react to anything that happens after the app last ran.
- The demo needs the phone and the backend on one network.
