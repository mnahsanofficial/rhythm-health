import type { components } from "./generated";
export type { components, paths, operations } from "./generated";

/** FastAPI response serialization includes default fields; requests retain schema optionality. */
type Serialized<T> = T extends readonly (infer U)[]
  ? Serialized<U>[]
  : T extends object
    ? { [K in keyof T]-?: Serialized<T[K]> }
    : T;

export type SleepSchedule = components["schemas"]["SleepSchedule"];
export type Classification = components["schemas"]["Classification"];
export type SafetyDecision = components["schemas"]["SafetyDecision"];
export type Intervention = components["schemas"]["Intervention"];
export type Metric = components["schemas"]["Metric"];
export type SuccessCriteria = components["schemas"]["SuccessCriteria"];
export type ExperimentProposal = components["schemas"]["ExperimentProposal"];
export type Prediction = components["schemas"]["Prediction"];
export type ProposeResponse = Serialized<components["schemas"]["ProposeResponse"]>;
export type SaveExperimentRequest = components["schemas"]["SaveExperimentRequest"];
export type ExperimentDay = components["schemas"]["ExperimentDay"];
export type ExperimentTimeline = Serialized<components["schemas"]["ExperimentTimeline"]>;
export type ExperimentProgress = Serialized<components["schemas"]["ExperimentProgress"]>;
export type PhaseStats = Serialized<components["schemas"]["PhaseStats"]>;
export type Outlier = components["schemas"]["Outlier"];
export type MetricAnalysis = Serialized<components["schemas"]["MetricAnalysis"]>;
export type Adherence = Serialized<components["schemas"]["Adherence"]>;
export type PredictionComparison = components["schemas"]["PredictionComparison"];
export type Signal = components["schemas"]["Signal"];
export type Analysis = Serialized<components["schemas"]["Analysis"]>;
export type ReportNarrative = components["schemas"]["ReportNarrative"];
export type ChartMetric = Serialized<components["schemas"]["ChartMetric"]>;
export type ChartPoint = Serialized<components["schemas"]["ChartPoint"]>;
export type PredictedBand = components["schemas"]["PredictedBand"];
export type ChartData = Serialized<components["schemas"]["ChartData"]>;
export type LabReport = Serialized<components["schemas"]["LabReport"]>;
export type ProfileInput = components["schemas"]["ProfileIn"];
export type Profile = Serialized<components["schemas"]["ProfileOut"]>;
export type Experiment = Serialized<components["schemas"]["ExperimentOut"]>;
export type CheckinInput = components["schemas"]["CheckinIn"];
export type Checkin = Serialized<components["schemas"]["CheckinOut"]>;

export type AgeRange = ProfileInput["age_range"];
export type ActivityLevel = ProfileInput["activity_level"];
export type ClockTime = SleepSchedule["bedtime"];
export type Category = Classification["category"];
export type ExperimentStatus = Experiment["status"];
export type MetricValue = CheckinInput["metric_values"][string];
export type SignalClass = Signal["classification"];
export type SignalReason = Signal["reasons"][number];

// Runtime form choices and bounds. Backend validation remains authoritative.
// Profile/check-in bounds: backend/app/schemas/{profile,checkin}.py.
// Number/duration limits are service rules, absent from OpenAPI: app/services/checkins.py.
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "lightly_active", "moderately_active", "very_active"] as const;
export const MAX_LIST_ITEMS = 20;
export const MAX_LIST_ITEM_LENGTH = 200;
export const MIN_SLEEP_HOURS = 3;
export const MAX_SLEEP_HOURS = 14;
export const CATEGORIES = ["sleep", "energy", "focus", "exercise", "nutrition", "stress", "routine", "other"] as const;
export const MAX_NOTE_LENGTH = 500;
export const MAX_DURATION_MINUTES = 24 * 60;
export const MAX_NUMBER = 1_000_000;

// POST /complete returns this 409 detail, but does not publish its schema in OpenAPI.
// Source: backend/app/api/reports.py. Keep explicit until Shakeb models error responses.
export type NotEnoughCheckins = {
  message: string;
  baseline_checkins: number;
  baseline_required: number;
  intervention_checkins: number;
  intervention_required: number;
};
