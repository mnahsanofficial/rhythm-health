# UI motion

Read [DESIGN.md](../../DESIGN.md) for tokens and screen patterns.

- Motion must answer a user action or show a real state change. No ambient loops, automatic carousels, section-by-section fade-ups or motion delaying an action. Only the pending AI proposal wait may pulse; it must not invent stage completion or percentage progress.
- Animate transform and opacity only. Use `MOTION_DURATION` and `MOTION_EASE` from `frontend/lib/motion.ts`; CSS equivalents are `--motion-*` and `--ease-settle` in `globals.css`. JS uses seconds, CSS milliseconds; keep them aligned. Preserve room for changing content and ticks instead of animating dimensions.
- Respect reduced motion explicitly. The root MotionConfig retains opacity animations, so custom transitions also need `useReducedMotion()` or CSS media queries. Show final information immediately and keep controls available. Never branch initial server-rendered SVG styles on a browser preference.
- Preserve native inputs and visible focus. Never put `whileTap` on a label/input wrapper. After changing a step or completing a check-in, focus its heading. Keep replay/selection controls keyboard accessible and announce useful state changes politely.
- Keep the two signature moments: the completed onboarding rhythm and the Lab Report's prediction-versus-reality comparison. Supporting feedback should not compete with them. Numeric values must remain honest; do not animate through intermediate health estimates.
- Follow the repo's red-before-green workflow for new behavior. Test normal and reduced motion, loading/error/empty states and keyboard use. Use fake services; never call paid proposal/report-generation APIs or write invented health data to shared accounts.
- Inspect the real browser at 390px and 1440px, critique the result, and remove something that adds no value. Save before/during/after animation frames under `docs/screenshots/ui-motion/` and link them in the PR. Screenshots are evidence, not snapshot tests. Report any remaining skips or limitations.
