import assert from "node:assert/strict";
import { test } from "node:test";
import { badSubjects } from "../check-commits.mjs";

test("accepts the types in docs/rules/git-workflow.md, with or without a scope", () => {
  assert.deepEqual(badSubjects([
    "feat(mobile): add tabs",
    "fix: handle blank configuration",
    "refactor: move completion into a service",
    "test(mobile): expect the trust line",
    "docs(decisions): tidy the wording",
    "chore(logs): add the last turns of session e0ee1147",
  ]), []);
});

test("accepts a generated revert", () => {
  assert.deepEqual(badSubjects(['Revert "feat: add tabs"']), []);
});

test("names each subject that doesn't follow the convention", () => {
  assert.deepEqual(
    badSubjects(["Feat/UI onboarding", "feat: ok", "Add completed experiment history", "wip: later", "feat:no space"]),
    ["Feat/UI onboarding", "Add completed experiment history", "wip: later", "feat:no space"],
  );
});

test("rejects an empty subject after the type", () => {
  assert.deepEqual(badSubjects(["fix: "]), ["fix: "]);
});
