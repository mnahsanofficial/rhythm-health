import { apiSend } from "@/lib/api/client";
import type { Experiment, LabReport } from "@rhythm-health/contract";

/** Prepare the signed-in user's seeded completed experiment. B1: returns its bare LabReport. */
export function resetDemo(): Promise<LabReport> {
  return apiSend("POST", "/api/demo/reset", {});
}

export function startActiveSample(): Promise<Experiment> {
  return apiSend("POST", "/api/demo/active", {});
}

export function removeSample(id: string): Promise<{ removed: boolean }> {
  return apiSend("POST", `/api/demo/active/${encodeURIComponent(id)}/remove`, { confirmed: true });
}
