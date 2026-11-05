import { describe, expect, it } from "vitest";
import { orderExperiments, readyForResults, weeklyCount, type RunningExperiment } from "@/components/today/model";
import { experiment } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";

function entry(day: number, recorded: number[], nextDayAt: string, sample = false): RunningExperiment {
  const active = { ...experiment, is_seeded: sample, progress: { ...experiment.progress,
    state: "in_progress" as const, day_number: day, days_remaining: 10 - day,
  } };
  return { experiment: active, timeline: timelineFixture(active, { recorded, nextDayAt }) };
}

describe("Today follows server progress", () => {
  it("counts only recorded days in this experiment's rolling week", () => {
    expect(weeklyCount(entry(9, [1, 2, 3, 5, 9, 10], "2026-11-06T12:00:00Z"))).toBe(3);
    expect(weeklyCount({ experiment, timeline: timelineFixture(experiment) })).toBeNull();
  });
  it("orders due work by the closing time, ahead of recorded work and examples", () => {
    const late = entry(4, [], "2026-11-06T15:00:00Z");
    const soon = entry(2, [], "2026-11-06T12:00:00Z");
    const done = entry(4, [4], "2026-11-06T10:00:00Z");
    const sample = entry(4, [], "2026-11-06T09:00:00Z", true);
    expect(orderExperiments([late, sample, done, soon])).toEqual([soon, late, done, sample]);
  });
  it("offers results after the final day is recorded even with earlier missed days", () => {
    expect(readyForResults(entry(10, [1, 2, 4, 5, 6, 7, 8, 9, 10], "2026-11-06T12:00:00Z"))).toBe(true);
    expect(readyForResults(entry(10, [1, 2, 4, 5, 6, 7, 8, 9], "2026-11-06T12:00:00Z"))).toBe(false);
  });
});
