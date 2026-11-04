import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const url = new URL("../../.github/workflows/ci.yml", import.meta.url);
const workflow = () => {
  assert.ok(existsSync(url), ".github/workflows/ci.yml should exist");
  return readFileSync(url, "utf8");
};

test("CI runs on pull requests and on main", () => {
  assert.match(workflow(), /pull_request:/);
  assert.match(workflow(), /push:\s*\n\s*branches:\s*\[main\]/);
});

test("CI runs every check the repo requires", () => {
  for (const command of [
    "npm ci", "uv sync", "npm run lint", "npm run typecheck", "npm test",
    "npm run contract:check", "npm run brand:check", "npm run build", "uv run pytest", "npm run test:e2e",
  ]) {
    assert.ok(workflow().includes(command), `missing: ${command}`);
  }
});

test("CI scans all of history for secrets, with values redacted and the tool pinned", () => {
  assert.match(workflow(), /gitleaks detect --source \. --redact/);
  assert.match(workflow(), /fetch-depth: 0/);
  assert.match(workflow(), /sha256sum --check/);
});

test("CI checks migrations on a disposable Postgres service", () => {
  assert.match(workflow(), /services:\s*\n\s*postgres:/);
  assert.match(workflow(), /python3 backend\/tests\/migrations\/check_all_migrations\.py/);
});

test("CI checks commit messages on pull requests only", () => {
  assert.match(workflow(), /if: github\.event_name == 'pull_request'\s*\n\s*run: node scripts\/check-commits\.mjs/);
});

test("lint fails on any warning, in every workspace that lints", () => {
  for (const workspace of ["frontend", "apps/mobile"]) {
    const pkg = JSON.parse(readFileSync(new URL(`../../${workspace}/package.json`, import.meta.url), "utf8"));
    assert.match(pkg.scripts.lint, /--max-warnings=0/, workspace);
  }
});

test("the secret scan has no broad allowlist", () => {
  const config = readFileSync(new URL("../../.gitleaks.toml", import.meta.url), "utf8");
  assert.match(config, /useDefault = true/);
  assert.doesNotMatch(config, /paths\s*=/, "don't exempt whole files, and especially not .claude-logs");
});

test("CI uses no secrets and only reads the repo", () => {
  assert.doesNotMatch(workflow(), /secrets\./);
  assert.match(workflow(), /permissions:\s*\n\s*contents: read/);
});
