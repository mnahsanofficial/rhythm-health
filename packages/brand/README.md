# Shared brand

`@rhythm-health/brand` owns the colour, type, spacing, shape, layout and motion values described in [DESIGN.md](../../DESIGN.md). Edit `src/tokens.json`, then run from the repository root:

```bash
npm run brand:generate
npm run brand:check
```

`generate` writes `generated/tokens.css`. `check` rejects missing/stale CSS without rewriting it; root `npm test` runs this gate. Both are local and need no env files or services. Do not edit the generated CSS.

## Web

`frontend/app/globals.css` imports `@rhythm-health/brand/tokens.css` after Tailwind. Existing utility names (`bg-oat`, `rounded-card`, `text-headline`) stay the same. The generated file supplies `@theme` and root variables; web layout, focus and reduced-motion rules remain in the frontend. `frontend/lib/motion.ts` re-exports the shared seconds/easing exports for existing components, and the browser theme colour reads `COLORS.oat`.

Web fonts still load through the existing static `next/font/google` calls. Their family/variable aliases are shared tokens; the package does not change font loading or bundle font assets.

## Native-ready exports

```ts
import {
  COLORS,
  FONT_FAMILIES,
  NATIVE_TYPOGRAPHY,
  SPACING,
  RADII,
  LAYOUT,
  MOTION_DURATION_MS,
  MOTION_EASE,
} from "@rhythm-health/brand";
```

- Colour roles keep the exact palette. `sun` is a marker, never text; clay colours are for errors.
- `NATIVE_TYPOGRAPHY` provides a fixed `{ fontSize, lineHeight }` Text style for every role. Both values are absolute numbers. Headings use the web minimum size (the mobile-first size at 390px), multiplying its line-height ratio into an absolute value rounded to two decimals. For example, title is 22 / 29.26; body is 16 / 25.6. There are no viewport terms or ratios to interpret in a native screen.
- `WEB_TYPOGRAPHY` retains the existing web descriptors, including fluid min/preferred/max sizes and heading line-height ratios. `TYPOGRAPHY` remains a compatibility alias for web consumers. Native screens use `NATIVE_TYPOGRAPHY` rather than spreading the web descriptors into Text styles.
- Spacing, radii and layout sizes are numeric. Generated web sizes use rems where the existing design did, based on 16px; the pill radius remains 999px. The 4px spacing unit is Tailwind's existing default.
- `MOTION_DURATION_MS` serves native timing APIs and generated CSS. `MOTION_DURATION` converts those same values to seconds for Motion on the web. `MOTION_EASE.settle` is the shared cubic-bezier tuple.
- The package contains no React/DOM dependency, animation, media-query subscription or font loader. Apps handle reduced motion and font loading. No mobile app is implemented in this PR.

A native Text style can use `...NATIVE_TYPOGRAPHY.body` together with `fontFamily: FONT_FAMILIES.sans`. Native font loading and system font scaling remain the app's responsibility.

Tests cover unit conversion, fluid type, token edits, generated-file freshness, portable numeric sizing, contrast pairings and web/native timing agreement. Browser checks verify that the extraction preserves the existing pages.
