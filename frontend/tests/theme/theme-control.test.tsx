import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "@/components/theme-control";
import { THEME_KEY, THEME_SCRIPT } from "@/lib/theme";

let systemDark = false;
const listeners = new Set<() => void>();

function installSystem() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("dark") ? systemDark : !systemDark; },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
}
const applied = () => document.documentElement.getAttribute("data-theme");
const openMenu = async () => userEvent.click(screen.getByRole("button", { name: /^Theme:/ }));

beforeEach(() => {
  systemDark = false;
  listeners.clear();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  installSystem();
});
afterEach(() => vi.unstubAllGlobals());

describe("theme control", () => {
  it("follows the system until someone chooses", async () => {
    systemDark = true;
    render(<ThemeControl />);
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
    expect(applied()).toBe("dark");
    await openMenu();
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  });

  it("applies and remembers a choice on this device", async () => {
    render(<ThemeControl />);
    await openMenu();
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(applied()).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
  });

  it("reacts to a system change only while set to System", async () => {
    render(<ThemeControl />);
    expect(applied()).toBe("light");
    systemDark = true;
    act(() => listeners.forEach(listener => listener()));
    expect(applied()).toBe("dark");

    await openMenu();
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    systemDark = false;
    act(() => listeners.forEach(listener => listener()));
    systemDark = true;
    act(() => listeners.forEach(listener => listener()));
    expect(applied()).toBe("light");
  });

  it("closes on Escape and returns focus to its button", async () => {
    render(<ThemeControl />);
    await openMenu();
    expect(screen.getByRole("radio", { name: "Light" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("radio", { name: "Light" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Theme:/ })).toHaveFocus();
  });

  it("ignores a saved value it doesn't recognise", () => {
    localStorage.setItem(THEME_KEY, "sepia");
    render(<ThemeControl />);
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
    expect(applied()).toBe("light");
  });
});

describe("the script that runs before first paint", () => {
  const run = () => new Function(THEME_SCRIPT)();

  it("uses the saved choice over the system", () => {
    systemDark = false;
    localStorage.setItem(THEME_KEY, "dark");
    run();
    expect(applied()).toBe("dark");
  });

  it("uses the system with no saved choice", () => {
    systemDark = true;
    run();
    expect(applied()).toBe("dark");
  });

  it("still sets a theme when storage is blocked", () => {
    systemDark = true;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    run();
    expect(applied()).toBe("dark");
  });
});
