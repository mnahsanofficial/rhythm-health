import { HomeCta } from "@/components/home-cta";
import { DemoEntry } from "@/components/demo-entry";
import { RhythmRing } from "@/components/rhythm-ring";
import Link from "next/link";
import { exampleProfile } from "@/lib/data/profile";
import { placeHabits } from "@/lib/rhythm/habits";

const EXAMPLE_QUESTIONS = [
  "Does walking after dinner improve my sleep?",
  "Does less caffeine improve my focus?",
  "Does waking earlier actually make me more productive?",
];

const STEPS = [
  {
    title: "Tell us your rhythm",
    body: "When you sleep, how much you move, and the habits you already have. About a minute.",
  },
  {
    title: "Get a prediction, then test it",
    body: "We design one small experiment and say what we expect to change. You record 3 normal days, then 7 test days. Each check-in takes about 30 seconds.",
  },
  {
    title: "See what actually happened",
    body: "Your lab report puts the prediction next to your own results, and says so when a change is just noise.",
  },
];

export default function Home() {
  const habits = placeHabits(exampleProfile.regular_habits, exampleProfile.usual_sleep_schedule);
  const { bedtime, wake_time } = exampleProfile.usual_sleep_schedule;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8">
      <section className="grid items-center gap-10 pt-8 pb-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-16">
        <div>
          <h1 className="font-display text-display-sm tracking-tight text-balance sm:text-display">
            Stop guessing what works for you.
            <span className="block text-muted">Test it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lead text-muted">
            Turn a habit you&apos;re curious about into a short experiment. We predict what will change, you
            try it for a week, and you see whether it actually worked for you.
          </p>
          <div className="mt-8">
            <HomeCta />
            <DemoEntry />
            <Link
              href="/history"
              className="mt-3 inline-flex min-h-11 items-center px-1 text-body font-medium text-moss underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              Experiment history
            </Link>
          </div>

          <div className="mt-12">
            <h2 className="text-caption font-medium text-ink">Questions people test</h2>
            <ul className="mt-3 flex flex-col gap-3 border-l-2 border-moss pl-4">
              {EXAMPLE_QUESTIONS.map((q) => (
                <li key={q} className="font-display text-lead text-ink">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <figure className="rounded-card border border-line bg-paper p-5 sm:p-8">
          <div className="mx-auto max-w-[340px]">
            <RhythmRing
              schedule={exampleProfile.usual_sleep_schedule}
              sleepHours={exampleProfile.usual_sleep_hours}
              habits={habits}
            />
          </div>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
            <dt className="flex items-center gap-2 text-muted">
              <span aria-hidden="true" className="size-3 rounded-full bg-night" />
              Asleep
            </dt>
            <dd className="font-mono tabular-nums">
              {bedtime}–{wake_time}
            </dd>
            {habits.map((h) => (
              <div key={h.label} className="contents">
                <dt className="flex items-center gap-2 text-muted">
                  <span aria-hidden="true" className="size-3 rounded-full border border-ink bg-sun" />
                  {h.label}
                </dt>
                <dd className="font-mono tabular-nums">{h.time}</dd>
              </div>
            ))}
          </dl>
          <figcaption className="mt-6 border-t border-line pt-4 text-caption text-muted">
            A rhythm, shown with sample data. Yours is drawn from your own answers.
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="how-it-works" className="border-t border-line pt-12">
        <h2 id="how-it-works" className="font-display text-headline tracking-tight">
          How it works
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <p className="font-mono text-caption text-moss tabular-nums">0{i + 1}</p>
              <h3 className="mt-2 text-title font-medium tracking-tight">{step.title}</h3>
              <p className="mt-2 text-body text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
