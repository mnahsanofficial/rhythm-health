const rem = (pixels) => `${pixels / 16}rem`;
const declaration = (name, value) => `  --${name}: ${value};`;

/** Every themed name for one mode: semantic tokens, plus the older names that point at them. */
function themedNames(theme, aliases, mode) {
  return [
    declaration("color-scheme", mode).replace("--color-scheme", "color-scheme"),
    ...Object.entries(theme).map(([name, color]) => declaration(`color-${name}`, color)),
    ...Object.entries(aliases).map(([name, semantic]) => declaration(`color-${name}`, theme[semantic])),
  ].join("\n");
}

/** Light is the default. `data-theme` picks a mode, also on a nested element such as an illustration. */
function renderThemes({ themes, colorAliases }) {
  const dark = themedNames(themes.dark, colorAliases, "dark");
  const indented = dark.replace(/^/gm, "  ");
  return `\n[data-theme="light"] {\n${themedNames(themes.light, colorAliases, "light")}\n}\n\n[data-theme="dark"] {\n${dark}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {\n${indented}\n  }\n}\n`;
}

/** Numeric sizes use CSS's default 16px rem; fluid type also retains its vw term. */
export function renderCss(tokens) {
  const theme = [];
  for (const [name, color] of Object.entries(tokens.colors)) {
    theme.push(declaration(`color-${name}`, color));
  }
  const light = tokens.themes?.light ?? {};
  for (const [name, color] of Object.entries(light)) {
    if (!(name in tokens.colors)) theme.push(declaration(`color-${name}`, color));
  }
  for (const [name, font] of Object.entries(tokens.fonts)) {
    theme.push(declaration(`font-${name}`, `var(${font.variable}), ${font.fallback}`));
  }
  for (const [name, type] of Object.entries(tokens.typography)) {
    const fixed = "size" in type;
    const size = fixed ? rem(type.size)
      : `clamp(${rem(type.min)}, ${rem(type.preferred.base)} + ${type.preferred.vw}vw, ${rem(type.max)})`;
    theme.push(declaration(`text-${name}`, size));
    theme.push(declaration(`text-${name}--line-height`, fixed ? rem(type.lineHeight) : type.lineHeight));
  }
  theme.push(declaration("spacing", rem(tokens.spacing.unit)));
  theme.push(declaration("radius-card", rem(tokens.radii.card)));
  theme.push(declaration("radius-pill", `${tokens.radii.pill}px`));
  if (tokens.radii.control !== undefined) theme.push(declaration("radius-control", rem(tokens.radii.control)));
  for (const [name, curve] of Object.entries(tokens.motion.ease)) {
    theme.push(declaration(`ease-${name}`, `cubic-bezier(${curve.join(", ")})`));
  }
  const root = Object.entries(tokens.motion.durationMs).map(([name, ms]) => declaration(`motion-${name}`, `${ms}ms`));
  const { layout } = tokens;
  root.push(declaration("header-h", rem(layout.headerHeight)));
  root.push(declaration("content-width", rem(layout.contentWidth)));
  root.push(declaration("gutter", `clamp(${rem(layout.gutter.min)}, ${layout.gutter.vw}vw, ${rem(layout.gutter.max)})`));
  if (layout.focusWidth !== undefined) {
    root.push(declaration("focus-width", `${layout.focusWidth}px`));
    root.push(declaration("focus-offset", `${layout.focusOffset}px`));
    root.push(declaration("focus-radius", `${layout.focusRadius}px`));
  }
  if (layout.buttonMaxWidth !== undefined) root.push(declaration("button-max", rem(layout.buttonMaxWidth)));
  const css = `/* Generated from src/tokens.json. Run npm run brand:generate; do not edit. */\n@theme {\n${theme.join("\n")}\n}\n\n:root {\n${root.join("\n")}\n}\n`;
  return tokens.themes ? css + renderThemes(tokens) : css;
}
