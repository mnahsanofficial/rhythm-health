"""Behaviour tests for the agent-log hooks. Run: python3 -m unittest discover -s scripts/tests"""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))


def load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


import agent_log_common as common  # noqa: E402

AMBIENT = "# Overview\n\nGenerate 0 to 3 hyperpersonalized suggestions for what this user can do with Codex in this local project"


def git_repo(path: Path) -> Path:
    subprocess.run(["git", "init", "-q", str(path)], check=True)
    subprocess.run(["git", "-C", str(path), "config", "user.name", "Test Person"], check=True)
    subprocess.run(["git", "-C", str(path), "config", "user.email", "test@example.invalid"], check=True)
    return path


def claude_transcript(path: Path, prompt: str, reply: str, when: str) -> Path:
    lines = [
        {"type": "user", "timestamp": when, "message": {"role": "user", "content": prompt}},
        {"type": "assistant", "timestamp": when, "message": {"role": "assistant", "content": [{"type": "text", "text": reply}]}},
    ]
    path.write_text("\n".join(json.dumps(line) for line in lines) + "\n")
    return path


class ResolveGithubUser(unittest.TestCase):
    def test_uses_the_authenticated_login(self):
        done = subprocess.CompletedProcess([], 0, stdout="mnahsanofficial\n", stderr="")
        with mock.patch.object(common.subprocess, "run", return_value=done) as run:
            self.assertEqual(common.resolve_github_user(), "mnahsanofficial")
        self.assertEqual(run.call_args_list[0].args[0][:3], ["gh", "api", "user"])

    def test_falls_back_to_the_local_active_account_when_offline(self):
        failed = subprocess.CompletedProcess([], 1, stdout="", stderr="network")
        local = subprocess.CompletedProcess([], 0, stdout="mnahsanofficial\n", stderr="")
        with mock.patch.object(common.subprocess, "run", side_effect=[failed, local]) as run:
            self.assertEqual(common.resolve_github_user(), "mnahsanofficial")
        self.assertEqual(run.call_args_list[1].args[0], ["gh", "config", "get", "-h", "github.com", "user"])

    def test_returns_none_when_gh_is_missing(self):
        with mock.patch.object(common.subprocess, "run", side_effect=FileNotFoundError):
            self.assertIsNone(common.resolve_github_user())

    def test_hook_environment_finds_homebrew_gh_and_sets_the_login(self):
        env = common.attribution_env({"PATH": "/usr/bin:/bin", "HOME": "/tmp"}, resolver=lambda: "mnahsanofficial")
        self.assertIn("/opt/homebrew/bin", env["PATH"].split(":"))
        self.assertEqual(env["GITHUB_USER"], "mnahsanofficial")

    def test_hook_environment_keeps_an_explicit_login(self):
        env = common.attribution_env({"PATH": "/usr/bin", "GITHUB_USER": "shakeb03"}, resolver=lambda: "someone-else")
        self.assertEqual(env["GITHUB_USER"], "shakeb03")


class ClaudeHook(unittest.TestCase):
    def setUp(self):
        self.hook = load("claude_log_hook", "claude-log-hook.py")

    def test_marks_the_firing_sessions_transcript_as_newest(self):
        with tempfile.TemporaryDirectory() as tmp:
            firing = Path(tmp, "firing.jsonl")
            other = Path(tmp, "other.jsonl")
            firing.write_text("{}\n")
            other.write_text("{}\n")
            old = time.time() - 600
            os.utime(firing, (old, old))
            self.hook.mark_firing_transcript({"transcript_path": str(firing)})
            self.assertGreater(firing.stat().st_mtime, other.stat().st_mtime)

    def test_logs_the_session_that_fired_not_the_newest_transcript(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp, "home")
            repo = git_repo(Path(tmp, "repo"))
            real = os.path.realpath(repo)
            sessions = home / ".claude" / "projects" / real.replace("/", "-")
            sessions.mkdir(parents=True)
            firing = claude_transcript(sessions / "aaaaaaaa-firing.jsonl", "LOG CHECK firing", "reply A", "2026-11-01T08:00:00Z")
            claude_transcript(sessions / "bbbbbbbb-other.jsonl", "the other session", "reply B", "2026-11-01T08:01:00Z")
            old = time.time() - 600
            os.utime(firing, (old, old))

            env = {**os.environ, "HOME": str(home), "CLAUDE_PROJECT_DIR": real, "GITHUB_USER": "mnahsanofficial"}
            payload = json.dumps({"session_id": "aaaaaaaa-firing", "transcript_path": str(firing), "hook_event_name": "Stop"})
            result = subprocess.run([sys.executable, str(SCRIPTS / "claude-log-hook.py")], input=payload, text=True,
                                    cwd=real, env=env, capture_output=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, "", "a prompt hook's output would be added to the conversation")

            logs = list(Path(real, ".claude-logs").glob("*.md"))
            self.assertEqual([p.name.split("_")[-1] for p in logs], ["aaaaaaaa-firing.md"])
            text = logs[0].read_text()
            self.assertIn("LOG CHECK firing", text)
            self.assertNotIn("the other session", text)
            self.assertIn("github_user: mnahsanofficial", text)

    def test_guide_script_is_unchanged(self):
        import hashlib
        digest = hashlib.sha256((SCRIPTS / "extract-log.py").read_bytes()).hexdigest()
        self.assertEqual(digest, "440fc0393c91af63eea6f9eeaeb93ade64afb475a0ba0c552eec29b33d53a735")


class CodexExtractor(unittest.TestCase):
    def setUp(self):
        self.codex = load("extract_log_codex", "extract-log-codex.py")
        self.cwd = os.getcwd()

    def tearDown(self):
        os.chdir(self.cwd)

    def rollout(self, home: Path, session_id: str, source, items):
        day = home / "sessions" / "2026" / "11" / "01"
        day.mkdir(parents=True, exist_ok=True)
        path = day / f"rollout-2026-11-01T10-00-00-{session_id}.jsonl"
        lines = [{"type": "session_meta", "timestamp": "2026-11-01T04:00:00Z", "payload": {"id": session_id, "cwd": "/x", "source": source}}]
        for role, text in items:
            kind = "UserMessage" if role == "user" else "AgentMessage"
            lines.append({"type": "event_msg", "timestamp": "2026-11-01T04:00:01Z",
                          "payload": {"type": "item_completed", "item": {"type": kind, "content": [{"type": "text", "text": text}]}}})
        path.write_text("\n".join(json.dumps(line) for line in lines) + "\n")
        return path

    def run_hook(self, payload, codex_home):
        with mock.patch.dict(os.environ, {"CODEX_HOME": str(codex_home)}), \
             mock.patch("sys.stdin", new=__import__("io").StringIO(json.dumps(payload))):
            self.codex.main()

    def test_skips_the_background_suggestions_job(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = git_repo(Path(tmp, "repo"))
            self.run_hook({"session_id": "01ambient", "prompt": AMBIENT, "cwd": str(repo), "hook_event_name": "UserPromptSubmit"}, Path(tmp, "codex"))
            self.assertFalse(Path(repo, ".claude-logs").exists())

    def test_skips_sub_agent_sessions(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = git_repo(Path(tmp, "repo"))
            home = Path(tmp, "codex")
            path = self.rollout(home, "01guardian", {"subagent": {"other": "guardian"}},
                                [("user", "The following is the Codex agent history whose request action you are assessing.")])
            self.run_hook({"session_id": "01guardian", "transcript_path": str(path), "cwd": str(repo), "hook_event_name": "Stop"}, home)
            self.assertFalse(Path(repo, ".claude-logs").exists())

    def test_logs_a_real_session_with_attribution_even_when_gh_is_unreachable(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = git_repo(Path(tmp, "repo"))
            home = Path(tmp, "codex")
            path = self.rollout(home, "01realsession", "vscode", [("user", "LOG CHECK — Codex"), ("assistant", "Logged.")])
            env = {k: v for k, v in os.environ.items() if k != "GITHUB_USER"}
            with mock.patch.dict(os.environ, env, clear=True), \
                 mock.patch.object(sys.modules["agent_log_common"], "resolve_github_user", return_value="mnahsanofficial"):
                self.run_hook({"session_id": "01realsession", "transcript_path": str(path), "cwd": str(repo), "hook_event_name": "Stop"}, home)
            logs = list(Path(repo, ".claude-logs").glob("*_01realsession.md"))
            self.assertEqual(len(logs), 1)
            text = logs[0].read_text()
            self.assertIn("LOG CHECK — Codex", text)
            self.assertIn("github_user: mnahsanofficial", text)


if __name__ == "__main__":
    unittest.main()
