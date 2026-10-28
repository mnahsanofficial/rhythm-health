"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api/client";
import { isAuthConfigured, supabase } from "@/lib/auth/supabase";
import { useSession } from "@/lib/auth/session";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-700";
const buttonClass =
  "rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50";

export function AuthPanel() {
  const { session, loading } = useSession();

  if (!isAuthConfigured) {
    return (
      <p className="text-sm text-zinc-500">
        Supabase isn&apos;t configured. Set NEXT_PUBLIC_SUPABASE_URL and
        NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
      </p>
    );
  }
  if (loading) return <p className="text-sm text-zinc-500">Loading session…</p>;
  return session ? <SignedIn email={session.user.email ?? ""} /> : <SignInForm />;
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(mode: "signIn" | "signUp") {
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else if (mode === "signUp" && !data.session)
      setMessage("Check your email to confirm your account, then sign in.");
    setBusy(false);
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit("signIn");
      }}
    >
      <input
        className={inputClass}
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className={inputClass}
        type="password"
        placeholder="Password (min 6 characters)"
        autoComplete="current-password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex gap-2">
        <button className={buttonClass} type="submit" disabled={busy}>
          Sign in
        </button>
        <button
          className={`${buttonClass} !bg-transparent !text-foreground border border-zinc-300 dark:border-zinc-700`}
          type="button"
          disabled={busy}
          onClick={() => void submit("signUp")}
        >
          Sign up
        </button>
      </div>
      {message && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}

function SignedIn({ email }: { email: string }) {
  const [result, setResult] = useState<string | null>(null);

  async function callProtected() {
    try {
      const me = await apiGet<{ user_id: string }>("/api/me", true);
      setResult(`Backend verified you: ${me.user_id}`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Request failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">Signed in as {email}</p>
      <div className="flex gap-2">
        <button className={buttonClass} onClick={() => void callProtected()}>
          Test protected endpoint
        </button>
        <button
          className={`${buttonClass} !bg-transparent !text-foreground border border-zinc-300 dark:border-zinc-700`}
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
      {result && (
        <p className="break-all text-sm text-zinc-600 dark:text-zinc-400" role="status">
          {result}
        </p>
      )}
    </div>
  );
}
