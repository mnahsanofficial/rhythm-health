import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PredictionVsReality } from "@/components/report/prediction-vs-reality";
import type { PredictionComparison } from "@/lib/types/api";

vi.mock("motion/react", async importOriginal => ({ ...await importOriginal<typeof import("motion/react")>(), useReducedMotion: () => true }));

const comparison: PredictionComparison = {
  predicted_direction: "increase", predicted_min: 8, predicted_max: 15, predicted_midpoint: 11.5,
  observed_change_percent: 11, error_points: -0.5, within_predicted_range: true,
  direction_correct: true, accuracy_percent: 100,
};

it.each([
  { observed: 11, within: true, expected: "+11%" },
  { observed: -4, within: false, expected: "-4%" },
  { observed: 0, within: false, expected: "0%" },
])("reveals the actual result $observed without changing the original prediction", async ({ observed, within: inside, expected }) => {
  const user = userEvent.setup();
  render(<PredictionVsReality comparison={{ ...comparison, observed_change_percent: observed, within_predicted_range: inside }} metricLabel="Morning energy" />);
  expect(screen.getByText("+8% to +15%", { exact: true })).toBeVisible();
  const reveal = screen.getByRole("button", { name: "Reveal my result" });
  await user.click(reveal);
  expect(within(screen.getAllByRole("definition")[1]).getByText(expected, { exact: true })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(inside ? "inside the predicted range" : "outside the predicted range");
  expect(screen.getByText("+8% to +15%", { exact: true })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Replay comparison" }));
  expect(within(screen.getAllByRole("definition")[1]).getByText(expected, { exact: true })).toBeVisible();
});

it("compares the user's committed guess, AI range and observed change using analysis values", async () => {
  const user = userEvent.setup();
  render(<PredictionVsReality comparison={comparison} metricLabel="Morning energy" personalGuess={{ guessed_change_percent: -12, observed_change_percent: 11, error_points: 23 }} />);
  expect(screen.getByText("Your guess")).toBeVisible();
  expect(screen.getByText("-12%", { exact: true })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Reveal my result" }));
  expect(screen.getByRole("status")).toHaveTextContent("23 percentage points");
  expect(screen.getByRole("img")).toHaveAccessibleName(/your guess -12%/i);
});
