import assert from "node:assert/strict";
import { test } from "node:test";
import { checkLog } from "../check-logs.mjs";

const AUTHORS = { "mnahsanofficial@gmail.com": "mnahsanofficial", "shakeb0308@gmail.com": "shakeb03" };
const NAME = "2026-11-01_09-00-00_abc123.md";

function log({ front = {}, prompts = ["LOG CHECK — Claude Code, Nazmul"], drop = [] } = {}) {
  const fields = {
    session_id: "abc123", date: "2026-11-01", author: "Md Nazmul Ahsan", github_user: "mnahsanofficial",
    git_email: "mnahsanofficial@gmail.com", project: "Health", session_status: "complete",
    last_entry_type: "assistant", total_exchanges: String(prompts.length), generated_at: "2026-11-01T09:00:00",
    ...front,
  };
  for (const key of drop) delete fields[key];
  const head = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n");
  const body = prompts.map((p, i) => [
    `[CLAUDE_LOG_ENTRY type=PROMPT num=${i + 1} session=abc123]`,
    "timestamp: 2026-11-01T09:00:00Z", "time: 2026-11-01 09:00", `chars: ${p.length}`, `words: ${p.split(/\s+/).filter(Boolean).length}`,
    "has_code_block: False", "has_file_paths: False", "has_urls: False", "likely_pasted: False", "", p, "",
    `[CLAUDE_LOG_ENTRY type=RESPONSE num=${i + 1} session=abc123]`, "timestamp: 2026-11-01T09:00:05Z", "time: 2026-11-01 09:00", "chars: 6", "", "Done.", "",
  ].join("\n")).join("\n");
  return `---\n${head}\n---\n\n# Claude Session Log - 2026-11-01\n\n---\n\n${body}`;
}

const check = (text, options = {}) => checkLog(NAME, text, { authors: AUTHORS, waivers: {}, ...options });

test("a log in the guide's format passes", () => {
  assert.deepEqual(check(log()), []);
});

test("fails when required frontmatter is missing", () => {
  const problems = check(log({ drop: ["github_user", "git_email"] }));
  assert.ok(problems.some(p => /github_user/.test(p)));
  assert.ok(problems.some(p => /git_email/.test(p)));
});

test("fails on an unknown or wrong github_user for the author's email", () => {
  assert.ok(check(log({ front: { github_user: "unknown" } })).some(p => /github_user/.test(p)));
  assert.ok(check(log({ front: { github_user: "nahsan-kpler" } })).some(p => /nahsan-kpler/.test(p)));
});

test("fails on an email nobody has registered", () => {
  assert.ok(check(log({ front: { git_email: "someone@example.invalid" } })).some(p => /someone@example\.invalid/.test(p)));
});

test("fails on an empty prompt", () => {
  assert.ok(check(log({ prompts: ["first", ""] })).some(p => /empty prompt/i.test(p)));
});

test("fails on a prompt the agent generated itself", () => {
  const ambient = "# Overview\n\nGenerate 0 to 3 hyperpersonalized suggestions for what this user can do with Codex";
  assert.ok(check(log({ prompts: [ambient] })).some(p => /generated/i.test(p)));
});

test("fails when the filename and session_id disagree", () => {
  assert.ok(check(log({ front: { session_id: "other" } })).some(p => /session_id/.test(p)));
});

test("a listed old log is excused only from the checks it's listed for", () => {
  const text = log({ front: { github_user: "unknown" }, prompts: [""] });
  const problems = check(text, { waivers: { [NAME]: { checks: ["github_user"], reason: "written before the fix" } } });
  assert.ok(!problems.some(p => /github_user/.test(p)));
  assert.ok(problems.some(p => /empty prompt/i.test(p)));
});
