#!/bin/bash
# Regenerate a session's log from inside a worktree, with project: Health. Usage: tools/review/regen-log.sh <session-id>
# extract-log.py names the project after its folder, so it runs through a folder named Health that points at this worktree.
# Entering a worktree also moves the transcript, so the same folder's project entry points at the transcripts.
# Nothing in the guide's script or format changes.
set -euo pipefail
id=${1:?session id}
root=$(cd "$(dirname "$0")/../.." && pwd)
transcripts="$HOME/.claude/projects/$(printf %s "$root" | tr '/.' '--')"
[ -f "$transcripts/$id.jsonl" ] || { echo "No transcript for $id in $transcripts" >&2; exit 1; }
base="${TMPDIR:-/tmp}"; base="${base%/}/rhythm-log-$id"
mkdir -p "$base"
ln -sfn "$root" "$base/Health"
ln -sfn "$transcripts" "$HOME/.claude/projects/$(printf %s "$base/Health" | tr '/' '-')"
cd "$root"
printf '{"transcript_path":"%s"}' "$transcripts/$id.jsonl" | CLAUDE_PROJECT_DIR="$root" CLAUDE_CWD="$base/Health" python3 scripts/claude-log-hook.py
ls .claude-logs | grep "$id"
