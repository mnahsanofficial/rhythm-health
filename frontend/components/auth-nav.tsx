"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/auth/supabase";
import { useSession } from "@/lib/auth/session";

const SECTIONS = [
  { href: "/", label: "Your lab", matches: (path: string) => path === "/" || path.startsWith("/experiments") },
  { href: "/history", label: "History", matches: (path: string) => path.startsWith("/history") },
  { href: "/demo", label: "Demo", matches: (path: string) => path.startsWith("/demo") },
] as const;

/** The header after the logo: sign in for visitors; the main sections and an account panel once signed in. */
export function AuthNav() {
  const { session, loading } = useSession();
  const pathname = usePathname();

  if (loading) return <span aria-hidden="true" className="ml-auto h-9 w-20 rounded-pill bg-line" />;

  if (!session) {
    return (
      <Link
        href="/sign-in"
        className="ml-auto flex min-h-11 items-center rounded-pill px-4 text-body font-medium text-ink hover:bg-line/60"
      >
        Sign in
      </Link>
    );
  }

  return (
    <>
      <nav aria-label="Main" className="ml-4 hidden md:block lg:ml-8">
        <ul className="flex items-center gap-1">
          {SECTIONS.map(({ href, label, matches }) => {
            const current = matches(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`relative flex min-h-11 items-center rounded-pill px-3 text-body hover:bg-line/50 ${
                    current
                      ? "font-medium text-ink after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-pill after:bg-moss"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <AccountMenu email={session.user.email ?? "your account"} pathname={pathname} />
    </>
  );
}

function AccountMenu({ email, pathname }: { email: string; pathname: string }) {
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Following a link in the panel lands on a new page; close it there.
  if (open && openedOn !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const row = "flex min-h-11 w-full items-center rounded-card px-3 text-left text-body text-ink hover:bg-oat";

  return (
    <div ref={root} className="relative ml-auto">
      <button
        ref={trigger}
        type="button"
        aria-label={`Account menu for ${email}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpenedOn(pathname);
          setOpen(value => !value);
        }}
        className="flex min-h-11 min-w-11 items-center gap-2 rounded-pill py-1 pr-2 pl-1 hover:bg-line/60 md:pr-3"
      >
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-pill bg-moss font-medium text-paper uppercase">
          {email.charAt(0)}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 text-muted md:hidden" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
          <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
        </svg>
        <svg viewBox="0 0 20 20" aria-hidden="true" className={`hidden size-4 text-muted transition-transform duration-[var(--motion-press)] motion-reduce:transition-none md:block ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="m5.5 8 4.5 4.5L14.5 8" />
        </svg>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2*var(--gutter)))] rounded-card border border-line bg-paper p-2"
      >
        <nav aria-label="Sections" className="border-b border-line pb-2 md:hidden">
          <ul>
            {SECTIONS.map(({ href, label, matches }) => (
              <li key={href}>
                <Link href={href} aria-current={matches(pathname) ? "page" : undefined} className={`${row} aria-[current=page]:font-medium aria-[current=page]:text-moss`}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-3 pt-3 pb-2">
          <p className="text-caption text-muted">Signed in as</p>
          <p className="truncate text-body font-medium text-ink">{email}</p>
        </div>
        <Link href="/onboarding" className={row}>Update your rhythm</Link>
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
            setSigningOut(false);
            setOpen(false);
            router.push("/");
          }}
          className={`${row} disabled:opacity-60`}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
