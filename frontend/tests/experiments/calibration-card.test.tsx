import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalibrationCard } from "@/components/experiments/calibration-card";
import type { Calibration } from "@/lib/types/api";
import { server } from "../support/server";

const api = "http://api.test.invalid";
const URL = `${api}/api/experiments/calibration`;
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));

const point = (number: number, guess: number, observed: number, off: number) => ({
  experiment_id: `exp-${number}`,
  question: `Question ${number}?`,
  completed_at: `2026-10-0${number}T10:00:00Z`,
  guessed_change_percent: guess,
  observed_change_percent: observed,
  off_by_points: off,
});

function reply(body: Omit<Calibration, "example"> & Partial<Pick<Calibration, "example">>) {
  server.use(http.get(URL, () => HttpResponse.json({ example: null, ...body })));
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
});

describe("the calibration card", () => {
  it("shows each guess against what happened, newest first", async () => {
    reply({ points: [point(1, 10, 30, 20), point(2, 10, 12.5, 2.5)], average_off_by_points: 11.3, trend: "closer" });
    render(<CalibrationCard />);

    const items = within(await screen.findByRole("list", { name: "Your guesses" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Question 2?");
    expect(items[0]).toHaveTextContent("You guessed +10%");
    expect(items[0]).toHaveTextContent("It changed +12.5%");
    expect(items[0]).toHaveTextContent("Off by 2.5 points");
    expect(items[1]).toHaveTextContent("Off by 20 points");
  });

  it.each([
    ["closer", "Your guesses are getting closer."],
    ["further", "Your recent guesses were further off."],
    ["steady", "Your guesses are staying about as close."],
  ] as const)("says the trend in plain words: %s", async (trend, text) => {
    reply({ points: [point(1, 10, 30, 20), point(2, 10, 12, 2)], average_off_by_points: 11, trend });
    render(<CalibrationCard />);
    expect(await screen.findByText(text)).toBeVisible();
    expect(screen.getByText(/Off by 11 points on average across 2 experiments/)).toBeVisible();
    expect(screen.getByText(/a pattern, not proof/i)).toBeVisible();
  });

  it("explains what one guess can't show yet", async () => {
    reply({ points: [point(1, 10, 14, 4)], average_off_by_points: 4, trend: null });
    render(<CalibrationCard />);
    expect(await screen.findByText("Finish another experiment to see whether you're getting closer.")).toBeVisible();
  });

  it("uses one point, not points, for a gap of exactly one", async () => {
    reply({ points: [point(1, 10, 11, 1)], average_off_by_points: 1, trend: null });
    render(<CalibrationCard />);
    expect(await screen.findByText(/Off by 1 point$/)).toBeVisible();
  });

  it("has an empty state that says how to start", async () => {
    reply({ points: [], average_off_by_points: null, trend: null });
    render(<CalibrationCard />);
    expect(await screen.findByText(/Your next experiment asks for your own guess/)).toBeVisible();
    expect(screen.queryByRole("list", { name: "Your guesses" })).toBeNull();
  });

  it("labels the sample as an example and keeps it out of the real guesses", async () => {
    reply({ points: [], average_off_by_points: null, trend: null, example: point(1, 5, 10.9, 5.9) });
    render(<CalibrationCard />);

    const example = await screen.findByRole("group", { name: "Example, not your results" });
    expect(within(example).getByText("Example")).toBeVisible();
    expect(example).toHaveTextContent("Built from invented check-ins and an invented guess. It isn't part of your results.");
    expect(example).toHaveTextContent("Question 1?");
    expect(example).toHaveTextContent("Guessed +5%");
    expect(example).toHaveTextContent("It changed +10.9%");
    expect(example).toHaveTextContent("Off by 5.9 points");
    expect(example).not.toHaveTextContent("You guessed");
    expect(screen.queryByRole("list", { name: "Your guesses" })).toBeNull();
    expect(screen.queryByText(/on average/)).toBeNull();
    expect(screen.getByText(/Your next experiment asks for your own guess/)).toBeVisible();
  });

  it("shows no example beside real guesses", async () => {
    reply({ points: [point(1, 10, 14, 4)], average_off_by_points: 4, trend: null });
    render(<CalibrationCard />);
    await screen.findByRole("list", { name: "Your guesses" });
    expect(screen.queryByText("Example")).toBeNull();
  });

  it("shows a loading state, then the result", async () => {
    reply({ points: [], average_off_by_points: null, trend: null });
    render(<CalibrationCard />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking your guesses…");
    expect(await screen.findByText(/Your next experiment asks/)).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("explains a failure and retries, without taking over the page", async () => {
    const user = userEvent.setup();
    let reads = 0;
    server.use(http.get(URL, () => {
      reads += 1;
      return reads === 1
        ? HttpResponse.json({ detail: "Database unavailable" }, { status: 503 })
        : HttpResponse.json({ points: [], average_off_by_points: null, trend: null, example: null });
    }));
    render(<CalibrationCard />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't compare your guesses.");
    expect(alert).toHaveTextContent("Database unavailable");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Your next experiment asks/)).toBeVisible();
  });
});
