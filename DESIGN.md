# Design

This file records the design as it is built in `frontend/`. The tokens come from `frontend/app/globals.css`; if this file and that one disagree, `globals.css` is right and this file is out of date.

## Overview

**A day's light.**
- **Colours:** oat paper and ink. Moss for actions, night blue for sleep, a sun yellow for daylight markers.
- **Type:** a soft serif for headings, a plain sans for reading, a mono for every number.
- **The signature visual:** the **rhythm ring**, a 24-hour dial with midnight at the top, sleep as a night-blue arc, and habits as sun dots. It appears on the home page (sample data), during onboarding and on the summary (the user's own answers).

**Key characteristics:**

- Mobile-first: designed at 390px, then widened.
- Light mode only for V1.
- Colour by role, from tokens only. No hex values outside `globals.css`.
- Calm motion that settles into place, and turns off with reduced motion.
- Honest data: results read as a pattern, not proof, and sample data is labelled.

## Tokens

All tokens live in the `@theme` block of `frontend/app/globals.css` (Tailwind 4, CSS-first, no `tailwind.config.js`). Use them as Tailwind classes: `bg-oat`, `text-muted`, `border-line`, `rounded-card`, `font-display`.

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

### Shape and motion

| Token | Value | Use |
|---|---|---|
| `rounded-card` | 1.25rem | Cards, inputs, alert boxes |
| `rounded-pill` | 999px | Buttons, chips, meters, skeleton lines |
| `ease-settle` | `cubic-bezier(0.22, 1, 0.36, 1)` | The easing for things settling into place; the same curve is written as `[0.22, 1, 0.36, 1]` in `motion` transitions |

Spacing uses Tailwind's default scale. There is one shadow in the app: the "You" marker on the prediction bar.

## Layout

- **Page container:** `mx-auto w-full max-w-6xl px-4 sm:px-8`, so a 16px side gutter on phones.
- **Content widths:**
  - forms and single-column flows: `max-w-xl`, `max-w-2xl` or `max-w-3xl`;
  - sign-in: `max-w-md`.
- **Wide screens:** onboarding puts the rhythm ring in a sticky side panel; on phones it's hidden until the summary.
- **Sticky bars:** onboarding's Back/Continue bar sticks to the bottom on phones, with a blurred `oat` background.

## Components

There is no component library and no `cva`/`cn` helper. Components are plain React with Tailwind classes. Shared class strings are written as constants at the top of the file (for example `primary` in `home-cta.tsx` and `new-experiment.tsx`).

| Pattern | How it's built |
|---|---|
| Primary button | `min-h-12 rounded-pill bg-moss px-6 text-lead font-medium text-paper hover:bg-moss-deep active:scale-[0.98]`; disabled at `opacity-40` to `opacity-60` |
| Secondary button | `min-h-11 rounded-pill border border-line bg-paper px-5`, border turns moss on hover |
| Text link or action | `font-medium text-moss underline-offset-4 hover:underline` |
| Card | `rounded-card border border-line bg-paper p-5` to `p-8` |
| Error | `role="alert"`, `rounded-card bg-clay-tint p-3 text-clay`, plus a "Try again" button where a retry makes sense |
| Info or success | `role="status"`, `bg-moss-tint text-ink` |
| Loading | A `…Skeleton` component in the shape of the content: `animate-pulse` blocks in `bg-line` |
| Choice lists and chips | Real radio or checkbox inputs inside labels (`onboarding/choice-group.tsx`, `onboarding/chip-picker.tsx`) |
| Scale input (1–10) | A radio grid, 5 per row on phones and 10 on wider screens, each 48px tall (`checkins/metric-input.tsx`) |
| Signal tag | `likely_signal`: `bg-moss text-paper`; `possible_signal`: `bg-moss-tint text-moss`; `unclear`: `bg-line text-ink`; `probably_noise`: `bg-oat text-muted` with a border (`report/lab-report.tsx`) |
| Charts | No chart library. `report/day-chart.tsx` is an SVG for areas and bands, with HTML for lines and labels and 44px tap targets on each day; `report/prediction-vs-reality.tsx` is a range bar with a "You" marker |

### Folders

`frontend/components/`:

| Folder | What's in it |
|---|---|
| `onboarding/` | The seven questions and the summary |
| `auth/` | Sign-in and sign-up |
| `experiments/` | Ask a question, the proposal, the dashboard and timeline |
| `checkins/` | The daily check-in |
| `report/` | The Lab Report |

Shared pieces sit at the top level: `site-header.tsx`, `auth-nav.tsx`, `home-cta.tsx`, `rhythm-ring.tsx` and `motion-provider.tsx`.

## Motion

- **Library:** `motion` (`motion/react`).
- **Reduced motion:** `MotionProvider` wraps the app in `MotionConfig reducedMotion="user"`. Components with their own animations also check `useReducedMotion()`. `globals.css` cuts CSS animations and transitions to near zero under `prefers-reduced-motion`.
- **Timing:**
  - most transitions take 0.2–0.6s on the settle curve;
  - markers that land (the "You" dot, ticks) use a quick, well-damped spring;
  - onboarding steps slide 48px in the direction you're going.
- **Numbers that matter count up once** (`CountUp` in `prediction-vs-reality.tsx`), so a result arrives rather than just appearing.

## Lessons from building it

- Don't put `whileTap` on a `<label>`: it makes the label focusable and breaks radio groups. Press feedback on choices is CSS `active:` instead.
- Round SVG coordinates calculated with `Math.sin` and `Math.cos` (`lib/rhythm/time.ts`). Otherwise the server and browser render slightly different numbers and hydration fails.
- On an SVG stretched with `preserveAspectRatio="none"`, draw dashed lines and anything that must keep its shape in HTML, not SVG.
- After a step change, move focus to the new heading (`tabIndex={-1}`, `outline-none`), so keyboard and screen-reader users land on the new question.

## Accessibility

- WCAG AA contrast for all text.
- Touch targets of at least 44px.
- A visible moss focus ring (`:focus-visible`, 2px, offset 3px).
- A skip link to `#main`.
- A label for every input.
- Details: [`docs/rules/ui-quality.md`](docs/rules/ui-quality.md).

### Signed-in home

Home resolves the session before showing either the public landing or the personal lab. Signed-in home focuses on the user's current question, today's check-in, phase and recorded days. Sample rhythm and marketing sections appear only when signed out. History, rhythm settings and the seeded demo (`/demo`) are secondary navigation.

The home and experiment detail reuse `experiments/experiment-progress.tsx` for the daily action and timeline. Selecting a recorded day reveals its answers with a 200ms opacity/6px transform transition; reduced motion shows them immediately. The answer region reserves space so selection keeps surrounding content stable. Both touched dashboard skeletons are static.

### Proposal and prediction

The response replaces question entry with a dedicated preview. The plan and original forecast sit side by side on desktop and in reading order on phones. Forecasts use night/night-tint, mono endpoints and a range rather than a single precise estimate. The range fills via scaleX over 480ms on the settle curve; endpoints fade over 280ms. Reduced motion shows the final values immediately. This shared forecast styling also applies on experiment detail.

The AI wait explains the request's work without claiming live stage completion or percentage progress. Its shaped skeleton may pulse while the actual request is pending; ordinary loading skeletons remain static. “Ask something else” restores focus to question entry.

### Onboarding rhythm

Habits follow morning, afternoon and evening; custom habits appear as their own group. Constraints explain how selections shape a manageable plan. Both retain native checkboxes, custom entries, back navigation and Skip.

Choice ticks reserve their space and use a 150ms transform/opacity transition. There are no layout or width animations. Step slides turn off under reduced motion. The summary's answers and save controls are immediately available; the completed night arc arrives once over 480ms and habit markers over 280ms. Ring geometry and sleep values are never intermediate estimates. CSS media queries control these arrivals so reduced-motion preferences cannot change server/client SVG markup.

### Lab Report comparison

Prediction versus reality leads the report. The original prediction is visible from the start; Reveal my result brings in the actual change and its range marker over 480ms with 10px translation and opacity on the settle curve. The final numeric value appears immediately and never counts through misleading intermediate estimates. Replay uses the saved response without another request. Reduced motion reveals the final state immediately, with the same information and keyboard focus retained on the button.

Night identifies the original forecast; moss identifies the observation. The verdict and adherence follow. Written sections without backend content show waiting states, never invented findings. Report skeletons are static.

### Public landing

The public hero explains the daily effort and the standard 3-baseline/7-test-day format. An explicitly labelled sample rhythm can be explored using native habit checkboxes; this only updates the example's local component state. No request or onboarding draft is written. Checkmarks respond over 150ms and added ring markers over 280ms, using transform/opacity with reduced motion respected. There is no ambient animation.

Example questions follow the product explanation. The primary action starts onboarding; signed-in visitors see their personal dashboard instead of the public hero.

### History

History uses divider rows instead of repeating card shells. Night identifies the original forecast and moss the observation; dates, questions and result labels stay readable without opening a report. Seeded experiments are explicitly labelled as samples.

Newest/oldest ordering uses native radio controls. Existing rows move with a 280ms transform on the settle curve; reduced motion changes their order immediately. No entrance fade, looping skeleton or repeated result reveal competes with the Lab Report's signature moment. Missing reports and report retries remain visible within their own rows.
