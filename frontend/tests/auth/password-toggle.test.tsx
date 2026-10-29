import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthForm, type AuthMode } from "@/components/auth/auth-form";

vi.mock("@/lib/auth/supabase", () => ({
  isAuthConfigured: true,
  supabase: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn() } },
}));

function renderForm(mode: AuthMode = "sign-in") {
  render(<AuthForm mode={mode} onModeChange={() => {}} />);
  return {
    email: screen.getByLabelText("Email") as HTMLInputElement,
    password: screen.getByLabelText("Password") as HTMLInputElement,
  };
}

describe("password visibility toggle", () => {
  it("shows and hides the password, and its name and pressed state follow", async () => {
    const user = userEvent.setup();
    const { password } = renderForm();
    await user.type(password, "fake-test-password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(password).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("fake-test-password");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Show password" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
  });

  it("works from the keyboard and keeps focus on the toggle", async () => {
    const user = userEvent.setup();
    const { password } = renderForm();
    await user.click(password);
    await user.keyboard("fake-test-password");
    await user.tab();

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveFocus();

    await user.keyboard(" ");
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveFocus();
  });

  it("clicking the eye while typing keeps focus and the cursor in the password", async () => {
    const user = userEvent.setup();
    const { password } = renderForm();
    await user.click(password);
    await user.keyboard("fake-test-password");
    password.setSelectionRange(4, 4);

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveFocus();
    expect(password.selectionStart).toBe(4);
    expect(password.selectionEnd).toBe(4);
  });

  it("is an icon inside the field, not a separate text control", () => {
    renderForm();
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).not.toHaveTextContent(/\S/);
    expect(toggle.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /^(Show|Hide)$/ })).toBeNull();
  });

  it("styles the password exactly like the email, plus room for the icon", () => {
    const { email, password } = renderForm();
    const emailClasses = email.className.split(/\s+/);
    for (const name of emailClasses) expect(password.className.split(/\s+/)).toContain(name);
  });

  it.each([
    ["sign-in", "current-password"],
    ["sign-up", "new-password"],
  ] as const)("keeps the %s autocomplete hint for password managers", (mode, hint) => {
    const { password } = renderForm(mode);
    expect(password).toHaveAttribute("autocomplete", hint);
  });
});
