import { defineConfig } from "@playwright/test";

/** Phone screenshots from a fake-config Expo web export. Every call is mocked, and no web server is needed. */
export default defineConfig({
  testDir: ".",
  testMatch: "mobile-screens.spec.ts",
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  use: { actionTimeout: 10_000 },
  webServer: {
    command: `node static-server.mjs "${process.env.MOBILE_BUILD}" 8092`,
    cwd: new URL(".", import.meta.url).pathname,
    url: "http://127.0.0.1:8092",
    reuseExistingServer: false,
  },
});
