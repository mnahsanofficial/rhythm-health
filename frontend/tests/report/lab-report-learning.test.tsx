import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LabReport } from "@/components/report/lab-report";
import type { Experiment, Report } from "@/lib/types/api";
import { server } from "../support/server";
import { experiment } from "../support/fixtures";

type ProposedB2Report = Omit<Report, "interpretation" | "learnings" | "next_experiment"> & {
  summary: string;
  interpretation: string;
  personal_learnings: string[];
  confounders: string[];
  next_experiment: { question: string; reason: string };
};

const api = "http://api.test.invalid";
const question = "Keep the evening walk, but move it closer to dinner?";
const nextQuestionHref = `/experiments/new?question=${encodeURIComponent(question)}`;

const completedExperiment: Experiment = {
  ...experiment,
  status: "completed",
  started_at: "2026-10-18T12:00:00Z",
  completed_at: "2026-10-28T12:00:00Z",
  progress: {
    ...experiment.progress,
    state: "completed",
    total_days: 10,
    started_at: "2026-10-18T12:00:00Z",
    ends_at: "2026-10-28T12:00:00Z",
  },
};

const proposedReport: ProposedB2Report = {
  experiment_id: experiment.id,
  analysis: {
    primary_metric: "morning_energy",
    success_criteria_percent: 10,
    adherence: {
      baseline_days_planned: 3,
      baseline_days_logged: 3,
      intervention_days_planned: 7,
      intervention_days_logged: 7,
      intervention_days_completed: 6,
      adherence_rate: 6 / 7,
      coverage_rate: 1,
      missing_days: [],
    },
    metrics: [
      {
        key: "morning_energy",
        label: "Morning energy",
        type: "scale",
        primary: true,
        baseline: { n: 3, mean: 5.5, median: 5, sd: 1 },
        intervention: { n: 7, mean: 6.1, median: 6, sd: 1.2 },
        absolute_change: 0.6,
        percent_change: 11,
        median_change_percent: 10,
        pooled_sd: 1.14,
        effect_size: 0.53,
        direction_consistency: 0.71,
        outliers: [],
      },
    ],
    prediction: null,
    signal: {
      classification: "likely_signal",
      reasons: ["change_meets_success_criteria"],
      success_criteria_met: true,
      matches_predicted_direction: true,
    },
  },
  summary: "Your morning energy was higher during the test days.",
  interpretation: "Evening movement appears to support your next-morning energy.",
  personal_learnings: [
    "Evening movement appears to be positively associated with your next-morning energy.",
    "Bedtime consistency may matter more than walk duration.",
  ],
  confounders: ["Bedtime varied during the experiment."],
  next_experiment: {
    question,
    reason: "The next test can narrow down when the walk works best.",
  },
  created_at: "2026-10-28T12:00:00Z",
};

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

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
  router.push.mockClear();
  router.replace.mockClear();
});

describe("Lab Report learning sections", () => {
  it("shows personal takeaways and carries the next question into a new proposal", async () => {
    server.use(
      http.get(`${api}/api/experiments/${experiment.id}`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
        return HttpResponse.json(completedExperiment);
      }),
      http.get(`${api}/api/experiments/${experiment.id}/report`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer fake-session-token");
        return HttpResponse.json(proposedReport);
      }),
      http.get(`${api}/api/experiments/${experiment.id}/checkins`, () => HttpResponse.json([])),
    );

    render(<LabReport id={experiment.id} />);

    const learningSection = await screen.findByRole("region", { name: "What you learned about you" });
    expect(within(learningSection).getByText(proposedReport.summary)).toBeInTheDocument();
    expect(within(learningSection).getByText(proposedReport.interpretation)).toBeInTheDocument();
    for (const learning of proposedReport.personal_learnings) {
      expect(within(learningSection).getByText(learning)).toBeInTheDocument();
    }

    const nextSection = screen.getByRole("region", { name: "What to test next" });
    expect(within(nextSection).getByText(question)).toBeInTheDocument();
    expect(within(nextSection).getByText(proposedReport.next_experiment.reason)).toBeInTheDocument();
    expect(within(nextSection).getByRole("link", { name: "Run this experiment" })).toHaveAttribute(
      "href",
      nextQuestionHref,
    );
  });
});
