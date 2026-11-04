import Link from "next/link";
import { button } from "@/components/ui/button";

export function HomeCta() {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
      <Link href="/onboarding" className={`${button("primary")} shrink-0 whitespace-nowrap text-lead`}>
        Start an experiment
      </Link>
      <p className="text-caption text-muted">About a minute to set up. You sign up at the end.</p>
    </div>
  );
}
