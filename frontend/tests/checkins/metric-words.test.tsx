import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { MetricInput } from "@/components/checkins/metric-input";
import { proposal } from "../support/fixtures";

it("names the actual scale endpoints and keeps numeric answers", async () => {
  const onChange = vi.fn();
  render(<MetricInput metric={{ ...proposal.metrics[0], min: 2, max: 6, min_label: "Very tired", max_label: "Ready for the day" }} value={undefined} text="" onChange={onChange} />);
  const question = screen.getByRole("group", { name: "Morning energy" });
  expect(within(question).getByText("2 Very tired")).toBeVisible();
  expect(within(question).getByText("6 Ready for the day")).toBeVisible();
  await userEvent.setup().click(within(question).getByRole("radio", { name: "6" }));
  expect(onChange).toHaveBeenCalledWith(6, "");
});

it("uses neutral Low / High for an old known metric rather than inventing its meaning", () => {
  render(<MetricInput metric={proposal.metrics[0]} value={undefined} text="" onChange={vi.fn()} />);
  expect(screen.getByText("1 Low")).toBeVisible();
  expect(screen.getByText("10 High")).toBeVisible();
});

it("falls back independently when only one end has words", () => {
  render(<MetricInput metric={{ ...proposal.metrics[0], max_label: "Fully awake" }} value={undefined} text="" onChange={vi.fn()} />);
  expect(screen.getByText("1 Low")).toBeVisible();
  expect(screen.getByText("10 Fully awake")).toBeVisible();
  expect(screen.getByRole("group", { name: "Morning energy" })).toHaveAccessibleDescription(/1 Low.*10 Fully awake/);
});
