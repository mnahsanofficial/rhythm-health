# Design

Rhythm Health Lab turns a daily habit question into a small personal experiment. The visual language comes from sleep, daylight, routines and evidence collected over time.

## Direction

**A day's light:** oat and paper surfaces, ink text, moss actions and observations, night-blue sleep and forecasts, and sun-yellow habit markers. Fraunces gives questions their voice, Instrument Sans keeps forms readable, and Geist Mono carries times and measurements.

Design at 390px first, then make the layout hold at every width (see [Layout](#layout)). Use type, spacing and dividers to establish hierarchy. Cards group a decision or comparison; history uses rows. Avoid decorative gradients, repeated shadows, all-caps labels and a fade-up on every section.

### Ours, not AI-default

These apply to the web app and the mobile app alike. A screen that breaks one reads as a template.

1. **No placeholders as content.** An empty panel never takes more than one line. Show the latest real data (the timeline opens on the latest recorded day) or leave the space out.
2. **Cards only for a decision or a comparison** (today's check-in, prediction versus reality). Information uses sections, rows and dividers.
3. **Mono only for numbers, times and counts** ("Day 4 of 10", "+8% to +15%"). Word labels and eyebrows use Instrument Sans.
4. **Every scale names both ends in plain words**, such as "1 drained · 10 full of energy". Never a bare 1–10.
5. **No glass, gradients, glows or decorative shadows.** Pinned bars use a solid background and a border.
6. **No navigation repeated on the same screen.** The header (or its menu on phones) is the one place for the main sections.
7. **Copy says what will happen, with real numbers.** "Results after 2 normal days and 3 test days", not "Results unlock soon". No "unlock", "journey", "discover" or "transform".

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

Scale: `text-caption` 14, `text-body` 16, `text-lead` 18 (px, fixed). Headings are fluid: `text-title` 22–24, `text-headline` 28–32, `text-display-sm` 36–44, `text-display` 44–60, each a `clamp()` of rem and vw, so they grow smoothly with the screen and still enlarge with browser zoom. Each size sets its own line height. Large headings use `tracking-tight` and often `text-balance`.

### Shape and spacing

| Token or convention | Value / use |
|---|---|
| `rounded-card` | 1.25rem; grouped controls, comparisons and alerts |
| `rounded-pill` | 999px; actions, chips, markers and meters |
| Page gutters | `var(--gutter)`: `clamp(1rem, 4vw, 4rem)`, 16px on phones up to 64px |
| Page width | `page-frame`: up to 90rem of content; focused flows narrow it with `[--frame:…]` |
| Tap targets | At least 44px; primary actions generally 48px |
| Inputs | At least 16px on phones |
| Focus | Visible moss outline, 2px with 3px offset |

Use Tailwind's spacing scale. Keep the typography and palette consistent across public and signed-in pages. Current comparison markers use a border rather than a shadow.

## Layout

Every page works at any width from 320px to 2560px, and at 200% browser zoom. There are no fixed "phone" and "desktop" designs: sizes flow between them.

- **Backgrounds and illustrations reach both edges.** Full-width sections (the landing story's sky, a coloured band) sit outside the page frame. Never put a background on a `page-frame` element and call it full width.
- **Content sits in the page frame.** Wrap each page's content in `page-frame` (in `globals.css`): centred, `width: 100%`, padded by the fluid `--gutter`, and at most 90rem of content wide. Focused flows narrow it with an arbitrary property instead of a new container, for example `page-frame [--frame:42rem]` for check-in, `28rem` for sign-in and `48rem` for the demo. The header uses the same frame, so its logo always lines up with the page content. Don't add `mx-auto max-w-* px-4 sm:px-8` containers.
- **Grids and cards use the width; paragraphs don't.** A global rule caps every `<p>` at `48ch` (about 65–75 characters a line, measured for Instrument Sans). Don't override it with a wider `max-w-*` on a paragraph. Let cards, timelines and multi-column grids take the extra width instead.
- **Fluid, not stepped.** Prefer `clamp()`, `var(--gutter)`, `minmax()` grid tracks and wrapping flex rows over adding breakpoints. Use a breakpoint where the layout really changes, such as a second column from `lg`.
- **The header is fixed.** `SiteHeader` is `sticky top-0` with a solid oat background and a bottom border, and its height is `--header-h` (4rem). Anything else that sticks to the top offsets by it: `top-[var(--header-h)]` or `top-[calc(var(--header-h)+2rem)]`, and screen-high sections use `calc(100svh - var(--header-h))`. `html` has `scroll-padding-top` set, so focused headings and anchors land below it.
- **Header contents.** Visitors see the logo and Sign in. Signed-in people see the logo, the main sections (Your lab, History, Demo) with the current one marked by `aria-current="page"` and a moss underline, and an account button (their initial). It opens a panel with their email, Update your rhythm and Sign out; Escape or a click outside closes it and returns focus. Below `md` the sections move into that panel, so the bar holds only the logo and one 44px button.
- **Pinned phone action bars** (`sticky bottom-0`) bleed to the screen edge with `-mx-[var(--gutter)] px-[var(--gutter)]`, not hard-coded `-mx-4`.
- **Nothing scrolls sideways.** No element may be wider than the viewport. Illustrations use `preserveAspectRatio="xMidYMax slice"` or `w-full h-auto`, never a fixed pixel width.

**How to check:** `frontend/tests/e2e/layout-widths.spec.ts` visits every page at 320, 375, 390, 768, 1024, 1280, 1440, 1920 and 2560px, and at 1280px and 1440px windows zoomed to 200% (640 and 720 CSS px). It fails on horizontal scrolling, content off centre, a page frame not using the available width, a paragraph over 76 characters a line, or overlapping text and controls. Add every new page to it. `CAPTURE_LAYOUT=1` saves a screenshot of each page at each width under `docs/screenshots/layout/`.

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
| Personal home | Own question, today's action, phase and recorded days. Day details open on the latest recorded day; choosing another day swaps them with a 6px/opacity panel transition. Space is reserved so the page doesn't jump between days. |
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
