import type { IconName } from '../icons';

/** The picture's own coordinates. All of this is drawing: nothing here decides or reports a health number. */
export const SCENE = { width: 390, height: 260 };
export const RING = { cx: 195, cy: 130, r: 92 };
export const RING_LENGTH = 2 * Math.PI * RING.r;
const DAY = 24 * 60;

/** A time of day on the ring, with midnight at the top and noon at the bottom. */
export function marker(minutes: number, radius = RING.r) {
  const angle = minutes / DAY * Math.PI * 2;
  return { x: RING.cx + radius * Math.sin(angle), y: RING.cy - radius * Math.cos(angle) };
}
/** The shape of an experiment around the ring: 3 baseline days, then 7 test days, clockwise from the top, with a small gap. */
export const PLAN_DAYS = Array.from({ length: 10 }, (_, day) => {
  const point = (share: number) => {
    const angle = share * Math.PI * 2;
    return `${(RING.cx + RING.r * Math.sin(angle)).toFixed(2)} ${(RING.cy - RING.r * Math.cos(angle)).toFixed(2)}`;
  };
  const gap = 0.006;
  return { phase: day < 3 ? 'baseline' as const : 'test' as const, d: `M ${point(day / 10 + gap)} A ${RING.r} ${RING.r} 0 0 1 ${point((day + 1) / 10 - gap)}` };
});
/** One day of a plan of any length, on the same ring. */
export function dayArc(index: number, total: number) {
  const point = (share: number) => {
    const angle = share * Math.PI * 2;
    return `${(RING.cx + RING.r * Math.sin(angle)).toFixed(2)} ${(RING.cy - RING.r * Math.cos(angle)).toFixed(2)}`;
  };
  const gap = 0.06 / total;
  return `M ${point(index / total + gap)} A ${RING.r} ${RING.r} 0 0 1 ${point((index + 1) / total - gap)}`;
}
export const arcFraction = (minutes: number) => Math.min(Math.max(minutes / DAY, 0), 1);
export const stepDirection = (from: number, to: number) => Math.sign(to - from);

/** About a third of the screen. Review keeps it small for its rows, Limits for its list, and short phones get less. */
export function sceneHeight(windowHeight: number, step: number) {
  if (step === 8) return Math.round(windowHeight * 0.17);
  if (step === 7) return Math.round(windowHeight * 0.22);
  if (windowHeight < 700) return Math.round(windowHeight * 0.24);
  // Steps with few controls take the most room, so the screen stays full.
  return Math.round(windowHeight * (step === 0 || step === 3 ? 0.35 : step === 1 ? 0.33 : 0.3));
}

const GOAL_ICONS: Record<string, IconName> = {
  'More energy in the morning': 'sunrise', 'Better focus': 'focus', 'Fall asleep faster': 'sleep', 'Fewer afternoon slumps': 'coffee',
  'Calmer evenings': 'sleep', 'Move more during the day': 'walk', 'Eat more vegetables': 'greens', 'A steadier routine': 'habits',
};
const HABIT_ICONS: [RegExp, IconName][] = [
  [/coffee/i, 'coffee'], [/workout|walk/i, 'walk'], [/veg/i, 'greens'], [/lunch|dinner/i, 'plate'], [/nap/i, 'sleep'], [/phone/i, 'phone'],
];
export const goalIcon = (goal: string): IconName => GOAL_ICONS[goal] ?? 'spark';
export const habitIcon = (habit: string): IconName => HABIT_ICONS.find(([pattern]) => pattern.test(habit))?.[1] ?? 'spark';
