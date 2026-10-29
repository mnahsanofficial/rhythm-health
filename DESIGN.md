# Design

Rhythm Health Lab turns a daily habit question into a small personal experiment. The visual language comes from sleep, daylight, routines and evidence collected over time.

## Direction

**A day's light:** oat and paper surfaces, ink text, moss actions and observations, night-blue sleep and forecasts, and sun-yellow habit markers. Fraunces gives questions their voice, Instrument Sans keeps forms readable, and Geist Mono carries times and measurements.

Design at 390px first, then check at 1440px. Use type, spacing and dividers to establish hierarchy. Cards group a decision or comparison; history uses rows. Avoid decorative gradients, repeated shadows, all-caps labels and a fade-up on every section.

## Visual tokens

Colour, type, shape and easing live in `frontend/app/globals.css`. Use Tailwind token classes; do not put literal colours in components.

### Colour

| Token | Value | Role |
|---|---|---|
| `oat` | `#f6f3ec` | Page background (also the browser `themeColor`) |
| `paper` | `#fffdf8` | Cards and inputs, one step lighter than the page; text on moss |
| `ink` | `#1b2421` | Main text |
| `muted` | `#5c6661` | Secondary text |
| `line` | `#dcd6ca` | Borders, dividers, skeleton blocks |
| `moss` | `#2f6b4f` | Primary actions, links, focus ring, "Likely signal" |
| `moss-deep` | `#24563f` | Primary button hover |
| `moss-tint` | `#e3ece5` | Success and info backgrounds, text selection |
| `night` | `#263a6b` | Sleep on the rhythm ring, the predicted range |
| `night-tint` | `#e4e7f0` | Soft night backgrounds |
| `sun` | `#f2c14e` | Daylight markers (habit dots on the ring, the ring round the selected day in the timeline). **Never text**: 1.5:1 on oat |
| `skin` | `#b9825e` | Illustration only: the landing character's skin |
| `clay` | `#7a2e1f` | Error text only (7.6:1 on `clay-tint`) |
| `clay-tint` | `#f7e4df` | Error backgrounds only |

### Type

| Token | Font | Use |
|---|---|---|
| `font-display` | Fraunces (with the `opsz` and `SOFT` axes) | Headings, questions, large numbers |
| `font-sans` | Instrument Sans | Body text (the default) |
| `font-mono` | Geist Mono | Times, counts, percentages, step numbers; always with `tabular-nums` |

Fonts load through `next/font/google` in `frontend/app/layout.tsx`.

Scale: `text-caption` 14, `text-body` 16, `text-lead` 18, `text-title` 24, `text-headline` 32, `text-display-sm` 44, `text-display` 60 (px). Each size sets its own line height. Large headings use `tracking-tight` and often `text-balance`.

### Shape and spacing

| Token or convention | Value / use |
|---|---|
| `rounded-card` | 1.25rem; grouped controls, comparisons and alerts |
| `rounded-pill` | 999px; actions, chips, markers and meters |
| Page gutters | `px-4 sm:px-8`; 16px on phones |
| Page width | `max-w-6xl`; focused flows use narrower containers |
| Tap targets | At least 44px; primary actions generally 48px |
| Inputs | At least 16px on phones |
| Focus | Visible moss outline, 2px with 3px offset |

Use Tailwind's spacing scale. Keep the typography and palette consistent across public and signed-in pages. Current comparison markers use a border rather than a shadow.

## Motion system

Motion answers a user action or shows a real state change. It never delays a decision, invents progress or obscures data. Animate **transform and opacity only**. The library is `motion/react`; native controls and the rhythm SVG also use CSS.

JavaScript tokens are in `frontend/lib/motion.ts`, in seconds. Their CSS mirrors are in `globals.css`, in milliseconds. Keep the two representations aligned. Use `MOTION_DURATION` / `MOTION_EASE` in Motion and `var(--motion-…)` / `var(--ease-settle)` in CSS.

| Name | JS seconds | CSS | Role |
|---|---:|---|---|
| `press` | 0.15 | `--motion-press: 150ms` | Choice ticks and press feedback |
| `exit` | 0.12 | `--motion-exit: 120ms` | Recorded-day panel departure |
| `panel` | 0.20 | `--motion-panel: 200ms` | Day details; onboarding departure |
| `response` | 0.28 | `--motion-response: 280ms` | Check-in confirmation, progress, habit arrival, history reorder |
| `step` | 0.35 | `--motion-step: 350ms` | Directional onboarding entry |
| `reveal` | 0.48 | `--motion-reveal: 480ms` | Forecast range, completed rhythm arc, report comparison |
| `settle` easing | `[0.22, 1, 0.36, 1]` | `--ease-settle` | A change settling into place |

Small existing selection springs, chart fades and panel departures keep their local settings. They are supporting interactions, not additional signature moments. Avoid inventing another timing where a shared role fits.

### Two memorable moments

1. **The completed rhythm.** Finishing onboarding assembles the person's sleep and chosen habits into a day. The arc arrives once over 480ms and habit markers over 280ms. Geometry and sleep duration are final immediately. Answers, editing and save controls remain available throughout; there is no stagger delaying them.
2. **Prediction versus reality.** The comparison leads the Lab Report. The original forecast stays visible and fixed. Reveal my result brings in the measured value and range marker over 480ms using opacity and 10px translation. Replay reuses the loaded report. Keyboard focus stays on the button and a polite status announces the result. No intermediate numerical estimates or confetti.

### Everyday loop

| Screen | Interaction and feedback |
|---|---|
| Check-in | Native choices respond to selection; the answered count tracks valid answers. Progress uses scaleX. A successful save lands a tick and today's marker and focuses the confirmation heading. “Not today” counts as an answer, not adherence. |
| Personal home | Own question, today's action, phase and recorded days. Selecting a logged day reveals its values with a 6px/opacity panel transition. Space is reserved so surrounding navigation stays stable. |
| Proposal | Waiting explains what goes into the response without claiming live stage completion. The finished plan replaces entry and restores focus appropriately. Forecast endpoints remain readable while the range fills. |
| Onboarding | Steps move in the direction of navigation; focus moves to the heading. Habits follow morning, afternoon and evening; constraints explain how the plan should fit life. Choices retain native keyboard behavior and Skip. |
| Lab Report | Comparison first; verdict, adherence and daily evidence follow. Written sections without backend content show waiting states. |
| Public landing | "A day in the life": scrolling moves one example day from night to morning, noon, evening and back to night. Sky, light, sun and moon follow the scroll position directly (`useScroll` + `useTransform`, opacity and transforms only), so stopping the scroll stops the scene. No snapping or scroll-jacking. Only the sets near the current position are mounted. With reduced motion, the stage is not mounted and each scene shows a still illustration above its text. |
| History | Native newest/oldest controls reorder existing rows through position transforms. Report state stays with each experiment; seeded rows are labelled as samples. |

Do not add global page entrance effects. Preserve context through persistent questions, directional step transitions, focused headings and stable panels.

### Loading and reduced motion

Ordinary loading skeletons are static and shaped like the coming content. **Only the AI proposal wait may pulse** while its actual request is pending. Never mark a stage complete or display a percentage unless the API provides that progress.

`MotionConfig reducedMotion="user"` disables transform/layout motion but preserves opacity; it is not sufficient on its own. Custom transitions must use `useReducedMotion()` to show the final state immediately. CSS arrivals use `motion-safe:` and native transitions use the reduced-motion override. Never lose text, results or controls when motion is reduced.

Server and client must produce identical initial markup. Do not branch SVG initial styles on a browser-only motion preference. The ring uses deterministic geometry and CSS media queries; the hydration regression explicitly tests differing server/browser preferences.

## Components and data

- Components are plain React and Tailwind; there is no component kit or class-variant framework.
- Pages get data through `lib/data/*`. Mock data belongs in `lib/mock/*` and every sample surface is labelled.
- Signed-in home resolves the session before mounting private data. Public marketing and the sample ring do not appear there.
- `experiments/experiment-progress.tsx` shares the daily action and timeline between home and experiment detail.
- Native radio/checkbox inputs belong inside labels. Never add `whileTap` to their labels or wrappers; CSS press feedback preserves keyboard behavior. Reserve tick space instead of animating width.
- Errors use clay and `role="alert"`, with retry where useful. Status messages are polite. API calls retain loading, error and empty states.
- SVG coordinates calculated with trigonometry are rounded. On stretched SVGs, use HTML for dashed lines and elements whose shapes must stay fixed.
- Forms cannot nest. Onboarding summary/account controls sit outside the step form.
- A short experiment shows a pattern, not proof. Keep prediction ranges and uncertainty; do not imply medical certainty.

## Evidence and maintenance

See [UI motion rules](docs/rules/ui-motion.md), [UI quality](docs/rules/ui-quality.md) and [testing](docs/rules/testing.md). The [screenshot index](docs/screenshots/ui-motion/README.md) links baseline and final screens and the before/during/after frames.

Every visible change is checked in the browser at 390px and 1440px. New interactive behavior and reduced motion get behavior tests. Keep screenshots as evidence, not snapshot assertions.
