import { apiSend } from "@/lib/api/client";
import type { LabReport } from "@rhythm-health/contract";

/** Prepare the signed-in user's seeded completed experiment. B1: returns its bare LabReport. */
export function resetDemo(): Promise<LabReport> {
  return apiSend("POST", "/api/demo/reset", {});
}
