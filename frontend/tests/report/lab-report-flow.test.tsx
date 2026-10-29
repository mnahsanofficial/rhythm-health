import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LabReport } from "@/components/report/lab-report";
import type { Experiment, LabReport as LabReportData } from "@/lib/types/api";
import { completedExperiment, experiment, labReport, writtenLabReport } from "../support/fixtures";
import { server } from "../support/server";

const api = "http://api.test.invalid";
const id = completedExperiment.id;

const { getSession, router, sessionState } = vi.hoisted(() => ({
  getSession: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
  sessionState: { session: { user: { id: "test-user", email: "learner@example.invalid" } }, loading: false },
}));

vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("motion/react", async () => import("../support/motion-mock"));

/** Count every call the page makes, and fail loudly on anything unmocked. */
function trackCalls() {
  const calls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    calls.push(`${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`);
  });
  return calls;
}

beforeEach(() => {
  server.events.removeAllListeners();
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
  router.push.mockClear();
  router.replace.mockClear();
});

describe("Lab Report flow", () => {
  it("keeps seeded demo results visibly labelled as a sample after opening the report", async () => {
    server.use(http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json({
      ...writtenLabReport,
      experiment: { ...writtenLabReport.experiment, is_seeded: true },
    })), http.get(`${api}/api/experiments`, () => HttpResponse.json([])));
    render(<LabReport id={id} />);

    const notice = await screen.findByRole("note", { name: "Sample experiment" });
    expect(notice).toBeVisible();
    expect(notice).toHaveTextContent("This report is based on seeded example check-ins.");
    expect(screen.getByRole("heading", { name: writtenLabReport.experiment.question })).toBeVisible();
  });

  it("shows the analysis straight away from one GET /report, then offers to write the report", async () => {
    const calls = trackCalls();
    server.use(http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(labReport)));
    render(<LabReport id={id} />);

    expect(await screen.findByRole("region", { name: "Prediction vs reality" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "How the days went" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Day by day" })).toBeInTheDocument();
    const learning = screen.getByRole("region", { name: "What you learned about you" });
    expect(within(learning).getByRole("button", { name: "Write my report" })).toBeEnabled();
    expect(calls).toEqual([`GET /api/experiments/${id}/report`]);
  });

  it("writes the narrative with one paid call, even on a double-click, and says what's happening", async () => {
    const user = userEvent.setup();
    let posts = 0;
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    server.use(
      http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(labReport)),
      http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
      http.post(`${api}/api/experiments/${id}/report`, async ({ request }) => {
        posts += 1;
        expect(new URL(request.url).searchParams.has("regenerate")).toBe(false);
        await gate;
        return HttpResponse.json(writtenLabReport);
      }),
    );
    render(<LabReport id={id} />);
    const button = await screen.findByRole("button", { name: "Write my report" });

    await user.dblClick(button);
    const learning = screen.getByRole("region", { name: "What you learned about you" });
    const busy = within(learning).getByRole("button", { name: /Writing your report/ });
    expect(busy).toBeDisabled();
    expect(within(learning).getByRole("status")).toHaveTextContent(/Writing your report from your results/);

    finish();
    expect(await within(learning).findByText(writtenLabReport.narrative!.summary)).toBeInTheDocument();
    for (const item of writtenLabReport.narrative!.personal_learnings) expect(within(learning).getByText(item)).toBeInTheDocument();
    for (const item of writtenLabReport.narrative!.confounders) expect(within(learning).getByText(item)).toBeInTheDocument();
    expect(within(learning).queryByRole("button", { name: /Write my report/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "What you learned about you" })).toHaveFocus();
    expect(posts).toBe(1);
  });

  it.each([
    [503, "AI service unavailable, please try again", /writing service isn't available right now/i],
    [502, "Could not write the report, please try again", /couldn't write a report that matched your results/i],
  ])("explains a %i from POST /report and retries", async (status, detail, message) => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(labReport)),
      http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
      http.post(`${api}/api/experiments/${id}/report`, () => {
        posts += 1;
        return posts === 1 ? HttpResponse.json({ detail }, { status }) : HttpResponse.json(writtenLabReport);
      }),
    );
    render(<LabReport id={id} />);
    await user.click(await screen.findByRole("button", { name: "Write my report" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveTextContent(/results above are saved/i);
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(writtenLabReport.narrative!.summary)).toBeInTheDocument();
    expect(posts).toBe(2);
  });

  it("takes every figure from the analysis, never from the narrative text", async () => {
    const misquoted: LabReportData = {
      ...writtenLabReport,
      narrative: { ...writtenLabReport.narrative!, summary: "Your morning energy rose 50% on test days." },
    };
    server.use(
      http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(misquoted)),
      http.get(`${api}/api/experiments`, () => HttpResponse.json([])),
    );
    render(<LabReport id={id} />);

    const verdict = await screen.findByRole("region", { name: "Likely signal" });
    expect(verdict).toHaveTextContent("Morning energy: +21% on test days");
    expect(verdict).toHaveTextContent("5.3 → 6.4");
    const comparison = screen.getByRole("region", { name: "Prediction vs reality" });
    expect(comparison).toHaveTextContent("+8% to +15%");
    expect(comparison).not.toHaveTextContent("50");
    expect(verdict).not.toHaveTextContent("50");
  });

  it("offers to run the suggested experiment, prefilled, when nothing else is running", async () => {
    server.use(
      http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(writtenLabReport)),
      http.get(`${api}/api/experiments`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("status")).toBe("active");
        return HttpResponse.json([]);
      }),
    );
    render(<LabReport id={id} />);
    const next = await screen.findByRole("region", { name: "What to test next" });
    const question = writtenLabReport.narrative!.next_experiment.question;
    expect(await within(next).findByRole("link", { name: "Run this experiment" })).toHaveAttribute(
      "href", `/experiments/new?question=${encodeURIComponent(question)}`,
    );
  });

  it("points to the running experiment instead, when one is active", async () => {
    const active: Experiment = { ...experiment, id: "77777777-7777-4777-8777-777777777777", status: "active", question: "Does less screen time help me fall asleep?" };
    server.use(
      http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(writtenLabReport)),
      http.get(`${api}/api/experiments`, () => HttpResponse.json([active])),
    );
    render(<LabReport id={id} />);
    const next = await screen.findByRole("region", { name: "What to test next" });
    expect(await within(next).findByText(/already running an experiment/i)).toBeInTheDocument();
    expect(within(next).getByRole("link", { name: "Go to your current experiment" })).toHaveAttribute("href", `/experiments/${active.id}`);
    expect(within(next).queryByRole("link", { name: "Run this experiment" })).toBeNull();
  });

  it("shows the not-finished state when there is no report yet", async () => {
    server.use(
      http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json({ detail: "No report for this experiment yet" }, { status: 404 })),
      http.get(`${api}/api/experiments/${id}`, () => HttpResponse.json({ ...experiment, status: "active" })),
    );
    render(<LabReport id={id} />);
    expect(await screen.findByRole("heading", { name: "No results yet." })).toBeInTheDocument();
    expect(screen.getByText(/Keep checking in/)).toBeInTheDocument();
  });
});

describe("day chart", () => {
  // An early finish: day 4 was missed, and days 8-10 had not happened yet when it was completed.
  const earlyFinish: LabReportData = {
    ...labReport,
    analysis: { ...labReport.analysis, adherence: { ...labReport.analysis.adherence, intervention_days_logged: 3, missing_days: [4] } },
    chart: {
      ...labReport.chart,
      points: labReport.chart.points.map(p =>
        p.day === 4 || p.day >= 8 ? { day: p.day, phase: p.phase, logged: false, intervention_completed: null, value: null, values: null, note: null } : p,
      ),
    },
  };

  it("plots the backend's chart points and predicted band, not its own maths", async () => {
    const user = userEvent.setup();
    server.use(http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(labReport)));
    render(<LabReport id={id} />);
    const chart = await screen.findByRole("region", { name: "Day by day" });
    expect(within(chart).getAllByRole("button", { name: /^Day \d+/ })).toHaveLength(10);
    expect(within(chart).getByText(/Predicted range: 5\.8–6\.1/)).toBeInTheDocument();
    await user.click(within(chart).getByRole("button", { name: /^Day 6, test, change skipped: 7/ }));
    expect(within(chart).getByText(/Late dinner, skipped the walk/)).toBeInTheDocument();
    expect(within(chart).getByText("Sleep quality").nextSibling).toHaveTextContent("7");
  });

  it("only calls a day missed when the analysis says so; later days are not reached", async () => {
    server.use(http.get(`${api}/api/experiments/${id}/report`, () => HttpResponse.json(earlyFinish)));
    render(<LabReport id={id} />);
    const chart = await screen.findByRole("region", { name: "Day by day" });
    expect(within(chart).getAllByRole("button", { name: /^Day \d+/ })).toHaveLength(6);
    expect(within(chart).getByText("Missed: day 4.")).toBeInTheDocument();
    expect(within(chart).getByText("Not reached before you finished: days 8, 9, 10.")).toBeInTheDocument();
    const days = screen.getByRole("region", { name: "How the days went" });
    expect(days).toHaveTextContent("Day 4");
    expect(days).not.toHaveTextContent(/Days? .*8/);
    await waitFor(() => expect(within(chart).queryByText(/Missed: .*8/)).toBeNull());
  });
});
