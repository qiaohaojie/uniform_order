#!/usr/bin/env bash
#
# land-pr.test.sh — offline regression test for scripts/land-pr.sh.
#
# Rule under test: the PR merges only when the CI run on its head commit ended
# `success`, or, with --docs-only, when every changed path is in the workflow's
# `paths-ignore` and no run exists on the head commit. Anything else: exit
# non-zero and the PR is not merged.
#
# Uses a fake `gh` on PATH. Never calls GitHub. The fake returns what the real
# `--jq` filters print, so the filters themselves are proven by the live probes
# (process 1250), not here.
#
# Usage:
#   bash scripts/tests/land-pr.test.sh
#   LAND_PR_SCRIPT=/other/land-pr.sh bash …   # test another copy
#
# Exit: 0 all cases pass · 1 any case fails

set -uo pipefail

script="${LAND_PR_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/land-pr.sh}"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/land-pr-test.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"

# Fake gh. State files in $S:
#   pr          "<state> <head sha> <mergeable>"
#   labels      one label per line
#   runlist     newest run that is not skipped, "<id> <status> <conclusion>";
#               one answer per line, per call; the last line repeats
#   runview     "<status> <failed jobs> <conclusion>"; same per-call rule
#   runcount    number of runs of any conclusion on the head commit
#   merge_rc    exit code of `gh pr merge`; `merged_as` = what the PR is after it
#   workflow    the workflow file; `files` = the changed paths
cat >"$tmp/bin/gh" <<'GH'
#!/usr/bin/env bash
next() { # $1 = file: print the line for this call, then move on
  local n=1 total
  [ -f "$1.n" ] && n="$(cat "$1.n")"
  total="$(wc -l <"$1" | tr -d ' ')"
  [ "$n" -le "$total" ] || n="$total"
  sed -n "${n}p" "$1"
  echo $((n + 1)) >"$1.n"
}
args=" $* "
case "$1 $2" in
  "pr view")
    case "$args" in
      *"state,headRefOid,mergeable"*) cat "$S/pr" ;;
      *"--json labels"*) cat "$S/labels" ;;
      *"--json state,headRefOid"*) cut -d' ' -f1,2 "$S/pr" ;;
    esac ;;
  "pr edit")
    echo "edit$(sed -E 's/.*(--(add|remove)-label [a-z]+).*/ \1/' <<<"$args")" >>"$S/calls" ;;
  "pr merge")
    echo "merge ${*:3}" >>"$S/calls"
    [ ! -f "$S/merged_as" ] || cp "$S/merged_as" "$S/pr"
    exit "$(cat "$S/merge_rc")" ;;
  "run list")
    case "$args" in
      *"--jq length"*) cat "$S/runcount" ;;
      *) next "$S/runlist" ;;
    esac ;;
  "run view")
    case "$args" in
      *"--json jobs"*) : ;;
      *) next "$S/runview" ;;
    esac ;;
  "api -H") [ -f "$S/workflow" ] || exit 1; cat "$S/workflow" ;;
  "api --paginate") cat "$S/files" ;;
  *) echo "fake gh: unexpected: $*" >&2; exit 99 ;;
esac
GH
chmod +x "$tmp/bin/gh"

SHA=abc1234abc1234abc1234abc1234abc1234abc12
OPEN="OPEN $SHA MERGEABLE"
pass=0 fail=0

# state <pr line> <labels> <runlist lines> <runview lines> [merge rc]
state() {
  S="$tmp/case.$((pass + fail))"
  mkdir -p "$S"
  printf '%s\n' "$1" >"$S/pr"
  printf '%s' "$2" >"$S/labels"
  printf '%b' "$3" >"$S/runlist"
  printf '%b' "$4" >"$S/runview"
  echo "${5:-0}" >"$S/merge_rc"
  [ "${5:-0}" != 0 ] || echo "MERGED $SHA MERGEABLE" >"$S/merged_as"
  echo 0 >"$S/runcount"
  : >"$S/calls"
  cat >"$S/workflow" <<'YML'
on:
  pull_request:
    types: [ready_for_review, labeled]
    paths-ignore:
      - "**/*.md"   # prose
      - 'docs/**'
      - specs/_logs/**
jobs:
  ci:
    uses: ./.github/workflows/ci-jobs.yml
YML
  printf 'README.md\ndocs/a/b.txt\n' >"$S/files"
}

# run_case <name> <want exit> <want merged: yes|no> <calls: regex | none | -> [land-pr args…]
# Reads the state the caller wrote in $S. Env set by the caller wins.
run_case() {
  local name="$1" want_rc="$2" want_merge="$3" want_calls="$4" rc merged=no
  shift 4
  PATH="$tmp/bin:$PATH" S="$S" LAND_PR_INTERVAL="${LAND_PR_INTERVAL-0}" \
    LAND_PR_START_TIMEOUT="${LAND_PR_START_TIMEOUT-0}" LAND_PR_RUN_TIMEOUT="${LAND_PR_RUN_TIMEOUT-5}" \
    bash "$script" 7 -R o/r "$@" >"$S/out" 2>&1
  rc=$?
  grep -q '^MERGED' "$S/pr" && merged=yes
  if [ "$rc" = "$want_rc" ] && [ "$merged" = "$want_merge" ] &&
    case "$want_calls" in
      -) : ;;
      none) [ ! -s "$S/calls" ] ;;
      *) tr '\n' ';' <"$S/calls" | grep -qE "$want_calls" ;;
    esac; then
    pass=$((pass + 1))
    echo "ok   $name"
  else
    fail=$((fail + 1))
    echo "FAIL $name: exit $rc (want $want_rc), merged $merged (want $want_merge)"
    sed 's/^/     /' "$S/out" "$S/calls"
  fi
}

LABEL_ONLY='^edit --add-label ci;$'
MERGE="merge 7 -R o/r --merge --delete-branch --match-head-commit $SHA;\$"

# --- the run decides
state "$OPEN" "" "\n101 queued \n" "in_progress 0 \ncompleted 0 success\n"
run_case "no run: adds ci, waits, merges on success" 0 yes "^edit --add-label ci;$MERGE"

state "$OPEN" "ci" "101 completed success\n" ""
run_case "run already passed on the head: merges, starts no run" 0 yes "^$MERGE"

state "$OPEN" "ci" "101 in_progress \n" "completed 0 success\n"
run_case "run in progress: waits for it, starts no run" 0 yes "^$MERGE"

state "$OPEN" "" "\n101 in_progress \n101 completed cancelled\n" "in_progress 0 \ncompleted 0 cancelled\n"
run_case "cancelled run: no merge" 1 no "$LABEL_ONLY"

state "$OPEN" "ci" "101 in_progress \n101 completed cancelled\n" "completed 0 cancelled\n"
run_case "run found in progress, then cancelled, no newer run: no merge, no re-label" 1 no none

state "$OPEN" "" "\n101 in_progress \n104 in_progress \n" "completed 0 cancelled\ncompleted 0 success\n"
run_case "run cancelled by a newer run (re-label): follows the newer run, merges" 0 yes "^edit --add-label ci;$MERGE"

state "$OPEN" "" "\n101 in_progress \n104 in_progress \n" "completed 0 cancelled\ncompleted 1 failure\n"
run_case "run cancelled by a newer run that fails: no merge" 1 no "$LABEL_ONLY"

state "$OPEN" "" "\n101 in_progress \n" "completed 1 failure\n"
run_case "failed run: no merge" 1 no "$LABEL_ONLY"

state "$OPEN" "" "\n101 in_progress \n" "in_progress 0 \nin_progress 1 \n"
run_case "a job failed, run still in progress: stops at once, no merge" 1 no "$LABEL_ONLY"

state "$OPEN" "" "\n101 in_progress \n" "in_progress 1 \ncompleted 0 success\n"
LAND_PR_FAIL_FAST=0 run_case "LAND_PR_FAIL_FAST=0: a failed job does not decide; run ends success: merges" 0 yes "^edit --add-label ci;$MERGE"

state "$OPEN" "" "\n101 in_progress \n" "completed 0 timed_out\n"
run_case "timed-out run: no merge" 1 no "$LABEL_ONLY"

state "$OPEN" "" "\n101 in_progress \n" "in_progress 0 \n"
LAND_PR_RUN_TIMEOUT=1 run_case "run never ends: gives up, no merge" 1 no "$LABEL_ONLY"

state "$OPEN" "" "\n" ""
run_case "no run starts: no merge" 1 no "$LABEL_ONLY"

state "$OPEN" "" "\n201 queued \n\n" "completed 0 skipped\n"
run_case "only a skipped run (other label): no merge" 1 no "$LABEL_ONLY"

state "$OPEN" "" "\n201 queued \n102 in_progress \n" "completed 0 skipped\ncompleted 0 success\n"
run_case "skipped run seen first, then the ci run passes: merges" 0 yes "^edit --add-label ci;$MERGE"

state "$OPEN" "bug
ci" "100 completed cancelled\n103 queued \n" "completed 0 success\n"
run_case "old cancelled run, ci label present: re-labels, merges on the new run" 0 yes "^edit --remove-label ci;edit --add-label ci;$MERGE"

state "$OPEN" "" "100 completed failure\n103 completed failure\n" ""
run_case "new run ends failed between polls: no merge" 1 no "$LABEL_ONLY"

# --- the merge step
state "$OPEN" "" "\n101 in_progress \n" "completed 0 success\n" 1
run_case "merge refused (head moved): exit 1" 1 no "$MERGE"

state "$OPEN" "" "\n101 in_progress \n" "completed 0 success\n" 1
echo "MERGED $SHA MERGEABLE" >"$S/merged_as"
run_case "gh pr merge exits 1 but the PR is merged at the same head: exit 0" 0 yes "$MERGE"

state "$OPEN" "" "\n101 in_progress \n" "completed 0 success\n" 1
echo "MERGED ffff234abc1234abc1234abc1234abc1234abc12 MERGEABLE" >"$S/merged_as"
run_case "gh pr merge exits 1 and the PR was merged at another head: exit 1" 1 yes "$MERGE"

# --- --docs-only is checked, not trusted
state "$OPEN" "" "\n" ""
run_case "--docs-only, every path ignored, no run: merges" 0 yes "^edit --add-label ci;$MERGE" --docs-only

state "$OPEN" "" "\n" ""
printf 'README.md\nscripts/x.sh\n' >"$S/files"
run_case "--docs-only with a code path: no label, no merge" 1 no none --docs-only

state "$OPEN" "" "\n" ""
printf 'docs.md.sh\n' >"$S/files"
run_case "--docs-only: a path that only looks ignored: no merge" 1 no none --docs-only

state "$OPEN" "" "\n" ""
echo 1 >"$S/runcount"
run_case "--docs-only but a run (skipped or failed) exists on the head: no merge" 1 no "$LABEL_ONLY" --docs-only

state "$OPEN" "" "\n102 in_progress \n" "completed 1 failure\n"
run_case "--docs-only but a run starts and fails: no merge" 1 no "$LABEL_ONLY" --docs-only

state "$OPEN" "" "\n" ""
printf 'on:\n  pull_request:\n    paths-ignore:\n      - "docs/[a-z]*"\n' >"$S/workflow"
run_case "--docs-only: a pattern the script cannot check: no merge" 1 no none --docs-only

state "$OPEN" "" "\n" ""
printf 'on:\n  pull_request:\n    types: [labeled]\n' >"$S/workflow"
run_case "--docs-only: workflow has no path filter: no merge" 1 no none --docs-only

# `paths` with `!` patterns: a later match wins
paths_workflow() {
  cat >"$S/workflow" <<'YML'
on:
  pull_request:
    types: [ready_for_review, labeled]
    paths:
      - "**"
      - "!**/*.md"
      - "!docs/**"
      - "packages/ai/prompts/**"
      - "docs/go-live-checklist.md"
jobs:
YML
}
state "$OPEN" "" "\n" ""
paths_workflow
printf 'README.md\ndocs/a/b.txt\npackages/ai/notes.md\n' >"$S/files"
run_case "--docs-only, paths list with ! patterns, every path excluded: merges" 0 yes "^edit --add-label ci;$MERGE" --docs-only

state "$OPEN" "" "\n" ""
paths_workflow
printf 'README.md\npackages/ai/prompts/system.md\n' >"$S/files"
run_case "--docs-only, paths list: a path included again after a ! pattern: no merge" 1 no none --docs-only

state "$OPEN" "" "\n" ""
paths_workflow
printf 'docs/go-live-checklist.md\n' >"$S/files"
run_case "--docs-only, paths list: a doc named again after its ! pattern: no merge" 1 no none --docs-only

state "$OPEN" "" "\n" ""
paths_workflow
printf 'apps/web/src/a.ts\n' >"$S/files"
run_case "--docs-only, paths list: a code path: no merge" 1 no none --docs-only

state "$OPEN" "" "\n" ""
printf 'on:\n  push:\n    paths-ignore:\n      - "**/*.md"\n  pull_request:\n    paths-ignore:\n      - "docs/**"\n' >"$S/workflow"
run_case "--docs-only: two path lists in the workflow: no merge" 1 no none --docs-only

state "$OPEN" "" "\n" ""
rm "$S/workflow"
run_case "--docs-only: workflow file not readable: no merge" 1 no none --docs-only

state "$OPEN" "" "\n" ""
: >"$S/files"
run_case "--docs-only: no changed files: no merge" 1 no none --docs-only

# --- bad input never reaches the merge
state "$OPEN" "" "\n" ""
LAND_PR_START_TIMEOUT=2m run_case "LAND_PR_START_TIMEOUT=2m: exit 2, nothing called" 2 no none

state "$OPEN" "" "\n" ""
LAND_PR_INTERVAL=0.5 run_case "LAND_PR_INTERVAL=0.5: exit 2, nothing called" 2 no none

state "$OPEN" "" "\n101 in_progress \n" "in_progress 0 \n"
LAND_PR_RUN_TIMEOUT=08 run_case "LAND_PR_RUN_TIMEOUT=08: exit 2, nothing called" 2 no none

state "$OPEN" "" "101 completed success\n" ""
run_case "empty -w: exit 2, nothing called" 2 no none -w ""

state "OPEN" "" "101 completed success\n" ""
run_case "PR answer with no head commit: no merge" 1 no none

state "OPEN  MERGEABLE" "" "101 completed success\n" ""
run_case "PR answer with an empty head commit: no merge" 1 no none

state "CLOSED $SHA UNKNOWN" "" "" ""
run_case "PR not open: no label, no merge" 1 no none

state "OPEN $SHA CONFLICTING" "" "" ""
run_case "merge conflicts: no label, no merge" 1 no none

S="$tmp/usage"
mkdir -p "$S"
PATH="$tmp/bin:$PATH" S="$S" bash "$script" >/dev/null 2>&1
if [ $? = 2 ]; then
  pass=$((pass + 1))
  echo "ok   no PR number: exit 2"
else
  fail=$((fail + 1))
  echo "FAIL no PR number"
fi

echo "land-pr.test: $pass passed, $fail failed"
[ "$fail" = 0 ]
