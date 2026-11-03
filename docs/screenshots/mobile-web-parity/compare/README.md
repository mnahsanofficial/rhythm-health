# Web and mobile at 390px

Taken 4 Nov 2026 from mocked runs: the web through its Playwright mocks, mobile through an isolated fake-config web export with all traffic intercepted. All data is sample data. Browser renders don't prove native iOS rendering.

| Screen | Web | Mobile |
|---|---|---|
| Signed-out landing | [web](1-landing-web.png) | [mobile](1-landing-mobile.png), [full page](1-landing-mobile-full.png) |
| Your lab, nothing running | [web](2-empty-lab-web.png) | [mobile](2-empty-lab-mobile.png) |
| Your lab, experiment running | [web](3-active-lab-web.png) | [mobile](3-active-lab-mobile.png) |
| Account panel | [web](4-panel-web.png) | [mobile](4-panel-mobile.png) |
| Experiment page | [web](5-experiment-web.png) | [mobile](5-experiment-mobile.png) |
| Demo | [web](6-demo-web.png) | [mobile](6-demo-mobile.png) |

## What still differs

**On purpose**

- **Landing:** the web's scrolling day illustration stays web-only; the scenes are text.
- **Account panel:** adds Daily reminders, which replace the web's calendar button.
- **Sign-up order:** on the phone you create the account before the seven questions; the web asks at the end. So the phone doesn't say "You sign up at the end."
- **Finish:** the web works out "Results unlock soon" and its meters from minimums in the browser. The phone holds no such rule, so it offers Finish once a test day is recorded and the backend explains any refusal.
- **Touch targets:** 48pt on the phone where the web uses 44px.

**Small, not changed**

- The experiment page's timeline sits on the page rather than in a card, and its When and How often are on one line each.
- "Missed days can't be filled in." is an extra line on the phone.
- Forecast bullets are text bullets.
