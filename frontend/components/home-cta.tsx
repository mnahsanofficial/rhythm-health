import Link from "next/link";
import { button } from "@/components/ui/button";

const link = "shrink-0 whitespace-nowrap text-lead";

/**
 * From tablet width up, the header holds the screen's one filled button. `hero` steps aside there,
 * and `closing`, at the end of the page, becomes the outlined button.
 */
export function HomeCta({ wide = "closing" }: { wide?: "hero" | "closing" }) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
      <Link href="/onboarding" className={`${button("primary")} ${link} sm:hidden`}>
        Start an experiment
      </Link>
      {wide === "closing" && (
        <Link href="/onboarding" className={`${button("secondary")} ${link} max-sm:hidden`}>
          Start an experiment
        </Link>
      )}
      <p className="text-caption text-muted">About a minute to set up. You sign up at the end.</p>
    </div>
  );
}
