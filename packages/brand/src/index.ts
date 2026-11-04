import tokens from "./tokens.json";

/** Portable numeric tokens. Native font loading remains the app's responsibility. */
export const COLORS = tokens.colors;
/** Semantic colours for each mode. New code should use these names. */
export const THEMES = tokens.themes;
export type ThemeName = keyof typeof THEMES;
export type ThemeColors = (typeof THEMES)[ThemeName];
export const COLOR_ALIASES = tokens.colorAliases;

/** One mode's colours under both names, so older colour names keep working in that mode. */
export function themeColors(mode: ThemeName): typeof COLORS & ThemeColors {
  const theme = THEMES[mode];
  const aliased = Object.fromEntries(
    Object.entries(COLOR_ALIASES).map(([name, semantic]) => [name, theme[semantic as keyof ThemeColors]]),
  );
  return { ...COLORS, ...theme, ...aliased } as typeof COLORS & ThemeColors;
}
export const FONT_FAMILIES = {
  display: tokens.fonts.display.family,
  sans: tokens.fonts.sans.family,
  /** Native fonts carry one weight per family; the web's font-medium needs its own name. */
  sansMedium: `${tokens.fonts.sans.family} Medium`,
  mono: tokens.fonts.mono.family,
} as const;
/** Web sizes retain fluid terms and unitless heading line-height ratios. */
export const WEB_TYPOGRAPHY = tokens.typography;
/** Existing web import; native consumers use NATIVE_TYPOGRAPHY. */
export const TYPOGRAPHY = WEB_TYPOGRAPHY;

export type NativeTextStyle = { fontSize: number; lineHeight: number };

/** Fixed mobile-first sizes: headings use the web minimum, with absolute line heights. */
export const NATIVE_TYPOGRAPHY = Object.fromEntries(
  Object.entries(WEB_TYPOGRAPHY).map(([name, type]) => {
    const fontSize = "size" in type ? type.size : type.min;
    const lineHeight = "size" in type
      ? type.lineHeight
      : Math.round(fontSize * type.lineHeight * 100) / 100;
    return [name, { fontSize, lineHeight }];
  }),
) as Record<keyof typeof WEB_TYPOGRAPHY, NativeTextStyle>;
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
