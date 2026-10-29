/** Motion durations in seconds. CSS mirrors these in globals.css for native controls and SVG. */
export const MOTION_DURATION = {
  press: 0.15,
  exit: 0.12,
  panel: 0.2,
  response: 0.28,
  step: 0.35,
  reveal: 0.48,
} as const;

/** The shared settling curve; keep --ease-settle in globals.css in sync. */
export const MOTION_EASE = {
  settle: [0.22, 1, 0.36, 1],
} as const;
