// Types for the FastAPI backend, mirroring backend/app/schemas/*.py field for field.
// Field names stay snake_case so responses can be used without mapping.

// ---- Profile (schemas/profile.py) ----

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export const ACTIVITY_LEVELS = ["sedentary", "lightly_active", "moderately_active", "very_active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** 24-hour local time, "HH:MM". */
export type ClockTime = string;

export type SleepSchedule = {
  bedtime: ClockTime;
  wake_time: ClockTime;
};

/** Backend limits on every text list (goals, habits, constraints). */
export const MAX_LIST_ITEMS = 20;
export const MAX_LIST_ITEM_LENGTH = 200;
/** usual_sleep_hours bounds. */
export const MIN_SLEEP_HOURS = 3;
export const MAX_SLEEP_HOURS = 14;

/** PUT /api/profile body (ProfileIn). No user_id: the backend takes it from the token. */
export type ProfileInput = {
  age_range: AgeRange;
  usual_sleep_hours: number;
  usual_sleep_schedule: SleepSchedule;
  activity_level: ActivityLevel;
  goals: string[];
  regular_habits: string[];
  constraints: string[];
};

/** GET/PUT /api/profile response (ProfileOut). GET is 404 until a profile exists. */
export type Profile = ProfileInput & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ---- Experiments (schemas/experiment.py, prediction.py, proposal.py, progress.py) ----

export const CATEGORIES = ["sleep", "energy", "focus", "exercise", "nutrition", "stress", "routine", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Classification = {
  category: Category;
  intent: "behavior_change" | "goal" | "question" | "other";
  risk: "low" | "review" | "blocked";
};

export type SafetyDecision = {
  allowed: boolean;
  /** When blocked: why. When allowed with risk "review": a caution to show. */
  reason: string | null;
  suggested_alternative: string | null;
};

export type Intervention = {
  action: string;
  timing: string;
  frequency: string;
};

export type Metric = {
  key: string;
  label: string;
  type: "scale" | "number" | "boolean" | "duration";
  /** Set for scale metrics, null otherwise. */
  min: number | null;
  max: number | null;
  primary: boolean;
};

export type SuccessCriteria = {
  primary_metric: string;
  minimum_change_percent: number;
};

export type ExperimentProposal = {
  question: string;
  hypothesis: string;
  intervention: Intervention;
  baseline_days: number;
  intervention_days: number;
  metrics: Metric[];
  success_criteria: SuccessCriteria;
};

export type Prediction = {
  target_metric: string;
  direction: "increase" | "decrease" | "no_change";
  /** Percent change in the target metric, as a range. */
  expected_change_min: number;
  expected_change_max: number;
  confidence: "low" | "moderate" | "high";
  reasoning: string;
  uncertainty_factors: string[];
};

/** POST /api/experiments/propose. `proposal` and `prediction` are null when safety blocks it. */
export type ProposeResponse = {
  proposal: ExperimentProposal | null;
  prediction: Prediction | null;
  safety: SafetyDecision;
  classification: Classification;
};

/** POST /api/experiments body: what propose returned, plus its category. */
export type SaveExperimentRequest = {
  proposal: ExperimentProposal;
  prediction: Prediction;
  category: Category;
};

export type ExperimentStatus = "draft" | "proposed" | "active" | "completed";

/** Computed by the backend on every read; never stored. */
export type ExperimentProgress = {
  state: "not_started" | "in_progress" | "ended" | "completed";
  /** Set only while in_progress. */
  day_number: number | null;
  phase: "baseline" | "intervention" | null;
  phase_day: number | null;
  phase_days: number | null;
  total_days: number;
  days_remaining: number | null;
  started_at: string | null;
  ends_at: string | null;
};

/** GET/POST /api/experiments responses (ExperimentOut). */
export type Experiment = ExperimentProposal & {
  id: string;
  status: ExperimentStatus;
  category: Category;
  prediction: Prediction;
  started_at: string | null;
  completed_at: string | null;
  is_seeded: boolean;
  progress: ExperimentProgress;
  created_at: string;
  updated_at: string;
};

// ---- Check-ins (schemas/checkin.py) ----

export type MetricValue = boolean | number;

/** POST /api/experiments/{id}/checkins body. Day, phase and ids come from the backend. */
export type CheckinInput = {
  /** Required on test (intervention) days; leave out on baseline days. */
  intervention_completed?: boolean | null;
  /** One value per metric key of the experiment, all required. */
  metric_values: Record<string, MetricValue>;
  /** Up to 500 characters. */
  note?: string | null;
};

/** A saved check-in. One per experiment day; sending again replaces today's. */
export type Checkin = {
  id: string;
  experiment_id: string;
  phase: "baseline" | "intervention";
  day_number: number;
  intervention_completed: boolean;
  metric_values: Record<string, MetricValue>;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export const MAX_NOTE_LENGTH = 500;
/** Backend bounds for non-scale metrics (services/checkins.py). */
export const MAX_DURATION_MINUTES = 24 * 60;
export const MAX_NUMBER = 1_000_000;

// ---- Analysis (schemas/analysis.py) ----

export type SignalClass = "likely_signal" | "possible_signal" | "unclear" | "probably_noise";

export type PhaseStats = {
  n: number;
  mean: number | null;
  median: number | null;
  /** Sample standard deviation; needs n >= 2. */
  sd: number | null;
};

export type Outlier = {
  phase: "baseline" | "intervention";
  day_number: number;
  value: number;
};

export type MetricAnalysis = {
  key: string;
  label: string;
  type: string;
  primary: boolean;
  baseline: PhaseStats;
  intervention: PhaseStats;
  /** Test-phase mean minus baseline mean. */
  absolute_change: number | null;
  /** Relative to the baseline mean. */
  percent_change: number | null;
  median_change_percent: number | null;
  pooled_sd: number | null;
  /** Signed Cohen's d: change in units of normal day-to-day variation. */
  effect_size: number | null;
  /** Share of test days on the same side of the baseline mean as the change. */
  direction_consistency: number | null;
  outliers: Outlier[];
};

export type Adherence = {
  baseline_days_planned: number;
  baseline_days_logged: number;
  intervention_days_planned: number;
  intervention_days_logged: number;
  intervention_days_completed: number;
  /** Completed / logged test days; null if none logged. */
  adherence_rate: number | null;
  /** Logged days / finished rolling days, including a logged in-progress day when finishing early. */
  coverage_rate: number;
  missing_days: number[];
};

export type PredictionComparison = {
  predicted_direction: "increase" | "decrease" | "no_change";
  predicted_min: number;
  predicted_max: number;
  predicted_midpoint: number;
  observed_change_percent: number;
  /** Observed minus midpoint, in percentage points. */
  error_points: number;
  within_predicted_range: boolean;
  direction_correct: boolean;
  /** 0–100: how close the forecast was. Not scientific confidence. */
  accuracy_percent: number;
};

/** Reason codes behind a classification, from services/analysis.py. */
export type SignalReason =
  | "insufficient_data"
  | "change_meets_success_criteria"
  | "change_below_success_criteria"
  | "consistent_direction"
  | "inconsistent_direction"
  | "larger_than_normal_variation"
  | "within_normal_variation"
  | "low_adherence"
  | "few_intervention_days"
  | "moved_opposite_to_prediction";

export type Signal = {
  classification: SignalClass;
  reasons: SignalReason[];
  success_criteria_met: boolean;
  matches_predicted_direction: boolean;
};

export type Analysis = {
  primary_metric: string;
  success_criteria_percent: number;
  adherence: Adherence;
  metrics: MetricAnalysis[];
  prediction: PredictionComparison | null;
  signal: Signal;
};

// ---- Lab Report (schemas/lab_report.py) ----

/** The AI-written part of the report. Its prose is never a source of numbers: use `analysis`. */
export type ReportNarrative = {
  summary: string;
  interpretation: string;
  personal_learnings: string[];
  confounders: string[];
  next_experiment: { question: string; reason: string };
};

export type ChartMetric = {
  key: string;
  label: string;
  type: string;
  min: number | null;
  max: number | null;
};

/** One planned day, logged or not. */
export type ChartPoint = {
  day: number;
  phase: string;
  logged: boolean;
  intervention_completed: boolean | null;
  /** The primary metric's value. */
  value: number | null;
  values: Record<string, MetricValue> | null;
  note: string | null;
};

/** The predicted range, in percent and in primary-metric units around the baseline mean. */
export type PredictedBand = {
  min_percent: number;
  max_percent: number;
  midpoint_percent: number;
  expected_value_min: number;
  expected_value_max: number;
};

export type ChartData = {
  primary_metric: ChartMetric;
  metrics: ChartMetric[];
  baseline_days: number;
  intervention_days: number;
  points: ChartPoint[];
  baseline_mean: number | null;
  intervention_mean: number | null;
  predicted_band: PredictedBand | null;
};

/** POST /complete, GET /report and POST /report. `narrative` is null until POST /report writes it. */
export type LabReport = {
  experiment: Experiment;
  analysis: Analysis;
  narrative: ReportNarrative | null;
  chart: ChartData;
  created_at: string;
};

/** The `detail` of a 409 from /complete when there aren't enough check-ins yet. */
export type NotEnoughCheckins = {
  message: string;
  baseline_checkins: number;
  baseline_required: number;
  intervention_checkins: number;
  intervention_required: number;
};
