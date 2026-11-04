#!/usr/bin/env python3
"""Checks one log against the exact format extract-log.py writes (docs/agent-logging-setup.md).

logs:check calls this with {"name": ..., "text": ...} on stdin and gets [[check, message], ...] back.
Values are recomputed with the script's own functions, so this check can't disagree with what it writes.
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from agent_log_common import base  # noqa: E402

FILENAME = re.compile(r'\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_[^_/]+\.md')
BEFORE_AGENT = ['session_id', 'date', 'author', 'github_user', 'git_email', 'project']
AFTER_AGENT = ['session_status', 'last_entry_type', 'total_exchanges', 'generated_at']
STATS = [
    'first_prompt_time', 'last_prompt_time', 'session_duration_minutes', 'avg_time_between_prompts_minutes',
    'total_prompt_chars', 'total_prompt_words', 'avg_prompt_length_chars', 'avg_prompt_length_words',
    'longest_prompt_words', 'shortest_prompt_words', 'total_response_chars', 'avg_response_length_chars',
    'response_to_prompt_ratio', 'prompts_with_code_blocks', 'prompts_with_file_paths', 'prompts_with_urls',
    'prompts_with_long_content', 'likely_pasted_count',
]
AGENTS = {'codex', 'cursor'}
PROMPT_FIELDS = ['timestamp', 'time', 'chars', 'words', 'has_code_block', 'has_file_paths', 'has_urls', 'likely_pasted']
RESPONSE_FIELDS = ['timestamp', 'time', 'chars']
MARKER = re.compile(r'\n\[CLAUDE_LOG_ENTRY type=(PROMPT|RESPONSE) num=(\d+) session=([^\]\n]*)\]\n')
Problem = Tuple[str, str]
Entry = Tuple[str, str, str]


def read_fields(text: str, pos: int, names: List[str]) -> Tuple[Optional[Dict[str, str]], int]:
    values: Dict[str, str] = {}
    for name in names:
        end = text.find('\n', pos)
        line = text[pos:end] if end >= 0 else ''
        if end < 0 or not line.startswith(f'{name}: '):
            return None, pos
        values[name] = line[len(name) + 2:]
        pos = end + 1
    return values, pos


def read_entries(text: str, session_id: str, problems: List[Problem]) -> Optional[List[Entry]]:
    """Walk the body, using each entry's chars to find its end. None if the structure breaks."""
    entries: List[Entry] = []
    prompts = 0
    pos = 0
    while pos < len(text):
        marker = MARKER.match(text, pos)
        if not marker:
            problems.append(('entries', f'expected a CLAUDE_LOG_ENTRY marker, found {text[pos:pos + 50]!r}'))
            return None
        kind, num, session = marker.groups()
        label = f'{kind.lower()} #{num}'
        prompts += kind == 'PROMPT'
        if int(num) != prompts:
            problems.append(('entries', f'{label} should be numbered {prompts}'))
        if session != session_id:
            problems.append(('entries', f'{label} names session {session}'))

        fields, pos = read_fields(text, marker.end(), PROMPT_FIELDS if kind == 'PROMPT' else RESPONSE_FIELDS)
        if fields is None or not fields['chars'].isdigit() or text[pos:pos + 1] != '\n':
            problems.append(('entries', f'{label} has wrong or misordered fields'))
            return None
        start = pos + 1
        end = start + int(fields['chars'])
        content = text[start:end]
        # An entry ends with one newline at the end of the file, or a blank line before the next marker.
        if text[end:] != '\n' and not (text[end:end + 2] == '\n\n' and MARKER.match(text, end + 2)):
            problems.append(('entries', f'{label} has the wrong chars value'))
            return None
        if content != content.strip():
            problems.append(('entries', f'{label} has text that was not trimmed'))
        if base.format_timestamp(fields['timestamp']) != fields['time']:
            problems.append(('entries', f'{label} has a time that does not match its timestamp'))
        if kind == 'PROMPT':
            if int(fields['words']) != len(content.split()):
                problems.append(('entries', f'{label} has the wrong word count'))
            indicators = base.detect_paste_indicators(content)
            for flag in ('has_code_block', 'has_file_paths', 'has_urls', 'likely_pasted'):
                if fields[flag] != str(indicators[flag]):
                    problems.append(('entries', f'{label} has the wrong {flag}'))
        entries.append((fields['timestamp'], 'user' if kind == 'PROMPT' else 'assistant', content))
        pos = end + 2
    return entries


def check(name: str, text: str) -> List[Problem]:
    problems: List[Problem] = []
    if not FILENAME.fullmatch(name):
        problems.append(('filename', 'file name is not <YYYY-MM-DD_HH-MM-SS>_<session-id>.md'))

    front = re.match(r'---\n(.*?)\n---\n', text, re.S)
    if not front:
        return problems + [('frontmatter_keys', 'no frontmatter')]
    pairs = [line.partition(':') for line in front.group(1).split('\n')]
    keys = [key for key, _, _ in pairs]
    values = {key: value.strip() for key, _, value in pairs}

    expected_order = BEFORE_AGENT + ['agent'] + AFTER_AGENT + STATS
    for key in keys:
        if key not in expected_order:
            problems.append(('frontmatter_keys', f'unexpected frontmatter key {key}'))
    known = [key for key in keys if key in expected_order]
    if known != sorted(known, key=expected_order.index):
        problems.append(('frontmatter_keys', "frontmatter keys aren't in the guide's order"))
    for key in BEFORE_AGENT + AFTER_AGENT:
        if key not in values:
            problems.append(('frontmatter_keys', f'missing frontmatter key {key}'))
    if 'agent' in values and values['agent'] not in AGENTS:
        problems.append(('frontmatter_keys', f"agent is {values['agent']}, not one of {sorted(AGENTS)}"))
    if 'agent' in keys and 'project' in keys and keys.index('agent') != keys.index('project') + 1:
        problems.append(('frontmatter_keys', 'agent must come right after project'))

    body = text[front.end():]
    header = (
        f"\n# Claude Session Log - {values.get('date')}\n\n"
        f"Session: `{values.get('session_id')}` | Project: `{values.get('project')}` | "
        f"Author: `{values.get('author')}` | GitHub: `{values.get('github_user')}`\n\n---\n\n"
    )
    if not body.startswith(header):
        problems.append(('header', "the header block doesn't match the guide's"))
        return problems

    entries = read_entries(body[len(header):], values.get('session_id', ''), problems)
    if entries is None:
        return problems

    stats = base.calculate_session_stats(entries)
    for key in STATS:
        if key in stats and key not in values:
            problems.append(('frontmatter_keys', f'missing frontmatter key {key}'))
        elif key in stats and values[key] != str(stats[key]):
            problems.append(('stats', f'{key} is {values[key]}, but the entries give {stats[key]}'))
        elif key in values and key not in stats:
            problems.append(('frontmatter_keys', f'{key} should not be there for these entries'))

    last = entries[-1][1] if entries else 'unknown'
    status = 'complete' if last == 'assistant' else 'awaiting_response'
    prompts = sum(1 for entry in entries if entry[1] == 'user')
    for key, value in (('last_entry_type', last), ('session_status', status), ('total_exchanges', str(prompts))):
        if key in values and values[key] != value:
            problems.append(('stats', f'{key} is {values[key]}, but the entries give {value}'))
    return problems


if __name__ == '__main__':
    payload = json.load(sys.stdin)
    json.dump(check(payload['name'], payload['text']), sys.stdout)
