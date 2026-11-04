import type { ProfileInput } from '@rhythm-health/contract';
import { AGE_RANGES, ACTIVITY_LEVELS, MIN_SLEEP_HOURS, MAX_LIST_ITEMS, MAX_LIST_ITEM_LENGTH } from '@rhythm-health/contract';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createSecureSessionStorage } from './secure-session-storage';

export type Draft = Partial<ProfileInput>;
export const AGE_OPTIONS = AGE_RANGES.map(value => ({ value, label: value === '65+' ? '65 or over' : value.replace('-', '–') }));
export const ACTIVITY_OPTIONS = ACTIVITY_LEVELS.map((value, i) => ({ value,
  label: ['Mostly sitting', 'Lightly active', 'Moderately active', 'Very active'][i],
  hint: ['Desk-based, not much walking', 'Some walking most days', 'Exercise two or three times a week', 'Training or physical work most days'][i],
}));
export const GOALS = ['More energy in the morning', 'Better focus', 'Fall asleep faster', 'Fewer afternoon slumps', 'Calmer evenings', 'Move more during the day', 'Eat more vegetables', 'A steadier routine'];
export const HABITS = [
  { label: 'Morning workout', time: '07:00' }, { label: 'Coffee around 9am', time: '09:00' },
  { label: 'Veg at lunch', time: '12:30' }, { label: 'Lunch at my desk', time: '13:00' },
  { label: 'Coffee after 2pm', time: '14:30' }, { label: 'Afternoon nap', time: '15:30' },
  { label: 'Evening workout', time: '18:30' }, { label: 'Walk after dinner', time: '20:00' },
  { label: 'Late dinner', time: '21:30' }, { label: 'Phone in bed', time: null },
];
export const CONSTRAINTS = ["Can't exercise before work", 'Shift work', 'Young kids at home', 'Long commute', 'Travel a lot for work', 'No gym nearby', 'Little free time in the evening'];
export const QUESTIONS = [
  ['How old are you?', 'A range is enough.'],
  ['When do you sleep?', 'On a normal workday. Rough is fine.'],
  ['How much of that is sleep?', ''],
  ['How much do you move?', 'Roughly is fine.'],
  ['What do you want to improve?', 'Pick up to three.'],
  ['What do you do most days?', 'Pick any, or add your own.'],
  ['Anything limiting you?', 'Skip if nothing comes to mind.'],
];
export function minutes(time: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number); return h * 60 + m;
}
export function nightMinutes(draft: Draft): number | null {
  const bed = minutes(draft.usual_sleep_schedule?.bedtime ?? '');
  const wake = minutes(draft.usual_sleep_schedule?.wake_time ?? '');
  return bed === null || wake === null ? null : (wake - bed + 1440) % 1440;
}
export function plausible(draft: Draft) { const n = nightMinutes(draft); return n !== null && n >= 180 && n <= 840; }
export function maxSleep(draft: Draft) { return Math.min(12, Math.floor((nightMinutes(draft) ?? 0) / 30) / 2); }
export function suggestedSleep(draft: Draft) { return Math.max(MIN_SLEEP_HOURS, Math.min(12, Math.floor(((nightMinutes(draft) ?? 480) - 30) / 30) / 2)); }
export function duration(n: number) { return n % 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n / 60} h`; }
function validList(value: unknown, max: number) {
  return Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= MAX_LIST_ITEM_LENGTH);
}
export function toProfileInput(d: Draft): ProfileInput | null {
  if (!AGE_RANGES.includes(d.age_range!) || !ACTIVITY_LEVELS.includes(d.activity_level!) || !plausible(d)
    || typeof d.usual_sleep_hours !== 'number' || d.usual_sleep_hours < MIN_SLEEP_HOURS || d.usual_sleep_hours > maxSleep(d)
    || !validList(d.goals, 3) || !d.goals?.length || !validList(d.regular_habits ?? [], MAX_LIST_ITEMS) || !validList(d.constraints ?? [], MAX_LIST_ITEMS)) return null;
  return { age_range: d.age_range!, usual_sleep_schedule: d.usual_sleep_schedule!, usual_sleep_hours: d.usual_sleep_hours,
    activity_level: d.activity_level!, goals: d.goals, regular_habits: d.regular_habits ?? [], constraints: d.constraints ?? [] };
}
export function habitTime(label: string, d: Draft) {
  const habit = HABITS.find(h => h.label === label);
  if (!habit) return null;
  if (habit.time) return habit.time;
  const bed = minutes(d.usual_sleep_schedule?.bedtime ?? '');
  if (bed === null) return null;
  const n = (bed - 30 + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
export type StoredDraft = { draft: Draft; step: number; editing: boolean };
const preview = new Map<string, string>();
const storage = Platform.OS === 'web' ? {
  getItem: async (key: string) => preview.get(key) ?? null,
  setItem: async (key: string, value: string) => { preview.set(key, value); },
  removeItem: async (key: string) => { preview.delete(key); },
} : createSecureSessionStorage(SecureStore);
const key = (owner: string) => `rhythm.onboarding.${owner}`;
export async function readDraft(owner: string): Promise<StoredDraft | null> {
  const raw = await storage.getItem(key(owner));
  if (!raw) return null;
  const data = JSON.parse(raw) as StoredDraft;
  if (!data || !Number.isInteger(data.step) || data.step < 0 || data.step > 8 || typeof data.editing !== 'boolean'
    || !data.draft || typeof data.draft !== 'object' || Array.isArray(data.draft)) throw new Error("Couldn't read your saved setup.");
  // A draft is device data, not a trusted API payload. Reject corrupted fields before rendering.
  const d = data.draft;
  if ((d.age_range !== undefined && !AGE_RANGES.includes(d.age_range))
    || (d.activity_level !== undefined && !ACTIVITY_LEVELS.includes(d.activity_level))
    || (d.usual_sleep_hours !== undefined && (typeof d.usual_sleep_hours !== 'number' || !Number.isFinite(d.usual_sleep_hours)))
    || (d.usual_sleep_schedule !== undefined && (!d.usual_sleep_schedule || typeof d.usual_sleep_schedule.bedtime !== 'string' || typeof d.usual_sleep_schedule.wake_time !== 'string'))
    || [d.goals, d.regular_habits, d.constraints].some(v => v !== undefined && !validList(v, MAX_LIST_ITEMS))) throw new Error("Couldn't read your saved setup.");
  return data;
}
export const writeDraft = (owner: string, data: StoredDraft) => storage.setItem(key(owner), JSON.stringify(data));
export const clearDraft = (owner: string) => storage.removeItem(key(owner));
