import { HomeCta } from "@/components/home-cta";
import { HomeExperience } from "@/components/home-experience";
import { DayStory } from "@/components/landing/day-story";

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
      <DayStory />

      <div className="page-frame pt-16 pb-20">
        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="font-display text-headline tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, i) => (
              <li key={step.title} className="max-w-prose">
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
        <section aria-labelledby="start" className="mt-12 border-t border-line pt-10">
          <h2 id="start" className="max-w-prose font-display text-headline tracking-tight text-balance">
            Your first question takes about a minute to set up.
          </h2>
          <div className="mt-6"><HomeCta /></div>
        </section>
      </div>
    </HomeExperience>
  );
}
