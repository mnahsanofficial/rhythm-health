# Landing day, layout, password field and header

Final screens from `feat/landing-day`. Auth and API responses are mocked, and the signed-in account is a test fixture. These images document visual checks; they are not snapshot tests.

| Area | Screens |
|---|---|
| Landing story, 390px | [Intro](landing/390/0-intro.png) · [Night](landing/390/1-your-sleep-is.png) · [Morning](landing/390/2-check-in-in.png) · [Noon](landing/390/3-the-prediction-comes.png) · [Evening](landing/390/4-late-coffee-or.png) · [Night again](landing/390/5-does-a-walk.png) · [Back to night](landing/390/6-tomorrow-is-day.png) · [After the story](landing/390/7-end.png) · [Reduced motion, full page](landing/390/reduced-motion.png) |
| Landing story, 1440px | [Intro](landing/1440/0-intro.png) · [Night](landing/1440/1-your-sleep-is.png) · [Morning](landing/1440/2-check-in-in.png) · [Noon](landing/1440/3-the-prediction-comes.png) · [Evening](landing/1440/4-late-coffee-or.png) · [Night again](landing/1440/5-does-a-walk.png) · [Back to night](landing/1440/6-tomorrow-is-day.png) · [After the story](landing/1440/7-end.png) · [Reduced motion, full page](landing/1440/reduced-motion.png) |
| Fluid layout | [Lab Report, 320px](layout/report-320.png) · [Lab Report, 1440px](layout/report-1440.png) · [History, 1920px](layout/history-1920.png) · [Experiment, 2560px](layout/experiment-2560.png) · [Experiment, 1440px at 200% zoom](layout/experiment-1440-zoom-200.png) |
| Password field | [Hidden, 390px](password/390-hidden.png) · [Shown, 390px](password/390-shown.png) · [Shown, 1440px](password/1440-shown.png) |
| Header | [Signed in, 1440px](header/1440-signed-in.png) · [Account panel, 1440px](header/1440-menu-open.png) · [Menu, 390px](header/390-menu-open.png) |

## Reproducing

From `frontend/`:

```bash
CAPTURE_LANDING=1 CAPTURE_PASSWORD=1 CAPTURE_HEADER=1 npx playwright test tests/e2e/landing-story.spec.ts tests/e2e/password-field.spec.ts tests/e2e/site-header.spec.ts
```

The specs also write 320px captures, which aren't kept here. `CAPTURE_LAYOUT=1 npx playwright test tests/e2e/layout-widths.spec.ts` writes every page at every width to `docs/screenshots/layout/`. That folder is a working set and isn't committed; the layout images above were picked from it.
