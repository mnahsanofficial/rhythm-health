import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CombinedCheckin } from "@/components/checkins/combined-checkin";
import type { TodayCheckin } from "@/lib/types/api";
import { server } from "../support/server";

const { getSession, router, sessionState } = vi.hoisted(() => ({
  getSession: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
  sessionState: { session: { user: { id: "user-1" } } as null | { user: { id: string } }, loading: false },
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState }));
vi.mock("@/lib/auth/supabase", () => ({ supabase: { auth: { getSession } } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("motion/react", async () => import("../support/motion-mock"));

const api = "http://api.test.invalid";
const scale = (key: string, label: string): TodayCheckin["questions"][number]["metric"] => ({ key, label, type: "scale", min: 1, max: 10, primary: false, min_label: "Low point", max_label: "High point" });
const A = "aaaaaaaa-1111-4111-8111-111111111111", B = "bbbbbbbb-1111-4111-8111-111111111111";
const today: TodayCheckin = {
  revision: "rev-1",
  experiments: [
    { id: A, question: "Does walking help?", action: "Walk after dinner", timing: "After dinner", day_number: 5, total_days: 10, phase: "intervention", change_required: true, change_made: null, recorded: false },
    { id: B, question: "Does less coffee help?", action: "Skip the second coffee", timing: "Afternoon", day_number: 2, total_days: 10, phase: "baseline", change_required: false, change_made: null, recorded: false },
  ],
  questions: [
    { id: `${A}:energy`, metric: scale("energy", "Morning energy"), experiment_ids: [A, B], value: null },
    { id: `${B}:focus`, metric: scale("focus", "Focus"), experiment_ids: [B], value: null },
  ],
  note: null,
  all_recorded: false,
};
const limitDetail = { detail: { code: "checkin_changed", message: "Today's check-in has changed. Reload it to see the current questions." } };

function install(read: TodayCheckin = today) {
  server.use(http.get(`${api}/api/checkins/today`, () => HttpResponse.json(read)));
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  const energy = await screen.findByRole("group", { name: /Morning energy/ });
  await user.click(within(energy).getByRole("radio", { name: /^7/ }));
  const focus = screen.getByRole("group", { name: /Focus/ });
  await user.click(within(focus).getByRole("radio", { name: /^6/ }));
  await user.click(screen.getByRole("radio", { name: "Yes" }));
}

beforeEach(() => {
  sessionState.session = { user: { id: "user-1" } };
  getSession.mockResolvedValue({ data: { session: { access_token: "fake-session-token" } }, error: null });
  router.replace.mockClear();
});

describe("today's check-in for several experiments", () => {
  it("asks a shared question once, and the change question only for the experiment testing today", async () => {
    install();
    render(<CombinedCheckin />);
    expect(await screen.findByRole("heading", { name: "Today's check-in.", level: 1 })).toBeVisible();
    expect(screen.getAllByRole("group", { name: /Morning energy/ })).toHaveLength(1);
    expect(screen.getByText("For both experiments")).toBeVisible();
    expect(screen.getByText("For: Does less coffee help?")).toBeVisible();
    expect(screen.getByText("Walk after dinner")).toBeVisible();
    expect(screen.queryByText("Skip the second coffee")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Yes" })).toHaveLength(1);
  });

  it("saves everything in one request, without any day or phase", async () => {
    const user = userEvent.setup();
    install();
    let saved: unknown;
    server.use(http.post(`${api}/api/checkins/today`, async ({ request }) => {
      saved = await request.json();
      return HttpResponse.json({ ...today, all_recorded: true });
    }));
    render(<CombinedCheckin />);
    await fill(user);
    await user.type(screen.getByRole("textbox", { name: /Anything unusual/ }), " late night ");
    await user.click(screen.getByRole("button", { name: "Save check-in" }));
    expect(await screen.findByRole("heading", { name: "Today's check-ins are recorded." })).toBeVisible();
    expect(saved).toEqual({ revision: "rev-1", answers: { [`${A}:energy`]: 7, [`${B}:focus`]: 6 }, changes: { [A]: true }, note: "late night" });
    expect(screen.getByRole("link", { name: "Back to Your lab" })).toHaveAttribute("href", "/");
  });

  it("prefills what's already recorded and says saving replaces it", async () => {
    install({
      ...today,
      experiments: [{ ...today.experiments[0], recorded: true, change_made: false }, today.experiments[1]],
      questions: [{ ...today.questions[0], value: 8 }, today.questions[1]],
      note: "earlier note",
    });
    render(<CombinedCheckin />);
    const energy = await screen.findByRole("group", { name: /Morning energy/ });
    expect(within(energy).getByRole("radio", { name: /^8/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Not today" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /Anything unusual/ })).toHaveValue("earlier note");
    expect(screen.getByRole("button", { name: "Update check-in" })).toBeVisible();
  });

  it("stops before sending when answers are missing", async () => {
    const user = userEvent.setup();
    install();
    const post = vi.fn(() => HttpResponse.json(today));
    server.use(http.post(`${api}/api/checkins/today`, post));
    render(<CombinedCheckin />);
    await user.click(await screen.findByRole("button", { name: "Save check-in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A few answers are still missing.");
    expect(post).not.toHaveBeenCalled();
  });

  it("shows the backend's field errors and keeps the answers", async () => {
    const user = userEvent.setup();
    install();
    server.use(http.post(`${api}/api/checkins/today`, () => HttpResponse.json({ detail: [{ field: `change:${A}`, message: "Required on a test day" }] }, { status: 422 })));
    render(<CombinedCheckin />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Save check-in" }));
    expect(await screen.findByText("Required on a test day")).toBeVisible();
    expect(within(screen.getByRole("group", { name: /Morning energy/ })).getByRole("radio", { name: /^7/ })).toBeChecked();
  });

  it("reloads the form when the day or the questions changed", async () => {
    const user = userEvent.setup();
    install();
    server.use(http.post(`${api}/api/checkins/today`, () => HttpResponse.json(limitDetail, { status: 409 })));
    render(<CombinedCheckin />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Save check-in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Today's check-in has changed.");
    install({ ...today, revision: "rev-2", experiments: [today.experiments[1], { ...today.experiments[0], id: "cccccccc-1111-4111-8111-111111111111" }] });
    await user.click(screen.getByRole("button", { name: "Reload today's check-in" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("offers Try again when it can't load, and sends an expired session to sign in", async () => {
    const user = userEvent.setup();
    server.use(http.get(`${api}/api/checkins/today`, () => HttpResponse.json({ detail: "Database unavailable" }, { status: 503 })));
    render(<CombinedCheckin />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load today's check-in");
    install();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("group", { name: /Morning energy/ })).toBeVisible();
  });

  it("sends a single due experiment to its own form", async () => {
    install({ ...today, experiments: [today.experiments[1]], questions: [today.questions[1]] });
    render(<CombinedCheckin />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/experiments/${B}/check-in`));
  });

  it("says so when nothing is due", async () => {
    install({ ...today, experiments: [], questions: [] });
    render(<CombinedCheckin />);
    expect(await screen.findByText("No check-in is open right now.")).toBeVisible();
  });
});
