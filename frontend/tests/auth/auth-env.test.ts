import { afterEach, describe, expect, it, vi } from "vitest";

const missingVariableCases = [
  {
    missing: "NEXT_PUBLIC_SUPABASE_URL",
    value: "",
    values: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon-key",
    },
  },
  {
    missing: "NEXT_PUBLIC_SUPABASE_URL",
    value: undefined,
    values: {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon-key",
    },
  },
  {
    missing: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    value: "",
    values: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
  {
    missing: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    value: undefined,
    values: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    },
  },
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Supabase environment configuration", () => {
  it.each(missingVariableCases)(
    "does not crash when $missing is unset or blank ($value)",
    async ({ values }) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", values.NEXT_PUBLIC_SUPABASE_URL);
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", values.NEXT_PUBLIC_SUPABASE_ANON_KEY);

      const auth = await import("@/lib/auth/supabase");

      expect(auth.isAuthConfigured).toBe(false);
    },
  );
});
