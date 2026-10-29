import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("lets visitors explore example habits without changing their own rhythm", async () => {
    const user = userEvent.setup();
    render(<Home />);
    const coffee = screen.getByRole("checkbox", { name: /Coffee around 9am/ });
    expect(coffee).toBeChecked();
    await user.click(coffee);
    expect(coffee).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("2 habits shown");
    await user.click(coffee);
    expect(coffee).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("3 habits shown");
    expect(screen.getByRole("link", { name: "Run your first experiment" })).toHaveAttribute("href", "/onboarding");
    expect(screen.getByText("A rhythm, shown with sample data. Yours is drawn from your own answers.")).toBeVisible();
  });

});
