"""Tests for the guide's log format: what the script captures, and what logs:check rejects."""

import ast
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
GUIDE = SCRIPTS.parent / "docs" / "agent-logging-setup.md"
sys.path.insert(0, str(SCRIPTS))
NAME = "2026-11-01_09-00-00_abc123.md"


def load_script():
    spec = importlib.util.spec_from_file_location("extract_log", SCRIPTS / "extract-log.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def user(content, **extra):
    return {"type": "user", "timestamp": "2026-11-01T09:00:00Z", "message": {"role": "user", "content": content}, **extra}


def assistant(text, when="2026-11-01T09:00:05Z"):
    return {"type": "assistant", "timestamp": when, "message": {"role": "assistant", "content": [{"type": "text", "text": text}]}}


def queued(prompt, **attachment):
    return {
        "type": "attachment",
        "timestamp": "2026-11-01T09:00:02Z",
        "attachment": {"type": "queued_command", "commandMode": "prompt", "prompt": prompt, **attachment},
    }


HUMAN = {"origin": {"kind": "human"}}
IMAGE = {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "SECRETPIXELS"}}


def captured(lines):
    script = load_script()
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp, "session.jsonl")
        path.write_text("\n".join(json.dumps(line) for line in lines) + "\n")
        return [(role, text) for _, role, text in script.dedupe_entries(script.extract_clean_log(path))]


class ReadingTranscripts(unittest.TestCase):
    def test_keeps_only_the_text_of_a_prompt_sent_with_an_image(self):
        entries = captured([user([IMAGE, {"type": "text", "text": "which one to change?"}], **HUMAN), assistant("That one.")])
        self.assertEqual(entries, [("user", "which one to change?"), ("assistant", "That one.")])
        self.assertNotIn("SECRETPIXELS", json.dumps(entries))

    def test_captures_a_prompt_queued_while_the_agent_was_working(self):
        entries = captured([
            user("first"), assistant("working"),
            queued("also this", origin={"kind": "human"}),
            assistant("done"),
        ])
        self.assertEqual([e for e in entries if e[0] == "user"], [("user", "first"), ("user", "also this")])
        self.assertEqual(entries[-1], ("assistant", "done"))

    def test_keeps_only_the_text_of_a_queued_prompt_with_an_image(self):
        entries = captured([queued([IMAGE, {"type": "text", "text": "look at this"}], origin={"kind": "human"})])
        self.assertEqual(entries, [("user", "look at this")])

    def test_never_captures_machine_messages_as_prompts(self):
        entries = captured([
            user("real prompt"),
            queued("<ci-monitor-event>watching</ci-monitor-event>"),
            queued("<task-notification>done</task-notification>", origin={"kind": "task-notification"}),
            queued("from a subagent", origin={"kind": "human"}) | {"isSidechain": True},
            user([{"type": "tool_result", "content": "output"}]),
            user([{"type": "text", "text": "[Request interrupted by user]"}]),
            user([IMAGE], **HUMAN),
            assistant("answer"),
        ])
        self.assertEqual(entries, [("user", "real prompt"), ("assistant", "answer")])


class ScriptStaysTheGuides(unittest.TestCase):
    def functions(self, source):
        return {node.name: ast.get_source_segment(source, node) for node in ast.parse(source).body if isinstance(node, ast.FunctionDef)}

    def test_only_the_transcript_reader_differs_from_the_guide(self):
        guide = GUIDE.read_text()
        guide = guide[guide.index("#!/usr/bin/env python3"):guide.index("settings.json hooks\nMerge")]
        ours = self.functions((SCRIPTS / "extract-log.py").read_text())
        changed = {name for name, body in self.functions(guide).items() if ours.get(name) != body}
        self.assertEqual(changed, {"is_user_prompt", "extract_clean_log"})

    def test_script_is_the_reviewed_version(self):
        digest = hashlib.sha256((SCRIPTS / "extract-log.py").read_bytes()).hexdigest()
        self.assertEqual(digest, "939d81387d5b1a557fec753932206ca0fa23716b410178d3da5a7c61ca89257a")


def good_log():
    """A log written by the real script, so the fixture can't disagree with the guide."""
    with tempfile.TemporaryDirectory() as tmp:
        repo = Path(tmp, "Health")
        repo.mkdir()
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test Person"], check=True)
        subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.invalid"], check=True)
        home = Path(tmp, "home")
        sessions = home / ".claude" / "projects" / str(repo).replace("/", "-")
        sessions.mkdir(parents=True)
        lines = [
            user("see https://example.com/a.py:12 please"), assistant("Done."),
            {**user("second one"), "timestamp": "2026-11-01T09:10:00Z"}, assistant("Also done.", "2026-11-01T09:10:05Z"),
        ]
        (sessions / "abc123.jsonl").write_text("\n".join(json.dumps(line) for line in lines) + "\n")
        env = {**os.environ, "HOME": str(home), "CLAUDE_CWD": str(repo), "GITHUB_USER": "someone"}
        subprocess.run([sys.executable, str(SCRIPTS / "extract-log.py")], cwd=repo, env=env, check=True, capture_output=True)
        return next((repo / ".claude-logs").glob("*.md")).read_text()


class FormatCheck(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import check_log_format
        cls.check = staticmethod(check_log_format.check)
        cls.good = good_log()

    def checks(self, text, name=NAME):
        return {check for check, _ in self.check(name, text)}

    def test_a_log_from_the_script_passes(self):
        self.assertEqual(self.check(NAME, self.good), [])

    def test_the_agent_line_is_allowed_only_right_after_project(self):
        project = re.search(r"^project: .*$", self.good, re.M).group(0)
        self.assertEqual(self.check(NAME, self.good.replace(project, f"{project}\nagent: codex", 1)), [])
        self.assertIn("frontmatter_keys", self.checks(self.good.replace(project, f"{project}\nagent: gpt", 1)))
        moved = self.good.replace(project, f"agent: codex\n{project}", 1)
        self.assertIn("frontmatter_keys", self.checks(moved))

    def test_drift_fails(self):
        cases = {
            "file name": ("filename", lambda t: t, "abc123.md"),
            "missing key": ("frontmatter_keys", lambda t: re.sub(r"^git_email: .*\n", "", t, flags=re.M), NAME),
            "reordered keys": ("frontmatter_keys", lambda t: re.sub(r"^(author: .*\n)(github_user: .*\n)", r"\2\1", t, flags=re.M), NAME),
            "unknown key": ("frontmatter_keys", lambda t: t.replace("---\n", "---\nmood: good\n", 1), NAME),
            "missing stat": ("frontmatter_keys", lambda t: re.sub(r"^total_prompt_words: .*\n", "", t, flags=re.M), NAME),
            "wrong stat": ("stats", lambda t: re.sub(r"^total_prompt_chars: .*$", "total_prompt_chars: 1", t, flags=re.M), NAME),
            "wrong exchange count": ("stats", lambda t: re.sub(r"^total_exchanges: .*$", "total_exchanges: 9", t, flags=re.M), NAME),
            "wrong status": ("stats", lambda t: t.replace("session_status: complete", "session_status: awaiting_response"), NAME),
            "changed heading": ("header", lambda t: t.replace("# Claude Session Log", "# Session Log"), NAME),
            "no session line": ("header", lambda t: re.sub(r"^Session: .*\n\n", "", t, flags=re.M), NAME),
            "renamed marker": ("entries", lambda t: t.replace("[CLAUDE_LOG_ENTRY type=PROMPT num=1", "[LOG_ENTRY type=PROMPT num=1"), NAME),
            "skipped number": ("entries", lambda t: t.replace("type=PROMPT num=2", "type=PROMPT num=3"), NAME),
            "other session": ("entries", lambda t: t.replace("num=1 session=abc123", "num=1 session=zzz"), NAME),
            "reordered fields": ("entries", lambda t: re.sub(r"^(chars: \d+\n)(words: \d+\n)", r"\2\1", t, count=1, flags=re.M), NAME),
            "wrong char count": ("entries", lambda t: re.sub(r"^chars: \d+$", "chars: 3", t, count=1, flags=re.M), NAME),
            "wrong word count": ("entries", lambda t: re.sub(r"^words: \d+$", "words: 99", t, count=1, flags=re.M), NAME),
            "wrong flag": ("entries", lambda t: t.replace("has_urls: True", "has_urls: False", 1), NAME),
            "wrong time": ("entries", lambda t: re.sub(r"^time: .*$", "time: 2020-01-01 00:00", t, count=1, flags=re.M), NAME),
        }
        for label, (expected, change, name) in cases.items():
            with self.subTest(label):
                self.assertIn(expected, self.checks(change(self.good), name))


if __name__ == "__main__":
    unittest.main()
