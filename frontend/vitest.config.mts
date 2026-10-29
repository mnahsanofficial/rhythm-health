import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const testEnv = Object.fromEntries(
  readFileSync(new URL("./.env.test", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  define: {
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(testEnv.NEXT_PUBLIC_API_URL),
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(testEnv.NEXT_PUBLIC_SUPABASE_URL),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(testEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
  },
});
