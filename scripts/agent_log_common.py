"""Shared renderer for non-Claude agent logs (Codex, Cursor).

Reuses the helpers from extract-log.py (the 8x guide script, kept unchanged)
and writes the same markdown format to <repo>/.claude-logs/<timestamp>_<session-id>.md.
"""

import importlib.util
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

_spec = importlib.util.spec_from_file_location(
    'extract_log', Path(__file__).with_name('extract-log.py')
)
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)


def repo_root(start: Path) -> Path:
    """Resolve the git top-level for start, falling back to start itself."""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--show-toplevel'],
            cwd=start,
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return Path(result.stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError, NotADirectoryError):
        pass
    return start


def git_path(root: Path, name: str) -> Path:
    """Path inside the repo's git dir (never committed), e.g. for hook state."""
    result = subprocess.run(
        ['git', 'rev-parse', '--git-path', name],
        cwd=root,
        capture_output=True,
        text=True,
        timeout=5
    )
    return root / result.stdout.strip()


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec='milliseconds') + 'Z'


def write_log(root: Path, session_id: str, entries: List[Tuple[str, str, str]], agent: str) -> Optional[Path]:
    """Render entries exactly like extract-log.py's main() does, plus an `agent` line."""
    # The git/gh attribution helpers read config from the process cwd.
    os.chdir(root)
    entries = base.dedupe_entries(entries)
    if not entries:
        return None

    session_stats = base.calculate_session_stats(entries)

    output_dir = root / '.claude-logs'
    output_dir.mkdir(parents=True, exist_ok=True)

    existing_files = list(output_dir.glob(f"*_{session_id}.md"))
    date = datetime.now().strftime('%Y-%m-%d')
    if existing_files:
        output_path = existing_files[0]
    else:
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = output_dir / f"{timestamp}_{session_id}.md"

    last_entry_type = entries[-1][1]
    session_status = 'complete' if last_entry_type == 'assistant' else 'awaiting_response'

    author = base.get_git_author()
    github_user = base.get_github_user()
    git_email = base.get_git_email()
    lines = ["---"]
    lines.append(f"session_id: {session_id}")
    lines.append(f"date: {date}")
    lines.append(f"author: {author}")
    lines.append(f"github_user: {github_user}")
    lines.append(f"git_email: {git_email}")
    lines.append(f"project: {root.name}")
    lines.append(f"agent: {agent}")
    lines.append(f"session_status: {session_status}")
    lines.append(f"last_entry_type: {last_entry_type}")
    lines.append(f"total_exchanges: {len([e for e in entries if e[1] == 'user'])}")
    lines.append(f"generated_at: {datetime.now().isoformat()}")

    for key, value in session_stats.items():
        lines.append(f"{key}: {value}")

    lines.append("---\n")
    lines.append(f"# Claude Session Log - {date}\n")
    lines.append(f"Session: `{session_id}` | Project: `{root.name}` | Author: `{author}` | GitHub: `{github_user}`\n")
    lines.append("---\n")

    exchange_num = 0
    for timestamp, role, content in entries:
        time_str = base.format_timestamp(timestamp)
        if role == 'user':
            exchange_num += 1
            indicators = base.detect_paste_indicators(content)
            lines.append(f"\n[CLAUDE_LOG_ENTRY type=PROMPT num={exchange_num} session={session_id}]")
            lines.append(f"timestamp: {timestamp}")
            lines.append(f"time: {time_str}")
            lines.append(f"chars: {len(content)}")
            lines.append(f"words: {len(content.split())}")
            lines.append(f"has_code_block: {indicators['has_code_block']}")
            lines.append(f"has_file_paths: {indicators['has_file_paths']}")
            lines.append(f"has_urls: {indicators['has_urls']}")
            lines.append(f"likely_pasted: {indicators['likely_pasted']}")
            lines.append(f"\n{content}\n")
        else:
            lines.append(f"\n[CLAUDE_LOG_ENTRY type=RESPONSE num={exchange_num} session={session_id}]")
            lines.append(f"timestamp: {timestamp}")
            lines.append(f"time: {time_str}")
            lines.append(f"chars: {len(content)}")
            lines.append(f"\n{content}\n")

    output_path.write_text('\n'.join(lines))
    return output_path
