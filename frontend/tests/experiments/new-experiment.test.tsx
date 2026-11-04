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
  safety: { allowed: true, reason: "Keep the walk gentle and comfortable.", suggested_alternative: null, suggested_question: null },
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
  await user.click(screen.getByRole("button", { name: "Design experiment" }));
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
  push.mockClear();
  installProfileHandler();
});

describe("new experiment flow", () => {
  it("asks for the plan directly, because the backend checks the limit before any paid call", async () => {
    const user = userEvent.setup();
    let listCalls = 0;
    let proposalCalls = 0;
    server.use(
      http.get(`${api}/api/experiments`, () => {
        listCalls += 1;
        return HttpResponse.json([]);
      }),
      http.post(`${api}/api/experiments/propose`, () => {
        proposalCalls += 1;
        return HttpResponse.json(proposeResponse);
      }),
    );
    render(<NewExperiment />);

    await submitQuestion(user);

    expect(await screen.findByRole("region", { name: "Experiment and prediction preview" })).toBeVisible();
    expect(screen.queryByText("Your question wasn't about a habit, so Rhythm suggested a related habit experiment instead.")).toBeNull();
    expect(proposalCalls).toBe(1);
    expect(listCalls).toBe(0);
  });

  it("explains the limit and points to Your lab when the backend refuses the proposal", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json({ detail: { code: "active_limit_reached", message: "You're running 3 experiments, the most at once. Finish one to start another.", limit: 3 } }, { status: 409 })),
    );
    render(<NewExperiment />);

    await submitQuestion(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You're running 3 experiments, the most at once.");
    expect(alert).not.toHaveTextContent("profile");
    expect(within(alert).getByRole("link", { name: "Go to your lab" })).toHaveAttribute("href", "/");
    expect(within(alert).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Experiment and prediction preview" })).not.toBeInTheDocument();
  });

  it("explains the daily AI limit, keeps the question and offers no retry", async () => {
    const user = userEvent.setup();
    const message = "You've used all of today's experiment plans. Please come back tomorrow.";
    installProfileHandler();
    server.use(
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json(
        { detail: { code: "ai_daily_limit", message, limit: 5 } }, { status: 429 },
      )),
    );
    render(<NewExperiment />);
    await submitQuestion(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You’ve reached today’s limit.");
    expect(alert).toHaveTextContent(message);
    expect(within(alert).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveValue(question);
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
    await user.click(screen.getByRole("button", { name: "Design experiment" }));
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

  it("saves once and starts the saved plan, with no extra reads", async () => {
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
    expect(listQueries).toEqual([]);
    expect(savedRequest).toEqual(saveExperimentRequest);
  });

  it("keeps the saved plan when the limit is reached at the last moment, and retries without a duplicate", async () => {
    const user = userEvent.setup();
    let saveCalls = 0;
    let startCalls = 0;
    server.use(
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json(proposeResponse)),
      http.post(`${api}/api/experiments`, () => {
        saveCalls += 1;
        return HttpResponse.json(experiment, { status: 201 });
      }),
      http.post(`${api}/api/experiments/${experiment.id}/start`, () => {
        startCalls += 1;
        return startCalls === 1
          ? HttpResponse.json({ detail: { code: "active_limit_reached", message: "You're running 3 experiments, the most at once. Finish one to start another.", limit: 3 } }, { status: 409 })
          : HttpResponse.json(activeExperiment);
      }),
    );
    render(<NewExperiment />);

    await submitQuestion(user);
    const preview = await screen.findByRole("region", { name: "Experiment and prediction preview" });
    await user.click(within(preview).getByRole("button", { name: "Start this experiment" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your experiment was saved, but it couldn’t start yet. You're running 3 experiments, the most at once.");
    expect(within(alert).getByRole("link", { name: "Go to your lab" })).toHaveAttribute("href", "/");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/experiments/${experiment.id}`));
    expect(saveCalls).toBe(1);
    expect(startCalls).toBe(2);
  });

  it("recognises a start that already went through instead of reporting a failure", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json(proposeResponse)),
      http.post(`${api}/api/experiments`, () => HttpResponse.json(experiment, { status: 201 })),
      http.post(`${api}/api/experiments/${experiment.id}/start`, () => HttpResponse.json({ detail: "Only a proposed experiment can be started (this one is active)" }, { status: 409 })),
      http.get(`${api}/api/experiments/${experiment.id}`, () => HttpResponse.json(activeExperiment)),
    );
    render(<NewExperiment />);

    await submitQuestion(user);
    const preview = await screen.findByRole("region", { name: "Experiment and prediction preview" });
    await user.click(within(preview).getByRole("button", { name: "Start this experiment" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/experiments/${experiment.id}`));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    expect(listCalls).toBe(0);
  });
});

function proposalQuestion() {
  return proposeResponse.proposal?.question ?? "";
}


it("keeps the AI forecast hidden until a valid personal guess is committed, then saves that guess", async () => {
  const user = userEvent.setup();
  let savedBody: unknown;
  server.use(
    http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
    http.post(`${api}/api/experiments/propose`, () => HttpResponse.json({ ...proposeResponse, personal_guess_available: true })),
    http.post(`${api}/api/experiments`, async ({ request }) => {
      savedBody = await request.json();
      return HttpResponse.json(experiment, { status: 201 });
    }),
    http.post(`${api}/api/experiments/${experiment.id}/start`, () => HttpResponse.json(experiment)),
  );
  render(<NewExperiment />);
  await submitQuestion(user);
  const guess = await screen.findByRole("textbox", { name: "Your guess for Morning energy" });
  expect(screen.queryByText("The original forecast")).not.toBeInTheDocument();
  const reveal = screen.getByRole("button", { name: "Show prediction" });
  expect(reveal).toBeDisabled();
  await user.type(guess, "201");
  expect(reveal).toBeDisabled();
  await user.clear(guess);
  await user.type(guess, "0");
  await user.click(reveal);
  expect(await screen.findByText("The original forecast")).toBeVisible();
  expect(screen.queryByRole("textbox", { name: "Your guess for Morning energy" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Start this experiment" }));
  await waitFor(() => expect(savedBody).toMatchObject({ personal_guess_percent: 0 }));
});

it("explains when guesses are unavailable and still lets an old database start normally", async () => {
  const user = userEvent.setup();
  server.use(
    http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
    http.post(`${api}/api/experiments/propose`, () => HttpResponse.json({ ...proposeResponse, personal_guess_available: false })),
  );
  render(<NewExperiment />);
  await submitQuestion(user);
  expect(await screen.findByText(/Your own guess is unavailable right now/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Start this experiment" })).toBeEnabled();
});

it("keeps a committed guess on save failure and requires explicit consent to omit it if rollout changes", async () => {
  const user = userEvent.setup();
  const saves: unknown[] = [];
  server.use(
    http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
    http.post(`${api}/api/experiments/propose`, () => HttpResponse.json({ ...proposeResponse, personal_guess_available: true })),
    http.post(`${api}/api/experiments`, async ({ request }) => {
      saves.push(await request.json());
      if (saves.length === 1) return HttpResponse.json({ detail: {
        code: "personal_guess_unavailable", message: "Your guess could not be saved yet. No experiment was saved.",
      } }, { status: 409 });
      return HttpResponse.json(experiment, { status: 201 });
    }),
    http.post(`${api}/api/experiments/${experiment.id}/start`, () => HttpResponse.json(experiment)),
  );
  render(<NewExperiment />);
  await submitQuestion(user);
  await user.type(await screen.findByRole("textbox", { name: "Your guess for Morning energy" }), "-12,5");
  await user.click(screen.getByRole("button", { name: "Show prediction" }));
  await user.click(screen.getByRole("button", { name: "Start this experiment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No experiment was saved");
  expect(screen.getByText("-12.5%", { exact: true })).toBeVisible();
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({ personal_guess_percent: -12.5 });
  await user.click(screen.getByRole("button", { name: "Continue without saving my guess" }));
  await waitFor(() => expect(saves).toHaveLength(2));
  expect(saves[1]).not.toHaveProperty("personal_guess_percent");
});

describe("a question that is not about a habit", () => {
  const suggested = "Does a 20-minute walk after dinner improve my morning energy?";
  const softCheck: ProposeResponse = {
    ...proposeResponse,
    proposal: null,
    prediction: null,
    habit_check: { message: "This doesn't look like a habit question.", suggested_question: suggested },
  };

  async function askOffTopic(bodies: unknown[]) {
    server.use(
      http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
      http.post(`${api}/api/experiments/propose`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(bodies.length === 1 ? softCheck : { ...proposeResponse, personal_guess_available: false });
      }),
    );
    const user = userEvent.setup();
    render(<NewExperiment />);
    await user.type(await screen.findByLabelText(/your question/i), "What is the capital of France?");
    await user.click(screen.getByRole("button", { name: /design experiment/i }));
    await screen.findByText("This doesn't look like a habit question.");
    return user;
  }

  it("shows the rewording and both choices, without an error", async () => {
    await askOffTopic([]);
    expect(screen.getByText(suggested)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this instead" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue anyway" })).toBeInTheDocument();
    expect(screen.queryByText(/came back incomplete/)).toBeNull();
  });

  it("Use this instead fills in the rewording and sends nothing", async () => {
    const bodies: unknown[] = [];
    const user = await askOffTopic(bodies);
    await user.click(screen.getByRole("button", { name: "Use this instead" }));
    expect(screen.getByLabelText(/your question/i)).toHaveValue(suggested);
    expect(bodies).toHaveLength(1);
  });

  it("Continue anyway carries on to the plan, saying so to the server", async () => {
    const bodies: unknown[] = [];
    const user = await askOffTopic(bodies);
    await user.click(screen.getByRole("button", { name: "Continue anyway" }));
    await screen.findByRole("button", { name: /start this experiment/i });
    expect(screen.getByText("Your question wasn't about a habit, so Rhythm suggested a related habit experiment instead.")).toBeVisible();
    expect(bodies[1]).toEqual({ question: "What is the capital of France?", continue_anyway: true });
  });
});

describe("a safety block", () => {
  const advice = "Try a small, low-risk habit change, and ask a clinician about anything medical.";
  async function askBlocked(suggested_question: string | null) {
    server.use(
      http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
      http.post(`${api}/api/experiments/propose`, () => HttpResponse.json({
        ...proposeResponse, proposal: null, prediction: null,
        safety: { allowed: false, reason: "Not this one.", suggested_alternative: advice, suggested_question },
      })),
    );
    const user = userEvent.setup();
    render(<NewExperiment />);
    await user.type(await screen.findByLabelText(/your question/i), "Something that gets blocked");
    await user.click(screen.getByRole("button", { name: /design experiment/i }));
    await screen.findByText("Let's find a gentler experiment.");
    return user;
  }

  it("fills the box with a testable question, never the advice", async () => {
    const user = await askBlocked("Does a consistent bedtime help me feel rested?");
    await user.click(screen.getByRole("button", { name: "Use this instead" }));
    expect(screen.getByLabelText(/your question/i)).toHaveValue("Does a consistent bedtime help me feel rested?");
  });

  it("disables another classification until the blocked question changes", async () => {
    const user = await askBlocked("Does a consistent bedtime help me feel rested?");
    const design = screen.getByRole("button", { name: "Design experiment" });
    expect(design).toBeDisabled();
    await user.type(screen.getByLabelText(/your question/i), "?");
    expect(design).toBeEnabled();
  });

  it("with only advice, shows it as text and leaves the box empty", async () => {
    await askBlocked(null);
    expect(screen.getByText(advice)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this instead" })).toBeNull();
    expect(screen.getByLabelText(/your question/i)).toHaveValue("");
  });
});
