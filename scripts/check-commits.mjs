#!/usr/bin/env node
// Checks the subjects of a pull request's own commits against docs/rules/git-workflow.md.
// Only new commits are read, because older history predates the rule. Merge commits are skipped.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SUBJECT = /^(feat|fix|refactor|test|docs|chore)(\([a-z0-9-]+\))?: \S/;
const REVERT = /^Revert "/;

export function badSubjects(subjects) {
  return subjects.filter((subject) => !SUBJECT.test(subject) && !REVERT.test(subject));
}

function main() {
  const { BASE_SHA: base, HEAD_SHA: head } = process.env;
  if (!base || !head) {
    console.error("Set BASE_SHA and HEAD_SHA to the pull request's base and head commits.");
    process.exit(2);
  }
  const output = execFileSync("git", ["log", "--no-merges", "--format=%s", `${base}..${head}`], { encoding: "utf8" });
  const subjects = output.split("\n").filter(Boolean);
  const bad = badSubjects(subjects);
  if (bad.length) {
    console.error("These commit messages don't follow docs/rules/git-workflow.md (type(scope): subject):");
    for (const subject of bad) console.error(`  ${subject}`);
    process.exit(1);
  }
  console.log(`Commit messages: ${subjects.length} checked.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
