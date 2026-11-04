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
