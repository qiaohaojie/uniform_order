#!/usr/bin/env bash
#
# resolve-capability-docs-dir.sh — resolve + validate the app capability vault.
#
# Portable across macOS and Windows (Git Bash / WSL / native bash). No machine
# path is committed. The only source is the gitignored pin bootstrap.sh writes:
#   .gq-spec/capability-docs-path   (one line, absolute path)
#
# No environment variable is read. A machine-wide GQ_CAPABILITY_DOCS_DIR can
# point at a different document library, so it is never an input here.
# Does NOT read absolute paths from AGENTS.md (those are not portable).
#
# Usage:
#   bash .gq-spec/resolve-capability-docs-dir.sh           # print path, exit 0/1/2
#   bash .gq-spec/resolve-capability-docs-dir.sh --quiet   # path only on success
#   eval "$(bash … --export)"  → export GQ_CAPABILITY_DOCS_DIR=<pinned vault>
#
# Exit codes:
#   0  ok — app vault path printed
#   1  unbound (no pin)
#   2  pin present but not the app capability vault
#
# The app capability vault is PimSpace/220_Dev_Project/Master_App_Capability.
# Markers (both required):
#   0010 - Guideline of Capability Documents Maintenance.md
#   0600 - UI Adapter.md
#
# Pins are gitignored, so every clone and every `git worktree` starts unbound.
# Bind each one with: bash .gq-spec/bootstrap.sh
# Self-test (fake vaults only): bash .gq-spec/tests/capability-resolver.test.sh

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

# --- the gitignored pin is the only source ---
if [ -f .gq-spec/capability-docs-path ]; then
  pin="$(head -1 .gq-spec/capability-docs-path 2>/dev/null || true)"
  if [ -n "$(normalize_path "$pin")" ]; then
    if try_dir "$pin" ".gq-spec/capability-docs-path"; then
      exit 0
    fi
    err "resolve-capability-docs-dir: pin is present but invalid. Run in this worktree:"
    err "  bash .gq-spec/bootstrap.sh"
    exit 2
  fi
fi

err "resolve-capability-docs-dir: capability library NOT resolved (unbound)."
err ""
err "Bind this worktree with:"
err "  bash .gq-spec/bootstrap.sh"
err "(Pins are gitignored: a new clone or git worktree does not inherit them.)"
err ""
err "Need the app capability vault: PimSpace/220_Dev_Project/Master_App_Capability"
err "  (marker: 0600 - UI Adapter.md)"
err "No environment variable is read. The gitignored pin is the only source."
err "Fallback: PimSpace/220_Dev_Project/Starter_Kit/Starter_Kit.md  or process 0000."
exit 1
