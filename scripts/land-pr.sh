#!/usr/bin/env bash
# land-pr.sh — merge a PR only when the CI run for its head commit ended `success`.
#
# `gh pr checks <n> --watch && gh pr merge <n>` is not a safe landing chain:
# `gh pr checks` exits 0 when every check is passed, skipped or cancelled, so a
# cancelled CI run merges with no finished CI (process 1250). This script reads
# the workflow run, not the checks:
#
#   1. Read the PR's head commit.
#   2. Use the CI run on that commit when one is in progress or has passed.
#      Otherwise add the `ci` label (remove it first when it is already there)
#      and wait for the new run.
#   3. Wait for the run to end. Merge only when its conclusion is `success` and
#      the head commit has not moved.
#
# No run, a skipped run, a cancelled run, a failed run, a timed-out run or a
# push during the run: exit 1, no merge. A run started by a label other than
# `ci` ends `skipped` and is never the confirmation run. A run cancelled by a
# newer run of the same PR (a re-label) is followed to the newer run.
#
#   bash scripts/land-pr.sh <pr> [-R owner/repo] [-w workflow] [--docs-only]
#
#   -R, --repo       owner/repo (default: the repo of the current folder)
#   -w, --workflow   file name of the workflow that holds the CI gate
#                    (default: $LAND_PR_WORKFLOW, else ci.yml)
#   --docs-only      no run is expected: the workflow's path filter
#                    (`paths-ignore`, or `paths` with `!` patterns) lets no
#                    changed path through. The script checks the claim (the
#                    paths against the filter; no run of the workflow on the
#                    head commit after the `ci` label) and then merges on the
#                    local gate. A run that does start must end `success`.
#
# Env (whole seconds): LAND_PR_START_TIMEOUT wait for the run to appear (60);
# LAND_PR_RUN_TIMEOUT wait for the run to end (3600); LAND_PR_INTERVAL poll (10).
# LAND_PR_FAIL_FAST=0: wait for the whole run even after a job failed (for a
# workflow with `continue-on-error` jobs, where a failed job can still pass).
#
# Always passes -R to gh, so it never touches a local branch: safe to run in
# the background from any folder or worktree.
#
# Exit: 0 merged · 1 not merged (reason on stderr) · 2 usage or missing tool
set -euo pipefail

LABEL=ci
WORKFLOW="${LAND_PR_WORKFLOW:-ci.yml}"
START_TIMEOUT="${LAND_PR_START_TIMEOUT:-60}"
RUN_TIMEOUT="${LAND_PR_RUN_TIMEOUT:-3600}"
INTERVAL="${LAND_PR_INTERVAL:-10}"
FAIL_FAST="${LAND_PR_FAIL_FAST:-1}"
PR="" REPO="" SHA="" DOCS_ONLY=0

log() { printf 'land-pr: %s\n' "$*" >&2; }
die() { log "$*"; exit 1; }
usage() { sed -n '2,/^# Exit:/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    -R | --repo) [ $# -ge 2 ] || usage; REPO="$2"; shift 2 ;;
    -w | --workflow) [ $# -ge 2 ] || usage; WORKFLOW="$2"; shift 2 ;;
    --docs-only) DOCS_ONLY=1; shift ;;
    -h | --help) usage ;;
    -*) log "unknown option: $1"; usage ;;
    *) [ -z "$PR" ] || usage; PR="${1#\#}"; shift ;;
  esac
done
case "$PR" in '' | *[!0-9]*) usage ;; esac
[ -n "$WORKFLOW" ] || usage
# A value bash cannot do arithmetic on would abort the wait loop, not the script.
for v in "$START_TIMEOUT" "$RUN_TIMEOUT" "$INTERVAL"; do
  case "$v" in '' | *[!0-9]* | 0[0-9]*) log "timeouts and interval are whole seconds, got '$v'"; exit 2 ;; esac
done
command -v gh >/dev/null 2>&1 || { log "gh (GitHub CLI) not found"; exit 2; }
if [ -z "$REPO" ]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)" ||
    { log "not in a GitHub repo; pass -R owner/repo"; exit 2; }
fi

# Runs of the CI workflow on the head commit, newest first.
runs() { # $1 = jq filter
  gh run list -R "$REPO" --workflow "$WORKFLOW" --commit "$SHA" --event pull_request \
    --limit 50 --json databaseId,status,conclusion --jq "$1"
}

# The newest run that is not `skipped`: "<id> <status> <conclusion>", or nothing.
newest_run() {
  runs '[.[] | select(.conclusion != "skipped")][0] | if . then "\(.databaseId) \(.status) \(.conclusion)" else empty end'
}

# --docs-only is a claim; check the part that can be read now. No changed
# path may pass the path filter of the workflow at the head commit: one
# `paths-ignore` list, or one `paths` list where a later `!pattern` excludes
# and a later plain pattern includes again. Supported patterns: literal text,
# `*` and `**`. Anything else, or more than one list: no merge.
check_docs_only() {
  local yaml list files p f i hit lists=0
  local -a excludes=() regexes=()
  yaml="$(gh api -H 'Accept: application/vnd.github.raw' "repos/$REPO/contents/.github/workflows/$WORKFLOW?ref=$SHA")" ||
    die "--docs-only: cannot read .github/workflows/$WORKFLOW (pass the file name with -w)"
  # One ordered include/exclude list: `paths-ignore: [a]` reads as `**`, `!a`.
  list="$(awk '/^[[:space:]]*paths(-ignore)?:[[:space:]]*$/ { on = 1; pre = ($0 ~ /paths-ignore/) ? "!" : ""; print "@list"; if (pre == "!") print "**"; next }
    on && /^[[:space:]]*-[[:space:]]/ { sub(/^[[:space:]]*-[[:space:]]*/, ""); sub(/[[:space:]]+#.*$/, ""); gsub(/["\047]/, ""); print pre $0; next }
    on && /^[[:space:]]*(#.*)?$/ { next }
    { on = 0 }' <<<"$yaml")"
  while IFS= read -r p; do
    if [ "$p" = "@list" ]; then
      lists=$((lists + 1))
      continue
    fi
    case "$p" in '!'*) excludes+=(1); p="${p#!}" ;; *) excludes+=(0) ;; esac
    case "$p" in '' | *[!A-Za-z0-9._/*-]*) die "--docs-only: cannot check the path pattern '$p' of $WORKFLOW; not merged" ;; esac
    p="$(sed -e 's/\./\\./g' -e 's#\*\*/#@A@#g' -e 's#\*\*#@B@#g' -e 's#\*#[^/]*#g' -e 's#@A@#(.*/)?#g' -e 's#@B@#.*#g' <<<"$p")"
    regexes+=("^($p)\$")
  done <<<"$list"
  [ "$lists" = 1 ] && [ "${#regexes[@]}" -gt 0 ] ||
    die "--docs-only: $WORKFLOW must have one 'paths-ignore' or 'paths' list, found $lists; not merged"
  files="$(gh api --paginate "repos/$REPO/pulls/$PR/files" --jq '.[] | .filename, (.previous_filename // empty)')" ||
    die "--docs-only: cannot list the changed files of PR #$PR"
  [ -n "$files" ] || die "--docs-only: PR #$PR has no changed files; not merged"
  while IFS= read -r f; do
    hit=0
    for i in "${!regexes[@]}"; do
      if [[ "$f" =~ ${regexes[$i]} ]]; then hit=$((1 - excludes[i])); fi
    done
    [ "$hit" = 0 ] || die "--docs-only: '$f' passes the path filter of $WORKFLOW, so CI must run; run again without --docs-only"
  done <<<"$files"
}

# Start the one confirmation run. `labeled` fires only when the label is added,
# so a label that is already there is removed first.
start_run() {
  local labels
  labels="$(gh pr view "$PR" -R "$REPO" --json labels --jq '.labels[].name')" ||
    die "cannot read the labels of PR #$PR"
  if grep -qx "$LABEL" <<<"$labels"; then
    gh pr edit "$PR" -R "$REPO" --remove-label "$LABEL" >/dev/null ||
      die "cannot remove the '$LABEL' label"
  fi
  gh pr edit "$PR" -R "$REPO" --add-label "$LABEL" >/dev/null ||
    die "cannot add the '$LABEL' label (create it once: gh label create $LABEL -R $REPO)"
  log "added the '$LABEL' label; waiting for the run on ${SHA:0:7}"
}

# Wait until run $1 is completed, or one of its jobs has failed (fail fast).
# Sets $status and $conclusion. A failed API call is retried ten times in a row.
wait_run() {
  local deadline=$((SECONDS + RUN_TIMEOUT)) out failed errors=0
  log "waiting for run $1: https://github.com/$REPO/actions/runs/$1"
  while :; do
    if out="$(gh run view "$1" -R "$REPO" --json status,conclusion,jobs \
      --jq '"\(.status) \([.jobs[] | select(.conclusion == "failure")] | length) \(.conclusion)"' 2>&1)"; then
      errors=0
      read -r status failed conclusion <<<"$out" || true
      [ "$status" != completed ] || return 0
      if [ "$FAIL_FAST" = 1 ] && [ "${failed:-0}" != 0 ]; then
        conclusion="failure (run still $status)"
        return 0
      fi
    else
      errors=$((errors + 1))
      [ "$errors" -lt 10 ] || die "cannot read run $1 ($out); not merged"
    fi
    [ "$SECONDS" -lt "$deadline" ] || die "run $1 not completed after ${RUN_TIMEOUT}s; not merged"
    sleep "$INTERVAL"
  done
}

not_success() { # $1 = run id
  gh run view "$1" -R "$REPO" --json jobs \
    --jq '.jobs[] | select(.conclusion != "" and .conclusion != "success" and .conclusion != "skipped") | "  \(.name): \(.conclusion)"' >&2 || true
  die "run $1 is '${conclusion:-unknown}', not 'success'; PR #$PR not merged"
}

# Everything below runs inside main: an error bash raises in an expansion ends
# the script there, and can never fall through to the merge.
main() {
  local info state mergeable line id status conclusion newer n
  local run="" stale="" started=0 deadline=0 poll=$((INTERVAL < 3 ? INTERVAL : 3))
  local give_up=$((START_TIMEOUT + 2 * RUN_TIMEOUT))

  info="$(gh pr view "$PR" -R "$REPO" --json state,headRefOid,mergeable --jq '"\(.state) \(.headRefOid) \(.mergeable)"')" ||
    die "cannot read PR #$PR in $REPO"
  read -r state SHA mergeable <<<"$info" || true
  case "$SHA" in *[!0-9a-f]*) SHA="" ;; esac
  [ "${#SHA}" = 40 ] || die "cannot read the head commit of PR #$PR"
  [ "$state" = OPEN ] || die "PR #$PR is $state, not OPEN"
  [ "$mergeable" != CONFLICTING ] || die "PR #$PR has merge conflicts; no CI run started"
  [ "$DOCS_ONLY" = 0 ] || check_docs_only

  while :; do
    [ "$SECONDS" -lt "$give_up" ] || die "no result after ${give_up}s; PR #$PR not merged"
    line="$(newest_run)" || die "cannot list runs of workflow '$WORKFLOW' in $REPO (other file? pass -w)"
    id="" status="" conclusion=""
    read -r id status conclusion <<<"$line" || true
    if [ -n "$id" ] && [ "$id" != "$stale" ]; then
      if [ "$status" != completed ]; then
        wait_run "$id"
        if [ "$conclusion" = skipped ]; then
          # A run from a label other than `ci`, seen before it ended: look again.
          sleep "$poll"
          continue
        fi
        if [ "$conclusion" = cancelled ]; then
          # A newer confirmation run cancels the older one (workflow
          # concurrency). Follow the newer run; with none, the cancel stands.
          newer="$(newest_run)" || newer=""
          if [ -n "$newer" ] && [ "${newer%% *}" != "$id" ]; then
            log "run $id was cancelled by a newer run; following ${newer%% *}"
            continue
          fi
        fi
        [ "$conclusion" = success ] || not_success "$id"
      fi
      if [ "$conclusion" = success ]; then
        run="$id"
        break
      fi
      # Completed and not success. The run this script started: stop.
      # An older run: start a new one.
      [ "$started" = 0 ] || not_success "$id"
    fi
    if [ "$started" = 0 ]; then
      stale="$id"
      start_run
      started=1
      deadline=$((SECONDS + START_TIMEOUT))
      continue
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      [ "$DOCS_ONLY" = 1 ] ||
        die "no '$WORKFLOW' run started for ${SHA:0:7} in ${START_TIMEOUT}s; PR #$PR not merged (every changed path in paths-ignore? run again with --docs-only)"
      # A run on the head commit, even a skipped or failed one, proves the
      # path filter let this PR through: it is not docs-only.
      n="$(runs length)" || die "cannot list runs of workflow '$WORKFLOW'; not merged"
      [ "$n" = 0 ] || die "--docs-only: $n run(s) of '$WORKFLOW' exist on ${SHA:0:7}; PR #$PR not merged"
      log "no run started for ${SHA:0:7} in ${START_TIMEOUT}s and no changed path passes the path filter: merging on the local gate"
      break
    fi
    sleep "$poll"
  done
  [ -n "$run" ] || [ "$DOCS_ONLY" = 1 ] || die "internal error: no successful run; PR #$PR not merged"

  # --match-head-commit: GitHub refuses the merge when a push moved the head
  # after the run started.
  if ! gh pr merge "$PR" -R "$REPO" --merge --delete-branch --match-head-commit "$SHA"; then
    info="$(gh pr view "$PR" -R "$REPO" --json state,headRefOid --jq '"\(.state) \(.headRefOid)"' 2>/dev/null || true)"
    [ "$info" = "MERGED $SHA" ] || die "gh pr merge failed; PR #$PR is '${info:-unknown}' (head moved? run again)"
  fi
  if [ -n "$run" ]; then
    log "merged PR #$PR at ${SHA:0:7} (run $run success)"
  else
    log "merged PR #$PR at ${SHA:0:7} (docs-only, no run)"
  fi
}

main
