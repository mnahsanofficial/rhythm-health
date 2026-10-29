"use client";

import { useId, useState } from "react";
import { isAuthConfigured, missingAuthVariables, supabase } from "@/lib/auth/supabase";

export type AuthMode = "sign-in" | "sign-up";

type Props = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Called once Supabase returns a session. */
  onSignedIn?: () => void;
};

const COPY = {
  "sign-in": { submit: "Sign in", busy: "Signing in…", switchPrompt: "New here?", switchLabel: "Create an account" },
  "sign-up": {
    submit: "Create account",
    busy: "Creating your account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
  },
} as const;

/** Email and password through Supabase Auth (TRD §6). Used on /sign-in and at the end of onboarding. */
export function AuthForm({ mode, onModeChange, onSignedIn }: Props) {
  const emailId = useId();
  const passwordId = useId();
  const messageId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const copy = COPY[mode];

  if (!isAuthConfigured) {
    return (
      <p role="alert" className="rounded-card border border-line bg-paper p-4 text-body text-muted">
        Sign-in isn&apos;t set up on this machine. Set {missingAuthVariables.join(" and ")} in{" "}
        <code>frontend/.env.local</code>.
      </p>
    );
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage({ tone: "error", text: error.message });
      } else if (!data.session) {
        // Projects with email confirmation on return a user but no session until the link is clicked.
        setMessage({
          tone: "info",
          text: `We've sent a link to ${email}. Open it to confirm your account, then sign in here.`,
        });
        onModeChange("sign-in");
      } else {
        onSignedIn?.();
      }
    } catch {
      setMessage({ tone: "error", text: "Can't reach the sign-in service. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-describedby={message ? messageId : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={emailId} className="text-caption font-medium text-ink">
          Email
        </label>
        <input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 rounded-card border border-line bg-paper px-4 text-lead text-ink focus-visible:border-moss"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={passwordId} className="text-caption font-medium text-ink">
          Password
        </label>
        <div className="flex gap-2">
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 min-w-0 flex-1 rounded-card border border-line bg-paper px-4 text-lead text-ink focus-visible:border-moss"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-pressed={showPassword}
            className="min-h-12 shrink-0 rounded-pill px-4 text-caption font-medium text-moss hover:bg-moss-tint"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {mode === "sign-up" && <p className="text-caption text-muted">At least 6 characters.</p>}
      </div>

      {message && (
        <p
          id={messageId}
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-card p-3 text-body ${message.tone === "error" ? "bg-clay-tint text-clay" : "bg-moss-tint text-ink"}`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="min-h-12 rounded-pill bg-moss px-7 text-lead font-medium text-paper transition-[background-color,opacity,scale] hover:bg-moss-deep active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? copy.busy : copy.submit}
      </button>

      <p className="text-body text-muted">
        {copy.switchPrompt}{" "}
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            onModeChange(mode === "sign-in" ? "sign-up" : "sign-in");
          }}
          className="-mx-1 min-h-11 rounded-pill px-1 font-medium text-moss underline-offset-4 hover:underline"
        >
          {copy.switchLabel}
        </button>
      </p>
    </form>
  );
}
