import { MAX_DURATION_MINUTES, MAX_NUMBER, type Checkin, type CheckinInput, type Metric, type TodayCheckin, type TodayCheckinInput } from '@rhythm-health/contract';
import { apiGet, apiPost } from './api';
const path = (id: string) => `/api/experiments/${encodeURIComponent(id)}/checkins`;
export const listCheckins = (token: string, id: string) => apiGet<Checkin[]>(token, path(id), "Couldn't load your answers. Try again.");
export const saveCheckin = (token: string, id: string, input: CheckinInput) => apiPost<Checkin>(token, path(id), input, "Couldn't save your check-in. Your answers are kept; try again.");
export const getTodayCheckin = (token: string) => apiGet<TodayCheckin>(token, '/api/checkins/today', "Couldn't load today's check-in. Try again.");
export const saveTodayCheckin = (token: string, input: TodayCheckinInput) => apiPost<TodayCheckin>(token, '/api/checkins/today', input, "Couldn't save your check-in. Try again.");

/** Helps the person fix an answer before sending. The backend's validation is the real check. */
export function metricAnswer(metric: Metric, raw: string | boolean | undefined): { value: boolean | number } | { error: string } {
  if (metric.type === 'boolean') return typeof raw === 'boolean' ? { value: raw } : { error: 'Choose Yes or No.' };
  const text = typeof raw === 'string' ? raw.trim().replace(',', '.') : '';
  const number = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
  if (!Number.isFinite(number)) return { error: 'Enter an answer as a number.' };
  if (metric.type === 'scale' && (!Number.isInteger(number) || number < (metric.min ?? 1) || number > (metric.max ?? 10))) return { error: `Choose a whole number from ${metric.min ?? 1} to ${metric.max ?? 10}.` };
  if (metric.type === 'duration' && (number < 0 || number > MAX_DURATION_MINUTES)) return { error: `Enter minutes from 0 to ${MAX_DURATION_MINUTES}.` };
  if (Math.abs(number) > MAX_NUMBER) return { error: `Enter a number between -${MAX_NUMBER} and ${MAX_NUMBER}.` };
  return { value: number };
}
