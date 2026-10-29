import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthNav } from "@/components/auth-nav";
import { AuthForm } from "@/components/auth/auth-form";
import { NewExperiment } from "@/components/experiments/new-experiment";
import { ExperimentDetail } from "@/components/experiments/experiment-detail";
import { safeNextPath } from "@/lib/auth/next-path";

const { signInWithPassword, signUp, signOut, sessionState, router } = vi.hoisted(() => {
  const router = { push: vi.fn(), replace: vi.fn() };
  return {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    sessionState: { session: null as null | { user: { email: string } }, loading: false },
    router,
  };
});

vi.mock("@/lib/auth/supabase", () => ({
  isAuthConfigured: true,
  supabase: { auth: { signInWithPassword, signUp, signOut } },
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("motion/react", async () => import("../support/motion-mock"));

beforeEach(() => {
  sessionState.session = null;
  sessionState.loading = false;
  router.push.mockClear();
  router.replace.mockClear();
  signInWithPassword.mockReset();
  signUp.mockReset();
  signOut.mockReset();
});

describe("auth controls", () => {
  it("signs up with the entered credentials and calls the success handler", async () => {
    const user = userEvent.setup();
    const onSignedIn = vi.fn();
    signUp.mockResolvedValue({
      data: { session: { access_token: "fake-session-token" }, user: { id: "user-1" } },
      error: null,
    });
    render(<AuthForm mode="sign-up" onModeChange={vi.fn()} onSignedIn={onSignedIn} />);

    await user.type(screen.getByRole("textbox", { name: "Email" }), "person@example.invalid");
    await user.type(screen.getByLabelText("Password"), "fake-test-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(signUp).toHaveBeenCalledWith({ email: "person@example.invalid", password: "fake-test-password" });
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it("signs in and exposes authentication errors to the user", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: { message: "Invalid credentials" } });
    render(<AuthForm mode="sign-in" onModeChange={vi.fn()} />);

    await user.type(screen.getByRole("textbox", { name: "Email" }), "person@example.invalid");
    await user.type(screen.getByLabelText("Password"), "fake-test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");

    signInWithPassword.mockResolvedValueOnce({
      data: { session: { access_token: "fake-session-token" }, user: { id: "user-1" } },
      error: null,
    });
    const onSignedIn = vi.fn();
    render(<AuthForm mode="sign-in" onModeChange={vi.fn()} onSignedIn={onSignedIn} />);
    await user.type(screen.getAllByRole("textbox", { name: "Email" })[1], "person@example.invalid");
    await user.type(screen.getAllByLabelText("Password")[1], "fake-test-password");
    await user.click(screen.getAllByRole("button", { name: "Sign in" })[1]);
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it("signs out and returns to the home page", async () => {
    const user = userEvent.setup();
    sessionState.session = { user: { email: "person@example.invalid" } };
    signOut.mockResolvedValue({ error: null });
    render(<AuthNav />);

    await user.click(screen.getByRole("button", { name: /Account menu/ }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/");
  });
});

describe("protected page guards", () => {
  it("redirects signed-out users before rendering the private experiment form", async () => {
    render(<NewExperiment />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading your rhythm");
    expect(screen.queryByRole("heading", { name: "Ask a question." })).not.toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sign-in?next=/experiments/new"));
  });

  it("redirects signed-out users before revealing experiment details", async () => {
    render(<ExperimentDetail id="33333333-3333-3333-3333-333333333333" />);

    expect(screen.queryByText("Does a 20-minute walk after dinner improve my morning energy?")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/sign-in?next=%2Fexperiments%2F33333333-3333-3333-3333-333333333333",
      ),
    );
  });
});

describe("safe return paths", () => {
  it.each([
    ["/experiments/new", "/experiments/new"],
    ["//malicious.example", "/"],
    ["https://malicious.example", "/"],
    [null, "/"],
  ])("keeps only same-site destinations (%s)", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
