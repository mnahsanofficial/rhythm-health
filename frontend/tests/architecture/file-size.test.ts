import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lines = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8").split("\n").length;

describe("the components 8x flagged stay split", () => {
  it.each([
    ["components/experiments/experiment-flow.tsx", 320],
    ["components/checkins/checkin-form.tsx", 300],
  ])("%s stays under %i lines", (path, limit) => {
    expect(lines(path)).toBeLessThanOrEqual(limit);
  });

  it("has one signed-percent helper", () => {
    expect(readFileSync(resolve(__dirname, "../../components/experiments/experiment-flow.tsx"), "utf8")).not.toContain("function signedPercent");
  });
});
