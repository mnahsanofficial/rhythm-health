import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RhythmRing } from "@/components/rhythm-ring";
import { minutesBetween } from "@/lib/rhythm/time";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  ...await (async () => {
    const React = await import("react");
    const components = new Map<string, React.ComponentType<Record<string, unknown>>>();
    class TestMotionValue<T> {
      constructor(private value: T, private transform?: (value: T) => unknown) {}
      get() { return this.transform ? this.transform(this.value) : this.value; }
      jump(value: T) { this.value = value; }
    }
    const motion = new Proxy({}, {
      get: (_target, key) => {
        const tag = String(key);
        if (!components.has(tag)) {
          const Component = React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
            const domProps = { ...props };
            delete domProps.animate;
            delete domProps.exit;
            delete domProps.initial;
            delete domProps.transition;
            delete domProps.viewport;
            const child = props.children;
            const content = child instanceof TestMotionValue ? child.get() : child;
            return React.createElement(tag, { ...domProps, ref }, content as React.ReactNode);
          });
          Component.displayName = `Motion(${tag})`;
          components.set(tag, Component);
        }
        return components.get(tag);
      },
    });

    return {
      AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
      animate: () => ({ stop() {} }),
      motion,
      useInView: () => true,
      useMotionValue: <T,>(initial: T) => React.useRef(new TestMotionValue(initial)).current,
      useReducedMotion: () => false,
      useTransform: <T, U,>(value: TestMotionValue<T>, transform: (value: T) => U) =>
        React.useMemo(() => new TestMotionValue(value.get() as T, transform), [value, transform]),
    };
  })(),
}));

describe("RhythmRing sleep duration", () => {
  it.each([
    { bedtime: "23:30", wake_time: "07:00", sleepHours: 7.5, expectedInBed: 450 },
    { bedtime: "01:00", wake_time: "08:00", sleepHours: 7, expectedInBed: 420 },
  ])("shows the same sleep duration from $bedtime to $wake_time", ({ bedtime, wake_time, sleepHours, expectedInBed }) => {
    expect(minutesBetween(bedtime, wake_time)).toBe(expectedInBed);

    render(
      <RhythmRing
        schedule={{ bedtime, wake_time }}
        sleepHours={sleepHours}
        habits={[]}
      />,
    );

    const ring = screen.getByRole("img", { name: new RegExp(`about ${sleepHours} hours`) });
    expect(ring).toHaveTextContent(`${sleepHours} h`);
  });
});
