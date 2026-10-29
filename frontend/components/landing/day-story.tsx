"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, useState, useSyncExternalStore } from "react";
import { HomeCta } from "@/components/home-cta";
import { Bedroom, Dinner, Glow, Hills, LAMPS, Layer, Moon, Office, SceneStill, Stars, Street, Sun, type StillKind } from "@/components/landing/scene-art";

/*
 * One example day, told by scrolling. The story is seven screen-high sections (less the fixed
 * header) over a sticky stage. Keyframes use "story positions": section i covers positions i..i+1, and the stage
 * shows positions 0.5 (top of the story) to 6.5 (bottom). The last frame matches the night
 * frame near the start, so the day reads as a cycle. Only opacity and transforms change.
 */

const SECTIONS = 7;
const toProgress = (position: number) => (position - 0.5) / (SECTIONS - 1);

type Scene = { id: string; time: string; title: string; body: string; still?: StillKind };

const SCENES: Scene[] = [
  {
    id: "night",
    time: "22:30 · Night",
    title: "Your sleep is the experiment.",
    body: "Ask one habit question. Rhythm turns it into a small experiment that changes one thing at a time, so you can tell what made the difference.",
    still: "night",
  },
  {
    id: "morning",
    time: "07:00 · Morning",
    title: "Check in in about 30 seconds.",
    body: "How did you sleep? How is your energy? Did you make the change? A few quick answers each morning, and the day is recorded.",
    still: "morning",
  },
  {
    id: "noon",
    time: "12:30 · Noon",
    title: "The prediction comes first.",
    body: "Before day one, Rhythm writes down what it expects, like “morning energy +8–15%”. It’s a range, not a promise, and it can’t change once you start.",
    still: "noon",
  },
  {
    id: "evening",
    time: "17:30 · Evening",
    title: "Late coffee, or none after 2 PM?",
    body: "Every experiment compares 3 normal days with 7 days of one small change. You live your day as usual; Rhythm keeps the evidence.",
    still: "evening",
  },
  {
    id: "night-again",
    time: "20:00 · Night again",
    title: "Does a walk after dinner help you sleep?",
    body: "At the end, your Lab Report puts the prediction next to what actually happened, and says honestly whether it looks like a likely signal or just noise.",
    still: "nightAgain",
  },
  {
    id: "tomorrow",
    time: "22:30 · Night",
    title: "Tomorrow is day 4.",
    body: "One small check-in a day adds up to an answer about you, not about people in general.",
  },
];

/** Where each set is shown, and the story positions where it is worth keeping mounted. */
const SETS = {
  bedroom: { keys: [0.5, 2.7, 2.95, 5.95, 6.15, 6.5], values: [1, 1, 0, 0, 1, 1], mount: [[0, 3.1], [5.75, 7]] },
  office: { keys: [2.8, 3.05, 3.85, 4.05], values: [0, 1, 1, 0], mount: [[2.6, 4.25]] },
  street: { keys: [3.9, 4.1, 4.95, 5.1, 5.5, 5.65, 5.95, 6.1], values: [0, 1, 1, 0, 0, 1, 1, 0], mount: [[3.7, 6.3]] },
  dinner: { keys: [4.95, 5.1, 5.5, 5.65], values: [0, 1, 1, 0], mount: [[4.75, 5.85]] },
} as const;

type SetId = keyof typeof SETS;

function mountedAt(position: number) {
  return (Object.keys(SETS) as SetId[])
    .filter(id => SETS[id].mount.some(([from, to]) => position >= from && position <= to))
    .join(" ");
}

function useKeyframes(progress: MotionValue<number>, keys: readonly number[], values: readonly number[]) {
  return useTransform(progress, keys.map(toProgress), [...values]);
}

function useUnit(progress: MotionValue<number>, keys: readonly number[], values: readonly number[], unit: string) {
  return useTransform(progress, keys.map(toProgress), values.map(v => `${v}${unit}`));
}

const subscribe = () => () => {};

export function DayStory() {
  const ref = useRef<HTMLDivElement>(null);
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const reduce = useReducedMotion();
  const animate = isClient && !reduce;

  return (
    <div ref={ref} className="relative">
      {/* Not a scroll anchor: its layers stay put while the page moves and mount as scenes change,
          so the browser must not use them to adjust the reader's scroll position. */}
      <div
        data-story-stage
        aria-hidden="true"
        className="sticky top-[var(--header-h)] h-[calc(100svh-var(--header-h))] w-full overflow-hidden bg-night [overflow-anchor:none] motion-reduce:hidden"
      >
        {animate && <Stage target={ref} />}
      </div>

      <div className="relative -mt-[calc(100svh-var(--header-h))] motion-reduce:mt-0">
        <StorySection first>
          <h1 className="font-display text-display-sm tracking-tight text-balance sm:text-display">
            Stop guessing what works for you.
            <span className="block text-muted">Test it.</span>
          </h1>
          <p className="mt-5 text-lead text-muted">
            Turn a habit question into a small personal experiment. Record your usual routine, test one
            change, then compare the forecast with what you observed.
          </p>
          <div className="mt-7"><HomeCta /></div>
          <p className="mt-6 border-t border-line pt-4 text-caption text-muted">
            An example day, illustrated. He&apos;s on day 3 of a 10-day experiment. Scroll to follow it.
          </p>
        </StorySection>

        {SCENES.map(scene => (
          <StorySection key={scene.id} labelledBy={`scene-${scene.id}`}>
            {scene.still && (
              <div className="mb-5 hidden overflow-hidden rounded-card motion-reduce:block">
                <SceneStill kind={scene.still} />
              </div>
            )}
            <p className="font-mono text-caption text-moss tabular-nums">{scene.time}</p>
            <h2 id={`scene-${scene.id}`} className="mt-2 font-display text-headline tracking-tight text-balance">
              {scene.title}
            </h2>
            <p className="mt-3 text-lead text-muted">{scene.body}</p>
            {scene.id === "tomorrow" && <div className="mt-6"><HomeCta /></div>}
          </StorySection>
        ))}
      </div>
    </div>
  );
}

function StorySection({ children, first = false, labelledBy }: { children: React.ReactNode; first?: boolean; labelledBy?: string }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`flex min-h-[calc(100svh-var(--header-h))] items-start lg:items-center motion-reduce:min-h-0 motion-reduce:py-6 ${first ? "pt-[max(1.5rem,6svh)] lg:pt-0 motion-reduce:pt-8" : "pt-[max(4.5rem,12svh)] lg:pt-0"}`}
    >
      {/* The card sits in the page frame, so it lines up with the header at every width. */}
      <div className="page-frame">
        <div className="w-full max-w-[34rem] rounded-card border border-line bg-paper/95 p-5 sm:p-7 motion-reduce:max-w-[40rem]">
          {children}
        </div>
      </div>
    </section>
  );
}

/** The illustrated stage, mounted only on the client and only when motion is welcome. */
function Stage({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress: p } = useScroll({ target, offset: ["start start", "end end"] });
  const [mounted, setMounted] = useState(() => mountedAt(0.5 + p.get() * (SECTIONS - 1)));
  useMotionValueEvent(p, "change", value => {
    const next = mountedAt(0.5 + value * (SECTIONS - 1));
    setMounted(current => (current === next ? current : next));
  });
  const has = (id: SetId) => mounted.split(" ").includes(id);

  // Sky and light.
  const night = useKeyframes(p, [0.5, 1.85, 2.35, 4.85, 5.15, 6.5], [1, 1, 0, 0, 1, 1]);
  const warm = useKeyframes(p, [0.5, 1.85, 2.2, 2.7, 3.05, 3.95, 4.3, 4.75, 5.1, 6.5], [0, 0, 0.55, 0.4, 0.1, 0.1, 0.7, 0.7, 0.15, 0]);
  const stars = useKeyframes(p, [0.5, 1.8, 2.15, 4.8, 5.2, 6.5], [1, 1, 0, 0, 1, 1]);
  const dark = useKeyframes(
    p,
    [0.5, 1.3, 1.5, 1.85, 2.3, 4.85, 5.1, 5.5, 5.6, 6.0, 6.2, 6.35, 6.5],
    [0.2, 0.2, 0.55, 0.55, 0, 0, 0.3, 0.3, 0.5, 0.5, 0.25, 0.55, 0.55],
  );
  const sunX = useUnit(p, [1.85, 2.6, 3.5, 4.6, 5.05], [12, 24, 50, 78, 86], "vw");
  const sunY = useUnit(p, [1.85, 2.6, 3.5, 4.6, 5.05], [78, 46, 12, 52, 80], "svh");
  const sunOpacity = useKeyframes(p, [1.8, 1.95, 4.9, 5.05], [0, 1, 1, 0]);
  const moonX = useUnit(p, [0.5, 1.6, 2.1, 2.2, 4.9, 6.5], [72, 72, 86, 30, 30, 72], "vw");
  const moonY = useUnit(p, [0.5, 1.6, 2.1, 4.9, 5.5, 6.5], [16, 16, 55, 55, 22, 16], "svh");
  const moonOpacity = useKeyframes(p, [0.5, 1.6, 2.1, 4.9, 5.3, 6.5], [1, 1, 0, 0, 1, 1]);

  // Lamps.
  const bedside = useKeyframes(p, [0.5, 1.3, 1.45, 6.0, 6.1, 6.3, 6.4], [1, 1, 0, 0, 1, 1, 0]);
  const pendant = useKeyframes(p, [5.0, 5.15, 5.5, 5.65], [0, 1, 1, 0]);
  const streetLamp = useKeyframes(p, [5.5, 5.65, 5.95, 6.1], [0, 1, 1, 0]);

  // Sets and poses.
  const bedroom = useKeyframes(p, SETS.bedroom.keys, SETS.bedroom.values);
  const office = useKeyframes(p, SETS.office.keys, SETS.office.values);
  const street = useKeyframes(p, SETS.street.keys, SETS.street.values);
  const dinner = useKeyframes(p, SETS.dinner.keys, SETS.dinner.values);
  const standPhone = useKeyframes(p, [0.5, 1.15, 1.3, 5.98, 6.05, 6.2, 6.3], [1, 1, 0, 0, 1, 1, 0]);
  const phoneDown = useTransform(standPhone, v => 1 - v);
  const lie = useKeyframes(p, [1.15, 1.3, 1.95, 2.05, 6.2, 6.3], [0, 1, 1, 0, 0, 1]);
  const sitUp = useKeyframes(p, [1.95, 2.05, 2.6, 2.7], [0, 1, 1, 0]);
  const standMug = useKeyframes(p, [2.6, 2.7, 3.0, 3.05], [0, 1, 1, 0]);
  const walkerX = useKeyframes(p, [3.9, 5.1, 5.2, 5.5, 6.1], [-110, 110, -110, -110, 110]);
  const withCup = useKeyframes(p, [5.1, 5.2], [1, 0]);
  const withoutCup = useKeyframes(p, [5.1, 5.2], [0, 1]);
  const stepA = useTransform(p, (v): number => (Math.sin((0.5 + v * (SECTIONS - 1)) * 48) > 0 ? 1 : 0));
  const stepB = useTransform(stepA, v => 1 - v);

  // Visible progress: day 3 until he goes to bed again, then day 4.
  const day3 = useKeyframes(p, [6.25, 6.35], [1, 0]);
  const day4 = useKeyframes(p, [6.25, 6.35], [0, 1]);

  return (
    <>
      <div data-sky="day" className="absolute inset-0 bg-oat" />
      <motion.div data-sky="warm" className="absolute inset-0 bg-sun" style={{ opacity: warm }} />
      <motion.div data-sky="night" className="absolute inset-0 bg-night" style={{ opacity: night }} />

      <motion.div className="absolute top-0 left-0 -mt-8 -ml-8 size-16" style={{ x: sunX, y: sunY, opacity: sunOpacity }}>
        <svg viewBox="0 0 64 64" className="size-full"><Sun cx={32} cy={32} r={30} /></svg>
      </motion.div>

      <Layer><Hills /></Layer>
      <div className="absolute inset-0 lg:left-[28%]">
        {has("bedroom") && (
          <motion.div data-scene="bedroom" className="absolute inset-0" style={{ opacity: bedroom }}>
            <Layer><Bedroom poses={{ standPhone, phoneDown, lie, sitUp, standMug }} /></Layer>
          </motion.div>
        )}
        {has("office") && (
          <motion.div data-scene="office" className="absolute inset-0" style={{ opacity: office }}>
            <Layer><Office /></Layer>
          </motion.div>
        )}
        {has("street") && (
          <motion.div data-scene="street" className="absolute inset-0" style={{ opacity: street }}>
            <Layer><Street walkerX={walkerX} step={[stepA, stepB]} evening={withCup} night={withoutCup} /></Layer>
          </motion.div>
        )}
        {has("dinner") && (
          <motion.div data-scene="dinner" className="absolute inset-0" style={{ opacity: dinner }}>
            <Layer><Dinner /></Layer>
          </motion.div>
        )}
      </div>

      <motion.div className="absolute inset-0 bg-night" style={{ opacity: dark }} />

      <motion.div className="absolute inset-0" style={{ opacity: stars }}>
        <Layer><Stars /></Layer>
      </motion.div>
      <motion.div className="absolute top-0 left-0 -mt-6 -ml-6 size-12" style={{ x: moonX, y: moonY, opacity: moonOpacity }}>
        <svg viewBox="0 0 48 48" className="size-full"><Moon cx={24} cy={24} r={20} /></svg>
      </motion.div>

      <div className="absolute inset-0 lg:left-[28%]">
        {has("bedroom") && <motion.div className="absolute inset-0" style={{ opacity: bedside }}><Layer><Glow {...LAMPS.bedside} /></Layer></motion.div>}
        {has("dinner") && <motion.div className="absolute inset-0" style={{ opacity: pendant }}><Layer><Glow {...LAMPS.pendant} /></Layer></motion.div>}
        {has("street") && <motion.div className="absolute inset-0" style={{ opacity: streetLamp }}><Layer><Glow {...LAMPS.street} /></Layer></motion.div>}
      </div>

      <div className="absolute right-[var(--gutter)] bottom-6 rounded-pill bg-paper/95 px-4 py-2">
        <DayStrip day={3} opacity={day3} />
        <DayStrip day={4} opacity={day4} overlay />
      </div>
    </>
  );
}

function DayStrip({ day, opacity, overlay = false }: { day: number; opacity: MotionValue<number>; overlay?: boolean }) {
  return (
    <motion.div className={`flex items-center gap-3 ${overlay ? "absolute inset-0 px-4 py-2" : ""}`} style={{ opacity }}>
      <span className="font-mono text-caption text-ink tabular-nums">Day {day} of 10</span>
      <span className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`size-2 rounded-pill ${i < day ? "bg-moss" : "bg-line"}`} />
        ))}
      </span>
    </motion.div>
  );
}
