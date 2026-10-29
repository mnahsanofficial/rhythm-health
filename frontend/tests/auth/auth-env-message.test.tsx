import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";

const config = vi.hoisted(() => ({ missingVariables: [] as string[] }));

vi.mock("@/lib/auth/supabase", () => ({
  isAuthConfigured: false,
  missingAuthVariables: config.missingVariables,
  supabase: { auth: {} },
}));

afterEach(() => {
  config.missingVariables = [];
});

describe("Supabase setup message", () => {
  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])(
    "names the missing variable %s without exposing a value",
    (variable) => {
      config.missingVariables = [variable];

      render(<AuthForm mode="sign-in" onModeChange={vi.fn()} />);

      expect(screen.getByRole("alert")).toHaveTextContent(variable);
    },
  );
});
