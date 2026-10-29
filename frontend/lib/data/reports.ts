import { apiGet, apiSend, ApiError } from "@/lib/api/client";
import type { CompleteResponse, NotEnoughCheckins, Report } from "@/lib/types/api";

/** The experiment's Lab Report, or null if it hasn't been completed yet (the API answers 404). */
export async function getReport(experimentId: string): Promise<Report | null> {
  try {
    return await apiGet<Report>(`/api/experiments/${encodeURIComponent(experimentId)}/report`, true);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Run the analysis and mark the experiment completed. */
export function completeExperiment(experimentId: string): Promise<CompleteResponse> {
  return apiSend("POST", `/api/experiments/${encodeURIComponent(experimentId)}/complete`);
}

/** The check-in counts from a 409 "not enough check-ins", or null for any other error. */
export function notEnoughCheckins(error: unknown): NotEnoughCheckins | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const d = error.detail as Partial<NotEnoughCheckins> | null;
  return d && typeof d.baseline_required === "number" ? (d as NotEnoughCheckins) : null;
}
