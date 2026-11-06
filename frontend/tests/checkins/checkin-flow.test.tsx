import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckinForm } from "@/components/checkins/checkin-form";
import type { Checkin, Experiment } from "@/lib/types/api";
import { experiment } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";
import { server } from "../support/server";

const { getSession, router, session } = vi.hoisted(() => ({ getSession: vi.fn(), router: { push: vi.fn(), replace: vi.fn() }, session: { user: { id: "user-1" } } }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session, loading: false }) }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
vi.mock("motion/react", async () => import("../support/motion-mock"));
const api = "http://api.test.invalid";
const active: Experiment = { ...experiment, status: "active", progress: {
  ...experiment.progress, state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1, phase_days: 7, days_remaining: 6,
} };
const saved: Checkin = { id: "44444444-4444-4444-8444-444444444444", experiment_id: experiment.id, day_number: 4, phase: "intervention", intervention_completed: true,
  metric_values: { morning_energy: 7, sleep_quality: 6 }, note: null, created_at: "2026-11-06T09:00:00Z", updated_at: "2026-11-06T09:00:00Z" };
const show = () => render(<CheckinForm id={experiment.id} />);
const answer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("radio", { name: "Yes" }));
  await user.click(await screen.findByRole("radio", { name: "7" }));
  await user.click(await screen.findByRole("radio", { name: "6" }));
};
beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-test-session" } }, error: null });
  server.use(
    http.get(`${api}/api/experiments/${experiment.id}`, () => HttpResponse.json(active)),
    http.get(`${api}/api/experiments/${experiment.id}/checkins`, () => HttpResponse.json([])),
    http.get(`${api}/api/experiments/${experiment.id}/progress`, () => HttpResponse.json(timelineFixture(active, { recorded: [1, 2, 3, 4] }))),
  );
});

describe("one question at a time", () => {
  it("requires an answer, keeps Back stable, and sends review edits straight back to review", async () => {
    const user = userEvent.setup(); show();
    const first = await screen.findByRole("heading", { name: "Did you make the change?", level: 1 });
    await user.keyboard("{Enter}"); expect(first).toBeVisible();
    expect(screen.queryByRole("group", { name: "Morning energy" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Yes" }));
    expect(await screen.findByRole("heading", { name: "Morning energy", level: 1 })).toHaveFocus();
    await user.click(screen.getByRole("radio", { name: "7" }));
    expect(await screen.findByRole("heading", { name: "Sleep quality", level: 1 })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("radio", { name: "8" }));
    expect(screen.getByRole("heading", { name: "Morning energy", level: 1 })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "6" }));
    expect(await screen.findByRole("heading", { name: "Review your check-in.", level: 1 })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Change Morning energy/ }));
    await user.click(screen.getByRole("radio", { name: "9" }));
    expect(screen.getByRole("heading", { name: "Morning energy", level: 1 })).toBeVisible();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Review your check-in.", level: 1 })).toBeVisible();
    expect(screen.getByRole("button", { name: /Change Morning energy/ })).toHaveTextContent("9/10");
  });

  it("prefills saved answers but never auto-advances an edit", async () => {
    const user = userEvent.setup();
    server.use(http.get(`${api}/api/experiments/${experiment.id}/checkins`, () => HttpResponse.json([saved])));
    show();
    expect(await screen.findByRole("radio", { name: "Yes" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Not today" }));
    expect(screen.getByRole("heading", { name: "Did you make the change?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("radio", { name: "7" })).toBeChecked();
    await user.keyboard("8");
    expect(screen.getByRole("heading", { name: "Morning energy" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "8" })).toBeChecked();
  });

  it("uses short labels, keeps typed numbers on their step, and doesn't steal typing as shortcuts", async () => {
    const user = userEvent.setup();
    const metric = { ...active.metrics[0], type: "duration" as const, label: "How many minutes did you take to fall asleep last night?", short_label: "Minutes to sleep", unit: "min" };
    const normal: Experiment = { ...active, metrics: [metric], progress: { ...active.progress, day_number: 2, phase: "baseline", phase_day: 2, phase_days: 3 } };
    server.use(
      http.get(`${api}/api/experiments/${experiment.id}`, () => HttpResponse.json(normal)),
      http.get(`${api}/api/experiments/${experiment.id}/progress`, () => HttpResponse.json(timelineFixture(normal))),
    );
    show();
    expect(await screen.findByRole("heading", { name: "Minutes to sleep" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: metric.label })).not.toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: /Minutes to sleep/ });
    await user.type(field, "90");
    expect(screen.getByRole("heading", { name: "Minutes to sleep" })).toBeVisible();
    await user.keyboard("1"); expect(field).toHaveValue("901");
    await user.clear(field); await user.type(field, "90"); await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Review your check-in." })).toBeVisible();
    expect(screen.getByRole("button", { name: /Change Minutes to sleep/ })).toHaveTextContent("90 min");
  });

  it("saves only the review, preserves answers on failure, and celebrates with refreshed server counts", async () => {
    const user = userEvent.setup(); let sent: unknown; let attempts = 0;
    server.use(http.post(`${api}/api/experiments/${experiment.id}/checkins`, async ({ request }) => {
      attempts++; sent = await request.json();
      return attempts === 1 ? HttpResponse.json({ detail: "Try saving again" }, { status: 503 }) : HttpResponse.json(saved);
    }));
    show(); await answer(user);
    await user.click(screen.getByText("Add a note", { exact: true }));
    await user.type(screen.getByRole("textbox", { name: /Anything unusual/ }), " late night ");
    await user.click(screen.getByRole("button", { name: "Save check-in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try saving again");
    expect(within(screen.getByRole("button", { name: /Change Morning energy/ })).getByText("7/10")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save check-in" }));
    expect(await screen.findByRole("heading", { name: "Day 4 recorded." })).toHaveFocus();
    expect(await screen.findByText("6 days left")).toBeVisible();
    expect(sent).toEqual({ metric_values: { morning_energy: 7, sleep_quality: 6 }, intervention_completed: true, note: "late night" });
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/");
  });
});


it("keeps a saved day honest if progress can't refresh", async () => {
  const user = userEvent.setup(); let written = false;
  server.use(
    http.get(`${api}/api/experiments/${experiment.id}/progress`, () => written
      ? HttpResponse.json({ detail: "Progress unavailable" }, { status: 503 }) : HttpResponse.json(timelineFixture(active))),
    http.post(`${api}/api/experiments/${experiment.id}/checkins`, () => { written = true; return HttpResponse.json(saved); }),
  );
  show(); await answer(user); await user.click(screen.getByRole("button", { name: "Save check-in" }));
  expect(await screen.findByRole("heading", { name: "Day 4 recorded." })).toBeVisible();
  expect(await screen.findByRole("alert")).toHaveTextContent("Your check-in is saved. Progress couldn't refresh.");
  expect(screen.queryByText("6 days left")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Refresh progress" })).toBeVisible();
});

it("doesn't send old answers when the server's day changes before saving", async () => {
  const user = userEvent.setup(); let reads = 0;
  const post = vi.fn(() => HttpResponse.json(saved));
  server.use(
    http.get(`${api}/api/experiments/${experiment.id}/progress`, () => HttpResponse.json(++reads === 1 ? timelineFixture(active)
      : timelineFixture({ ...active, progress: { ...active.progress, day_number: 5 } }))),
    http.post(`${api}/api/experiments/${experiment.id}/checkins`, post),
  );
  show(); await answer(user); await user.click(screen.getByRole("button", { name: "Save check-in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Today has changed.");
  expect(post).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save check-in" })).toBeDisabled();
});


it("offers a typed answer for a large scale and keeps its bounds available to a screen reader", async () => {
  const user = userEvent.setup();
  const normal: Experiment = { ...active, metrics: [{ ...active.metrics[0], label: "Focus", short_label: "Focus", min: 0, max: 100, unit: "/100" }],
    progress: { ...active.progress, day_number: 2, phase: "baseline", phase_day: 2, phase_days: 3 } };
  server.use(
    http.get(`${api}/api/experiments/${experiment.id}`, () => HttpResponse.json(normal)),
    http.get(`${api}/api/experiments/${experiment.id}/progress`, () => HttpResponse.json(timelineFixture(normal))),
  );
  show();
  const group = await screen.findByRole("group", { name: "Focus" });
  expect(group).toHaveAccessibleDescription(/0 Low.*100 High/);
  const field = within(group).getByRole("textbox", { name: "Focus" });
  await user.type(field, "100.5");
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  await user.clear(field); await user.type(field, "75");
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("button", { name: /Change Focus/ })).toHaveTextContent("75/100");
});
