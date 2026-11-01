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
};

/** One question in the daily check-in, shaped by the metric's type. */
export function MetricInput({ metric, value, text, onChange, error }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const scaleId = `${id}-scale-words`;
  const describedBy = [metric.type === "scale" ? scaleId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset className="border-b border-line pb-8" aria-describedby={describedBy} aria-invalid={Boolean(error)}>
      <legend className="font-display text-title text-ink">{metric.label}</legend>
      {metric.type === "scale" && metric.min !== null && metric.max !== null && (
        <ScaleInput
          min={metric.min}
          max={metric.max}
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
      {(metric.type === "number" || metric.type === "duration") && (
        <NumberInput
          id={`${id}-input`}
          label={metric.label}
          duration={metric.type === "duration"}
          text={text}
          onChange={(t) => onChange(parseNumber(t, metric.type === "duration"), t)}
        />
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
  const n = Number(text.replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  if (duration ? n < 0 || n > MAX_DURATION_MINUTES : Math.abs(n) > MAX_NUMBER) return undefined;
  return n;
}

function ScaleInput({
  min,
  max,
  value,
  name,
  low,
  high,
  descriptionId,
  onChange,
}: {
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
      <p id={descriptionId} className="mt-2 flex flex-wrap justify-between gap-x-5 gap-y-1 text-body text-muted">
        <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{min} {low}</span>
        <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{max} {high}</span>
      </p>
      {/* Native radios: arrow keys move along the scale, and screen readers announce "7 of 10". */}
      <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {options.map((n) => {
          const selected = value === n;
          return (
            <label
              key={n}
              className={`grid min-h-12 cursor-pointer place-items-center rounded-card border font-mono text-lead tabular-nums transition-transform duration-[var(--motion-press)] motion-reduce:transition-none active:scale-95 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss ${
                selected ? "border-moss bg-moss text-paper" : "border-line bg-paper text-ink hover:border-muted"
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
                className={`transition-transform duration-[var(--motion-press)] motion-reduce:transition-none ${selected ? "scale-110" : "scale-100"}`}
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
            className={`grid min-h-12 cursor-pointer place-items-center rounded-card border text-lead transition-transform duration-[var(--motion-press)] motion-reduce:transition-none active:scale-[0.98] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss ${
              selected ? "border-moss bg-moss text-paper" : "border-line bg-paper text-ink hover:border-muted"
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
        className="min-h-12 w-32 rounded-card border border-line bg-paper px-4 font-mono text-lead text-ink tabular-nums focus-visible:border-moss"
      />
      {duration && <span className="text-body text-muted">minutes</span>}
    </div>
  );
}
