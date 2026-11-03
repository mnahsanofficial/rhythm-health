import { apiGet, apiSend } from "@/lib/api/client";
import type { Checkin, CheckinInput, TodayCheckin, TodayCheckinInput } from "@rhythm-health/contract";

/** All check-ins for an owned experiment, oldest day first. */
export function listCheckins(experimentId: string): Promise<Checkin[]> {
  return apiGet(`/api/experiments/${encodeURIComponent(experimentId)}/checkins`, true);
}

/** Record today's check-in, or replace it if today's already exists. */
export function submitCheckin(experimentId: string, input: CheckinInput): Promise<Checkin> {
  return apiSend("POST", `/api/experiments/${encodeURIComponent(experimentId)}/checkins`, input);
}

/** Everything due today across running experiments, with shared questions combined by the backend. */
export function getTodayCheckin(): Promise<TodayCheckin> {
  return apiGet("/api/checkins/today", true);
}

/** Record or replace today's check-in for all of them: all saved or none. */
export function saveTodayCheckin(input: TodayCheckinInput): Promise<TodayCheckin> {
  return apiSend("POST", "/api/checkins/today", input);
}
