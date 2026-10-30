import type {
  ChartPoint,
  Experiment,
  ExperimentProposal,
  LabReport,
  Prediction,
  Profile,
  ProfileInput,
  ProposeResponse,
  SaveExperimentRequest,
} from "@rhythm-health/contract";

export const profileInput: ProfileInput = {
  age_range: "25-34",
  usual_sleep_hours: 8,
  usual_sleep_schedule: { bedtime: "23:30", wake_time: "07:30" },
  activity_level: "lightly_active",
  goals: ["better morning energy"],
  regular_habits: ["coffee around 9 AM"],
  constraints: ["cannot exercise before work"],
};

export const profile: Profile = {
  ...profileInput,
  id: "22222222-2222-2222-2222-222222222222",
  created_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
};

export const proposal: ExperimentProposal = {
  question: "Does a 20-minute walk after dinner improve my morning energy?",
  hypothesis: "Light evening activity may improve next-morning energy.",
  intervention: {
    action: "Walk for 20 minutes",
    timing: "Within one hour after dinner",
    frequency: "daily",
  },
  baseline_days: 3,
  intervention_days: 7,
  metrics: [
    { key: "morning_energy", label: "Morning energy", type: "scale", min: 1, max: 10, primary: true },
    { key: "sleep_quality", label: "Sleep quality", type: "scale", min: 1, max: 10, primary: false },
  ],
  success_criteria: { primary_metric: "morning_energy", minimum_change_percent: 10 },
};

export const prediction: Prediction = {
  target_metric: "morning_energy",
  direction: "increase",
  expected_change_min: 8,
  expected_change_max: 15,
  confidence: "moderate",
  reasoning: "Adds light movement without reducing sleep.",
  uncertainty_factors: ["bedtime consistency", "caffeine timing"],
};

export const proposeResponse: ProposeResponse = {
  proposal,
  prediction,
  safety: { allowed: true, reason: null, suggested_alternative: null },
  classification: { category: "energy", intent: "behavior_change", risk: "low" },
};

export const saveExperimentRequest: SaveExperimentRequest = {
  proposal,
  prediction,
  category: "energy",
};

export const experiment: Experiment = {
  ...proposal,
  id: "33333333-3333-3333-3333-333333333333",
  status: "proposed",
  category: "energy",
  prediction,
  started_at: null,
  completed_at: null,
  is_seeded: false,
  progress: {
    state: "not_started",
    day_number: null,
    phase: null,
    phase_day: null,
    phase_days: null,
    total_days: 10,
    days_remaining: null,
    started_at: null,
    ends_at: null,
  },
  created_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
};

// ---- Lab Report (backend schemas/lab_report.py) ----

const energy = [5, 6, 5, 6, 6, 7, 6, 7, 6, 7];
const sleep = [6, 7, 6, 7, 7, 7, 8, 7, 7, 8];

export const completedExperiment: Experiment = {
  ...experiment,
  status: "completed",
  started_at: "2026-10-18T08:00:00Z",
  completed_at: "2026-10-28T09:00:00Z",
  progress: {
    state: "completed",
    day_number: null,
    phase: null,
    phase_day: null,
    phase_days: null,
    total_days: 10,
    days_remaining: 0,
    started_at: "2026-10-18T08:00:00Z",
    ends_at: "2026-10-28T08:00:00Z",
  },
};

const chartPoints: ChartPoint[] = energy.map((value, i) => {
  const day = i + 1;
  const phase = day <= 3 ? "baseline" : "intervention";
  return {
    day,
    phase,
    logged: true,
    intervention_completed: phase === "intervention" && day !== 6,
    value,
    values: { morning_energy: value, sleep_quality: sleep[i] },
    note: day === 6 ? "Late dinner, skipped the walk." : null,
  };
});

/** What POST /complete and GET /report return before the narrative is written. */
export const labReport: LabReport = {
  experiment: completedExperiment,
  analysis: {
    primary_metric: "morning_energy",
    success_criteria_percent: 10,
    adherence: {
      baseline_days_planned: 3,
      baseline_days_logged: 3,
      intervention_days_planned: 7,
      intervention_days_logged: 7,
      intervention_days_completed: 6,
      adherence_rate: 0.857,
      coverage_rate: 1,
      missing_days: [],
    },
    metrics: [
      {
        key: "morning_energy", label: "Morning energy", type: "scale", primary: true,
        baseline: { n: 3, mean: 5.333, median: 5, sd: 0.577 },
        intervention: { n: 7, mean: 6.429, median: 6, sd: 0.535 },
        absolute_change: 1.095, percent_change: 20.5, median_change_percent: 20,
        pooled_sd: 0.547, effect_size: 2, direction_consistency: 1, outliers: [],
      },
      {
        key: "sleep_quality", label: "Sleep quality", type: "scale", primary: false,
        baseline: { n: 3, mean: 6.333, median: 6, sd: 0.577 },
        intervention: { n: 7, mean: 7.286, median: 7, sd: 0.488 },
        absolute_change: 0.952, percent_change: 15, median_change_percent: 16.7,
        pooled_sd: 0.512, effect_size: 1.86, direction_consistency: 1, outliers: [],
      },
    ],
    prediction: {
      predicted_direction: "increase",
      predicted_min: 8,
      predicted_max: 15,
      predicted_midpoint: 11.5,
      observed_change_percent: 20.5,
      error_points: 9,
      within_predicted_range: false,
      direction_correct: true,
      accuracy_percent: 61,
    },
    signal: {
      classification: "likely_signal",
      reasons: ["change_meets_success_criteria", "consistent_direction", "larger_than_normal_variation"],
      success_criteria_met: true,
      matches_predicted_direction: true,
    },
  },
  narrative: null,
  chart: {
    primary_metric: { key: "morning_energy", label: "Morning energy", type: "scale", min: 1, max: 10 },
    metrics: [
      { key: "morning_energy", label: "Morning energy", type: "scale", min: 1, max: 10 },
      { key: "sleep_quality", label: "Sleep quality", type: "scale", min: 1, max: 10 },
    ],
    baseline_days: 3,
    intervention_days: 7,
    points: chartPoints,
    baseline_mean: 5.333,
    intervention_mean: 6.429,
    predicted_band: {
      min_percent: 8,
      max_percent: 15,
      midpoint_percent: 11.5,
      expected_value_min: 5.76,
      expected_value_max: 6.133,
    },
  },
  created_at: "2026-10-28T09:00:00Z",
};

/** The same report after POST /report has written the narrative. */
export const writtenLabReport: LabReport = {
  ...labReport,
  narrative: {
    summary: "Your morning energy was higher on the days you walked after dinner.",
    interpretation: "Energy rose on test days compared with your usual routine, more than we expected. Ten days show a pattern, not proof.",
    personal_learnings: [
      "An evening walk fits your routine on most days.",
      "Your energy held up even on the one day you skipped the walk.",
    ],
    confounders: ["A late dinner on day 6 meant no walk that evening."],
    next_experiment: {
      question: "Does walking earlier in the evening help me fall asleep faster?",
      reason: "Your energy improved; the next step is to see whether timing changes your sleep too.",
    },
  },
};
