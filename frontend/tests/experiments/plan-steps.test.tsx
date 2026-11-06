import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { NewExperiment } from "@/components/experiments/new-experiment";
import { server } from "../support/server";
import { profile, proposeResponse } from "../support/fixtures";

const { getSession, router, session } = vi.hoisted(() => ({ getSession: vi.fn(), router: { push: vi.fn(), replace: vi.fn() }, session: { user: { id: "user-1" } } }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session, loading: false }) }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
vi.mock("motion/react", async () => import("../support/motion-mock"));
const api = "http://api.test.invalid";
const proposal = proposeResponse.proposal!;
const available = { ...proposeResponse, personal_guess_available: true };
beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-plan-token" } }, error: null });
  server.use(http.get(`${api}/api/profile`, () => HttpResponse.json(profile)), http.post(`${api}/api/experiments/propose`, () => HttpResponse.json(available)));
});
async function plan(user: ReturnType<typeof userEvent.setup>) {
  render(<NewExperiment />);
  await user.type(await screen.findByRole("textbox", { name: "Your question or goal" }), proposal.question);
  await user.click(screen.getByRole("button", { name: "Design experiment" }));
  await screen.findByRole("heading", { name: proposal.intervention.change_short!, level: 1 });
}
it("starts with the short change, then a guess that can be revisited before the forecast", async () => {
  const user = userEvent.setup(); await plan(user);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.queryByRole("textbox", { name: /^Your guess for/ })).toBeNull();
  expect(screen.queryByText("The original forecast")).toBeNull();
  expect(screen.getByText(proposal.hypothesis)).not.toBeVisible();
  await user.click(screen.getByText("Details"));
  expect(screen.getByText(proposal.hypothesis)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next", exact: true }));
  const input = screen.getByRole("textbox", { name: "Your guess for Morning energy" });
  expect(screen.getByRole("button", { name: "Show prediction" })).toBeDisabled();
  await user.type(input, "25");
  expect(screen.getByRole("status")).toHaveTextContent("+25%");
  await user.click(screen.getByRole("button", { name: "Back", exact: true }));
  await user.click(screen.getByRole("button", { name: "Next", exact: true }));
  expect(screen.getByRole("textbox", { name: /^Your guess for/ })).toHaveValue("25");
  await user.click(screen.getByRole("button", { name: "Show prediction" }));
  expect(screen.getByText("The original forecast")).toBeVisible();
  expect(screen.getByText("Your guess")).toBeVisible();
  expect(screen.queryByRole("textbox", { name: /^Your guess for/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Start this experiment" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Next", exact: true }));
  expect(screen.getByText(/Your check-ins decide, not the AI/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Start this experiment" })).toBeVisible();
});
it("skips the unavailable guess without inventing one", async () => {
  server.use(http.post(`${api}/api/experiments/propose`, () => HttpResponse.json({ ...available, personal_guess_available: false })));
  const user = userEvent.setup(); await plan(user);
  await user.click(screen.getByRole("button", { name: "Next", exact: true }));
  expect(screen.getByText("The original forecast")).toBeVisible();
  expect(screen.queryByText("Your guess")).toBeNull();
  expect(screen.queryByRole("textbox", { name: /^Your guess for/ })).toBeNull();
});
