#!/usr/bin/env python3
"""Cursor hook (beforeSubmitPrompt, afterAgentResponse, stop): write prompts and final responses to .claude-logs/.

Cursor hands the prompt and the agent's final response text directly in the
hook payload, so each event is appended to a per-conversation state file in
the git dir (never committed) and the log is re-rendered from it.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from agent_log_common import git_path, now_iso, repo_root, write_log  # noqa: E402


def main():
    try:
        payload = json.loads(sys.stdin.read() or '{}')
    except json.JSONDecodeError:
        payload = {}

    event = payload.get('hook_event_name', '')
    # Cursor expects a JSON reply on stdout; never block the agent.
    print(json.dumps({'continue': True} if event == 'beforeSubmitPrompt' else {}))

    session_id = payload.get('conversation_id', '')
    if not session_id:
        return

    roots = payload.get('workspace_roots') or []
    root = repo_root(Path(roots[0] if roots else os.getcwd()))

    state_path = git_path(root, f'agent-log-state/cursor-{session_id}.json')
    state_path.parent.mkdir(parents=True, exist_ok=True)
    entries = json.loads(state_path.read_text()) if state_path.exists() else []

    if event == 'beforeSubmitPrompt' and (payload.get('prompt') or '').strip():
        entries.append([now_iso(), 'user', payload['prompt'].strip()])
    elif event == 'afterAgentResponse' and (payload.get('text') or '').strip():
        entries.append([now_iso(), 'assistant', payload['text'].strip()])

    state_path.write_text(json.dumps(entries))
    write_log(root, session_id, [tuple(e) for e in entries], agent='cursor')


if __name__ == '__main__':
    main()
