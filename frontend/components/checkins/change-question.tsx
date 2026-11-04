"use client";

/** The test-day question. The change is shown as written: the AI's wording can run to several sentences. */
export function ChangeQuestion({ name, action, timing, value, onChange, error }: {
  name: string;
  action: string;
  timing: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  error?: string;
}) {
  return (
    <fieldset aria-invalid={Boolean(error)}>
      <legend className="text-lead font-medium text-ink">Did you make the change today?</legend>
      <div className="mt-2 rounded-card bg-moss-tint p-3 text-body text-ink">
        <p>{action}</p>
        <p className="mt-1 text-caption text-muted">When: {timing}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { v: true, label: "Yes" },
          { v: false, label: "Not today" },
        ].map(({ v, label }) => {
          const selected = value === v;
          return (
            <label
              key={label}
              className={`grid min-h-12 cursor-pointer place-items-center rounded-card border text-lead transition-transform duration-[var(--motion-press)] motion-reduce:transition-none active:scale-[0.98] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss ${
                selected ? "border-moss bg-moss text-on-accent" : "border-control bg-paper text-ink hover:border-ink"
              }`}
            >
              <input type="radio" name={name} checked={selected} onChange={() => onChange(v)} className="sr-only" />
              {label}
            </label>
          );
        })}
      </div>
      {error && <p className="mt-2 text-caption font-medium text-clay">{error}</p>}
    </fieldset>
  );
}
