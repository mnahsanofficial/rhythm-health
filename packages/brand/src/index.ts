import tokens from "./tokens.json";

/** Portable numeric tokens. Native font loading remains the app's responsibility. */
export const COLORS = tokens.colors;
export const FONT_FAMILIES = {
  display: tokens.fonts.display.family,
  sans: tokens.fonts.sans.family,
  mono: tokens.fonts.mono.family,
} as const;
export const TYPOGRAPHY = tokens.typography;
export const SPACING = tokens.spacing;
export const RADII = tokens.radii;
export const LAYOUT = tokens.layout;
export const MOTION_DURATION_MS = tokens.motion.durationMs;

/** Motion on the web uses seconds; native timing APIs and generated CSS use ms. */
export const MOTION_DURATION = Object.fromEntries(
  Object.entries(MOTION_DURATION_MS).map(([name, ms]) => [name, ms / 1000]),
) as Record<keyof typeof MOTION_DURATION_MS, number>;

export const MOTION_EASE = {
  settle: tokens.motion.ease.settle as [number, number, number, number],
} as const;
