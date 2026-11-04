"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { button } from "@/components/ui/button";
import { flowFallback } from "@/lib/nav/routes";

type Nav = {
  /** The page you were on before this one, in this visit. */
  previous: string | null;
  /** While a screen holds something that leaving would lose, this says what. */
  hold: (id: string, reason: string) => () => void;
  /** Runs `leave`, asking first if something would be lost. `reason` asks about one thing in particular. */
  confirm: (leave: () => void, reason?: string) => void;
  /** The ×: back to where you came from, or `fallback` if you opened this page directly. */
  close: (fallback: string) => void;
};

const NavContext = createContext<Nav>({
  previous: null,
  hold: () => () => undefined,
  confirm: leave => leave(),
  close: () => undefined,
});

export const useNav = () => useContext(NavContext);

/** Protects `reason` from every way out: the ×, the browser's back button and links. Null when nothing's at risk. */
export function useLeaveGuard(reason: string | null) {
  const { hold } = useNav();
  const id = useId();
  useEffect(() => (reason ? hold(id, reason) : undefined), [hold, id, reason]);
}

/** Reads the pathname inside its own boundary, so the provider doesn't hold back prerendering every page. */
function PathWatcher({ onPath }: { onPath: (path: string) => void }) {
  const pathname = usePathname();
  useLayoutEffect(() => onPath(pathname), [onPath, pathname]);
  return null;
}

export function NavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [{ pathname, previous }, setPath] = useState<{ pathname: string | null; previous: string | null }>({ pathname: null, previous: null });
  const onPath = useCallback((next: string) => {
    setPath(path => (path.pathname === next ? path : { pathname: next, previous: path.pathname }));
  }, []);

  const [holds, setHolds] = useState<Record<string, string>>({});
  const reason = Object.values(holds).at(-1) ?? null;
  const [asking, setAsking] = useState<{ reason: string; leave: () => void } | null>(null);
  /** The extra history entry that lets the browser's back button stop at the sheet. */
  const spare = useRef(false);
  /** Set once someone has chosen to leave, so nothing stops them on the way out. */
  const leaving = useRef(false);

  useEffect(() => {
    spare.current = false;
    leaving.current = false;
  }, [pathname]);

  const hold = useCallback((id: string, text: string) => {
    setHolds(all => ({ ...all, [id]: text }));
    return () => setHolds(all => {
      const rest = { ...all };
      delete rest[id];
      return rest;
    });
  }, []);

  const confirm = useCallback<Nav["confirm"]>((leave, about) => {
    const text = about ?? reason;
    if (text) setAsking({ reason: text, leave });
    else leave();
  }, [reason]);

  const goBack = useCallback((fallback: string) => {
    leaving.current = true;
    if (previous && !flowFallback(previous)) {
      const steps = spare.current ? 2 : 1;
      spare.current = false;
      window.history.go(-steps);
    } else {
      router.replace(fallback);
    }
  }, [previous, router]);

  const close = useCallback((fallback: string) => confirm(() => goBack(fallback)), [confirm, goBack]);

  useEffect(() => {
    if (!reason) return;
    if (!spare.current) {
      window.history.pushState(window.history.state, "", window.location.href);
      spare.current = true;
    }
    const onBack = () => {
      if (leaving.current) return;
      window.history.pushState(window.history.state, "", window.location.href);
      setAsking({ reason, leave: () => goBack(flowFallback(window.location.pathname) ?? "/") });
    };
    // On window, in capture, to run before the router's own click handling on links.
    const onLink = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target || link.origin !== window.location.origin) return;
      const destination = link.pathname + link.search + link.hash;
      if (link.pathname + link.search === window.location.pathname + window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setAsking({ reason, leave: () => { leaving.current = true; router.push(destination); } });
    };
    window.addEventListener("popstate", onBack);
    window.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("popstate", onBack);
      window.removeEventListener("click", onLink, true);
    };
  }, [reason, goBack, router]);

  const value = useMemo(() => ({ previous, hold, confirm, close }), [previous, hold, confirm, close]);

  return (
    <NavContext.Provider value={value}>
      <Suspense><PathWatcher onPath={onPath} /></Suspense>
      {children}
      {asking && (
        <LeaveSheet
          reason={asking.reason}
          onStay={() => setAsking(null)}
          onLeave={() => {
            const { leave } = asking;
            setAsking(null);
            leave();
          }}
        />
      )}
    </NavContext.Provider>
  );
}

/** In the app's own style, never a browser dialog. <dialog> holds focus, closes on Escape and returns focus when it closes. */
function LeaveSheet({ reason, onStay, onLeave }: { reason: string; onStay: () => void; onLeave: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    if (element && !element.open) element.showModal?.();
    return () => {
      element?.close?.();
      opener?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={event => {
        event.preventDefault();
        onStay();
      }}
      onClick={event => {
        if (event.target === dialog.current) onStay();
      }}
      className="sheet-enter fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-card border border-line bg-raised p-6 text-ink backdrop:bg-black/50 sm:top-0 sm:m-auto sm:h-fit sm:max-w-md sm:rounded-card"
    >
      <h2 id={titleId} className="font-display text-title tracking-tight">Leave without saving?</h2>
      <p className="mt-2 text-body text-muted">{reason}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" autoFocus onClick={onStay} className={`${button("primary")} max-sm:w-full max-sm:max-w-none`}>Stay</button>
        <button type="button" onClick={onLeave} className={`${button("secondary")} max-sm:w-full max-sm:max-w-none`}>Leave</button>
      </div>
    </dialog>
  );
}
