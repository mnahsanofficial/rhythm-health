"use client";

import { useId } from "react";
import { MAX_DURATION_MINUTES, MAX_NUMBER, type Metric, type MetricValue } from "@/lib/types/api";

type Props = {
  metric: Metric;
  value: MetricValue | undefined;
  /** Raw text for number and duration fields, so typing "7." doesn't snap back. */
  text: string;
  onChange: (value: MetricValue | undefined, text: string) => void;
  error?: string;
  compact?: boolean;
  disabled?: boolean;
};

/** One question in the daily check-in, shaped by the metric's type. */
export function MetricInput({ metric, value, text, onChange, error, compact = false, disabled = false }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const scaleId = `${id}-scale-words`;
  const describedBy = [metric.type === "scale" ? scaleId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const min = metric.min ?? 1, max = metric.max ?? 10;
  const typed = metric.type === "number" || metric.type === "duration" || (metric.type === "scale" && max - min > 20);
  return (
    <fieldset disabled={disabled} className={compact ? "" : "border-b border-line pb-8"} aria-describedby={describedBy} aria-invalid={Boolean(error)}>
      <legend className={compact ? "sr-only" : "font-display text-title text-ink"}>{metric.label}</legend>
      {metric.type === "scale" && !typed && (
        <ScaleInput
          compact={compact}
          min={min}
          max={max}
          value={value}
          name={id}
          descriptionId={scaleId}
          low={metric.min_label ?? "Low"}
          high={metric.max_label ?? "High"}
          onChange={(v) => onChange(v, "")}
        />
      )}
      {metric.type === "boolean" && (
        <YesNo name={id} value={typeof value === "boolean" ? value : undefined} onChange={(v) => onChange(v, "")} />
      )}
      {typed && (
        <>
          {metric.type === "scale" && <p id={scaleId} className="mt-2 text-body text-ink">{min} {metric.min_label ?? "Low"} · {max} {metric.max_label ?? "High"}</p>}
          <NumberInput
            id={`${id}-input`}
            label={metric.label}
            duration={metric.type === "duration"}
            text={text}
            onChange={(t) => {
              const parsed = parseNumber(t, metric.type === "duration");
              onChange(metric.type === "scale" && (parsed === undefined || !Number.isInteger(parsed) || parsed < min || parsed > max) ? undefined : parsed, t);
            }}
          />
        </>
      )}
      {error && (
        <p id={errorId} className="mt-2 text-caption font-medium text-clay">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Text to a number within the backend's bounds, or undefined if it isn't one yet. */
function parseNumber(text: string, duration: boolean): number | undefined {
  if (text.trim() === "") return undefined;
  const normalized = text.trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return undefined;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return undefined;
  if (duration ? n < 0 || n > MAX_DURATION_MINUTES : Math.abs(n) > MAX_NUMBER) return undefined;
  return n;
}

function ScaleInput({
  compact,
  min,
  max,
  value,
  name,
  low,
  high,
  descriptionId,
  onChange,
}: {
  compact: boolean;
  min: number;
  max: number;
  value: MetricValue | undefined;
  name: string;
  descriptionId: string;
  low: string;
  high: string;
  onChange: (v: number) => void;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <>
      <p id={descriptionId} className="mt-2 flex max-w-none flex-wrap justify-between gap-x-5 gap-y-1 text-body text-ink">
        <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{`${min} ${low}`}</span>
        <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{`${max} ${high}`}</span>
      </p>
      {/* Native radios: arrow keys move along the scale, and screen readers announce "7 of 10". */}
      <div className={compact ? "mt-3 grid grid-cols-5 gap-3" : "mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10"}>
        {options.map((n) => {
          const selected = value === n;
          return (
            <label
              key={n}
              className={`grid ${compact ? "min-h-16" : "min-h-12"} cursor-pointer place-items-center rounded-control border font-mono text-lead tabular-nums transition-transform duration-[var(--motion-press)] motion-reduce:transition-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss ${
                selected ? "border-moss bg-moss text-on-accent" : "border-control bg-paper text-ink hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={selected}
                onChange={() => onChange(n)}
                className="sr-only"
              />
              <span
                className={`transition-transform duration-[var(--motion-press)] motion-reduce:transition-none `}
              >
                {n}
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
}

function YesNo({ name, value, onChange }: { name: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {[
        { v: true, label: "Yes" },
        { v: false, label: "No" },
      ].map(({ v, label }) => {
        const selected = value === v;
        return (
          <label
            key={label}
            className={`grid min-h-12 cursor-pointer place-items-center rounded-control border text-lead transition-transform duration-[var(--motion-press)] motion-reduce:transition-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss ${
              selected ? "border-moss bg-moss text-on-accent" : "border-control bg-paper text-ink hover:border-ink"
            }`}
          >
            <input type="radio" name={name} checked={selected} onChange={() => onChange(v)} className="sr-only" />
            {label}
          </label>
        );
      })}
    </div>
  );
}

function NumberInput({
  id,
  label,
  duration,
  text,
  onChange,
}: {
  id: string;
  label: string;
  duration: boolean;
  text: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="mt-3 flex max-w-xs items-center gap-3">
      {/* type="text" with a numeric keypad: type="number" swallows partial input like "7." */}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        aria-label={duration ? `${label}, in minutes` : label}
        className="min-h-12 w-32 rounded-control border border-control bg-paper px-4 font-mono text-lead text-ink tabular-nums focus-visible:border-moss"
      />
      {duration && <span className="text-body text-ink">minutes</span>}
    </div>
  );
}
