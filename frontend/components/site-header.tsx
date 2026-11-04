import { Suspense } from "react";
import { LiveHeader } from "@/components/nav/live-header";
import { Logo } from "@/components/nav/logo";

export function SiteHeader() {
  return (
    // The header reads the pathname, which isn't known while prerendering /experiments/[id] pages.
    // The boundary lets the page prerender with this plain version until the live one streams in.
    <Suspense fallback={<PlainHeader />}>
      <LiveHeader />
    </Suspense>
  );
}

function PlainHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-oat">
      <div className="page-frame flex h-[var(--header-h)] items-center gap-2">
        <Logo />
        <span aria-hidden="true" className="ml-auto h-9 w-20 rounded-pill bg-line" />
      </div>
    </header>
  );
}
