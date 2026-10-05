#!/usr/bin/env bash
#
# log-capability-lesson.sh — kept for callers that still use the old name.
#
# It no longer writes to the capability vault. The app libraries are the gold
# layer and no agent writes there; every lesson goes to the landing zone through
# log-lesson.sh, and a scheduled refine job files it in the owning document.
# Contract: <220_Dev_Project>/AGENTS.md.
#
# Same env as before (GQ_DOC_ID GQ_KIND GQ_STATUS GQ_SUMMARY, optional
# GQ_DETAIL GQ_EVIDENCE GQ_VERSION_SCOPE GQ_MILESTONE GQ_PROJECT GQ_LINKS).
# New callers use log-lesson.sh and set GQ_LIBRARY.

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$script_dir/log-lesson.sh" ]; then
  echo "log-capability-lesson.sh: log-lesson.sh is missing beside this script; nothing written." >&2
  echo "  Copy it from the process library's _harness/ folder." >&2
  exit 1
fi
GQ_LIBRARY="${GQ_LIBRARY:-capability}" exec bash "$script_dir/log-lesson.sh"
