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
const saved: Checkin = { id: "saved", experiment_id: experiment.id, day_number: 4, phase: "intervention", intervention_completed: true,
  metric_values: { morning_energy: 7, sleep_quality: 6 }, note: null, created_at: "2026-11-06T09:00:00Z", updated_at: "2026-11-06T09:00:00Z" };
const show = () => render(<CheckinForm id={experiment.id} />);
const answer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("radio", { name: "Yes", exact: true }));
  await user.click(await screen.findByRole("radio", { name: "7", exact: true }));
  await user.click(await screen.findByRole("radio", { name: "6", exact: true }));
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
    await user.click(screen.getByRole("radio", { name: "Yes", exact: true }));
    expect(await screen.findByRole("heading", { name: "Morning energy", level: 1 })).toHaveFocus();
    await user.click(screen.getByRole("radio", { name: "7", exact: true }));
    expect(await screen.findByRole("heading", { name: "Sleep quality", level: 1 })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back", exact: true }));
    await user.click(screen.getByRole("radio", { name: "8", exact: true }));
    expect(screen.getByRole("heading", { name: "Morning energy", level: 1 })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next", exact: true }));
    await user.click(screen.getByRole("radio", { name: "6", exact: true }));
    expect(await screen.findByRole("heading", { name: "Review your check-in.", level: 1 })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Change Morning energy/ }));
    await user.click(screen.getByRole("radio", { name: "9", exact: true }));
    expect(screen.getByRole("heading", { name: "Morning energy", level: 1 })).toBeVisible();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Review your check-in.", level: 1 })).toBeVisible();
    expect(screen.getByRole("button", { name: /Change Morning energy/ })).toHaveTextContent("9/10");
  });

  it("prefills saved answers but never auto-advances an edit", async () => {
    const user = userEvent.setup();
    server.use(http.get(`${api}/api/experiments/${experiment.id}/checkins`, () => HttpResponse.json([saved])));
    show();
    expect(await screen.findByRole("radio", { name: "Yes", exact: true })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Not today", exact: true }));
    expect(screen.getByRole("heading", { name: "Did you make the change?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next", exact: true }));
    expect(screen.getByRole("radio", { name: "7", exact: true })).toBeChecked();
    await user.keyboard("8");
    expect(screen.getByRole("heading", { name: "Morning energy" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "8", exact: true })).toBeChecked();
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
