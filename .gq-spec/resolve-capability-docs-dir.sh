#!/usr/bin/env bash
#
# resolve-capability-docs-dir.sh — resolve + validate the Obsidian capability library root.
#
# Portable across macOS and Windows (Git Bash / WSL / native bash). No machine path is
# committed; resolution order (per-repo pin wins; Unity env is never a fallback):
#   1) .gq-spec/capability-docs-path (gitignored local pin — one line, absolute path)
#   2) GQ_CAPABILITY_DOCS_DIR only if that directory is the APP vault
#
# Does NOT read absolute paths from AGENTS.md (those are not portable).
#
# Usage:
#   bash .gq-spec/resolve-capability-docs-dir.sh           # print path, exit 0/1/2
#   bash .gq-spec/resolve-capability-docs-dir.sh --quiet   # path only on success
#   source or: eval "$(bash … --export)"  → export GQ_CAPABILITY_DOCS_DIR=…
#
# Exit codes:
#   0  ok — app vault path printed
#   1  unbound (missing pin / env is Unity or unset)
#   2  pin/env present but not an app vault
#
# App-family markers (this script is the APP template resolver):
#   0010 - Guideline of Capability Documents Maintenance.md
#   0600 - UI Adapter.md
# A Unity/game vault also has 0010*.md — that is NOT valid here. Never succeed
# against 210_Game_Dev. Exit 1 rather than look bound.

set -euo pipefail

quiet=0
do_export=0
for a in "$@"; do
  case "$a" in
    --quiet) quiet=1 ;;
    --export) do_export=1 ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

err() { printf '%s\n' "$*" >&2; }

# Normalize path for existence checks (Windows drive letters, trailing slash, quotes).
normalize_path() {
  local p="$1"
  p="${p//$'\r'/}"
  p="${p#"${p%%[![:space:]]*}"}"
  p="${p%"${p##*[![:space:]]}"}"
  p="${p%\"}"
  p="${p#\"}"
  p="${p%\'}"
  p="${p#\'}"
  # strip a single trailing slash (not drive roots)
  if [[ ${#p} -gt 3 && "$p" == */ ]]; then
    p="${p%/}"
  fi
  # Git Bash: convert Windows-style C:\foo if cygpath exists
  if command -v cygpath >/dev/null 2>&1 && [[ "$p" =~ ^[A-Za-z]:[\\/] ]]; then
    p="$(cygpath -u "$p" 2>/dev/null || printf '%s' "$p")"
  fi
  printf '%s' "$p"
}

is_app_capability_vault() {
  local dir="$1"
  [ -f "$dir/0010 - Guideline of Capability Documents Maintenance.md" ] &&
    [ -f "$dir/0600 - UI Adapter.md" ]
}

try_dir() {
  local raw="$1" source_label="$2"
  local p
  p="$(normalize_path "$raw")"
  [ -n "$p" ] || return 1
  if [ ! -d "$p" ]; then
    err "resolve-capability-docs-dir: path from ${source_label} is not a directory: ${p}"
    return 1
  fi
  if ! is_app_capability_vault "$p"; then
    err "resolve-capability-docs-dir: ${source_label} is not the app capability vault: ${p}"
    err "  Need 0010 - Guideline of Capability Documents Maintenance.md"
    err "  and  0600 - UI Adapter.md"
    err "  (A Unity/game vault with 0010*.md is not valid in this repo.)"
    return 2
  fi
  if [ "$do_export" -eq 1 ]; then
    printf 'export GQ_CAPABILITY_DOCS_DIR=%q\n' "$p"
  else
    printf '%s\n' "$p"
  fi
  if [ "$quiet" -eq 0 ] && [ "$do_export" -eq 0 ]; then
    err "resolve-capability-docs-dir: OK (${source_label}) → ${p}"
  fi
  return 0
}

# --- 1) local pin (gitignored) — per-repo authority ---
# A present pin is exclusive: never fall through to a Unity env on failure.
if [ -f .gq-spec/capability-docs-path ]; then
  pin="$(head -1 .gq-spec/capability-docs-path 2>/dev/null || true)"
  if [ -n "$(normalize_path "$pin")" ]; then
    if try_dir "$pin" ".gq-spec/capability-docs-path"; then
      exit 0
    fi
    err "resolve-capability-docs-dir: pin is present but invalid. Run: bash .gq-spec/bootstrap.sh"
    exit 2
  fi
fi

# --- 2) environment — APP vault only (Unity env is ignored) ---
if [ -n "${GQ_CAPABILITY_DOCS_DIR:-}" ]; then
  if try_dir "$GQ_CAPABILITY_DOCS_DIR" "GQ_CAPABILITY_DOCS_DIR"; then
    exit 0
  fi
  # Wrong family (Unity) or missing files: do not treat as bound.
fi

err "resolve-capability-docs-dir: capability library NOT resolved (unbound)."
err ""
err "This is an APP repo. Bind it with:"
err "  bash .gq-spec/bootstrap.sh"
err ""
err "Need the app vault: PimSpace/220_Dev_Project/Master_App_Capability"
err "  (marker: 0600 - UI Adapter.md)"
err "GQ_CAPABILITY_DOCS_DIR on this machine may still point at the Unity vault."
err "That env is not a valid fallback here. The gitignored pin is the authority."
err "Fallback: PimSpace/220_Dev_Project/Starter_Kit/Starter_Kit.md  or process 0000."
exit 1
