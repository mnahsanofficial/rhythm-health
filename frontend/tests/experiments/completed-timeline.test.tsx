import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExperimentDetail } from "@/components/experiments/experiment-detail";
import backend from "../support/early-finish-reports.json";
import { server } from "../support/server";

const { getSession, router, session } = vi.hoisted(() => ({
  getSession: vi.fn(), router: { push: vi.fn(), replace: vi.fn() },
  session: { user: { id: "isolated-user" } },
}));
vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({ session, loading: false }),
}));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("motion/react", async () => import("../support/motion-mock"));

const api = "http://api.test.invalid";
const scenario = backend.cases.find(item => item.name === "today-unlogged")!;
const { report } = scenario;
const id = report.experiment.id;
const checkins = report.chart.points.filter(point => point.logged).map(point => ({
  id: `00000000-0000-4000-8000-${String(point.day).padStart(12, "0")}`, experiment_id: id, day_number: point.day, phase: point.phase,
  intervention_completed: point.intervention_completed, metric_values: point.values,
  note: point.note, created_at: report.created_at, updated_at: report.created_at,
}));

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
  server.use(
    http.get(`${api}/api/experiments/${id}`, () => HttpResponse.json(report.experiment)),
    http.get(`${api}/api/experiments/${id}/checkins`, () => HttpResponse.json(checkins)),
    http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(report)),
  );
});

describe("completed experiment timeline", () => {
  it("keeps an elapsed missed day but never marks an unfinished/future day missed", async () => {
    render(<ExperimentDetail id={id} />);
    expect(await screen.findByRole("heading", { name: report.experiment.question })).toBeVisible();
    expect(screen.getByLabelText("Day 2, baseline, missed")).toBeVisible();
    for (const day of [7, 8, 9, 10]) {
      expect(screen.queryByLabelText(`Day ${day}, test, missed`)).not.toBeInTheDocument();
      expect(screen.getByLabelText(`Day ${day}, test, not recorded before completion`)).toBeVisible();
    }
    expect(screen.getByRole("button", { name: "Day 1, baseline, logged" })).toBeVisible();
  });

  it("shows an explicit unavailable status rather than inventing missed days without a report", async () => {
    server.use(http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json({ detail: "No report yet" }, { status: 404 })));
    render(<ExperimentDetail id={id} />);
    expect(await screen.findByText("Completed-day status will appear when your report is available.")).toHaveAttribute("role", "status");
    expect(screen.queryAllByLabelText(/, missed$/)).toHaveLength(0);
  });

  it("retries a completed report lookup failure instead of silently guessing day status", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.use(http.get(`${api}/api/experiments/${id}/report`, () => ++attempts === 1
      ? HttpResponse.json({ detail: "Report unavailable" }, { status: 503 }) : HttpResponse.json(report)));
    render(<ExperimentDetail id={id} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Report unavailable");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Day 2, baseline, missed")).toBeVisible();
    expect(attempts).toBe(2);
  });

  it("uses progress for an active first day without fetching a report", async () => {
    const first = backend.first_day.experiment;
    const reportReads = vi.fn(() => HttpResponse.json({ detail: "Not finished" }, { status: 404 }));
    server.use(
      http.get(`${api}/api/experiments/${first.id}`, () => HttpResponse.json(first)),
      http.get(`${api}/api/experiments/${first.id}/checkins`, () => HttpResponse.json([])),
      http.get(`${api}/api/experiments/${first.id}/report`, reportReads),
    );
    render(<ExperimentDetail id={first.id} />);
    expect(await screen.findByLabelText("Day 1, baseline, today, not logged yet")).toBeVisible();
    expect(screen.getByLabelText("Day 10, test, upcoming")).toBeVisible();
    expect(screen.queryAllByLabelText(/, missed$/)).toHaveLength(0);
    await waitFor(() => expect(reportReads).not.toHaveBeenCalled());
  });
});
