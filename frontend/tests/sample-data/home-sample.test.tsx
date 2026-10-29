import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: null, loading: false }) }));
vi.mock("@/components/rhythm-ring", () => ({ RhythmRing: () => <svg role="img" aria-label="Sample rhythm illustration" /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("sample-data home illustration", () => {
  it("labels the example profile as sample data and shows its example schedule", () => {
    render(<Home />);

    expect(screen.getByText("A rhythm, shown with sample data. Yours is drawn from your own answers.")).toBeVisible();
    expect(screen.getByText("23:30–07:30")).toBeVisible();
    expect(screen.getByRole("img", { name: "Sample rhythm illustration" })).toBeVisible();
  });
});
