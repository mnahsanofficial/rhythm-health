import { MOTION_DURATION_MS } from "@rhythm-health/brand";
import type { Metric, MetricValue } from "@/lib/types/api";

export type CheckinStep = { key: string; audience?: string } & (
  | { kind: "change"; name: string; action: string; short?: string | null; timing: string }
  | { kind: "metric"; metric: Metric }
);
export type StepAnswers = Record<string, MetricValue | undefined>;
export const ADVANCE_MS = MOTION_DURATION_MS.response + MOTION_DURATION_MS.step;
export const metricName = (metric: Metric) => metric.short_label?.trim()
  || (metric.label.length <= 45 && !metric.label.includes("?") ? metric.label : "Your answer");
export const stepName = (step: CheckinStep) => step.kind === "change" ? step.name : metricName(step.metric);
export const typedStep = (step: CheckinStep) => step.kind === "metric" && (step.metric.type === "number" || step.metric.type === "duration"
  || (step.metric.type === "scale" && (step.metric.max ?? 10) - (step.metric.min ?? 1) > 20));
export const answered = (value: MetricValue | undefined) => value !== undefined;
export function answerText(step: CheckinStep, value: MetricValue | undefined) {
  if (value === undefined) return "Not answered";
  if (typeof value === "boolean") return value ? "Yes" : step.kind === "change" ? "Not today" : "No";
  if (step.kind !== "metric") return String(value);
  const unit = step.metric.unit || (step.metric.type === "scale" ? `/${step.metric.max ?? 10}` : step.metric.type === "duration" ? "min" : "");
  return unit ? unit.startsWith("/") ? `${value}${unit}` : `${value} ${unit}` : String(value);
}
