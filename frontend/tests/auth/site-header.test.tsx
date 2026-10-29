import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/site-header";

const { signOut, sessionState, router, nav } = vi.hoisted(() => ({
  signOut: vi.fn(),
  sessionState: { session: null as null | { user: { email: string } }, loading: false },
  router: { push: vi.fn(), replace: vi.fn() },
  nav: { pathname: "/" },
}));

vi.mock("@/lib/auth/supabase", () => ({ isAuthConfigured: true, supabase: { auth: { signOut } } }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => nav.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

beforeEach(() => {
  sessionState.session = null;
  sessionState.loading = false;
  nav.pathname = "/";
  signOut.mockReset();
  router.push.mockClear();
});

const signIn = () => { sessionState.session = { user: { email: "learner@example.invalid" } }; };

describe("site header", () => {
  it("is pinned to the top of every page", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("banner")).toHaveClass("sticky", "top-0");
  });

  it("offers only sign in to a visitor", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(screen.queryByRole("button", { name: /account|menu/i })).toBeNull();
  });

  it("gives a signed-in person the main sections, with the current page marked", () => {
    signIn();
    nav.pathname = "/history";
    render(<SiteHeader />);
    const main = screen.getByRole("navigation", { name: "Main" });
    const links = within(main).getAllByRole("link");
    expect(links.map(link => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Your lab", "/"], ["History", "/history"], ["Demo", "/demo"],
    ]);
    expect(within(main).getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
    expect(within(main).getByRole("link", { name: "Your lab" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("marks Your lab on the experiment pages under it", () => {
    signIn();
    nav.pathname = "/experiments/abc/check-in";
    render(<SiteHeader />);
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Your lab" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the email and sign out in an account panel that opens, closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    signIn();
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Account menu for learner@example.invalid" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    expect(within(panel).getByText("learner@example.invalid")).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Sign out" })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("closes the panel when you click elsewhere", async () => {
    const user = userEvent.setup();
    signIn();
    render(<><SiteHeader /><p>Elsewhere</p></>);
    const trigger = screen.getByRole("button", { name: /Account menu/ });
    await user.click(trigger);
    await user.click(screen.getByText("Elsewhere"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("signs out from the account panel and returns home", async () => {
    const user = userEvent.setup();
    signIn();
    signOut.mockResolvedValue({ error: null });
    render(<SiteHeader />);
    await user.click(screen.getByRole("button", { name: /Account menu/ }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/");
  });
});
