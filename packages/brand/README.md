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
  TYPOGRAPHY,
  SPACING,
  RADII,
  LAYOUT,
  MOTION_DURATION_MS,
  MOTION_EASE,
} from "@rhythm-health/brand";
```

- Colour roles keep the exact palette. `sun` is a marker, never text; clay colours are for errors.
- Fixed typography uses numeric `size` and `lineHeight`. Heading tokens expose numeric min/max and a preferred base/vw term: web CSS retains the existing fluid clamps. A native screen can adapt presentation to its available width; it must not pass CSS `rem`/`clamp` strings to React Native.
- Spacing, radii and layout sizes are numeric. Generated web sizes use rems where the existing design did, based on 16px; the pill radius remains 999px. The 4px spacing unit is Tailwind's existing default.
- `MOTION_DURATION_MS` serves native timing APIs and generated CSS. `MOTION_DURATION` converts those same values to seconds for Motion on the web. `MOTION_EASE.settle` is the shared cubic-bezier tuple.
- The package contains no React/DOM dependency, animation, media-query subscription or font loader. Apps handle reduced motion and font loading. No mobile app is implemented in this PR.

Tests cover unit conversion, fluid type, token edits, generated-file freshness, portable numeric sizing, contrast pairings and web/native timing agreement. Browser checks verify that the extraction preserves the existing pages.
