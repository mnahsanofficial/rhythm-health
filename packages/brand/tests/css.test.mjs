import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCss } from "../scripts/css.mjs";

const tokens = {
  colors: { oat: "#f6f3ec", moss: "#2f6b4f" },
  fonts: {
    display: { family: "Fraunces", variable: "--font-fraunces", fallback: "ui-serif, Georgia, serif" },
    sans: { family: "Instrument Sans", variable: "--font-instrument", fallback: "ui-sans-serif, system-ui, sans-serif" },
    mono: { family: "Geist Mono", variable: "--font-geist-mono", fallback: "ui-monospace, monospace" },
  },
  typography: {
    body: { size: 16, lineHeight: 25.6 },
    title: { min: 22, max: 24, preferred: { base: 20, vw: 0.5 }, lineHeight: 1.33 },
  },
  spacing: { unit: 4 },
  radii: { card: 20, pill: 999 },
  layout: { headerHeight: 64, contentWidth: 1440, gutter: { min: 16, vw: 4, max: 64 } },
  motion: { durationMs: { press: 150, reveal: 480 }, ease: { settle: [0.22, 1, 0.36, 1] } },
};

test("web colours and font aliases retain the native brand's values", () => {
  const css = renderCss(tokens);
  assert.match(css, /--color-oat: #f6f3ec;/);
  assert.match(css, /--color-moss: #2f6b4f;/);
  assert.match(css, /--font-display: var\(--font-fraunces\), ui-serif, Georgia, serif;/);
  assert.match(css, /--font-sans: var\(--font-instrument\), ui-sans-serif, system-ui, sans-serif;/);
});

test("fixed type sizes convert native pixels to web rems without changing line height", () => {
  const css = renderCss(tokens);
  assert.match(css, /--text-body: 1rem;/);
  assert.match(css, /--text-body--line-height: 1\.6rem;/);
});

test("fluid headings retain min, preferred and max sizes and unitless line height", () => {
  const css = renderCss(tokens);
  assert.match(css, /--text-title: clamp\(1\.375rem, 1\.25rem \+ 0\.5vw, 1\.5rem\);/);
  assert.match(css, /--text-title--line-height: 1\.33;/);
});

test("layout, spacing and radii keep current dimensions", () => {
  const css = renderCss(tokens);
  assert.match(css, /--spacing: 0\.25rem;/);
  assert.match(css, /--radius-card: 1\.25rem;/);
  assert.match(css, /--radius-pill: 999px;/);
  assert.match(css, /--header-h: 4rem;/);
  assert.match(css, /--content-width: 90rem;/);
  assert.match(css, /--gutter: clamp\(1rem, 4vw, 4rem\);/);
});

test("motion uses milliseconds for CSS and preserves the shared easing curve", () => {
  const css = renderCss(tokens);
  assert.match(css, /--motion-press: 150ms;/);
  assert.match(css, /--motion-reveal: 480ms;/);
  assert.match(css, /--ease-settle: cubic-bezier\(0\.22, 1, 0\.36, 1\);/);
});

test("changing a token changes its generated web value without editing the renderer", () => {
  const changed = structuredClone(tokens);
  changed.colors.moss = "#123456";
  changed.typography.title.max = 32;
  changed.motion.durationMs.reveal = 600;
  const css = renderCss(changed);
  assert.match(css, /--color-moss: #123456;/);
  assert.match(css, /clamp\(1\.375rem, 1\.25rem \+ 0\.5vw, 2rem\)/);
  assert.match(css, /--motion-reveal: 600ms;/);
  assert.equal(changed.motion.durationMs.reveal, 600);
});
