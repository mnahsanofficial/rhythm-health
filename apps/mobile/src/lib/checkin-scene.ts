import { MOTION_DURATION_MS } from '@rhythm-health/brand';
import type { Metric } from '@rhythm-health/contract';
import { metricAnswer } from './checkins';

export type ChangeIcon = 'shoe' | 'cup' | 'window' | 'moon' | 'ring';
export type CheckinSceneChoice = { kind: 'sun' | 'night' | 'moon-arc' | 'ring' | 'days' } | { kind: 'change'; icon: ChangeIcon };
type SceneStep = { kind: 'change'; action: string } | { kind: 'metric'; metric: Metric };

export const SCENE_MOVE_MS = MOTION_DURATION_MS.response;
export const SCENE_HOLD_MS = MOTION_DURATION_MS.step;
/** A tap's whole wait before the next question: the scene moves to the value, then holds so you can see it. */
export const CHECKIN_ADVANCE_MS = SCENE_MOVE_MS + SCENE_HOLD_MS;
/** The furthest an unbounded minutes answer moves the moon. Drawing only: it's never saved or shown as a number. */
const MINUTES_ON_ARC = 60;

/** More of these is worse, so a brighter scene would say the opposite of the answer. They get the neutral day ring. */
const MORE_IS_WORSE = /\b(crash\w*|slump\w*|tired\w*|fatigue\w*|sleepiness|drowsi\w*|groggi\w*|stress\w*|anxi\w*|pain\w*|ache\w*|restless\w*|craving\w*)\b/;
const MINUTES = /\b(minutes?|mins?|time to|asleep)\b/;
const ENERGY = /\b(energy|energi[sz]ed|alert|alertness|awake|vitality|refreshed)\b/;
const SLEEP = /\b(sleep|rest|rested|restful|restfulness)\b/;
const FOCUS = /\b(focus|focused|concentration|attention|clarity|mood)\b/;
const SHOE = /\b(walk\w*|steps?|stairs|run|running|jog\w*|stroll\w*|hike\w*)\b/;
const CUP = /\b(coffee|caffeine|tea|cups?|espresso|water|drink\w*)\b/;
const BEDTIME = /\b(bed|bedtime|sleep\w*|asleep|nap\w*|wind down)\b/;
const WINDOW = /\b(sunrise|sunlight|sun|daylight|light|window|curtains?|outside|outdoors)\b/;

const words = (metric: Metric) => `${metric.key} ${metric.label}`.toLowerCase().replace(/_/g, ' ');

/** Which picture a check-in question gets, from what the API already returns about it. */
export function sceneFor(step: SceneStep): CheckinSceneChoice {
  if (step.kind === 'change') {
    const action = step.action.toLowerCase();
    return { kind: 'change', icon: SHOE.test(action) ? 'shoe' : CUP.test(action) ? 'cup' : WINDOW.test(action) ? 'window' : BEDTIME.test(action) ? 'moon' : 'ring' };
  }
  const { metric } = step;
  const text = words(metric);
  if (MORE_IS_WORSE.test(text)) return { kind: 'days' };
  if (metric.type === 'duration' || (metric.type !== 'boolean' && MINUTES.test(text))) return { kind: 'moon-arc' };
  if (ENERGY.test(text)) return { kind: 'sun' };
  if (SLEEP.test(text)) return { kind: 'night' };
  if (FOCUS.test(text)) return { kind: 'ring' };
  return { kind: 'days' };
}

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/** How far the answer moves the picture, from 0 to 1. Null means nothing has been answered yet. */
export function sceneLevel(step: SceneStep, value: string | boolean | undefined): number | null {
  if (value === undefined || value === '') return null;
  if (step.kind === 'change') return value === true ? 1 : 0;
  const { metric } = step;
  const answer = metricAnswer(metric, value);
  if ('error' in answer) return null;
  if (typeof answer.value === 'boolean') return answer.value ? 1 : 0;
  if (sceneFor(step).kind === 'moon-arc') return clamp(1 - answer.value / (metric.max ?? MINUTES_ON_ARC));
  const min = metric.min ?? (metric.type === 'scale' ? 1 : null), max = metric.max ?? (metric.type === 'scale' ? 10 : null);
  if (min === null || max === null || max === min) return null;
  return clamp((answer.value - min) / (max - min));
}
