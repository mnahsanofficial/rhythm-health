import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeExperience } from "@/components/home-experience";
import type { Experiment } from "@/lib/types/api";
import { experiment, profile, proposeResponse, saveExperimentRequest } from "../support/fixtures";
import { timelineFixture } from "../support/timeline-fixture";
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
    http.get(`${api}/api/experiments/${experiment.id}/progress`, () => HttpResponse.json(timelineFixture(activeExperiment))),
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
    expect(await screen.findByRole("heading", { name: "Evening walk" })).toBeVisible();
    expect(screen.getByText("Day 4 of 10")).toBeVisible();
    expect(screen.getByRole("link", { name: "Check in for day 4" })).toHaveAttribute(
      "href", `/experiments/${experiment.id}/check-in`,
    );
    expect(screen.queryByRole("link", { name: "Test a new question" })).not.toBeInTheDocument();
  });

  it("doesn't repeat the header's navigation or its Your lab label", async () => {
    signedIn();
    render(home());

    expect(await screen.findByRole("heading", { name: "Evening walk" })).toBeVisible();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Experiment history" })).not.toBeInTheDocument();
    expect(screen.queryByText("Your lab", { exact: true })).not.toBeInTheDocument();
  });

  it("offers a new question when the profile has no active experiment", async () => {
    signedIn();
    server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([])));
    render(home());

    expect(await screen.findByRole("textbox", { name: "Your question or goal" })).toBeVisible();
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
    expect(screen.queryByRole("heading", { name: "Evening walk" })).not.toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: "Evening walk" })).toBeVisible();
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
    expect(await screen.findByRole("heading", { name: "Evening walk" })).toBeVisible();
    expect(calls).toBe(2);
  });

  it("discards the previous user's experiment immediately when accounts change", async () => {
    signedIn();
    const { rerender } = render(home());
    expect(await screen.findByRole("heading", { name: "Evening walk" })).toBeVisible();
    server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([])));

    signedIn("user-2");
    rerender(home());

    expect(screen.queryByRole("heading", { name: "Evening walk" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your lab");
    expect(await screen.findByRole("textbox", { name: "Your question or goal" })).toBeVisible();
  });

  it("removes the private dashboard immediately on sign-out", async () => {
    signedIn();
    const { rerender } = render(home());
    expect(await screen.findByRole("heading", { name: "Evening walk" })).toBeVisible();

    sessionState.session = null;
    rerender(home());

    expect(screen.queryByRole("heading", { name: "Evening walk" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public landing with sample rhythm" })).toBeVisible();
  });
});


describe("ask from Your lab", () => {
  it("validates the question and shows the same counter and copy as the question page", async () => {
    const user = userEvent.setup();
    signedIn();
    server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([])));
    render(home());

    const field = await screen.findByRole("textbox", { name: "Your question or goal" });
    const design = screen.getByRole("button", { name: "Design experiment" });
    expect(screen.getByRole("heading", { name: "Ask a question.", level: 1 })).toBeVisible();
    expect(screen.getByText("A little curiosity, a little evidence")).toBeVisible();
    expect(screen.getByText("5–500 characters. One small change at a time.")).toBeVisible();
    expect(screen.getByText("0/500")).toBeVisible();
    expect(design).toBeDisabled();
    await user.type(field, "abcd");
    expect(screen.getByText("4/500")).toBeVisible();
    expect(design).toBeDisabled();
    await user.type(field, "e");
    expect(design).toBeEnabled();
    await user.clear(field);
    await user.type(field, "     ");
    expect(design).toBeDisabled();
    await user.clear(field);
    await user.click(field);
    await user.paste("x".repeat(501));
    expect(field).toHaveValue("x".repeat(500));
    expect(screen.getByText("500/500")).toBeVisible();
    expect(design).toBeEnabled();
  });

  it("proposes, previews, saves and starts directly from home", async () => {
    const user = userEvent.setup();
    signedIn();
    const order: string[] = [];
    let saved: unknown;
    server.use(
      http.get(`${api}/api/experiments`, () => {
        order.push("active-check");
        return HttpResponse.json([]);
      }),
      http.post(`${api}/api/experiments/propose`, async ({ request }) => {
        order.push("propose");
        expect(await request.json()).toEqual({ question: "Does evening walking help my sleep?" });
        return HttpResponse.json(proposeResponse);
      }),
      http.post(`${api}/api/experiments`, async ({ request }) => {
        order.push("save");
        saved = await request.json();
        return HttpResponse.json(experiment, { status: 201 });
      }),
      http.post(`${api}/api/experiments/${experiment.id}/start`, () => {
        order.push("start");
        return HttpResponse.json(activeExperiment);
      }),
    );
    render(home());
    await user.type(await screen.findByRole("textbox", { name: "Your question or goal" }), "  Does evening walking help my sleep?  ");
    await user.click(screen.getByRole("button", { name: "Design experiment" }));
    expect(await screen.findByRole("region", { name: "Experiment and prediction preview" })).toBeVisible();
    expect(screen.getByRole("heading", { name: experiment.intervention.change_short! })).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Start this experiment" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/experiments/${experiment.id}`));
    expect(saved).toEqual(saveExperimentRequest);
    expect(order).toEqual(["active-check", "propose", "save", "start"]);
  });

  it("keeps today's check-in visible while designing another experiment", async () => {
    const user = userEvent.setup();
    signedIn();
    const propose = vi.fn(() => HttpResponse.json(proposeResponse));
    server.use(http.post(`${api}/api/experiments/propose`, propose));
    render(home());
    expect(await screen.findByRole("heading", { name: "Evening walk" })).toBeVisible();
    const toggle = screen.getByRole("button", { name: "Test another habit" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const summary = screen.getByRole("heading", { name: "Evening walk" });
    expect(toggle.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(toggle);
    const field = screen.getByRole("textbox", { name: "Your question or goal" });
    expect(field).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check in for day 4" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Evening walk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See your experiment" })).not.toBeInTheDocument();
    expect(screen.queryByText("Day 4 of 10")).not.toBeVisible();
    expect(screen.getByRole("heading", { name: "Ask a question.", level: 1 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your rhythm" })).toBeVisible();
    expect(screen.queryByText("Start with a hunch")).not.toBeInTheDocument();
    await user.type(field, "Does less caffeine improve my focus?");
    await user.click(screen.getByRole("button", { name: "Close question" }));
    expect(screen.getByRole("button", { name: "Test another habit" })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Evening walk" })).toBeVisible();
    await user.click(screen.getByText("Details", { exact: true }));
    expect(screen.getByRole("link", { name: "See your experiment" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Test another habit" }));
    expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveValue("Does less caffeine improve my focus?");
    await user.click(screen.getByRole("button", { name: "Design experiment" }));
    expect(await screen.findByRole("region", { name: "Experiment and prediction preview" })).toBeVisible();
    expect(propose).toHaveBeenCalledOnce();
  });

  it("shows the limit if the backend refuses the proposal, without a second paid try", async () => {
    const user = userEvent.setup();
    signedIn();
    server.use(
      http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json({ detail: { code: "active_limit_reached", message: "You're running 3 experiments, the most at once. Finish one to start another.", limit: 3 } }, { status: 409 })),
    );
    render(home());
    await user.type(await screen.findByRole("textbox", { name: "Your question or goal" }), "Does evening walking help my sleep?");
    await user.click(screen.getByRole("button", { name: "Design experiment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You're running 3 experiments");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    // Already on Your lab, so a link to "/" would do nothing: this has to reload.
    server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([activeExperiment])));
    await user.click(screen.getByRole("button", { name: "Go to your lab" }));
    expect(await screen.findByRole("heading", { name: "Evening walk" })).toBeVisible();
  });
});

it('labels a running sample separately from real observations', async () => {
  signedIn();
  server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([{ ...activeExperiment, is_seeded: true }])));
  render(home());
  expect(await screen.findByText('Sample experiment')).toBeVisible();
  expect(screen.getByText(/Sample answers never become your real experiment data/)).toBeVisible();
});


describe("desktop Today parity", () => {
  it("uses short names, a greeting and a weekly ring without repeating the full question", async () => {
    signedIn();
    server.use(http.get(`${api}/api/experiments/${experiment.id}/progress`, () => HttpResponse.json(
      timelineFixture(activeExperiment, { recorded: [1, 3], missed: [2], nextDayAt: "2026-10-29T10:00:00Z" }),
    )));
    render(home());
    expect(await screen.findByRole("heading", { name: /Good (morning|afternoon|evening)/, level: 1 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Evening walk" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: experiment.question })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Evening walk: 2 of 7 days recorded in the last seven experiment days" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Up next" })).toBeVisible();
    expect(screen.getByRole("list", { name: "Evening walk: 10-day timeline" })).toBeVisible();
    await userEvent.click(screen.getByText("Details", { exact: true }));
    expect(screen.getByText(experiment.question, { exact: true })).toBeVisible();
  });

  it("makes finishing available when the server says all days have ended", async () => {
    signedIn();
    const ended: Experiment = { ...activeExperiment, progress: { ...activeExperiment.progress, state: "ended", day_number: null, phase: null } };
    server.use(
      http.get(`${api}/api/experiments`, () => HttpResponse.json([ended])),
      http.get(`${api}/api/experiments/${experiment.id}/progress`, () => HttpResponse.json(timelineFixture(ended))),
    );
    render(home());
    expect(await screen.findByRole("link", { name: "Finish and see results" })).toHaveAttribute("href", `/experiments/${experiment.id}`);
    expect(screen.queryByRole("link", { name: /Check in for day/ })).not.toBeInTheDocument();
  });
});
