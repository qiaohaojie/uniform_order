#!/usr/bin/env bash
#
# bootstrap.sh — bind this app repo to the central process library and
# app capability vault. Idempotent. No machine path is committed.
#
# GitHub template clones do not include gitignored pins. This script writes
# them on this machine, chmod's the loggers, and refuses a Unity/game vault.
# Unbound work is forbidden: exit non-zero rather than look "ready".
#
# Usage (from the git root):
#   bash .gq-spec/bootstrap.sh
#   bash .gq-spec/bootstrap.sh --quiet
#
# Exit:
#   0  bound (pins valid, app family)
#   1  unbound — libraries not found or wrong family
#
# Discovery (first match wins):
#   1) existing valid pins
#   2) GQ_MASTER_APP_DEV_PROCESS_DIR (must be the app process library)
#   3) GQ_PIMSPACE_DIR / PIMSPACE_ROOT + 220_Dev_Project/...
#   4) a short list of well-known PimSpace locations
# Capability is the sibling Master_App_Capability/ (must contain
# 0600 - UI Adapter.md). GQ_CAPABILITY_DOCS_DIR is used only if it is
# already that app vault — never the Unity vault.

set -euo pipefail

quiet=0
for a in "$@"; do
  case "$a" in
    --quiet) quiet=1 ;;
    -h|--help)
      sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

err() { printf '%s\n' "$*" >&2; }
log() { [ "$quiet" -eq 1 ] || err "$*"; }

normalize_path() {
  local p="$1"
  p="${p//$'\r'/}"
  p="${p#"${p%%[![:space:]]*}"}"
  p="${p%"${p##*[![:space:]]}"}"
  p="${p%\"}"; p="${p#\"}"
  p="${p%\'}"; p="${p#\'}"
  if [[ ${#p} -gt 3 && "$p" == */ ]]; then
    p="${p%/}"
  fi
  if command -v cygpath >/dev/null 2>&1 && [[ "$p" =~ ^[A-Za-z]:[\\/] ]]; then
    p="$(cygpath -u "$p" 2>/dev/null || printf '%s' "$p")"
  fi
  printf '%s' "$p"
}

is_app_process_lib() {
  local d="$1"
  [ -n "$d" ] && [ -d "$d" ] &&
    [ -f "$d/0000 - Set Up a New Project for AI Agents.md" ] &&
    [ -f "$d/0010 - Master App Development Process Index.md" ]
}

is_app_capability_vault() {
  local d="$1"
  [ -n "$d" ] && [ -d "$d" ] &&
    [ -f "$d/0010 - Guideline of Capability Documents Maintenance.md" ] &&
    [ -f "$d/0600 - UI Adapter.md" ]
}

write_pin() {
  local file="$1" value="$2"
  mkdir -p .gq-spec
  printf '%s\n' "$value" > "$file"
}

# --- git root ---
if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  cd "$git_root"
elif [ ! -f AGENTS.md ]; then
  err "bootstrap: run from the app git root (AGENTS.md not found)."
  exit 1
fi

process_pin=".gq-spec/master-app-dev-process-path"
cap_pin=".gq-spec/capability-docs-path"
rel_process="220_Dev_Project/Master_App_Dev_Process"
rel_cap="220_Dev_Project/Master_App_Capability"

process_dir=""
cap_dir=""
source_label=""

# --- 1) existing valid pins ---
if [ -f "$process_pin" ] && [ -f "$cap_pin" ]; then
  p="$(normalize_path "$(head -1 "$process_pin")")"
  c="$(normalize_path "$(head -1 "$cap_pin")")"
  if is_app_process_lib "$p" && is_app_capability_vault "$c"; then
    process_dir="$p"
    cap_dir="$c"
    source_label="existing pins"
  fi
fi

# --- 2) env process lib ---
if [ -z "$process_dir" ] && [ -n "${GQ_MASTER_APP_DEV_PROCESS_DIR:-}" ]; then
  p="$(normalize_path "$GQ_MASTER_APP_DEV_PROCESS_DIR")"
  if is_app_process_lib "$p"; then
    process_dir="$p"
    source_label="GQ_MASTER_APP_DEV_PROCESS_DIR"
    sibling="$(normalize_path "$p/../Master_App_Capability")"
    if is_app_capability_vault "$sibling"; then
      cap_dir="$sibling"
    fi
  fi
fi

# --- 3) PimSpace roots ---
try_pimspace() {
  local root="$1" why="$2"
  [ -n "$root" ] || return 1
  root="$(normalize_path "$root")"
  [ -d "$root" ] || return 1
  if is_app_process_lib "$root/$rel_process" && is_app_capability_vault "$root/$rel_cap"; then
    process_dir="$root/$rel_process"
    cap_dir="$root/$rel_cap"
    source_label="$why"
    return 0
  fi
  return 1
}

if [ -z "$process_dir" ] || [ -z "$cap_dir" ]; then
  try_pimspace "${GQ_PIMSPACE_DIR:-}" "GQ_PIMSPACE_DIR" || true
fi
if [ -z "$process_dir" ] || [ -z "$cap_dir" ]; then
  try_pimspace "${PIMSPACE_ROOT:-}" "PIMSPACE_ROOT" || true
fi

if [ -z "$process_dir" ] || [ -z "$cap_dir" ]; then
  home="${HOME:-}"
  userprofile="${USERPROFILE:-}"
  candidates=()
  [ -n "$home" ] && candidates+=(
    "$home/Documents/obs_pimspace/PimSpace"
    "$home/Documents/PimSpace"
  )
  [ -n "$userprofile" ] && candidates+=(
    "$userprofile/Documents/obs_pimspace/PimSpace"
    "$userprofile/Documents/PimSpace"
  )
  if [ -n "${USER:-}" ]; then
    for vol in /Volumes/*; do
      [ -d "$vol" ] || continue
      candidates+=(
        "$vol/Documents/obs_pimspace/PimSpace"
        "$vol/${USER}/Documents/obs_pimspace/PimSpace"
      )
    done
  fi
  for cand in "${candidates[@]}"; do
    if try_pimspace "$cand" "discovered:$cand"; then
      break
    fi
  done
fi

# --- 4) env capability only if it is already the app vault ---
if [ -z "$cap_dir" ] && [ -n "${GQ_CAPABILITY_DOCS_DIR:-}" ]; then
  c="$(normalize_path "$GQ_CAPABILITY_DOCS_DIR")"
  if is_app_capability_vault "$c"; then
    cap_dir="$c"
    sibling="$(normalize_path "$c/../Master_App_Dev_Process")"
    if [ -z "$process_dir" ] && is_app_process_lib "$sibling"; then
      process_dir="$sibling"
      source_label="${source_label:-GQ_CAPABILITY_DOCS_DIR (app vault)}"
    fi
  else
    log "bootstrap: ignoring GQ_CAPABILITY_DOCS_DIR (not an app vault): $c"
  fi
fi

if ! is_app_process_lib "${process_dir:-}" || ! is_app_capability_vault "${cap_dir:-}"; then
  err "bootstrap: UNBOUND — app process library and/or app capability vault not found."
  err ""
  err "Need:"
  err "  PimSpace/220_Dev_Project/Master_App_Dev_Process"
  err "    (file: 0010 - Master App Development Process Index.md)"
  err "  PimSpace/220_Dev_Project/Master_App_Capability"
  err "    (file: 0600 - UI Adapter.md)"
  err ""
  err "A Unity/game vault in GQ_CAPABILITY_DOCS_DIR is not valid for this repo."
  err "Fallback: give an agent process 0000 and say “Read this and set up.”"
  err "  See PimSpace/220_Dev_Project/Starter_Kit/Starter_Kit.md"
  exit 1
fi

write_pin "$process_pin" "$process_dir"
write_pin "$cap_pin" "$cap_dir"

# Loggers must be executable in the working tree. Mode 755 is also committed
# in the template; update-index repairs clones that lost +x. Skip untracked
# files (update-index --chmod=+x cannot --add).
for f in bootstrap.sh log-capability-lesson.sh resolve-capability-docs-dir.sh log-decision.sh check-heroui-pro-mcp.sh check-playwright-cli.sh; do
  chmod +x ".gq-spec/$f" 2>/dev/null || true
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1 &&
     git ls-files --error-unmatch ".gq-spec/$f" >/dev/null 2>&1; then
    git update-index --chmod=+x ".gq-spec/$f" 2>/dev/null || true
  fi
done

# Prove the capability resolver agrees (app family, not Unity).
if ! bash .gq-spec/resolve-capability-docs-dir.sh --quiet >/dev/null; then
  err "bootstrap: pins written but capability resolver still failed."
  bash .gq-spec/resolve-capability-docs-dir.sh || true
  exit 1
fi

resolved="$(bash .gq-spec/resolve-capability-docs-dir.sh --quiet)"
log "bootstrap: PASS (bound)"
log "  source=     $source_label"
log "  process=    $process_dir"
log "  capability= $resolved"
log "  pins=       $process_pin , $cap_pin (gitignored)"

# Hard gates for UI / web drive. Bootstrap only reports; coding-time
# gates (process 0200 Steps 3a / 3b) stop on failure.
report_gate() {
  local script="$1" label="$2" runbook="$3"
  if [ ! -x "$script" ] && [ ! -f "$script" ]; then
    log "  ${label}= SCRIPT MISSING — $script"
    log "  ${label} work is blocked until ${runbook} is followed."
    return
  fi
  chmod +x "$script" 2>/dev/null || true
  local out rc
  set +e
  out="$(bash "$script" 2>&1)"
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then
    log "  ${label}= $out"
  else
    log "  ${label}= NOT READY — $out"
    log "  ${label} work is blocked until ${runbook} is followed."
  fi
}

report_gate ".gq-spec/check-heroui-pro-mcp.sh" "heroui-pro" "docs/runbooks/heroui-pro-mcp.md"
report_gate ".gq-spec/check-playwright-cli.sh" "playwright-cli" "docs/runbooks/playwright-cli.md"
exit 0
