import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { NewExperiment } from "@/components/experiments/new-experiment";
import { profile, proposeResponse } from "../support/fixtures";
import { server } from "../support/server";
const { getSession, router, session } = vi.hoisted(() => ({ getSession: vi.fn(), router: { push: vi.fn(), replace: vi.fn() }, session: { user: { id: "user-1" } } }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session, loading: false }) }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
vi.mock("motion/react", async () => import("../support/motion-mock"));
const api = "http://api.test.invalid";
const suggested = "Does a short outdoor break help my afternoon focus?";
const message = "That is a broader question. A personal experiment needs one small daily action that you can repeat and observe, so here is a related habit question you could try.";
beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-question-token" } }, error: null });
  server.use(http.get(`${api}/api/profile`, () => HttpResponse.json(profile)));
});
async function ask(user: ReturnType<typeof userEvent.setup>) {
  render(<NewExperiment />);
  await user.type(await screen.findByRole("textbox", { name: "Your question or goal" }), "How can I get more from my working day?");
  await user.click(screen.getByRole("button", { name: "Design experiment" }));
}
it("shows the whole soft check with one clear suggested action and fills the real question without a request", async () => {
  let calls = 0;
  server.use(http.post(`${api}/api/experiments/propose`, () => { calls++; return HttpResponse.json({ ...proposeResponse, proposal: null, prediction: null, habit_check: { message, suggested_question: suggested } }); }));
  const user = userEvent.setup(); await ask(user);
  expect(await screen.findByRole("heading", { name: "Turn it into a habit question.", level: 2 })).toHaveFocus();
  expect(screen.getByText(message)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Design experiment" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Use this instead" }));
  expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveValue(suggested);
  expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Design experiment" })).toBeEnabled();
  expect(calls).toBe(1);
});
it("keeps the safety reason visible and only a real suggested question can fill the field", async () => {
  let calls = 0;
  server.use(http.post(`${api}/api/experiments/propose`, () => { calls++; return HttpResponse.json({ ...proposeResponse, proposal: null, prediction: null, safety: { allowed: false, reason: "This change is outside a small habit experiment.", suggested_alternative: "Try a gentler routine change.", suggested_question: suggested } }); }));
  const user = userEvent.setup(); await ask(user);
  expect(await screen.findByRole("heading", { name: "Let's find a gentler experiment.", level: 2 })).toHaveFocus();
  expect(screen.getByText("This change is outside a small habit experiment.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Continue anyway" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Use this instead" }));
  expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveValue(suggested);
  expect(screen.getByRole("textbox", { name: "Your question or goal" })).toHaveFocus();
  expect(calls).toBe(1);
});
