import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeExperience } from "@/components/home-experience";
import type { Experiment, TodayCheckin } from "@/lib/types/api";
import { experiment, profile } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";
import { server } from "../support/server";

const { getSession, router, sessionState } = vi.hoisted(() => ({
  getSession: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
  sessionState: { session: { user: { id: "user-1", email: "user-1@example.invalid" } } as null | { user: { id: string; email: string } }, loading: false },
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("motion/react", async () => import("../support/motion-mock"));

const api = "http://api.test.invalid";

function running(n: number, day: number, extra: Partial<Experiment> = {}): Experiment {
  return {
    ...experiment,
    id: `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`,
    question: `Question number ${n}?`,
    status: "active",
    started_at: "2026-10-25T10:00:00Z",
    progress: {
      state: "in_progress", day_number: day, phase: "baseline", phase_day: day, phase_days: 3, total_days: 10,
      days_remaining: 10 - day, started_at: "2026-10-25T10:00:00Z", ends_at: "2026-11-04T10:00:00Z",
    },
    ...extra,
  };
}

function due(items: Experiment[], all_recorded = false): TodayCheckin {
  return { revision: "r", experiments: items.map(item => ({ id: item.id, question: item.question, action: "a", timing: "t", day_number: 1, total_days: 10, phase: "baseline", change_required: false, change_made: null, recorded: all_recorded })), questions: [], note: null, all_recorded };
}

function install(experiments: Experiment[], capacity = { active: experiments.length, limit: 3, can_start: experiments.length < 3 }) {
  server.use(
    http.get(`${api}/api/profile`, () => HttpResponse.json(profile)),
    http.get(`${api}/api/experiments`, () => HttpResponse.json(experiments)),
    http.get(`${api}/api/experiments/capacity`, () => HttpResponse.json(capacity)),
    http.get(`${api}/api/checkins/today`, () => HttpResponse.json(due(experiments.filter(item => !item.is_seeded)))),
    ...experiments.map(item => http.get(`${api}/api/experiments/${item.id}/progress`, () => HttpResponse.json(timelineFixture(item)))),
  );
}

const home = () => <HomeExperience><h1>Public landing</h1></HomeExperience>;

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
});

describe("Your lab with several experiments", () => {
  it("shows each one with its own day and its own check-in", async () => {
    const first = running(1, 2), second = running(2, 5);
    install([first, second]);
    render(home());

    const one = await screen.findByRole("article", { name: first.question });
    const two = screen.getByRole("article", { name: second.question });
    expect(one).toHaveTextContent("Day 2 of 10");
    expect(two).toHaveTextContent("Day 5 of 10");
    expect(within(one).getByRole("link", { name: "Check in for day 2" })).toHaveAttribute("href", `/experiments/${first.id}/check-in`);
    expect(within(two).getByRole("link", { name: "Check in for day 5" })).toHaveAttribute("href", `/experiments/${second.id}/check-in`);
    expect(within(two).getByRole("link", { name: "See your experiment" })).toHaveAttribute("href", `/experiments/${second.id}`);
    expect(screen.getByRole("heading", { name: "2 experiments running", level: 1 })).toBeVisible();
    expect(screen.getByRole("button", { name: "Test another habit" })).toBeVisible();
  });

  it("offers one check-in for everything due today", async () => {
    install([running(1, 2), running(2, 5)]);
    render(home());
    expect(await screen.findByRole("link", { name: "Check in for today" })).toHaveAttribute("href", "/check-in");
    expect(screen.getByText("One check-in for all 2 experiments.")).toBeVisible();
  });

  it("says when today's check-ins are all done, and lets you change them", async () => {
    const all = [running(1, 2), running(2, 5)];
    install(all);
    server.use(http.get(`${api}/api/checkins/today`, () => HttpResponse.json(due(all, true))));
    render(home());
    expect(await screen.findByText("Done for today: all 2 check-ins are recorded.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Change today's answers" })).toHaveAttribute("href", "/check-in");
  });

  it("offers no combined check-in when only one real experiment is due", async () => {
    install([running(1, 2), running(2, 5, { is_seeded: true })]);
    render(home());
    await screen.findByRole("heading", { name: "2 experiments running", level: 1 });
    expect(screen.queryByRole("link", { name: "Check in for today" })).not.toBeInTheDocument();
  });

  it("offers no new question at the limit, and says why", async () => {
    const all = [running(1, 2), running(2, 5), running(3, 7)];
    install(all);
    render(home());

    expect(await screen.findByRole("heading", { name: "3 experiments running", level: 1 })).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("You're running 3 experiments, the most at once. Finish one to start another.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Test another habit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your question or goal" })).not.toBeInTheDocument();
  });

  it("shows an error rather than a partial list when one read fails", async () => {
    const first = running(1, 2), second = running(2, 5);
    install([first, second]);
    server.use(http.get(`${api}/api/experiments/${second.id}/progress`, () => HttpResponse.json({ detail: "Database unavailable" }, { status: 503 })));
    render(home());

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your lab.");
    expect(screen.queryByText(first.question)).not.toBeInTheDocument();
  });

  it("keeps a running sample labelled and removable", async () => {
    install([running(1, 2), running(2, 5, { is_seeded: true, question: "Sample: a walk?" })]);
    render(home());

    const controls = await screen.findByRole("region", { name: "Sample experiment controls" });
    expect(within(controls).getByRole("button", { name: "Remove sample" })).toBeVisible();
    expect(controls).toHaveTextContent("Remove the sample to free up a slot");
  });
});
