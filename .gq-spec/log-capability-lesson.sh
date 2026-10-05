#!/usr/bin/env bash
#
# log-capability-lesson.sh — log a reusable capability lesson (gq-spec builds).
#
# Appends to specs/_logs/CAPABILITY_LESSONS.md (in-repo, reviewable) and one
# implementation-log line to the owning vault doc (docId -> "NNNN - *.md").
# The vault and its doc are resolved BEFORE any write: when the repo is unbound
# or the docId has no doc, this exits non-zero and writes nothing.
#
# Vault path is MANDATORY for normal builds (resolved via resolve-capability-docs-dir.sh):
#   .gq-spec/capability-docs-path (gitignored local pin; bootstrap.sh writes it)
# The pin is the only source. No environment variable is read.
# Pins are per checkout: in a new git worktree run `bash .gq-spec/bootstrap.sh` first.
# Does NOT parse absolute paths from AGENTS.md (not portable).
#
# Env (required):
#   GQ_DOC_ID     four-digit id, e.g. 1100
#   GQ_KIND       works | fails | note
#   GQ_STATUS     provisional | verified
#   GQ_SUMMARY    short phrase
#
# Env (optional):
#   GQ_DETAIL GQ_EVIDENCE GQ_VERSION_SCOPE GQ_MILESTONE GQ_PROJECT GQ_LINKS
#   GQ_LESSONS_FILE   default specs/_logs/CAPABILITY_LESSONS.md
#   GQ_SKIP_VAULT=1   emergency in-repo only (gq-spec-build-grok must NOT use this)
#   GQ_ID             force id (tests)
#
# Exit: 0 logged · 1 vault not resolved (unbound) · 2 bad arguments · 3 no vault doc for docId
# Prints the new lesson id on stdout.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

doc_id="${GQ_DOC_ID:-}"
kind="${GQ_KIND:-}"
status="${GQ_STATUS:-}"
summary="${GQ_SUMMARY:-}"

if [ -z "$doc_id" ] || [ -z "$kind" ] || [ -z "$status" ] || [ -z "$summary" ]; then
  echo "log-capability-lesson.sh: GQ_DOC_ID, GQ_KIND, GQ_STATUS, GQ_SUMMARY are required." >&2
  exit 2
fi

if [[ "$doc_id" =~ ^[0-9]+$ ]]; then
  doc_id="$(printf '%04d' "$((10#$doc_id))")"
fi

case "$kind" in works|fails|note) ;; *)
  echo "log-capability-lesson.sh: GQ_KIND must be works|fails|note (got: $kind)" >&2
  exit 2
  ;;
esac
case "$status" in provisional|verified) ;; *)
  echo "log-capability-lesson.sh: GQ_STATUS must be provisional|verified (got: $status)" >&2
  exit 2
  ;;
esac

detail="${GQ_DETAIL:-}"
evidence="${GQ_EVIDENCE:-}"
version_scope="${GQ_VERSION_SCOPE:-}"
milestone="${GQ_MILESTONE:-}"
project="${GQ_PROJECT:-$(basename "$(pwd)")}"
links="${GQ_LINKS:-}"
lessons_file="${GQ_LESSONS_FILE:-specs/_logs/CAPABILITY_LESSONS.md}"
skip_vault="${GQ_SKIP_VAULT:-0}"

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
day="${now:0:10}"

resolve_vault_dir() {
  local resolver=""
  if [ -x "${script_dir}/resolve-capability-docs-dir.sh" ]; then
    resolver="${script_dir}/resolve-capability-docs-dir.sh"
  elif [ -x .gq-spec/resolve-capability-docs-dir.sh ]; then
    resolver=".gq-spec/resolve-capability-docs-dir.sh"
  fi
  if [ -n "$resolver" ]; then
    # quiet: path only on stdout; the resolver's reason stays on stderr
    bash "$resolver" --quiet && return 0
    return 1
  fi
  # minimal fallback if resolver not installed yet: the pin only, and it
  # must be the app capability vault (0600 - UI Adapter.md).
  local p
  if [ -f .gq-spec/capability-docs-path ]; then
    p="$(tr -d '\r' < .gq-spec/capability-docs-path | head -1)"
    p="${p#"${p%%[![:space:]]*}"}"
    p="${p%"${p##*[![:space:]]}"}"
    if [ -n "$p" ] && [ -f "$p/0600 - UI Adapter.md" ]; then
      printf '%s\n' "$p"
      return 0
    fi
  fi
  return 1
}

find_vault_doc() {
  local vault="$1" did="$2"
  local match
  match="$(find "$vault" -maxdepth 1 -type f -name "${did} - *.md" 2>/dev/null | head -1 || true)"
  if [ -n "$match" ]; then
    printf '%s\n' "$match"
    return 0
  fi
  match="$(find "$vault" -maxdepth 1 -type f -name "${did}*.md" 2>/dev/null | head -1 || true)"
  if [ -n "$match" ]; then
    printf '%s\n' "$match"
    return 0
  fi
  return 1
}

# --- resolve the vault before any write --------------------------------------
vault_dir=""
vault_doc=""
if [ "$skip_vault" != "1" ]; then
  if ! vault_dir="$(resolve_vault_dir)"; then
    echo "log-capability-lesson.sh: capability library not resolved; nothing written." >&2
    echo "  Run in this worktree: bash .gq-spec/bootstrap.sh" >&2
    exit 1
  fi
  if ! vault_doc="$(find_vault_doc "$vault_dir" "$doc_id")"; then
    echo "log-capability-lesson.sh: vault dir OK but no doc for docId=${doc_id} under ${vault_dir}; nothing written." >&2
    exit 3
  fi
fi

# --- ensure in-repo log ----------------------------------------------------
lessons_dir="$(dirname "$lessons_file")"
[ -d "$lessons_dir" ] || mkdir -p "$lessons_dir"
if [ ! -f "$lessons_file" ]; then
  cat > "$lessons_file" <<'HEADER'
# Capability Lessons

> Append-only log of **reusable** capability insights from gq-spec builds.
> Project-only decisions stay in DECISION.md. The build skill Persist step writes
> here via .gq-spec/log-capability-lesson.sh, then promotes to the Obsidian
> capability doc library (vault 0010 index) when the machine-local path resolves.
>
> Path resolution (portable): the gitignored pin .gq-spec/capability-docs-path
> (written by bootstrap.sh) is the only source. It must be the app capability
> vault (`0600 - UI Adapter.md`). Never hard-code absolute paths in git.
>
> Entry fields: docId · kind (works|fails|note) · status (provisional|verified) · milestone

HEADER
fi

{
  printf '## %s\n' "$summary"
  printf -- '- **ID:** %s\n' "$id"
  printf -- '- **Date:** %s\n' "$now"
  printf -- '- **DocId:** %s\n' "$doc_id"
  printf -- '- **Kind:** %s\n' "$kind"
  printf -- '- **Status:** %s\n' "$status"
  [ -n "$milestone" ] && printf -- '- **Milestone:** %s\n' "$milestone"
  printf -- '- **Project:** %s\n' "$project"
  [ -n "$version_scope" ] && printf -- '- **Version scope:** %s\n' "$version_scope"
  [ -n "$detail" ] && printf -- '- **Detail:** %s\n' "$detail"
  [ -n "$evidence" ] && printf -- '- **Evidence:** %s\n' "$evidence"
  [ -n "$links" ] && printf -- '- **Links:** %s\n' "$links"
  printf '\n'
} >> "$lessons_file"

vault_note="(in-repo only)"
if [ "$skip_vault" = "1" ]; then
  vault_note="GQ_SKIP_VAULT=1 (in-repo only; not allowed for normal gq-spec-build-grok)"
else
  if ! grep -qE '^### Implementation log|^## Implementation log' "$vault_doc"; then
    printf '\n### Implementation log\n\n' >> "$vault_doc"
  fi
  line="- **${day} — [${status}] [${kind}]"
  [ -n "$milestone" ] && line+=" (build:${milestone})"
  line+=" · ${project}:** ${summary}"
  [ -n "$detail" ] && line+=" ${detail}"
  [ -n "$evidence" ] && line+=" Evidence: ${evidence}."
  [ -n "$version_scope" ] && line+=" Scope: ${version_scope}."
  line+=" (lesson ${id:0:8})"
  printf '%s\n' "$line" >> "$vault_doc"
  vault_note="vault: $vault_doc"
fi

printf '%s\n' "$id"
echo "log-capability-lesson: ${id:0:8} doc=${doc_id} ${kind}/${status} -> ${lessons_file}; ${vault_note}" >&2
