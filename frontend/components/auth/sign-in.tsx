"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthForm, type AuthMode } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/next-path";
import { useSession } from "@/lib/auth/session";

/** The /sign-in page body. New users are pointed at onboarding, where the account is created. */
export function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { session } = useSession();
  const [mode, setMode] = useState<AuthMode>(params.get("mode") === "sign-up" ? "sign-up" : "sign-in");

  if (session) {
    return (
      <div>
        <h1 className="font-display text-headline tracking-tight">You&apos;re signed in.</h1>
        <p className="mt-2 text-body text-muted">As {session.user.email}.</p>
        <Link
          href={next}
          className="mt-6 inline-flex min-h-12 items-center rounded-pill bg-moss px-6 text-lead font-medium text-paper hover:bg-moss-deep"
        >
          Continue
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-headline tracking-tight">
        {mode === "sign-in" ? "Welcome back." : "Create your account."}
      </h1>
      <p className="mt-2 mb-8 text-body text-muted">
        {mode === "sign-in" ? (
          "Sign in to see your rhythm and your experiments."
        ) : (
          <>
            Most people start with{" "}
            <Link href="/onboarding" className="font-medium text-moss underline underline-offset-4">
              seven quick questions
            </Link>{" "}
            and create the account at the end.
          </>
        )}
      </p>
      <AuthForm mode={mode} onModeChange={setMode} onSignedIn={() => router.push(next)} />
    </div>
  );
}
