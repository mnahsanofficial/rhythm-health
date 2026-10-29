import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeExperience } from "@/components/home-experience";
import type { Experiment } from "@/lib/types/api";
import { experiment, profile } from "../support/fixtures";
import { server } from "../support/server";

const { getSession, router, sessionState } = vi.hoisted(() => ({
  getSession: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
  sessionState: {
    session: null as null | { user: { id: string; email: string } },
    loading: false,
  },
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
const activeExperiment: Experiment = {
  ...experiment,
  status: "active",
  started_at: "2026-10-25T10:00:00Z",
  progress: {
    state: "in_progress",
    day_number: 4,
    phase: "intervention",
    phase_day: 1,
    phase_days: 7,
    total_days: 10,
    days_remaining: 6,
    started_at: "2026-10-25T10:00:00Z",
    ends_at: "2026-11-04T10:00:00Z",
  },
};

function home() {
  return (
    <HomeExperience>
      <h1>Public landing with sample rhythm</h1>
    </HomeExperience>
  );
}

function signedIn(id = "user-1") {
  sessionState.session = { user: { id, email: `${id}@example.invalid` } };
}

beforeEach(() => {
  sessionState.session = null;
  sessionState.loading = false;
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
  server.use(
    http.get(`${api}/api/profile`, () => HttpResponse.json(profile)),
    http.get(`${api}/api/experiments`, ({ request }) => {
      expect(new URL(request.url).searchParams.get("status")).toBe("active");
      return HttpResponse.json([activeExperiment]);
    }),
    http.get(`${api}/api/experiments/${experiment.id}/checkins`, () => HttpResponse.json([])),
  );
});

describe("home session gate", () => {
  it("shows the public landing only when signed out", () => {
    render(home());

    expect(screen.getByRole("heading", { name: "Public landing with sample rhythm" })).toBeVisible();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("shows a loading status without sample content while auth is unresolved", () => {
    sessionState.loading = true;
    render(home());

    expect(screen.getByRole("status")).toHaveTextContent("Loading your lab");
    expect(screen.queryByRole("heading", { name: "Public landing with sample rhythm" })).not.toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("replaces sample content with the user's question and today's next action", async () => {
    signedIn();
    render(home());

    expect(screen.queryByRole("heading", { name: "Public landing with sample rhythm" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: experiment.question })).toBeVisible();
    expect(screen.getByText("Day 4 of 10")).toBeVisible();
    expect(screen.getByRole("link", { name: "Check in for day 4" })).toHaveAttribute(
      "href", `/experiments/${experiment.id}/check-in`,
    );
    expect(screen.queryByRole("link", { name: "Test a new question" })).not.toBeInTheDocument();
  });

  it("offers a new question when the profile has no active experiment", async () => {
    signedIn();
    server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([])));
    render(home());

    expect(await screen.findByRole("link", { name: "Test a new question" })).toHaveAttribute("href", "/experiments/new");
    expect(screen.queryByRole("heading", { name: "Public landing with sample rhythm" })).not.toBeInTheDocument();
  });

  it("offers setup when the signed-in user has no profile", async () => {
    signedIn();
    server.use(http.get(`${api}/api/profile`, () => HttpResponse.json({ detail: "Not found" }, { status: 404 })));
    render(home());

    expect(await screen.findByRole("link", { name: "Set up your rhythm" })).toHaveAttribute("href", "/onboarding");
    expect(screen.queryByRole("heading", { name: "Public landing with sample rhythm" })).not.toBeInTheDocument();
  });

  it("redirects an expired session without showing private experiment content", async () => {
    signedIn();
    server.use(http.get(`${api}/api/profile`, () => HttpResponse.json({ detail: "Session expired" }, { status: 401 })));
    render(home());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sign-in?next=/"));
    expect(screen.queryByRole("heading", { name: experiment.question })).not.toBeInTheDocument();
  });

  it("keeps sample content hidden while signed-in data loads", async () => {
    signedIn();
    let release!: () => void;
    const started = vi.fn();
    const gate = new Promise<void>((resolve) => { release = resolve; });
    server.use(http.get(`${api}/api/profile`, async () => {
      started();
      await gate;
      return HttpResponse.json(profile);
    }));
    render(home());

    try {
      await waitFor(() => expect(started).toHaveBeenCalledOnce());
      expect(screen.getByRole("status")).toHaveTextContent("Loading your lab");
      expect(screen.queryByRole("heading", { name: "Public landing with sample rhythm" })).not.toBeInTheDocument();
    } finally {
      release();
    }
    expect(await screen.findByRole("heading", { name: experiment.question })).toBeVisible();
  });

  it("shows a load error and retries without falling back to the public landing", async () => {
    const user = userEvent.setup();
    signedIn();
    let calls = 0;
    server.use(http.get(`${api}/api/experiments`, () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ detail: "Experiments unavailable" }, { status: 503 })
        : HttpResponse.json([activeExperiment]);
    }));
    render(home());

    expect(await screen.findByRole("alert")).toHaveTextContent("Experiments unavailable");
    expect(screen.queryByRole("heading", { name: "Public landing with sample rhythm" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: experiment.question })).toBeVisible();
    expect(calls).toBe(2);
  });

  it("discards the previous user's experiment immediately when accounts change", async () => {
    signedIn();
    const { rerender } = render(home());
    expect(await screen.findByRole("heading", { name: experiment.question })).toBeVisible();
    server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([])));

    signedIn("user-2");
    rerender(home());

    expect(screen.queryByRole("heading", { name: experiment.question })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your lab");
    expect(await screen.findByRole("link", { name: "Test a new question" })).toBeVisible();
  });

  it("removes the private dashboard immediately on sign-out", async () => {
    signedIn();
    const { rerender } = render(home());
    expect(await screen.findByRole("heading", { name: experiment.question })).toBeVisible();

    sessionState.session = null;
    rerender(home());

    expect(screen.queryByRole("heading", { name: experiment.question })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public landing with sample rhythm" })).toBeVisible();
  });
});
