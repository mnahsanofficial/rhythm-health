import { act, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async importOriginal => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useReducedMotion: () => preference.reduced,
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: null, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const SCENES = [
  "Your sleep is the experiment.",
  "Check in in about 30 seconds.",
  "The prediction comes first.",
  "Late coffee, or none after 2 PM?",
  "Does a walk after dinner help you sleep?",
  "Tomorrow is day 4.",
];

afterEach(() => { preference.reduced = false; });

describe("landing day story", () => {
  it("tells the whole day as readable text, in order, and ends with the call to action", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: /Stop guessing what works for you/ })).toBeVisible();
    expect(screen.getByText(/An example day/)).toBeVisible();
    const headings = screen.getAllByRole("heading", { level: 2 }).map(h => h.textContent);
    expect(headings.slice(0, SCENES.length)).toEqual(SCENES);
    expect(screen.getByText(/30 seconds/, { selector: "h2" })).toBeVisible();
    expect(screen.getByText(/3 normal days with 7 days of one small change/)).toBeVisible();
    expect(screen.getByText(/likely signal or just noise/)).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "How it works" })).toBeVisible();

    const ctas = screen.getAllByRole("link", { name: "Run your first experiment" });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/onboarding");
    const last = ctas.at(-1)!;
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.at(-1)).toBe(last);
  });

  it("only renders the illustrated scenes near the current scroll position", async () => {
    const { container } = render(<Home />);
    const stage = container.querySelector("[data-story-stage]");
    expect(stage).not.toBeNull();
    await act(async () => {});
    const mounted = [...stage!.querySelectorAll("[data-scene]")].map(el => el.getAttribute("data-scene"));
    expect(mounted).toContain("bedroom");
    expect(mounted).not.toContain("office");
    expect(mounted).not.toContain("dinner");
  });

  it("with reduced motion, shows the five scenes as stills and mounts no scroll-driven stage", async () => {
    preference.reduced = true;
    const { container } = render(<Home />);
    await act(async () => {});

    expect(container.querySelectorAll("[data-story-stage] [data-scene]")).toHaveLength(0);
    const stills = screen.getAllByRole("img", { name: /^Illustration:/ });
    expect(stills).toHaveLength(5);
    for (const name of SCENES.slice(0, 5)) {
      const section = screen.getByRole("heading", { level: 2, name }).closest("section")!;
      expect(within(section).getByRole("img", { name: /^Illustration:/ })).toBeInTheDocument();
    }
  });

  it("hydrates without a mismatch when the browser asks for reduced motion", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    preference.reduced = false; // The server cannot know the browser's preference.
    const host = document.createElement("div");
    host.innerHTML = renderToString(<Home />);
    document.body.append(host);
    preference.reduced = true;
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(host, <Home />); });
      expect(error.mock.calls.flat().join(" ")).not.toMatch(/hydration|didn't match|did not match/i);
      expect(host.querySelectorAll("[data-story-stage] [data-scene]")).toHaveLength(0);
    } finally {
      await act(async () => root?.unmount());
      host.remove();
      error.mockRestore();
    }
  });
});
