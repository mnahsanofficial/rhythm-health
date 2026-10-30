// Plain-language wording for the deterministic analysis (backend/app/services/analysis.py).
// Never says "proves": a short personal experiment shows a pattern, not proof (PRD §5.5).

import type { SignalClass, SignalReason } from "@/lib/types/api";

export const SIGNAL_COPY: Record<SignalClass, { label: string; summary: string }> = {
  likely_signal: {
    label: "Likely signal",
    summary: "The change was consistent and bigger than your normal day-to-day ups and downs.",
  },
  possible_signal: {
    label: "Possible signal",
    summary: "It moved the way we expected, but the evidence is still limited.",
  },
  unclear: {
    label: "Unclear",
    summary: "The data doesn't clearly support the idea or rule it out.",
  },
  probably_noise: {
    label: "Probably noise",
    summary: "The changes were small or inconsistent compared with your normal variation.",
  },
};

export function reasonText(reason: SignalReason, criteriaPercent: number): string | undefined {
  switch (reason) {
    case "insufficient_data":
      return "One of the phases didn't have enough check-ins to compare.";
    case "change_meets_success_criteria":
      return `The change reached at least ${criteriaPercent}%, the size we set out to look for.`;
    case "change_below_success_criteria":
      return `It moved the expected way, but by less than the ${criteriaPercent}% we set out to look for.`;
    case "consistent_direction":
      return "Most test days moved in the same direction.";
    case "inconsistent_direction":
      return "Test days went up and down without a clear pattern.";
    case "larger_than_normal_variation":
      return "The change was bigger than your normal day-to-day variation.";
    case "within_normal_variation":
      return "The change stayed within your normal day-to-day variation.";
    case "low_adherence":
      return "You made the change on fewer than 6 in 10 test days.";
    case "few_intervention_days":
      return "Fewer than 5 test days were logged, so treat this as a first look.";
    case "moved_opposite_to_prediction":
      return "It moved the opposite way to the prediction.";
  }
}

/** +11%, -3%, 0%. Ranges and observations both read in whole percents. */
export function signedPercent(value: number): string {
  const n = Math.round(value);
  return `${n > 0 ? "+" : ""}${n}%`;
}
