import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/** Screenshots for pull requests, with every call mocked. Not part of `npm run test:e2e`. */
const fakeEnv = Object.fromEntries(
  readFileSync(new URL("../../.env.test", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 300_000,
  use: { baseURL: "http://127.0.0.1:3100", actionTimeout: 10_000 },
  webServer: [
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      cwd: new URL("../..", import.meta.url).pathname,
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...fakeEnv, NEXT_DIST_DIR: ".next-playwright" },
    },
    // MOBILE_BUILD is the folder from a fake-config `expo export --platform web`; the spec reads MOBILE_URL.
    ...(process.env.MOBILE_BUILD ? [{
      command: `node static-server.mjs "${process.env.MOBILE_BUILD}" 8092`,
      cwd: new URL(".", import.meta.url).pathname,
      url: "http://127.0.0.1:8092",
      reuseExistingServer: false,
    }] : []),
  ],
});
