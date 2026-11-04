import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangeQuestion } from "@/components/checkins/change-question";

function setup(overrides: Partial<Parameters<typeof ChangeQuestion>[0]> = {}) {
  const onChange = vi.fn();
  render(<ChangeQuestion name="change" action="Walk for 20 minutes" timing="After dinner" value={undefined} onChange={onChange} {...overrides} />);
  return onChange;
}

describe("the daily 'did you make the change' question", () => {
  it("shows the change as written and offers two answers", () => {
    setup();
    expect(screen.getByRole("group", { name: "Did you make the change today?" })).toBeVisible();
    expect(screen.getByText("Walk for 20 minutes")).toBeVisible();
    expect(screen.getByText("When: After dinner")).toBeVisible();
    expect(screen.getByRole("radio", { name: "Yes" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Not today" })).not.toBeChecked();
  });

  it("reports each answer", async () => {
    const user = userEvent.setup();
    const onChange = setup();
    await user.click(screen.getByRole("radio", { name: "Not today" }));
    expect(onChange).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole("radio", { name: "Yes" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("marks the saved answer and shows an error", () => {
    setup({ value: true, error: "Please answer this" });
    expect(screen.getByRole("radio", { name: "Yes" })).toBeChecked();
    expect(screen.getByText("Please answer this")).toBeVisible();
    expect(screen.getByRole("group", { name: "Did you make the change today?" })).toHaveAttribute("aria-invalid", "true");
  });
});
