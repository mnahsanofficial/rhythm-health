import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RhythmRing } from "@/components/rhythm-ring";

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async importOriginal => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useReducedMotion: () => preference.reduced,
  useInView: () => false,
}));

it("hydrates habit markers when the browser requests reduced motion", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = <RhythmRing schedule={{ bedtime: "23:30", wake_time: "07:00" }} sleepHours={7.5} habits={[{ label: "Coffee", time: "09:00" }]} />;
  preference.reduced = false; // The server cannot know the browser's media preference.
  const container = document.createElement("div");
  container.innerHTML = renderToString(view);
  document.body.append(container);
  preference.reduced = true;
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(container, view); });
    expect(error.mock.calls.flat().join(" ")).not.toMatch(/hydration|didn't match|did not match/i);
    expect(container.querySelector("svg")).toHaveAccessibleName(/about 7.5 hours/);
  } finally {
    await act(async () => root?.unmount());
    container.remove();
    error.mockRestore();
  }
});
