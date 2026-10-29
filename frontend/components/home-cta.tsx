import Link from "next/link";

export function HomeCta() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <Link
        href="/onboarding"
        className="inline-flex min-h-12 items-center justify-center rounded-pill bg-moss px-6 text-lead font-medium text-paper hover:bg-moss-deep active:scale-[0.98]"
      >
        Run your first experiment
      </Link>
      <p className="text-caption text-muted">About a minute to set up. You sign up at the end.</p>
    </div>
  );
}
