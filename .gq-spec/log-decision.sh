#!/usr/bin/env bash
#
# log-decision.sh — canonical decision logger for the gq-spec-* workflow.
#
# Appends one formatted decision block to the sharded decision log under decisions/,
# routing by Stage (build:M14 -> decisions/M14.md, design -> decisions/design.md,
# everything else -> decisions/misc.md), and refreshes decisions/INDEX.md. Stamps a
# globally-unique UUID and a UTC timestamp. Prints the new ID.
#
# The env-in / print-ID-out CLI is unchanged from the pre-shard version, so callers
# (the gq-spec skills) need no changes. See ../DECISION.md for the layout.
#
# Fields are passed via environment variables (multiline-safe, no jq needed):
#   GQ_SUMMARY        short phrase summarising the decision   (required)
#   GQ_DECISION       what was decided                        (required)
#   GQ_WHY            rationale
#   GQ_ALTERNATIVES   options considered
#   GQ_PROS           upsides
#   GQ_CONS           downsides
#   GQ_RISKS          known issues / risks
#   GQ_LINKS          related files / docs / notes
#   GQ_STAGE          design | build:MNN | review:MNN | onboard   (default: unspecified)
#   GQ_TYPE           decision | assumption                       (default: decision)
#
# Optional overrides:
#   GQ_DECISIONS_DIR  shard directory            (default: ./decisions)
#   GQ_DECISION_FILE  legacy: write everything to this ONE file, bypassing routing +
#                     index (used by tests). When set, GQ_DECISIONS_DIR is ignored.
#   GQ_ID             use this id instead of generating one (rarely needed)
#
# Example:
#   GQ_SUMMARY="Use Better Auth for sessions" \
#   GQ_DECISION="Adopt better-auth with email+password and cookie sessions" \
#   GQ_WHY="First-class TS support; matches existing stack" \
#   GQ_ALTERNATIVES="NextAuth, hand-rolled JWT" \
#   GQ_STAGE="build:M03" bash .gq-spec/log-decision.sh

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- required fields -------------------------------------------------------
summary="${GQ_SUMMARY:-}"
decision="${GQ_DECISION:-}"
if [ -z "$summary" ] || [ -z "$decision" ]; then
  echo "log-decision.sh: GQ_SUMMARY and GQ_DECISION are required." >&2
  exit 2
fi

# --- optional fields -------------------------------------------------------
why="${GQ_WHY:-}"
alternatives="${GQ_ALTERNATIVES:-}"
pros="${GQ_PROS:-}"
cons="${GQ_CONS:-}"
risks="${GQ_RISKS:-}"
links="${GQ_LINKS:-}"
stage="${GQ_STAGE:-unspecified}"
type="${GQ_TYPE:-decision}"

# --- id + timestamp --------------------------------------------------------
gen_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  elif [ -r /proc/sys/kernel/random/uuid ]; then
    cat /proc/sys/kernel/random/uuid
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import uuid; print(uuid.uuid4())'
  else
    # last-resort pseudo-uuid from /dev/urandom
    od -An -tx1 -N16 /dev/urandom | tr -d ' \n' | \
      sed -E 's/(.{8})(.{4})(.{4})(.{4})(.{12})/\1-\2-\3-\4-\5/'
  fi
}

id="${GQ_ID:-$(gen_uuid)}"
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- stage -> shard routing (JS twin: decisions-lib.mjs routeStage) ---------
route_stage() {
  local s="$1"
  if [[ "$s" =~ M([0-9]+) ]]; then
    printf 'M%02d' "$((10#${BASH_REMATCH[1]}))"
  elif [[ "$s" == design* ]]; then
    printf 'design'
  else
    printf 'misc'
  fi
}

# --- resolve target file ----------------------------------------------------
override_file="${GQ_DECISION_FILE:-}"
decisions_dir="${GQ_DECISIONS_DIR:-decisions}"
index_file=""

if [ -n "$override_file" ]; then
  # Legacy single-file mode (tests): no routing, no index.
  target="$override_file"
  dir="$(dirname "$target")"
  [ -d "$dir" ] || mkdir -p "$dir"
  if [ ! -f "$target" ]; then
    cat > "$target" <<'HEADER'
# Decision Log

> Append-only record of decisions. Every entry carries a UUID and a UTC timestamp,
> written by `.gq-spec/log-decision.sh`. Reference a decision by its ID.

HEADER
  fi
else
  shard="$(route_stage "$stage")"
  [ -d "$decisions_dir" ] || mkdir -p "$decisions_dir"
  target="$decisions_dir/$shard.md"
  index_file="$decisions_dir/INDEX.md"
  if [ ! -f "$target" ]; then
    {
      printf '# Decisions — %s\n\n' "$shard"
      printf '> Auto-routed shard of the decision log (see `../DECISION.md`). New entries\n'
      printf '> appended by `.gq-spec/log-decision.sh`. Find any decision via\n'
      printf '> `decisions/INDEX.md` or `grep -r <term> decisions/`.\n\n'
    } > "$target"
  fi
fi

# --- append the entry (optional fields omitted when empty) -----------------
opt() { [ -n "$2" ] && printf -- '- **%s:** %s\n' "$1" "$2"; return 0; }

{
  printf '## %s\n' "$summary"
  printf -- '- **ID:** %s\n' "$id"
  printf -- '- **Date:** %s\n' "$now"
  printf -- '- **Stage:** %s\n' "$stage"
  # Type is emitted only when it carries signal (i.e. not the default "decision").
  [ "$type" != "decision" ] && printf -- '- **Type:** %s\n' "$type"
  printf -- '- **Decision:** %s\n' "$decision"
  opt 'Why' "$why"
  opt 'Alternatives' "$alternatives"
  opt 'Pros' "$pros"
  opt 'Cons' "$cons"
  opt 'Risks / known issues' "$risks"
  opt 'Links' "$links"
  printf '\n'
} >> "$target"

# --- refresh the index (shards are the source of truth) --------------------
if [ -n "$index_file" ]; then
  if command -v node >/dev/null 2>&1; then
    node "$script_dir/reindex-decisions.mjs" "$decisions_dir" >/dev/null 2>&1 || true
  else
    # dependency-light fallback: append an ungrouped tail line
    printf -- '- %s · %s · %s · %s\n' "${now:0:10}" "${id:0:8}" "$stage" "$summary" >> "$index_file"
  fi
fi

# print the id so callers can capture and reference it
printf '%s\n' "$id"
