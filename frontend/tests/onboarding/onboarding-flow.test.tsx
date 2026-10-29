import { MotionConfig } from "motion/react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { saveProfile } from "@/lib/data/profile";
import type { ProfileInput } from "@/lib/types/api";
import { profile } from "../support/fixtures";

const { getProfileMock, saveProfileMock, sessionState } = vi.hoisted(() => ({
  getProfileMock: vi.fn(),
  saveProfileMock: vi.fn(),
  sessionState: { session: null as null | { user: { email: string } }, loading: false },
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState }));
vi.mock("@/lib/data/profile", () => ({ getProfile: getProfileMock, saveProfile: saveProfileMock }));
vi.mock("@/components/rhythm-ring", () => ({ RhythmRing: () => null }));
vi.mock("motion/react", async () => {
  const React = await import("react");
  const components = new Map<string, React.ComponentType<Record<string, unknown>>>();
  const ignoredMotionProps = new Set([
    "animate",
    "custom",
    "exit",
    "initial",
    "layout",
    "layoutId",
    "onUpdate",
    "transition",
    "variants",
    "viewport",
    "whileFocus",
    "whileHover",
    "whileInView",
    "whileTap",
  ]);
  const motion = new Proxy(
    {},
    {
      get: (_target, element) => {
        const tag = String(element);
        if (!components.has(tag)) {
          const component = React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
            const domProps = Object.fromEntries(
              Object.entries(props).filter(([key]) => !ignoredMotionProps.has(key)),
            );
            return React.createElement(tag, { ...domProps, ref }, props.children as React.ReactNode);
          });
          component.displayName = `Motion(${tag})`;
          components.set(tag, component);
        }
        return components.get(tag);
      },
    },
  );
  const passThrough = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    motion,
    AnimatePresence: passThrough,
    MotionConfig: passThrough,
    useInView: () => true,
    useReducedMotion: () => true,
  };
});

function renderFlow() {
  return render(
    <MotionConfig reducedMotion="always">
      <OnboardingFlow />
    </MotionConfig>,
  );
}

function completeDraft(): ProfileInput {
  return {
    age_range: "25-34",
    usual_sleep_hours: 7.5,
    usual_sleep_schedule: { bedtime: "22:30", wake_time: "06:30" },
    activity_level: "lightly_active",
    goals: ["More energy in the morning"],
    regular_habits: ["Coffee"],
    constraints: ["Long commute"],
  };
}

beforeEach(() => {
  window.localStorage.clear();
  sessionState.session = null;
  sessionState.loading = false;
  getProfileMock.mockResolvedValue(null);
  saveProfileMock.mockResolvedValue(profile);
});

describe("onboarding flow", () => {
  it("validates required answers, shows progress, and keeps answers when going back", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByRole("heading", { name: "How old are you?" })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Setup progress" })).toHaveAttribute(
      "aria-valuetext",
      "Question 1 of 7",
    );

    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "25–34" }));
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

    expect(await screen.findByRole("heading", { name: "When do you usually sleep?" })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Setup progress" })).toHaveAttribute(
      "aria-valuetext",
      "Question 2 of 7",
    );
    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
    await user.type(screen.getByLabelText("Bedtime"), "22:30");
    await user.type(screen.getByLabelText("Wake time"), "06:30");
    const scheduleContinue = screen.getByRole("button", { name: "Continue" });
    expect(scheduleContinue).toBeEnabled();
    await user.click(scheduleContinue);

    expect(await screen.findByRole("heading", { name: "How much of that is actual sleep?" })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Setup progress" })).toHaveAttribute(
      "aria-valuetext",
      "Question 3 of 7",
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "When do you usually sleep?" })).toBeVisible();
    expect(screen.getByLabelText("Bedtime")).toHaveValue("22:30");
    expect(screen.getByLabelText("Wake time")).toHaveValue("06:30");

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "How old are you?" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "25–34" })).toBeChecked();
    expect(screen.getByRole("progressbar", { name: "Setup progress" })).toHaveAttribute(
      "aria-valuetext",
      "Question 1 of 7",
    );
  });

  it("requires activity and a goal, while letting the user skip optional habits and constraints", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByRole("heading", { name: "How old are you?" })).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "18–24" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Bedtime"), "22:30");
    await user.type(screen.getByLabelText("Wake time"), "06:30");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "How much do you move on a typical day?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Lightly active/ }));
    const activityContinue = screen.getByRole("button", { name: "Continue" });
    await user.click(activityContinue);

    expect(await screen.findByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "More energy in the morning" }));
    const goalsContinue = screen.getByRole("button", { name: "Continue" });
    await user.click(goalsContinue);

    expect(await screen.findByRole("heading", { name: "What do you already do most days?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(await screen.findByRole("heading", { name: "Anything that limits what you can change?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(await screen.findByRole("heading", { name: /Here's your rhythm/ })).toBeVisible();
    expect(screen.getByText("More energy in the morning")).toBeVisible();
  });

  it("saves the completed answers from the summary and confirms success", async () => {
    const draft = completeDraft();
    sessionState.session = { user: { email: "test@example.invalid" } };
    window.localStorage.setItem("rhythm.onboarding.draft", JSON.stringify({ step: 8, draft }));
    const user = userEvent.setup();
    renderFlow();

    expect(await screen.findByRole("heading", { name: /Here's your rhythm/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save my rhythm" }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledWith(draft));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
    expect(within(screen.getByRole("status")).getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });
});
