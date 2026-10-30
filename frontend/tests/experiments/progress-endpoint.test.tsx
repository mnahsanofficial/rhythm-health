import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExperimentDetail } from "@/components/experiments/experiment-detail";
import { HomeExperience } from "@/components/home-experience";
import type { Experiment } from "@rhythm-health/contract";
import { experiment, profile } from "../support/fixtures";
import { server } from "../support/server";
import { timelineFixture } from "../support/timeline-fixture";

const { getSession, router, session } = vi.hoisted(() => ({
  getSession: vi.fn(), router: { push: vi.fn(), replace: vi.fn() },
  session: { user: { id: "isolated-user" } },
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session, loading: false }) }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("motion/react", async () => import("../support/motion-mock"));

const api = "http://api.test.invalid";
const active: Experiment = {
  ...experiment, status: "active", started_at: "2026-10-28T09:00:00Z",
  progress: {
    ...experiment.progress, state: "in_progress", day_number: 4, phase: "intervention", phase_day: 1,
    phase_days: 7, days_remaining: 6, started_at: "2026-10-28T09:00:00Z",
  },
};
const timeline = timelineFixture(active, { missed: [2, 3], nextDayAt: "2026-11-01T09:00:00Z" });
// Day 1 is deliberately future, not inferred as missed from day_number=4.
// Rendering must follow the response, even if another request has a stale summary.
const stale = { ...active, progress: { ...active.progress, day_number: 1, phase: "baseline" as const } };
const url = `${api}/api/experiments/${experiment.id}/progress`;

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
  server.use(
    http.get(`${api}/api/profile`, () => HttpResponse.json(profile)),
    http.get(`${api}/api/experiments`, () => HttpResponse.json([stale])),
    http.get(`${api}/api/experiments/${experiment.id}`, () => HttpResponse.json(stale)),
    http.get(`${api}/api/experiments/${experiment.id}/checkins`, () => HttpResponse.json([])),
    http.get(url, ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
      return HttpResponse.json(timeline);
    }),
  );
});

for (const view of ["detail", "home"] as const) {
  describe(`${view} uses authoritative progress`, () => {
    const show = () => render(view === "detail" ? <ExperimentDetail id={experiment.id} /> : <HomeExperience>Public</HomeExperience>);

    it("uses the endpoint's summary, counts and individual states instead of inferring days", async () => {
      show();
      expect(await screen.findByLabelText("Day 4, test, today, not logged yet")).toBeVisible();
      expect(screen.getByLabelText("Day 1, baseline, upcoming")).toBeVisible();
      expect(screen.getByLabelText("Day 2, baseline, missed")).toBeVisible();
      expect(screen.getByRole("link", { name: "Check in for day 4" })).toBeVisible();
      expect(screen.getByText(/0 of 10 days (logged|recorded)/)).toBeVisible();
    });

    it("keeps the skeleton until progress resolves", async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const requested = vi.fn();
      server.use(http.get(url, async () => { requested(); await gate; return HttpResponse.json(timeline); }));
      show();
      try {
        await waitFor(() => expect(requested).toHaveBeenCalledOnce());
        expect(screen.queryByRole("heading", { name: experiment.question })).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/, missed$/)).not.toBeInTheDocument();
      } finally { release(); }
      expect(await screen.findByLabelText("Day 4, test, today, not logged yet")).toBeVisible();
    });

    it("shows a progress failure and retries without presenting guessed days", async () => {
      const user = userEvent.setup();
      let attempts = 0;
      server.use(http.get(url, () => ++attempts === 1
        ? HttpResponse.json({ detail: "Progress unavailable" }, { status: 503 }) : HttpResponse.json(timeline)));
      show();
      expect(await screen.findByRole("alert")).toHaveTextContent("Progress unavailable");
      expect(screen.queryAllByLabelText(/, missed$/)).toHaveLength(0);
      await user.click(screen.getByRole("button", { name: "Try again" }));
      expect(await screen.findByLabelText("Day 2, baseline, missed")).toBeVisible();
      expect(attempts).toBe(2);
    });

    it("redirects an expired progress session without flashing private content", async () => {
      server.use(http.get(url, () => HttpResponse.json({ detail: "Session expired" }, { status: 401 })));
      show();
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith(view === "home" ? "/sign-in?next=/" : `/sign-in?next=${encodeURIComponent(`/experiments/${experiment.id}`)}`));
      expect(screen.queryByRole("heading", { name: experiment.question })).not.toBeInTheDocument();
    });
  });
}
