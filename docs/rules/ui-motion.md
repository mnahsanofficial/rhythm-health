# UI motion

Read [DESIGN.md](../../DESIGN.md) for tokens and screen patterns.

- Motion must answer a user action or show a real state change. No ambient loops, automatic carousels, section-by-section fade-ups or motion delaying an action. A short transition on navigating between screens is allowed (see [DESIGN.md](../../DESIGN.md#everyday-loop)). Mobile uses `react-native-reanimated`, with `reduceMotion: ReduceMotion.System` on every animation. Only the pending AI proposal wait may pulse; it must not invent stage completion or percentage progress.
- Animate transform and opacity only. Use the shared `@rhythm-health/brand` motion exports (`frontend/lib/motion.ts` re-exports them for web consumers). Web Motion uses `MOTION_DURATION` in seconds; native timing uses `MOTION_DURATION_MS`. CSS equivalents are generated from the same tokens: `--motion-*` and `--ease-settle`. Edit the brand JSON and run `npm run brand:generate`; do not duplicate timings. Preserve room for changing content and ticks instead of animating dimensions.
- One exception to transform and opacity: the onboarding scene's ring arcs and markers animate SVG `strokeDashoffset`, `cx` and `cy` through Reanimated's animated props. They run off the main thread and never touch layout. Don't extend this to anything else.
- One exception to no ambient loops: while a plan is being written, the planning moment's step dots pulse, because they show a real state, a request in flight. The ring draws once. Both stop for Reduce Motion, and neither says how far along the request is.
- One more exception to no ambient loops: a check-in question's scene drifts very slowly while nothing is answered, because Nazmul asked for a scene that doesn't sit dead. It's a few points over nine seconds, it stops on an answer, and it stops for Reduce Motion. Don't copy it to other screens. The scene itself animates transform and opacity only.
- Respect reduced motion explicitly. The root MotionConfig retains opacity animations, so custom transitions also need `useReducedMotion()` or CSS media queries. Show final information immediately and keep controls available. Never branch initial server-rendered SVG styles on a browser preference.
- Preserve native inputs and visible focus. Never put `whileTap` on a label/input wrapper. After changing a step or completing a check-in, focus its heading. Keep replay/selection controls keyboard accessible and announce useful state changes politely.
- Keep the two signature moments: the completed onboarding rhythm and the Lab Report's prediction-versus-reality comparison. Supporting feedback should not compete with them. Numeric values must remain honest; do not animate through intermediate health estimates. Plain counts, such as days recorded, may count up.
- Follow the repo's red-before-green workflow for new behavior. Test normal and reduced motion, loading/error/empty states and keyboard use. Use fake services; never call paid proposal/report-generation APIs or write invented health data to shared accounts.
- Inspect the real browser at 390px and 1440px, critique the result, and remove something that adds no value. Save before/during/after animation frames under `docs/screenshots/ui-motion/` and link them in the PR. Screenshots are evidence, not snapshot tests. Report any remaining skips or limitations.

## The phone landing carousel

The one place something moves without being asked. It waits `dwell` on each slide and loops forward. It stops for Reduce Motion, a screen reader, a finger on the slide, or Pause, which stays on screen whenever the slides can move. Every slide can also be reached by swiping or by its dot.

