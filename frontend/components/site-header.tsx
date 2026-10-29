import Link from "next/link";
import { Suspense } from "react";
import { AuthNav } from "@/components/auth-nav";

/** The mark: a 24-hour dial (midnight at the top) with night from 22:00 to 06:00 and a midday sun. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="1.5" />
      <path d="M12 12 L7.5 4.21 A9 9 0 0 1 21 12 Z" fill="var(--color-night)" />
      <circle cx="10.3" cy="18.3" r="2" fill="var(--color-sun)" stroke="var(--color-ink)" strokeWidth="0.75" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-oat">
      <div className="page-frame flex h-[var(--header-h)] items-center gap-2">
        <Link
          href="/"
          className="-mx-2 flex min-h-11 shrink-0 items-center gap-2 px-2 font-display text-title tracking-tight"
        >
          <Mark />
          Rhythm
        </Link>
        {/* AuthNav reads the pathname, which isn't known while prerendering /experiments/[id]
            pages. The boundary lets the rest of the header prerender and the nav stream in. */}
        <Suspense fallback={<NavPlaceholder />}>
          <AuthNav />
        </Suspense>
      </div>
    </header>
  );
}

/** Holds the nav's place while it streams in; the same shape AuthNav shows while loading. */
function NavPlaceholder() {
  return <span aria-hidden="true" className="ml-auto h-9 w-20 rounded-pill bg-line" />;
}
