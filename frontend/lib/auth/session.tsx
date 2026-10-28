"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

type SessionState = { session: Session | null; loading: boolean };

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Fires INITIAL_SESSION on subscribe, then on sign-in, sign-out and token refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext value={state}>{children}</SessionContext>;
}

export function useSession() {
  return useContext(SessionContext);
}
