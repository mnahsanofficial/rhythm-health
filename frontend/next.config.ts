import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
const release = process.env.SENTRY_RELEASE ?? process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_SENTRY_RELEASE: release },
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
