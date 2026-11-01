import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(await screen.findByRole("heading", { name: experiment.question })).toBeVisible();
    expect(screen.getByText("Day 4 of 10")).toBeVisible();
    expect(screen.getByRole("link", { name: "Check in for day 4" })).toHaveAttribute(
      "href", `/experiments/${experiment.id}/check-in`,
    );
    expect(screen.queryByRole("link", { name: "Test a new question" })).not.toBeInTheDocument();
  });

  it("doesn't repeat the header's navigation or its Your lab label", async () => {
    signedIn();
    render(home());

    expect(await screen.findByRole("heading", { name: experiment.question })).toBeVisible();
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
    expect(await screen.findByRole("textbox", { name: "Your question or goal" })).toBeVisible();
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


describe("ask from Your lab", () => {
  it("validates the question and shows the same counter and copy as the question page", async () => {
    const user = userEvent.setup();
    signedIn();
    server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([])));
    render(home());

    const field = await screen.findByRole("textbox", { name: "Your question or goal" });
    const design = screen.getByRole("button", { name: "Design my experiment" });
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
    await user.click(screen.getByRole("button", { name: "Design my experiment" }));
    expect(await screen.findByRole("region", { name: "Experiment and prediction preview" })).toBeVisible();
    expect(screen.getByRole("heading", { name: experiment.question })).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Start this experiment" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/experiments/${experiment.id}`));
    expect(saved).toEqual(saveExperimentRequest);
    expect(order).toEqual(["active-check", "active-check", "propose", "active-check", "save", "start"]);
  });

  it("keeps today's check-in and shows the active warning before a paid request", async () => {
    const user = userEvent.setup();
    signedIn();
    const propose = vi.fn(() => HttpResponse.json(proposeResponse));
    server.use(http.post(`${api}/api/experiments/propose`, propose));
    render(home());
    expect(await screen.findByRole("heading", { name: experiment.question })).toBeVisible();
    const toggle = screen.getByRole("button", { name: "Test another habit" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const summary = screen.getByRole("heading", { name: experiment.question });
    expect(toggle.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(toggle);
    const field = screen.getByRole("textbox", { name: "Your question or goal" });
    expect(field).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("You already have an active experiment.");
    expect(screen.getByRole("link", { name: "Check in for day 4" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: experiment.question })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See your experiment" })).not.toBeInTheDocument();
    expect(screen.queryByText("Day 4 of 10")).not.toBeVisible();
    expect(screen.getByRole("heading", { name: "Ask a question.", level: 1 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your observations, day by day." })).toBeVisible();
    expect(screen.queryByText("Start with a hunch")).not.toBeInTheDocument();
    await user.type(field, "Does less caffeine improve my focus?");
    expect(screen.getByRole("button", { name: "Design my experiment" })).toBeDisabled();
    // Also guard the submit handler if the disabled button is bypassed.
    fireEvent.submit(field.closest("form")!);
    expect(propose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close question" }));
    expect(screen.getByRole("button", { name: "Test another habit" })).toHaveFocus();
    expect(screen.getByRole("heading", { name: experiment.question })).toBeVisible();
    expect(screen.getByRole("link", { name: "See your experiment" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Test another habit" }));
    expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveValue("Does less caffeine improve my focus?");
  });

  it("rechecks active status on submit and blocks a newly started experiment", async () => {
    const user = userEvent.setup();
    signedIn();
    let checks = 0;
    const propose = vi.fn(() => HttpResponse.json(proposeResponse));
    server.use(
      http.get(`${api}/api/experiments`, () => HttpResponse.json(++checks === 1 ? [] : [activeExperiment])),
      http.post(`${api}/api/experiments/propose`, propose),
    );
    render(home());
    await user.type(await screen.findByRole("textbox", { name: "Your question or goal" }), "Does evening walking help my sleep?");
    await user.click(screen.getByRole("button", { name: "Design my experiment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You already have an active experiment.");
    expect(screen.getByRole("link", { name: "Go to your active experiment" })).toHaveAttribute("href", `/experiments/${experiment.id}`);
    expect(propose).not.toHaveBeenCalled();
  });

  it("keeps the question and retries if the active lookup fails without proposing", async () => {
    const user = userEvent.setup();
    signedIn();
    let checks = 0;
    const propose = vi.fn(() => HttpResponse.json(proposeResponse));
    server.use(
      http.get(`${api}/api/experiments`, () => ++checks === 2
        ? HttpResponse.json({ detail: "Experiments unavailable" }, { status: 503 })
        : HttpResponse.json([])),
      http.post(`${api}/api/experiments/propose`, propose),
    );
    render(home());
    const field = await screen.findByRole("textbox", { name: "Your question or goal" });
    await user.type(field, "Does evening walking help my sleep?");
    await user.click(screen.getByRole("button", { name: "Design my experiment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t check for an active experiment.");
    expect(field).toHaveValue("Does evening walking help my sleep?");
    expect(propose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("region", { name: "Experiment and prediction preview" })).toBeVisible();
    expect(propose).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Ask something else" }));
    expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveFocus();
  });
});

it('labels a running sample separately from real observations', async () => {
  signedIn();
  server.use(http.get(`${api}/api/experiments`, () => HttpResponse.json([{ ...activeExperiment, is_seeded: true }])));
  render(home());
  expect(await screen.findByText('Sample experiment')).toBeVisible();
  expect(screen.getByText(/Sample answers never become your real experiment data/)).toBeVisible();
});
