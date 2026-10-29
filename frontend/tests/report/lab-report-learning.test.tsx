import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LabReport } from "@/components/report/lab-report";
import { server } from "../support/server";
import { completedExperiment, writtenLabReport } from "../support/fixtures";

const api = "http://api.test.invalid";
const experiment = completedExperiment;
const narrative = writtenLabReport.narrative!;
const nextQuestionHref = `/experiments/new?question=${encodeURIComponent(narrative.next_experiment.question)}`;

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
        return HttpResponse.json(writtenLabReport);
      }),
      http.get(`${api}/api/experiments/${experiment.id}/checkins`, () => HttpResponse.json([])),
    );

    render(<LabReport id={experiment.id} />);

    const learningSection = await screen.findByRole("region", { name: "What you learned about you" });
    expect(within(learningSection).getByText(narrative.summary)).toBeInTheDocument();
    expect(within(learningSection).getByText(narrative.interpretation)).toBeInTheDocument();
    for (const learning of narrative.personal_learnings) {
      expect(within(learningSection).getByText(learning)).toBeInTheDocument();
    }

    const nextSection = screen.getByRole("region", { name: "What to test next" });
    expect(within(nextSection).getByText(narrative.next_experiment.question)).toBeInTheDocument();
    expect(within(nextSection).getByText(narrative.next_experiment.reason)).toBeInTheDocument();
    expect(within(nextSection).getByRole("link", { name: "Run this experiment" })).toHaveAttribute(
      "href",
      nextQuestionHref,
    );
  });
});
