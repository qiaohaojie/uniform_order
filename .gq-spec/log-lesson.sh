#!/usr/bin/env bash
#
# log-lesson.sh — write one reusable lesson to the LANDING zone.
#
# The two app libraries (Master_App_Capability, Master_App_Dev_Process) are the
# gold layer. No agent writes there. A lesson lands as one file in
#   <220_Dev_Project>/Master_App_Landing/inbox/
# and a scheduled refine job moves it into the owning gold document.
# Contract: <220_Dev_Project>/AGENTS.md.
#
# Read before you write: open INDEX.md in the library you think owns the
# lesson. If a rule there already covers it, do not log it.
#
# The landing zone is found from the gitignored process pin
#   .gq-spec/master-app-dev-process-path   (bootstrap.sh writes it)
# as the sibling folder Master_App_Landing. No environment variable binds it.
# Pins are per checkout: in a new git worktree run `bash .gq-spec/bootstrap.sh`.
#
# Env (required):
#   GQ_KIND       works | fails | note
#   GQ_STATUS     provisional | verified
#   GQ_SUMMARY    one short line
#
# Env (optional):
#   GQ_LIBRARY    capability | process | identity   (default capability)
#                 capability = a stack adapter fact (package, framework, host)
#                 process    = how to do an activity (test, drive, land, verify)
#                 identity   = a vendor account, install or auth quirk
#   GQ_DOC_ID     four-digit id of the gold doc you think owns it. A hint only;
#                 the refine job decides the owner.
#   GQ_TOUCHES    the INDEX.md line or rule this lesson changes or contradicts
#   GQ_DETAIL GQ_EVIDENCE GQ_VERSION_SCOPE GQ_MILESTONE GQ_PROJECT GQ_LINKS
#   GQ_SKIP_VAULT=1   in-repo log only (emergency; build skills must not use it)
#   GQ_ID             force the id (tests)
#
# Exit: 0 logged, or an identical summary is already waiting (its id is printed)
#       1 landing zone not resolved (unbound) — nothing written
#       2 bad arguments — nothing written
# Prints the lesson id on stdout.

set -euo pipefail

library="${GQ_LIBRARY:-capability}"
doc_id="${GQ_DOC_ID:-}"
kind="${GQ_KIND:-}"
status="${GQ_STATUS:-}"
summary="${GQ_SUMMARY:-}"

if [ -z "$kind" ] || [ -z "$status" ] || [ -z "$summary" ]; then
  echo "log-lesson.sh: GQ_KIND, GQ_STATUS, GQ_SUMMARY are required." >&2
  exit 2
fi
case "$library" in capability|process|identity) ;; *)
  echo "log-lesson.sh: GQ_LIBRARY must be capability|process|identity (got: $library)" >&2
  exit 2
  ;;
esac
case "$kind" in works|fails|note) ;; *)
  echo "log-lesson.sh: GQ_KIND must be works|fails|note (got: $kind)" >&2
  exit 2
  ;;
esac
case "$status" in provisional|verified) ;; *)
  echo "log-lesson.sh: GQ_STATUS must be provisional|verified (got: $status)" >&2
  exit 2
  ;;
esac
if [ -n "$doc_id" ]; then
  if [[ "$doc_id" =~ ^[0-9]{1,4}$ ]]; then
    doc_id="$(printf '%04d' "$((10#$doc_id))")"
  else
    echo "log-lesson.sh: GQ_DOC_ID must be a four-digit id (got: $doc_id)" >&2
    exit 2
  fi
fi

one_line() { printf '%s' "$1" | tr '\r\n' '  ' | sed -e 's/[[:space:]]\{1,\}/ /g' -e 's/^ //' -e 's/ $//'; }

summary="$(one_line "$summary")"
detail="${GQ_DETAIL:-}"
evidence="${GQ_EVIDENCE:-}"
version_scope="$(one_line "${GQ_VERSION_SCOPE:-}")"
milestone="$(one_line "${GQ_MILESTONE:-}")"
links="${GQ_LINKS:-}"
touches="${GQ_TOUCHES:-}"
skip_vault="${GQ_SKIP_VAULT:-0}"

# Project = the main repository's folder, not a worktree's.
project="${GQ_PROJECT:-}"
if [ -z "$project" ]; then
  common="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [ -n "$common" ] && [ "$(basename "$common")" = ".git" ]; then
    project="$(basename "$(dirname "$common")")"
  else
    project="$(basename "$(pwd)")"
  fi
fi
project="$(one_line "$project")"

gen_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  elif [ -r /proc/sys/kernel/random/uuid ]; then
    cat /proc/sys/kernel/random/uuid
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import uuid; print(uuid.uuid4())'
  else
    od -An -tx1 -N16 /dev/urandom | tr -d ' \n' | \
      sed -E 's/(.{8})(.{4})(.{4})(.{4})(.{12})/\1-\2-\3-\4-\5/'
  fi
}

id="${GQ_ID:-$(gen_uuid)}"
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
stamp="$(date -u +%Y%m%d-%H%M%S)"

# --- resolve the landing zone before any write --------------------------------
resolve_landing_dir() {
  local p dir
  [ -f .gq-spec/master-app-dev-process-path ] || return 1
  p="$(tr -d '\r' < .gq-spec/master-app-dev-process-path | head -1)"
  p="${p#"${p%%[![:space:]]*}"}"
  p="${p%"${p##*[![:space:]]}"}"
  p="${p%/}"
  [ -n "$p" ] || return 1
  [ -f "$p/0010 - Master App Development Process Index.md" ] || return 1
  dir="$(dirname "$p")/Master_App_Landing"
  # AGENTS.md is the marker: a folder without it is not the landing zone.
  [ -f "$dir/AGENTS.md" ] || return 1
  printf '%s\n' "$dir"
}

landing=""
if [ "$skip_vault" != "1" ]; then
  if ! landing="$(resolve_landing_dir)"; then
    echo "log-lesson.sh: landing zone not resolved; nothing written." >&2
    echo "  Needs a valid .gq-spec/master-app-dev-process-path and its sibling Master_App_Landing/." >&2
    echo "  Run in this worktree: bash .gq-spec/bootstrap.sh" >&2
    exit 1
  fi
  # An identical summary already waiting is not logged twice.
  for zone in inbox held; do
    [ -d "$landing/$zone" ] || continue
    hit="$(grep -rlxF -- "# $summary" "$landing/$zone" 2>/dev/null | head -1 || true)"
    if [ -n "$hit" ]; then
      old="$(sed -n 's/^id: //p' "$hit" | head -1)"
      printf '%s\n' "${old:-$id}"
      echo "log-lesson: duplicate of ${old:0:8} already in landing/$zone; nothing written" >&2
      exit 0
    fi
  done
fi

# --- in-repo copy (reviewable in the PR) --------------------------------------
case "$library" in
  capability) default_file="specs/_logs/CAPABILITY_LESSONS.md"; title="Capability lessons" ;;
  process)    default_file="specs/_logs/PROCESS_LESSONS.md";    title="Process lessons" ;;
  identity)   default_file="specs/_logs/IDENTITY_LESSONS.md";   title="Vendor identity lessons" ;;
esac
lessons_file="${GQ_LESSONS_FILE:-$default_file}"
lessons_dir="$(dirname "$lessons_file")"
[ -d "$lessons_dir" ] || mkdir -p "$lessons_dir"
if [ ! -f "$lessons_file" ]; then
  {
    printf '# %s\n\n' "$title"
    printf '> Append-only copy of the reusable lessons this repo sent to the landing zone\n'
    printf '> (.gq-spec/log-lesson.sh). Project-only choices go to decisions/, not here.\n'
    printf '> The refine job files each lesson in the gold library; this file is the repo'"'"'s record.\n\n'
  } > "$lessons_file"
fi
{
  printf '## %s\n' "$summary"
  printf -- '- **ID:** %s\n' "$id"
  printf -- '- **Date:** %s\n' "$now"
  printf -- '- **Library:** %s\n' "$library"
  [ -n "$doc_id" ] && printf -- '- **DocId:** %s\n' "$doc_id"
  printf -- '- **Kind:** %s\n' "$kind"
  printf -- '- **Status:** %s\n' "$status"
  [ -n "$milestone" ] && printf -- '- **Milestone:** %s\n' "$milestone"
  printf -- '- **Project:** %s\n' "$project"
  [ -n "$version_scope" ] && printf -- '- **Version scope:** %s\n' "$version_scope"
  [ -n "$detail" ] && printf -- '- **Detail:** %s\n' "$detail"
  [ -n "$evidence" ] && printf -- '- **Evidence:** %s\n' "$evidence"
  [ -n "$touches" ] && printf -- '- **Touches:** %s\n' "$touches"
  [ -n "$links" ] && printf -- '- **Links:** %s\n' "$links"
  printf '\n'
} >> "$lessons_file"

# --- landing file (one per lesson; written whole, then renamed) ----------------
note="in-repo only (GQ_SKIP_VAULT=1)"
if [ "$skip_vault" != "1" ]; then
  mkdir -p "$landing/inbox"
  name="${stamp}-${id:0:8}.md"
  tmp_file="$landing/inbox/.${name}.tmp"
  {
    printf -- '---\n'
    printf 'id: %s\n' "$id"
    printf 'date: %s\n' "$now"
    printf 'library: %s\n' "$library"
    printf 'docId: "%s"\n' "$doc_id"
    printf 'kind: %s\n' "$kind"
    printf 'status: %s\n' "$status"
    printf 'project: "%s"\n' "${project//\"/\'}"
    printf 'milestone: "%s"\n' "${milestone//\"/\'}"
    printf 'versionScope: "%s"\n' "${version_scope//\"/\'}"
    printf -- '---\n\n'
    printf '# %s\n' "$summary"
    [ -n "$detail" ] && printf '\n**Detail:** %s\n' "$detail"
    [ -n "$evidence" ] && printf '\n**Evidence:** %s\n' "$evidence"
    [ -n "$touches" ] && printf '\n**Touches:** %s\n' "$touches"
    [ -n "$links" ] && printf '\n**Links:** %s\n' "$links"
  } > "$tmp_file"
  mv "$tmp_file" "$landing/inbox/$name"
  note="landing: inbox/$name"
fi

printf '%s\n' "$id"
echo "log-lesson: ${id:0:8} ${library}${doc_id:+/$doc_id} ${kind}/${status} -> ${lessons_file}; ${note}" >&2
