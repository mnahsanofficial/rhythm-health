import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const missingAuthVariables = [
  !url && "NEXT_PUBLIC_SUPABASE_URL",
  !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
].filter((variable): variable is string => Boolean(variable));

export const isAuthConfigured = missingAuthVariables.length === 0;

// Browser-only client. supabase-js persists the session and refreshes tokens itself.
export const supabase = createClient(
  url || "http://localhost:54321",
  anonKey || "missing-anon-key",
);
