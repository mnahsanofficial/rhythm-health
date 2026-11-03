import { ApiError, apiGet, apiSend } from "@/lib/api/client";
import type { ActiveCapacity, Experiment, ExperimentTimeline, ExperimentStatus, ProposeResponse, SaveExperimentRequest } from "@rhythm-health/contract";

export function proposeExperiment(question: string): Promise<ProposeResponse> {
  return apiSend("POST", "/api/experiments/propose", { question });
}

export function saveExperiment(input: SaveExperimentRequest): Promise<Experiment> {
  return apiSend("POST", "/api/experiments", input);
}

export function startExperiment(id: string): Promise<Experiment> {
  return apiSend("POST", `/api/experiments/${encodeURIComponent(id)}/start`);
}

export function getExperiment(id: string): Promise<Experiment> {
  return apiGet(`/api/experiments/${encodeURIComponent(id)}`, true);
}

export function listExperiments(status?: ExperimentStatus): Promise<Experiment[]> {
  return apiGet(`/api/experiments${status ? `?status=${status}` : ""}`, true);
}

/** The backend owns the limit; screens only show what it says. */
export function getActiveCapacity(): Promise<ActiveCapacity> {
  return apiGet("/api/experiments/capacity", true);
}

export function isActiveLimitReached(error: unknown): error is ApiError {
  return error instanceof ApiError && typeof error.detail === "object" && error.detail !== null
    && "code" in error.detail && error.detail.code === "active_limit_reached";
}

/** Backend-owned rolling days, counts and timeline states for web and mobile. */
export function getExperimentProgress(id: string): Promise<ExperimentTimeline> {
  return apiGet(`/api/experiments/${encodeURIComponent(id)}/progress`, true);
}
