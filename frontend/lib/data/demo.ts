import { apiSend } from "@/lib/api/client";
import type { Experiment, Report } from "@/lib/types/api";

/** The proposed B1 response from POST /api/demo/reset. */
export type DemoResetResponse = {
  experiment: Experiment;
  report: Report;
};

/** Prepare the authenticated user's seeded completed experiment. */
export function resetDemo(): Promise<DemoResetResponse> {
  return apiSend("POST", "/api/demo/reset", {});
}
