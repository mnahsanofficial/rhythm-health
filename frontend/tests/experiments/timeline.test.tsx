import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Timeline } from "@/components/experiments/experiment-progress";
import type { Checkin, Experiment } from "@/lib/types/api";
import { timelineFixture } from "../support/timeline-fixture";
import { experiment } from "../support/fixtures";

vi.mock("motion/react", async () => import("../support/motion-mock"));

const active: Experiment = {
  ...experiment,
  status: "active",
  started_at: "2026-10-25T10:00:00Z",
  progress: {
    state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7,
    total_days: 10, days_remaining: 6, started_at: "2026-10-25T10:00:00Z", ends_at: "2026-11-04T10:00:00Z",
  },
};

const day = (n: number, energy: number, note: string | null): Checkin => ({
  id: `day-${n}`, experiment_id: experiment.id, phase: "baseline", day_number: n, intervention_completed: false,
  metric_values: { morning_energy: energy, sleep_quality: 7 }, note,
  created_at: "2026-10-25T12:00:00Z", updated_at: "2026-10-25T12:00:00Z",
});

const recorded = [day(1, 5, "A quiet evening."), day(2, 6, null), day(3, 4, "Late dinner.")];

describe("timeline day details", () => {
  it("opens on the latest recorded day instead of an empty panel", () => {
    render(<Timeline experiment={active} checkins={recorded} timeline={timelineFixture(active, { recorded: [1, 2, 3] })} />);
    const details = screen.getByRole("region", { name: "Recorded day" });
    expect(within(details).getByRole("article", { name: "Day 3 answers" })).toBeInTheDocument();
    expect(within(details).getByText(/Late dinner/)).toBeInTheDocument();
    expect(screen.queryByText(/Choose a recorded day/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day 3, baseline, logged" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches days, and choosing the open day again keeps it open", async () => {
    const user = userEvent.setup();
    render(<Timeline experiment={active} checkins={recorded} timeline={timelineFixture(active, { recorded: [1, 2, 3] })} />);
    const first = screen.getByRole("button", { name: "Day 1, baseline, logged" });
    await user.click(first);
    expect(screen.getByRole("article", { name: "Day 1 answers" })).toBeInTheDocument();
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Day 3, baseline, logged" })).toHaveAttribute("aria-pressed", "false");
    await user.click(first);
    expect(screen.getByRole("article", { name: "Day 1 answers" })).toBeInTheDocument();
  });

  it("has no details panel before the first check-in", () => {
    render(<Timeline experiment={active} checkins={[]} timeline={timelineFixture(active)} />);
    expect(screen.queryByRole("region", { name: "Recorded day" })).not.toBeInTheDocument();
  });
});
