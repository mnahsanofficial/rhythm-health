import type { Metric } from '@rhythm-health/contract';

type Named = Pick<Metric, 'label' | 'short_label'>;

/** The backend writes these. The label is only there for a response from before it did. */
export const metricName = (metric: Named) => metric.short_label ?? metric.label;

/** "10/10", "90 min", "Yes". */
export function metricValue(metric: Pick<Metric, 'unit'>, value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (!metric.unit) return String(value);
  return metric.unit.startsWith('/') ? `${value}${metric.unit}` : `${value} ${metric.unit}`;
}
