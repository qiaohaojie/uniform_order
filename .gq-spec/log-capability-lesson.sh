#!/usr/bin/env bash
#
# log-capability-lesson.sh — log a reusable capability lesson (gq-spec builds).
#
# Always appends to specs/_logs/CAPABILITY_LESSONS.md (in-repo, reviewable).
# Also appends one implementation-log line to the owning vault doc (docId -> "NNNN - *.md").
#
# Vault path is MANDATORY for normal builds (resolved via resolve-capability-docs-dir.sh):
#   1) GQ_CAPABILITY_DOCS_DIR env (per PC — Mac/Windows)
#   2) .gq-spec/capability-docs-path (gitignored local pin)
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
    # quiet: path only on stdout
    bash "$resolver" --quiet 2>/dev/null && return 0
    return 1
  fi
  # minimal fallback if resolver not installed yet
  if [ -n "${GQ_CAPABILITY_DOCS_DIR:-}" ] && [ -d "$GQ_CAPABILITY_DOCS_DIR" ]; then
    printf '%s\n' "$GQ_CAPABILITY_DOCS_DIR"
    return 0
  fi
  if [ -f .gq-spec/capability-docs-path ]; then
    local p
    p="$(tr -d '\r' < .gq-spec/capability-docs-path | head -1)"
    p="${p#"${p%%[![:space:]]*}"}"
    p="${p%"${p##*[![:space:]]}"}"
    if [ -n "$p" ] && [ -d "$p" ]; then
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
> Path resolution (portable): GQ_CAPABILITY_DOCS_DIR env, then gitignored
> .gq-spec/capability-docs-path. Never hard-code Mac/Windows absolute paths in git.
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
  if vault_dir="$(resolve_vault_dir)"; then
    export GQ_CAPABILITY_DOCS_DIR="$vault_dir"
    if vault_doc="$(find_vault_doc "$vault_dir" "$doc_id")"; then
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
    else
      echo "log-capability-lesson.sh: vault dir OK but no doc for docId=${doc_id} under ${vault_dir}" >&2
      exit 3
    fi
  else
    echo "log-capability-lesson.sh: capability library not resolved (set GQ_CAPABILITY_DOCS_DIR or .gq-spec/capability-docs-path)." >&2
    exit 1
  fi
fi

printf '%s\n' "$id"
echo "log-capability-lesson: ${id:0:8} doc=${doc_id} ${kind}/${status} -> ${lessons_file}; ${vault_note}" >&2
