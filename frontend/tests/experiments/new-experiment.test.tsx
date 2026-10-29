import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewExperiment } from "@/components/experiments/new-experiment";
import type { Experiment, ProposeResponse } from "@/lib/types/api";
import { server } from "../support/server";
import { experiment, profile, proposeResponse, saveExperimentRequest } from "../support/fixtures";

const { getSession, push, router, session } = vi.hoisted(() => {
  const push = vi.fn();
  const session = { user: { id: "user-1", email: "test@example.invalid" } };
  return { getSession: vi.fn(), push, router: { push, replace: vi.fn() }, session };
});
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
const question = "Does a short evening walk help my morning energy?";
const expectedReview: ProposeResponse = {
  ...proposeResponse,
  safety: { allowed: true, reason: "Keep the walk gentle and comfortable.", suggested_alternative: null },
  classification: { ...proposeResponse.classification, risk: "review" },
};
const activeExperiment: Experiment = {
  ...experiment,
  status: "active",
  started_at: "2026-10-28T10:00:00Z",
  progress: {
    state: "in_progress",
    day_number: 1,
    phase: "baseline",
    phase_day: 1,
    phase_days: 3,
    total_days: 10,
    days_remaining: 9,
    started_at: "2026-10-28T10:00:00Z",
    ends_at: "2026-11-06T10:00:00Z",
  },
};

function installProfileHandler(goals = ["Better focus"]) {
  server.use(http.get(`${api}/api/profile`, () => HttpResponse.json({ ...profile, goals })));
}

async function submitQuestion(user: ReturnType<typeof userEvent.setup>, value = question) {
  await user.type(await screen.findByRole("textbox", { name: "Your question or goal" }), value);
  await user.click(screen.getByRole("button", { name: "Design my experiment" }));
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
  push.mockClear();
  installProfileHandler();
});

describe("new experiment flow", () => {
  it("checks for an active experiment before proposing when none is running", async () => {
    const user = userEvent.setup();
    const requestOrder: string[] = [];
    let proposalCalls = 0;
    server.use(
      http.get(`${api}/api/experiments`, ({ request }) => {
        requestOrder.push("active-check");
        expect(new URL(request.url).search).toBe("?status=active");
        return HttpResponse.json([]);
      }),
      http.post(`${api}/api/experiments/propose`, () => {
        requestOrder.push("propose");
        proposalCalls += 1;
        return HttpResponse.json(proposeResponse);
      }),
    );
    render(<NewExperiment />);

    await submitQuestion(user);

    expect(await screen.findByRole("region", { name: "Experiment and prediction preview" })).toBeVisible();
    expect(requestOrder).toEqual(["active-check", "propose"]);
    expect(proposalCalls).toBe(1);
  });

  it("shows the active experiment and skips proposing when one is already running", async () => {
    const user = userEvent.setup();
    let proposalCalls = 0;
    server.use(
      http.get(`${api}/api/experiments`, ({ request }) => {
        expect(new URL(request.url).search).toBe("?status=active");
        return HttpResponse.json([activeExperiment]);
      }),
      http.post(`${api}/api/experiments/propose`, () => {
        proposalCalls += 1;
        return HttpResponse.json(proposeResponse);
      }),
    );
    render(<NewExperiment />);

    await submitQuestion(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("You already have an active experiment");
    expect(screen.getByRole("link", { name: "Go to your active experiment" })).toHaveAttribute(
      "href",
      `/experiments/${activeExperiment.id}`,
    );
    expect(screen.queryByRole("region", { name: "Experiment and prediction preview" })).not.toBeInTheDocument();
    expect(proposalCalls).toBe(0);
  });

  it("shows proposal loading and retry states, then the review preview and lets the user ask again", async () => {
    const user = userEvent.setup();
    let releaseFirstResponse!: () => void;
    let requestStarted!: () => void;
    const firstResponseGate = new Promise<void>((resolve) => { releaseFirstResponse = resolve; });
    const firstRequestStarted = new Promise<void>((resolve) => { requestStarted = resolve; });
    let proposalCalls = 0;
    server.use(
      http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
      http.post(`${api}/api/experiments/propose`, async ({ request }) => {
        expect(await request.json()).toEqual({ question });
        proposalCalls += 1;
        if (proposalCalls === 1) {
          requestStarted();
          await firstResponseGate;
          return HttpResponse.json({ detail: "AI service is unavailable" }, { status: 503 });
        }
        return HttpResponse.json(expectedReview);
      }),
    );
    render(<NewExperiment />);

    expect(await screen.findByRole("heading", { name: "Ask a question." })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "What could help me focus better?" }));
    expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveValue("What could help me focus better?");
    expect(screen.queryByRole("button", { name: "Does less caffeine improve my focus?" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Your question or goal" }));
    await user.type(screen.getByRole("textbox", { name: "Your question or goal" }), question);
    await user.click(screen.getByRole("button", { name: "Design my experiment" }));
    await firstRequestStarted;

    expect(screen.getByRole("region", { name: "Preparing your experiment" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Finding a small change you can test");
    releaseFirstResponse();
    expect(await screen.findByRole("alert")).toHaveTextContent("The service is unavailable right now.");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    const preview = await screen.findByRole("region", { name: "Experiment and prediction preview" });
    expect(screen.queryByRole("textbox", { name: "Your question or goal" })).not.toBeInTheDocument();
    expect(within(preview).getByRole("heading", { name: proposalQuestion(), level: 1 })).toBeVisible();
    expect(within(preview).getByRole("heading", { name: proposalQuestion() })).toBeVisible();
    expect(within(preview).getByText("Light evening activity may improve next-morning energy.")).toBeVisible();
    expect(within(preview).getByText("Walk for 20 minutes")).toBeVisible();
    expect(within(preview).getByText("Within one hour after dinner")).toBeVisible();
    expect(within(preview).getByText("daily")).toBeVisible();
    expect(within(preview).getByRole("heading", { name: "A 10-day timeline" })).toBeVisible();
    expect(within(preview).getAllByText("Baseline", { exact: true })).toHaveLength(3);
    expect(within(preview).getAllByText("Test", { exact: true })).toHaveLength(7);
    expect(within(preview).getByText("Morning energy")).toBeVisible();
    expect(within(preview).getByText("Sleep quality")).toBeVisible();
    expect(within(preview).getByRole("note")).toHaveTextContent("Keep the walk gentle and comfortable.");
    expect(within(preview).getByRole("heading", { name: "Morning energy is likely to go up" })).toBeVisible();
    expect(within(preview).getByText("+8% to +15%")).toBeVisible();
    expect(within(preview).getByText("moderate", { exact: true })).toBeVisible();
    expect(within(preview).getByText("Adds light movement without reducing sleep.")).toBeVisible();
    expect(within(preview).getByText("bedtime consistency")).toBeVisible();
    expect(within(preview).getByText("This plan and prediction become fixed once you start.")).toBeVisible();
    expect(proposalCalls).toBe(2);

    await user.click(within(preview).getByRole("button", { name: "Ask something else" }));
    expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveValue("");
    expect(screen.queryByRole("region", { name: "Experiment and prediction preview" })).not.toBeInTheDocument();
  });

  it("checks for an active experiment, saves once, and starts the saved plan", async () => {
    const user = userEvent.setup();
    const listQueries: string[] = [];
    let savedRequest: unknown;
    let releaseStart!: () => void;
    let startStarted!: () => void;
    const startGate = new Promise<void>((resolve) => { releaseStart = resolve; });
    const startRequestStarted = new Promise<void>((resolve) => { startStarted = resolve; });
    server.use(
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json(proposeResponse)),
      http.get(`${api}/api/experiments`, ({ request }) => {
        listQueries.push(new URL(request.url).search);
        return HttpResponse.json([]);
      }),
      http.post(`${api}/api/experiments`, async ({ request }) => {
        savedRequest = await request.json();
        return HttpResponse.json(experiment, { status: 201 });
      }),
      http.post(`${api}/api/experiments/${experiment.id}/start`, async () => {
        startStarted();
        await startGate;
        return HttpResponse.json(activeExperiment);
      }),
    );
    render(<NewExperiment />);

    await submitQuestion(user);
    const preview = await screen.findByRole("region", { name: "Experiment and prediction preview" });
    await user.click(within(preview).getByRole("button", { name: "Start this experiment" }));
    await startRequestStarted;
    expect(within(preview).getByRole("button", { name: "Saving your experiment…" })).toBeDisabled();
    releaseStart();

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/experiments/${experiment.id}`));
    expect(listQueries).toEqual(["?status=active", "?status=active"]);
    expect(savedRequest).toEqual(saveExperimentRequest);
  });

  it("does not save another proposal when an active experiment already exists", async () => {
    const user = userEvent.setup();
    let saveCalls = 0;
    let startCalls = 0;
    let activeChecks = 0;
    server.use(
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json(proposeResponse)),
      http.get(`${api}/api/experiments`, () => {
        activeChecks += 1;
        return HttpResponse.json(activeChecks === 1 ? [] : [activeExperiment]);
      }),
      http.post(`${api}/api/experiments`, () => {
        saveCalls += 1;
        return HttpResponse.json(experiment, { status: 201 });
      }),
      http.post(`${api}/api/experiments/${experiment.id}/start`, () => {
        startCalls += 1;
        return HttpResponse.json(activeExperiment);
      }),
    );
    render(<NewExperiment />);

    await submitQuestion(user);
    const preview = await screen.findByRole("region", { name: "Experiment and prediction preview" });
    await user.click(within(preview).getByRole("button", { name: "Start this experiment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You already have an active experiment");
    expect(screen.getByRole("link", { name: "Go to your active experiment" })).toHaveAttribute(
      "href",
      `/experiments/${activeExperiment.id}`,
    );
    expect(within(preview).getByRole("button", { name: "Start this experiment" })).toBeDisabled();
    expect(activeChecks).toBe(2);
    expect(saveCalls).toBe(0);
    expect(startCalls).toBe(0);
  });

  it("retries starting the saved experiment without creating a duplicate", async () => {
    const user = userEvent.setup();
    let saveCalls = 0;
    let startCalls = 0;
    let listCalls = 0;
    server.use(
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json(proposeResponse)),
      http.get(`${api}/api/experiments`, () => {
        listCalls += 1;
        return HttpResponse.json([]);
      }),
      http.post(`${api}/api/experiments`, () => {
        saveCalls += 1;
        return HttpResponse.json(experiment, { status: 201 });
      }),
      http.post(`${api}/api/experiments/${experiment.id}/start`, () => {
        startCalls += 1;
        if (startCalls === 1) {
          return HttpResponse.json({ detail: "Start temporarily failed" }, { status: 503 });
        }
        return HttpResponse.json(activeExperiment);
      }),
    );
    render(<NewExperiment />);

    await submitQuestion(user);
    const preview = await screen.findByRole("region", { name: "Experiment and prediction preview" });
    await user.click(within(preview).getByRole("button", { name: "Start this experiment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your experiment was saved, but it couldn’t be started");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/experiments/${experiment.id}`));
    expect(saveCalls).toBe(1);
    expect(startCalls).toBe(2);
    expect(listCalls).toBe(2);
  });
});

function proposalQuestion() {
  return proposeResponse.proposal?.question ?? "";
}
