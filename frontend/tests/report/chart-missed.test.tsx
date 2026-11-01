import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DayChart } from "@/components/report/day-chart";
import { labReport } from "../support/fixtures";
vi.mock("motion/react", async () => import("../support/motion-mock"));

it("uses point-level missed flags to distinguish missed and unobserved days", () => {
  const chart = { ...labReport.chart, points: labReport.chart.points.map(p => p.day === 2 || p.day === 10 ? {
    ...p, logged: false, missed: p.day === 2, value: null, values: null,
  } : { ...p, missed: false }) };
  render(<DayChart chart={chart} />);
  expect(screen.getByText("Missed: day 2.")).toBeVisible();
  expect(screen.getByText("Not reached before you finished: day 10.")).toBeVisible();
  expect(screen.queryByText("Missed: day 10.")).not.toBeInTheDocument();
});
