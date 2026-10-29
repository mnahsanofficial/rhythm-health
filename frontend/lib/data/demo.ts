import { apiSend } from "@/lib/api/client";
import type { LabReport } from "@/lib/types/api";

/** Prepare the signed-in user's seeded completed experiment. B1: returns its bare LabReport. */
export function resetDemo(): Promise<LabReport> {
  return apiSend("POST", "/api/demo/reset", {});
}
