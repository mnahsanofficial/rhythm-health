import { HomeCta } from "@/components/home-cta";
import { HomeExperience } from "@/components/home-experience";
import { LandingRhythm } from "@/components/landing-rhythm";
import { exampleProfile } from "@/lib/data/profile";

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
  return (
    <HomeExperience>
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8">
        <section className="grid items-center gap-10 pt-8 pb-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-12">
          <div>
            <h1 className="font-display text-display-sm tracking-tight text-balance sm:text-display">
              Stop guessing what works for you.
              <span className="block text-muted">Test it.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lead text-muted">
              Turn a habit question into a small personal experiment. Record your usual routine,
              test one change, then compare the forecast with your own observations.
            </p>
            <div className="mt-8">
              <HomeCta />

            </div>

            <div className="mt-10 grid grid-cols-2 gap-5 border-t border-line pt-5">
              <div>
                <p className="font-mono text-title tabular-nums">3 + 7</p>
                <p className="mt-1 text-caption text-muted">Normal days, then test days.</p>
              </div>
              <div>
                <p className="font-mono text-title tabular-nums">30 seconds</p>
                <p className="mt-1 text-caption text-muted">A small daily check-in.</p>
              </div>
            </div>
          </div>

          <LandingRhythm profile={exampleProfile} />
        </section>

        <section aria-labelledby="how-it-works" className="border-t border-line pt-12">
          <h2 id="how-it-works" className="font-display text-headline tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <p className="font-mono text-caption text-moss tabular-nums">0{i + 1}</p>
                <h3 className="mt-2 font-display text-title tracking-tight">{step.title}</h3>
                <p className="mt-2 text-body text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="question-examples" className="mt-12 border-t border-line pt-10">
          <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <h2 id="question-examples" className="font-display text-headline tracking-tight">A question worth testing.</h2>
            <ul className="divide-y divide-line">
              {EXAMPLE_QUESTIONS.map((question, index) => (
                <li key={question} className="flex gap-4 py-4 first:pt-0">
                  <span aria-hidden="true" className="pt-1 font-mono text-caption text-moss">0{index + 1}</span>
                  <p className="font-display text-title">{question}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </HomeExperience>
  );
}
