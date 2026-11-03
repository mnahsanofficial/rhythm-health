import type { Checkin, CheckinInput, TodayCheckin, TodayCheckinInput } from '@rhythm-health/contract';
import { apiGet, apiPost } from './api';
const path = (id: string) => `/api/experiments/${encodeURIComponent(id)}/checkins`;
export const listCheckins = (token: string, id: string) => apiGet<Checkin[]>(token, path(id), "Couldn't load your answers. Try again.");
export const saveCheckin = (token: string, id: string, input: CheckinInput) => apiPost<Checkin>(token, path(id), input, "Couldn't save your check-in. Your answers are kept; try again.");
export const getTodayCheckin = (token: string) => apiGet<TodayCheckin>(token, '/api/checkins/today', "Couldn't load today's check-in. Try again.");
export const saveTodayCheckin = (token: string, input: TodayCheckinInput) => apiPost<TodayCheckin>(token, '/api/checkins/today', input, "Couldn't save your check-in. Try again.");
