import { describe, expect, it } from "vitest";
import * as brand from "@rhythm-health/brand";
import { COLORS, LAYOUT, MOTION_DURATION_MS, SPACING, TYPOGRAPHY } from "@rhythm-health/brand";
import { MOTION_DURATION } from "@/lib/motion";

function luminance(hex: string): number {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((pair) => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("shared brand in the web app", () => {
  it("keeps web seconds aligned with native/CSS milliseconds for every motion role", () => {
    for (const role of Object.keys(MOTION_DURATION_MS) as (keyof typeof MOTION_DURATION_MS)[]) {
      expect(MOTION_DURATION[role] * 1000).toBe(MOTION_DURATION_MS[role]);
    }
  });

  it("preserves readable body, secondary, action and error colour pairings", () => {
    expect(contrast(COLORS.ink, COLORS.oat)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(COLORS.muted, COLORS.oat)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(COLORS.paper, COLORS.moss)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(COLORS.clay, COLORS["clay-tint"])).toBeGreaterThanOrEqual(4.5);
  });

  it("provides numeric native sizing that retains input and tap-target minimums", () => {
    expect(TYPOGRAPHY.body.size).toBeGreaterThanOrEqual(16);
    expect(LAYOUT.inputFontSize).toBeGreaterThanOrEqual(16);
    expect(LAYOUT.tapTarget).toBeGreaterThanOrEqual(44);
    expect(LAYOUT.primaryAction).toBeGreaterThanOrEqual(LAYOUT.tapTarget);
    expect(SPACING.md).toBe(SPACING.unit * 4);
  });
});


describe("native typography", () => {
  it("offers fixed font sizes and absolute line heights alongside the web scale", () => {
    const native = Reflect.get(brand, "NATIVE_TYPOGRAPHY");
    expect(native).toEqual(expect.objectContaining({
      caption: { fontSize: 14, lineHeight: 21.6 },
      body: { fontSize: 16, lineHeight: 25.6 },
      title: { fontSize: 22, lineHeight: 29.26 },
      "display-sm": { fontSize: 36, lineHeight: 39.24 },
      display: { fontSize: 44, lineHeight: 47.08 },
    }));
  });

  it("makes every native type role a numeric Text style with no fluid terms", () => {
    const native = Reflect.get(brand, "NATIVE_TYPOGRAPHY") as
      Record<string, { fontSize: number; lineHeight: number }> | undefined;
    expect(Object.keys(native ?? {}).sort()).toEqual(Object.keys(TYPOGRAPHY).sort());
    for (const style of Object.values(native ?? {})) {
      expect(Object.keys(style).sort()).toEqual(["fontSize", "lineHeight"]);
      expect(Number.isFinite(style.fontSize)).toBe(true);
      expect(Number.isFinite(style.lineHeight)).toBe(true);
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
    }
  });
});
