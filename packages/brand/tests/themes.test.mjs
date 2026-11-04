import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { renderCss } from "../scripts/css.mjs";

const tokens = JSON.parse(await readFile(new URL("../src/tokens.json", import.meta.url), "utf8"));
const { light, dark } = tokens.themes ?? {};

function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map((pair) => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const TEXT_ON = {
  text: ["background", "surface", "raised", "accent-tint", "night-tint"],
  muted: ["background", "surface", "raised", "accent-tint", "night-tint", "danger-tint"],
  accent: ["background", "surface", "raised", "accent-tint", "night-tint"],
  "on-accent": ["accent", "accent-press", "chart-1", "chart-2"],
  "night-text": ["night-tint", "surface", "background"],
  success: ["success-tint", "surface"],
  warning: ["warning-tint", "background", "surface"],
  danger: ["danger-tint", "background", "surface", "raised"],
};
const SHAPES_ON = {
  control: ["background", "surface", "raised"],
  accent: ["background", "surface"],
  "chart-1": ["background", "surface"],
  "chart-2": ["background", "surface"],
  "chart-3": ["background", "surface"],
};

for (const [mode, theme] of [["light", light], ["dark", dark]]) {
  for (const [foreground, backgrounds] of Object.entries(TEXT_ON)) {
    for (const background of backgrounds) {
      test(`${mode}: ${foreground} text on ${background} meets AA (4.5:1)`, () => {
        assert.ok(contrast(theme[foreground], theme[background]) >= 4.5);
      });
    }
  }
  for (const [foreground, backgrounds] of Object.entries(SHAPES_ON)) {
    for (const background of backgrounds) {
      test(`${mode}: ${foreground} shape on ${background} meets AA (3:1)`, () => {
        assert.ok(contrast(theme[foreground], theme[background]) >= 3);
      });
    }
  }
}

test("both themes define the same semantic tokens", () => {
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
});

test("every older colour name points at a semantic token with today's light value", () => {
  for (const [name, semantic] of Object.entries(tokens.colorAliases)) {
    assert.equal(light[semantic], tokens.colors[name], `${name} -> ${semantic}`);
  }
});

test("the generated CSS keeps light as the default and switches every name in dark", () => {
  const css = renderCss(tokens);
  assert.match(css, /@theme \{[^}]*--color-surface: #fffdf8;/);
  assert.match(css, /@theme \{[^}]*--color-oat: #f6f3ec;/);
  assert.match(css, /\[data-theme="dark"\] \{[^}]*color-scheme: dark;/);
  assert.match(css, new RegExp(`\\[data-theme="dark"\\] \\{[^}]*--color-surface: ${dark.surface};`));
  assert.match(css, new RegExp(`\\[data-theme="dark"\\] \\{[^}]*--color-oat: ${dark.background};`));
  assert.match(css, new RegExp(`\\[data-theme="dark"\\] \\{[^}]*--color-ink: ${dark.text};`));
});

test("a nested light region resets every themed name, so illustrations keep their colours", () => {
  const css = renderCss(tokens);
  assert.match(css, /\[data-theme="light"\] \{[^}]*color-scheme: light;/);
  assert.match(css, /\[data-theme="light"\] \{[^}]*--color-oat: #f6f3ec;/);
  assert.match(css, new RegExp(`\\[data-theme="light"\\] \\{[^}]*--color-surface: ${light.surface};`));
});

test("without a saved choice or script, the page follows the system", () => {
  const css = renderCss(tokens);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme\]\) \{[^}]*color-scheme: dark;/);
});
