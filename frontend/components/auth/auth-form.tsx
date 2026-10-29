"use client";

import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { isAuthConfigured, missingAuthVariables, supabase } from "@/lib/auth/supabase";

export type AuthMode = "sign-in" | "sign-up";

type Props = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Called once Supabase returns a session. */
  onSignedIn?: () => void;
};

/** Shared by both fields, so the password looks exactly like the email. */
const FIELD = "min-h-12 w-full rounded-card border border-line bg-paper px-4 text-lead text-ink focus-visible:border-moss";

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
  const passwordRef = useRef<HTMLInputElement>(null);
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

  /** Swapping the input type can reset the caret, so put it back where the person left it. */
  function togglePassword() {
    const input = passwordRef.current;
    const typing = input !== null && document.activeElement === input;
    const range = typing ? ([input.selectionStart, input.selectionEnd, input.selectionDirection] as const) : null;
    flushSync(() => setShowPassword((shown) => !shown));
    if (input && range && range[0] !== null && range[1] !== null) {
      input.setSelectionRange(range[0], range[1], range[2] ?? undefined);
    }
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
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={passwordId} className="text-caption font-medium text-ink">
          Password
        </label>
        <div className="relative">
          <input
            ref={passwordRef}
            id={passwordId}
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${FIELD} pr-12`}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls={passwordId}
            // A mouse or tap on the eye leaves focus (and the caret) in the field being typed in.
            onMouseDown={(e) => {
              if (document.activeElement === passwordRef.current) e.preventDefault();
            }}
            onClick={togglePassword}
            className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 place-items-center rounded-card text-muted hover:text-ink"
          >
            <EyeIcon crossed={showPassword} />
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

/** An open eye while the password is hidden; crossed out once it is shown. */
function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx={12} cy={12} r={3} />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}
