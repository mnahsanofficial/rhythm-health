import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayCard } from "@/components/experiments/experiment-progress";
import type { Experiment } from "@/lib/types/api";
import { timelineFixture } from "../support/timeline-fixture";
import { experiment } from "../support/fixtures";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const path = `/experiments/${experiment.id}`;
const onDay = (day: number, remaining: number): Experiment => ({
  ...experiment,
  status: "active",
  started_at: "2026-10-26T08:00:00Z",
  progress: {
    state: "in_progress", day_number: day, phase: day > 3 ? "intervention" : "baseline", phase_day: 1, phase_days: 7,
    total_days: 10, days_remaining: remaining, started_at: "2026-10-26T08:00:00Z", ends_at: "2026-11-05T08:00:00Z",
  },
});

afterEach(() => vi.restoreAllMocks());

describe("today card calendar reminder", () => {
  it("offers the next day as a calendar event once today is recorded", async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => { blobs.push(blob as Blob); return "blob:reminder"; });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });

    render(<TodayCard experiment={onDay(4, 6)} timeline={timelineFixture(onDay(4, 6), { recorded: [4], nextDayAt: "2026-11-01T14:00:00Z" })} path={path} />);
    expect(screen.getByText("Done for today")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add day 5 to your calendar" }));

    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe("text/calendar;charset=utf-8");
    // jsdom's Blob has no .text(); FileReader reads it the same way a browser would.
    const raw = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]);
    });
    const ics = raw.replace(/\r\n /g, ""); // undo line folding
    // Use the server-provided boundary, even when the cached experiment differs.
    expect(ics).toContain("DTSTART:20261101T140000Z");
    expect(ics).toContain(`URL:${window.location.origin}${path}/check-in`);
    expect(clicked[0].download).toBe("rhythm-day-5.ics");
    expect(clicked[0].href).toBe("blob:reminder");
  });

  it("doesn't offer a reminder after the last day", () => {
    render(<TodayCard experiment={onDay(10, 0)} timeline={timelineFixture(onDay(10, 0), { recorded: [10] })} path={path} />);
    expect(screen.getByText("That was the last day.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /calendar/ })).not.toBeInTheDocument();
  });

  it("doesn't offer a reminder before today's check-in", () => {
    render(<TodayCard experiment={onDay(4, 6)} timeline={timelineFixture(onDay(4, 6))} path={path} />);
    expect(screen.queryByRole("button", { name: /calendar/ })).not.toBeInTheDocument();
  });
});
