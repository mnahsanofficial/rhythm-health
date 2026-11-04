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

test("CI uses no secrets and only reads the repo", () => {
  assert.doesNotMatch(workflow(), /secrets\./);
  assert.match(workflow(), /permissions:\s*\n\s*contents: read/);
});
