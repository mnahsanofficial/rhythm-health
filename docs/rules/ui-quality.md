# UI quality

Mobile-first. The daily loop happens on a phone (PRD §21), so check every screen at **390px** wide first. Then it must hold at every width from 320px to 2560px and at 200% zoom: follow the [layout rules in DESIGN.md](../../DESIGN.md#layout) and add new pages to `frontend/tests/e2e/layout-widths.spec.ts`.

## Every API call has real states

- **Loading:**
  - a skeleton in the shape of what's coming (`…Skeleton` components);
  - busy buttons disabled, with a busy label ("Saving…").
- **Error:**
  - a visible message in plain words, with a way to retry;
  - errors use `role="alert"` and the clay colours;
  - a 401 sends the user to `/sign-in?next=<this page>`.
- **Empty:** say what's missing and what to do next. For example, no profile goes to onboarding, and no report yet explains when one will exist.
- **No silent failures.** Never `.catch(() => {})`. If a failure doesn't block the screen, still tell the user, for example "Couldn't load your saved answers".

## Accessibility

- Touch targets are at least 44px (`min-h-11`), and main actions are 48px (`min-h-12`).
- Every input has a `<label>`, and every icon-only control has an accessible name.
- A visible focus ring is required (`:focus-visible` in `globals.css`). After moving to a new step or result, move focus to its heading.
- Text meets WCAG AA contrast. `sun` is never used for text (see [`DESIGN.md`](../../DESIGN.md)).
- Respect reduced motion: `MotionConfig reducedMotion="user"` wraps the app, and custom animations check `useReducedMotion()`.

## Honest content

- **Sample data is labelled as sample**, and lives in `frontend/lib/mock/` behind `lib/data/`.
- **Don't fake progress.** Only show days, counts and results the backend returned.
- **Don't call a result early.** The dashboard shows progress, not "it's working" (PRD §11).

## Before a PR that changes what people see

- Check the screens at 390px and at desktop width, in the real app.
- Check the browser console for errors and hydration warnings.
- Check every state: loading, error, empty and success.
