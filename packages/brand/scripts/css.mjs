const rem = (pixels) => `${pixels / 16}rem`;
const declaration = (name, value) => `  --${name}: ${value};`;

/** Numeric sizes use CSS's default 16px rem; fluid type also retains its vw term. */
export function renderCss(tokens) {
  const theme = [];
  for (const [name, color] of Object.entries(tokens.colors)) {
    theme.push(declaration(`color-${name}`, color));
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
  return `/* Generated from src/tokens.json. Run npm run brand:generate; do not edit. */\n@theme {\n${theme.join("\n")}\n}\n\n:root {\n${root.join("\n")}\n}\n`;
}
