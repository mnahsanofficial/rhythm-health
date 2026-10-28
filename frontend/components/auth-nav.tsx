"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/auth/supabase";
import { useSession } from "@/lib/auth/session";

/** Right side of the header: sign in, or who's signed in and a way out. */
export function AuthNav() {
  const { session, loading } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (loading) return <span aria-hidden="true" className="h-9 w-20 animate-pulse rounded-pill bg-line" />;

  if (!session) {
    return (
      <Link
        href="/sign-in"
        className="flex min-h-11 items-center rounded-pill px-4 text-body font-medium text-ink hover:bg-line/60"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-48 truncate text-caption text-muted sm:inline">{session.user.email}</span>
      <button
        type="button"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
          setSigningOut(false);
          router.push("/");
        }}
        className="min-h-11 rounded-pill px-4 text-body font-medium text-ink hover:bg-line/60 disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
