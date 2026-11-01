#!/usr/bin/env python3
"""Claude Code hook (UserPromptSubmit + Stop): run the 8x guide's extract-log.py for the session that fired.

The guide script must stay byte-for-byte unchanged, and it logs whichever transcript in
~/.claude/projects/<project>/ was modified most recently. With two sessions open in one
folder, that can be the wrong one. Claude Code passes the firing session's transcript_path
on stdin, so this wrapper marks that file as the newest, then runs the guide script with gh
on PATH and GITHUB_USER resolved (offline if needed), so attribution never falls back to
"unknown". It prints nothing: UserPromptSubmit output would be added to the conversation.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
from agent_log_common import attribution_env  # noqa: E402


def read_payload() -> dict:
    try:
        return json.loads(sys.stdin.read() or '{}')
    except json.JSONDecodeError:
        return {}


def mark_firing_transcript(payload: dict) -> None:
    """Touch the firing session's transcript so the guide script picks it as the latest."""
    transcript = payload.get('transcript_path')
    if not transcript:
        return
    path = Path(transcript)
    if path.is_file() and not path.name.startswith('agent-'):
        os.utime(path, None)


def main() -> None:
    payload = read_payload()
    mark_firing_transcript(payload)
    project = os.environ.get('CLAUDE_PROJECT_DIR') or payload.get('cwd') or os.getcwd()
    subprocess.run(
        [sys.executable, str(SCRIPTS / 'extract-log.py')],
        cwd=project,
        env=attribution_env(os.environ),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=60,
        check=False,
    )


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Logging must never block or break a Claude Code turn.
        pass
