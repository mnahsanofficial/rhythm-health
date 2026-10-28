#!/usr/bin/env python3
"""Codex hook (UserPromptSubmit + Stop): write the session's prompts and final responses to .claude-logs/.

Reads the hook payload on stdin, then Codex's own rollout transcript
(~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl). Only user_message and
agent_message events are kept; tool calls, reasoning and outputs are dropped.
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from agent_log_common import now_iso, repo_root, write_log  # noqa: E402


def read_payload() -> dict:
    try:
        return json.loads(sys.stdin.read() or '{}')
    except json.JSONDecodeError:
        return {}


def find_rollout(session_id: str) -> Optional[Path]:
    """Fallback when the payload has no transcript_path."""
    sessions = Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')) / 'sessions'
    if not session_id or not sessions.exists():
        return None
    matches = sorted(sessions.rglob(f'rollout-*{session_id}.jsonl'), key=lambda p: p.stat().st_mtime)
    return matches[-1] if matches else None


def extract_clean_log(jsonl_path: Path) -> List[Tuple[str, str, str]]:
    entries = []
    for line in jsonl_path.read_text().strip().split('\n'):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get('type') != 'event_msg':
            continue
        payload = entry.get('payload') or {}
        message = payload.get('message')
        if not isinstance(message, str) or not message.strip():
            continue
        timestamp = entry.get('timestamp', '')
        if payload.get('type') == 'user_message':
            entries.append((timestamp, 'user', message.strip()))
        elif payload.get('type') == 'agent_message':
            entries.append((timestamp, 'assistant', message.strip()))
    return entries


def main():
    payload = read_payload()
    session_id = payload.get('session_id', '')
    transcript = payload.get('transcript_path')
    path = Path(transcript) if transcript else find_rollout(session_id)

    entries = extract_clean_log(path) if path and path.exists() else []

    # The rollout is written asynchronously; fill in from the payload if it lags.
    prompt = (payload.get('prompt') or '').strip()
    users = [c for _, r, c in entries if r == 'user']
    if prompt and (not users or users[-1] != prompt):
        entries.append((now_iso(), 'user', prompt))
    last = (payload.get('last_assistant_message') or '').strip()
    if last and entries and entries[-1][1] == 'user':
        entries.append((now_iso(), 'assistant', last))

    if not session_id or not entries:
        return

    root = repo_root(Path(payload.get('cwd') or os.getcwd()))
    write_log(root, session_id, entries, agent='codex')


if __name__ == '__main__':
    main()
