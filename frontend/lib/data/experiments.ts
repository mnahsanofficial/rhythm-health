import { apiGet, apiSend } from "@/lib/api/client";
import type { Experiment, ExperimentStatus, ProposeResponse, SaveExperimentRequest } from "@rhythm-health/contract";

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
