import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BackLink } from "@/components/nav/back-link";
import { flowFallback, sectionOf } from "@/lib/nav/routes";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));

describe("routes", () => {
  it.each([
    ["/sign-in", "/"],
    ["/onboarding", "/"],
    ["/experiments/new", "/"],
    ["/check-in", "/"],
    ["/experiments/abc/check-in", "/experiments/abc"],
  ])("%s is a flow that closes to %s when nothing came before it", (path, fallback) => {
    expect(flowFallback(path)).toBe(fallback);
  });

  it.each(["/", "/history", "/demo", "/experiments/abc", "/experiments/abc/report"])("%s isn't a flow", path => {
    expect(flowFallback(path)).toBeNull();
  });

  it("names the section a back link can return to", () => {
    expect(sectionOf("/history")).toEqual({ href: "/history", label: "History" });
    expect(sectionOf("/demo")).toEqual({ href: "/demo", label: "Demo" });
    expect(sectionOf("/")).toEqual({ href: "/", label: "Your lab" });
    expect(sectionOf("/sign-in")).toBeNull();
    expect(sectionOf(null)).toBeNull();
  });
});

describe("BackLink", () => {
  it("shows where it goes, never the word Back on screen, and says so to screen readers", () => {
    render(<BackLink href="/history" label="History" />);
    const link = screen.getByRole("link", { name: "Back to History" });
    expect(link).toHaveAttribute("href", "/history");
    expect(link).toHaveTextContent("‹ History");
    expect(link.className).toMatch(/min-h-11/);
  });
});
