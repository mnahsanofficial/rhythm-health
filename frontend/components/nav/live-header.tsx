"use client";

import { useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { AuthNav } from "@/components/auth-nav";
import { closeButton, CloseIcon } from "@/components/nav/close-icon";
import { Logo } from "@/components/nav/logo";
import { useNav } from "@/components/nav/navigation";
import { ThemeControl } from "@/components/theme-control";
import { useSession } from "@/lib/auth/session";
import { flowFallback } from "@/lib/nav/routes";

function subscribeToScroll(listener: () => void) {
  window.addEventListener("scroll", listener, { passive: true });
  return () => window.removeEventListener("scroll", listener);
}

/** True once the page has moved at all. Starts false, so the server and first paint agree. */
function useScrolled() {
  return useSyncExternalStore(subscribeToScroll, () => window.scrollY > 8, () => false);
}

/**
 * Over the landing page's night sky the header has no background and uses the dark theme's colours,
 * which pass on that sky whichever theme is chosen. Once you scroll, a solid layer with a hairline
 * fades in. With reduced motion there's no sky, so it's solid from the start.
 */
export function LiveHeader() {
  const pathname = usePathname();
  const { session, loading } = useSession();
  const reduce = useReducedMotion();
  const scrolled = useScrolled();
  const { close } = useNav();
  const landing = pathname === "/" && !loading && !session;
  const overHero = landing && reduce === false && !scrolled;
  const fallback = flowFallback(pathname);

  return (
    <header data-over-hero={overHero} data-theme={overHero ? "dark" : undefined} className="sticky top-0 z-40 text-ink">
      <span
        data-header-solid
        aria-hidden="true"
        className={`absolute inset-0 border-b border-line bg-oat transition-opacity duration-[var(--motion-panel)] ease-[var(--ease-settle)] motion-reduce:transition-none ${overHero ? "opacity-0" : "opacity-100"}`}
      />
      <div className="page-frame relative flex h-[var(--header-h)] items-center gap-2">
        <Logo large={landing} />
        {fallback ? (
          <div className="ml-auto flex items-center gap-1">
            <ThemeControl />
            <button type="button" aria-label="Close" onClick={() => close(fallback)} className={closeButton}>
              <CloseIcon />
            </button>
          </div>
        ) : (
          <AuthNav />
        )}
      </div>
    </header>
  );
}

