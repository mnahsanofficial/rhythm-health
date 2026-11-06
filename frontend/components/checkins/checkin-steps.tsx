"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { MAX_NOTE_LENGTH, type MetricValue } from "@/lib/types/api";
import { button } from "@/components/ui/button";
import { AnswerProgress } from "./answer-progress";
import { CheckinScene } from "./checkin-scene";
import { MetricInput } from "./metric-input";
import { ADVANCE_MS, answerText, answered, metricName, stepName, typedStep, type CheckinStep, type StepAnswers } from "./step-model";

export function CheckinSteps({ steps, values, texts, onAnswer, fields, note, onNote, busy, editing, context, notice, alert, blocked = false, saveLabel, onSave }: {
  steps: CheckinStep[]; values: StepAnswers; texts: Record<string, string>; onAnswer: (key: string, value: MetricValue | undefined, text: string) => void;
  fields: Record<string, string>; note: string; onNote: (value: string) => void; busy: boolean; editing: boolean; context: string; notice?: string;
  alert?: ReactNode; blocked?: boolean; saveLabel: string; onSave: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [returning, setReturning] = useState(false);
  const [noteOpen, setNoteOpen] = useState(Boolean(note));
  const reduce = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const noteId = useId();
  const step = steps[index];
  const complete = steps.every(item => answered(values[item.key]));
  const go = (next: number) => { setDirection(next < index ? -1 : 1); setIndex(next); };
  const forward = () => { if (returning) { setReturning(false); go(steps.length); } else go(Math.min(index + 1, steps.length)); };
  const back = () => { setReturning(false); go(Math.max(index - 1, 0)); };
  useEffect(() => { if (!step) heading.current?.focus(); }, [step]);
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-ink">
      <p>{context}</p><span>{step ? `Question ${index + 1} of ${steps.length}` : "Review"}</span>
    </div>
    <AnswerProgress answered={steps.filter(item => answered(values[item.key])).length} total={steps.length} />
    {notice && <p className="mt-3 text-body">{notice}</p>}
    <form noValidate onSubmit={event => { event.preventDefault(); if (step) { if (answered(values[step.key])) forward(); } else if (complete && !busy && !blocked) onSave(); }}>
      <motion.div key={step?.key ?? "review"} initial={reduce ? false : { opacity: 0, y: direction * 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : MOTION_DURATION.step, ease: MOTION_EASE.settle }} className="mt-6">
        {step ? <Question key={step.key} step={step} value={values[step.key]} text={texts[step.key] ?? ""} editing={editing} busy={busy} error={fields[step.key]}
          onAnswer={(value, text) => onAnswer(step.key, value, text)} onNext={forward} onBack={index > 0 ? back : undefined} />
          : <div onKeyDown={event => {
            if (event.key === "Enter" && !event.repeat && !(event.target as HTMLElement).closest("button,a,input,textarea,select,summary") && complete && !busy && !blocked) { event.preventDefault(); onSave(); }
          }}>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12">
              <div className="min-w-0">
                <h1 ref={heading} tabIndex={-1} className="font-display text-headline tracking-tight outline-none">Review your check-in.</h1>
                <p className="mt-2">Check your answers before saving.</p>
                {alert && <div className="mt-5">{alert}</div>}
                <div className="mt-5 divide-y divide-line border-y border-line">
                  {steps.map((item, position) => <div key={item.key}>
                    <button type="button" disabled={busy} aria-label={`Change ${stepName(item)}, ${answerText(item, values[item.key])}`}
                      onClick={() => { setReturning(true); go(position); }} className="flex min-h-14 w-full items-center justify-between gap-4 rounded-control py-3 text-left hover:bg-line/30 disabled:cursor-wait">
                      <span>{stepName(item)}</span><span className="flex shrink-0 items-center gap-3"><span className="font-mono tabular-nums">{answerText(item, values[item.key])}</span><span aria-hidden="true">↗</span></span>
                    </button>
                    {fields[item.key] && <p className="pb-3 text-body text-clay">{fields[item.key]}</p>}
                  </div>)}
                </div>
                <details className="mt-4" open={noteOpen} onToggle={event => setNoteOpen(event.currentTarget.open)}>
                  <summary className="flex min-h-11 cursor-pointer items-center font-medium">Add a note <span className="ml-2" aria-hidden="true">⌄</span></summary>
                  <label htmlFor={noteId} className="mt-2 block">Anything unusual yesterday? (optional)</label>
                  <textarea id={noteId} rows={3} maxLength={MAX_NOTE_LENGTH} disabled={busy} value={note} onChange={event => onNote(event.target.value)}
                    className="mt-2 w-full resize-y rounded-control border border-control bg-paper p-4 text-ink" placeholder="Late night, a stressful day, a long run…" />
                  {fields.note && <p className="mt-2 text-body text-clay">{fields.note}</p>}
                </details>
              </div>
              <CheckinScene review />
            </div>
            <div className="sticky bottom-0 -mx-[var(--gutter)] mt-6 flex min-h-20 items-center justify-between gap-3 border-t border-line bg-oat px-[var(--gutter)] py-4 lg:static lg:mx-0 lg:px-0">
              <button type="button" disabled={busy} onClick={back} className={button("secondary")}>Back</button>
              <button type="submit" disabled={busy || blocked || !complete} aria-busy={busy} className={button("primary")}>{saveLabel}</button>
            </div>
          </div>}
      </motion.div>
    </form>
  </div>;
}

function Question({ step, value, text, editing, busy, error, onAnswer, onNext, onBack }: {
  step: CheckinStep; value: MetricValue | undefined; text: string; editing: boolean; busy: boolean; error?: string;
  onAnswer: (value: MetricValue | undefined, text: string) => void; onNext: () => void; onBack?: () => void;
}) {
  const reduce = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const manual = useRef(editing || typedStep(step) || answered(value));
  const title = step.kind === "change" ? "Did you make the change?" : metricName(step.metric);
  const next = () => { clearTimeout(timer.current); if (!busy) onNext(); };
  useEffect(() => { heading.current?.focus(); return () => clearTimeout(timer.current); }, []);
  const choose = (selected: MetricValue | undefined, raw: string) => {
    clearTimeout(timer.current); onAnswer(selected, raw);
    if (busy || manual.current || selected === undefined) return;
    if (reduce) onNext(); else timer.current = setTimeout(onNext, ADVANCE_MS);
  };
  function shortcut(event: KeyboardEvent<HTMLDivElement>) {
    if (busy || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest("textarea,select,[contenteditable=true]")) return;
    const input = target.closest("input");
    if (event.key.startsWith("Arrow") && input?.type === "radio") { manual.current = true; return; }
    if (event.key === "Enter") {
      if (target.closest("button,a,summary")) return;
      event.preventDefault(); if (answered(value)) next(); return;
    }
    if ((input && input.type !== "radio") || typedStep(step) || !/^[1-9]$/.test(event.key)) return;
    const digit = Number(event.key);
    if (step.kind === "change" || step.metric.type === "boolean") {
      if (digit <= 2) { event.preventDefault(); choose(digit === 1, ""); }
    } else if (digit >= (step.metric.min ?? 1) && digit <= (step.metric.max ?? 10)) { event.preventDefault(); choose(digit, ""); }
  }
  return <div onKeyDown={shortcut}>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <h1 ref={heading} tabIndex={-1} className="font-display text-headline tracking-tight outline-none">{title}</h1>
        {step.kind === "change" ? <>
          <p className="mt-2 text-lead">{step.short || "Record whether you made your small change."}</p>
          <details className="mt-3"><summary className="flex min-h-11 cursor-pointer items-center font-medium">Change details <span aria-hidden="true" className="ml-2">⌄</span></summary><p className="mt-2">{step.action}</p><p className="mt-2">{step.timing}</p></details>
        </> : <p className="mt-2 text-body">{step.metric.label !== title ? step.metric.label : "Choose the answer that fits your day."}</p>}
        {step.audience && <p className="mt-2 text-caption text-muted">{step.audience}</p>}
      </div>
      <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2"><CheckinScene step={step} value={value} /></div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <div>
          {step.kind === "metric" ? <MetricInput compact metric={{ ...step.metric, label: title }} value={value} text={text} disabled={busy} error={error} onChange={choose} />
            : <fieldset disabled={busy} aria-label="Did you make the change?" aria-invalid={Boolean(error)}>
              <legend className="sr-only">Did you make the change?</legend>
              <div className="grid grid-cols-2 gap-3">{[true, false].map(choice => <label key={String(choice)} className={`grid min-h-16 cursor-pointer place-items-center rounded-control border px-3 text-lead has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss ${value === choice ? "border-moss bg-moss text-on-accent" : "border-control bg-paper text-ink hover:border-ink"}`}>
                <input type="radio" name={step.key} checked={value === choice} onChange={() => choose(choice, "")} className="sr-only" />{choice ? "Yes" : "Not today"}
              </label>)}</div>
              {error && <p className="mt-2 text-body text-clay">{error}</p>}
            </fieldset>}
        </div>
        <p role="status" className="sr-only">{answered(value) ? `${title}: ${answerText(step, value)} selected.` : ""}</p>
        <p className="mt-4 hidden text-caption text-ink sm:block">{typedStep(step) ? "Enter continues" : step.kind === "change" || step.metric.type === "boolean" ? "1 / 2 choose · Enter continues" : "1–9 choose · Enter continues"}</p>
      </div>
    </div>
    <div className="sticky bottom-0 -mx-[var(--gutter)] mt-6 flex min-h-20 items-center justify-between gap-3 border-t border-line bg-oat px-[var(--gutter)] py-4 lg:static lg:mx-0 lg:px-0">
      {onBack ? <button type="button" disabled={busy} onClick={() => { clearTimeout(timer.current); onBack(); }} className={button("secondary")}>Back</button> : <span className="text-caption">{typedStep(step) ? "Enter an answer." : "Choose an answer."}</span>}
      <button type="button" disabled={busy || !answered(value)} onClick={next} className={button("primary")}>Next</button>
    </div>
  </div>;
}
