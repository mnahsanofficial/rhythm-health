import type {
  Experiment,
  ExperimentProposal,
  Prediction,
  Profile,
  ProfileInput,
  ProposeResponse,
  SaveExperimentRequest,
} from "@/lib/types/api";

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
