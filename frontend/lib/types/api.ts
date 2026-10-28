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
