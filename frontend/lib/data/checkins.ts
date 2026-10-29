import { apiGet, apiSend } from "@/lib/api/client";
import type { Checkin, CheckinInput } from "@/lib/types/api";

/** All check-ins for an owned experiment, oldest day first. */
export function listCheckins(experimentId: string): Promise<Checkin[]> {
  return apiGet(`/api/experiments/${encodeURIComponent(experimentId)}/checkins`, true);
}

/** Record today's check-in, or replace it if today's already exists. */
export function submitCheckin(experimentId: string, input: CheckinInput): Promise<Checkin> {
  return apiSend("POST", `/api/experiments/${encodeURIComponent(experimentId)}/checkins`, input);
}
