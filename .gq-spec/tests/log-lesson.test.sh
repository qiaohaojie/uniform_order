#!/usr/bin/env bash
#
# log-lesson.test.sh — regression test for the landing-zone logger.
#
# Rules under test: a lesson is one file in Master_App_Landing/inbox/; the gold
# libraries are never written; the process pin is the only source; an identical
# summary is not logged twice; the old log-capability-lesson.sh name still works
# and lands in the same place.
#
# Builds a throwaway repo and fake libraries under a temp dir. Never reads or
# writes the real vault.
#
# Usage:
#   bash .gq-spec/tests/log-lesson.test.sh
#   GQ_TEST_SCRIPTS_DIR=/other/.gq-spec bash …   # test another copy of the scripts
#
# Exit: 0 all cases pass · 1 any case fails

set -uo pipefail

src="${GQ_TEST_SCRIPTS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/gq-lesson-test.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

root="$tmp/vault/220_Dev_Project"
proc="$root/Master_App_Dev_Process"
cap="$root/Master_App_Capability"
land="$root/Master_App_Landing"
repo="$tmp/work/my-app"
mkdir -p "$proc" "$cap" "$land/inbox" "$land/held" "$repo/.gq-spec"
printf '# index\n' > "$proc/0010 - Master App Development Process Index.md"
printf '# drive\n' > "$proc/0700 - App Drive Input Simulation and Replay.md"
printf '# hosting\n' > "$cap/0700 - Hosting Adapter.md"
printf '# landing\n' > "$land/AGENTS.md"

cp "$src/log-lesson.sh" "$src/log-capability-lesson.sh" "$repo/.gq-spec/"
cd "$repo" || exit 1
git init -q . 2>/dev/null

pass=0
fail=0
out=""
rc=0
ok() { pass=$((pass + 1)); printf 'ok   %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n       %s\n' "$1" "$2"; }
check() { if [ -z "$2" ]; then ok "$1"; else bad "$1" "$2"; fi; }

pin() { printf '%s\n' "$1" > .gq-spec/master-app-dev-process-path; }
unpin() { rm -f .gq-spec/master-app-dev-process-path; }
gold() { (cd "$root" && find Master_App_Dev_Process Master_App_Capability -type f -exec cksum {} + | sort); }
inbox_count() { find "$land/inbox" -type f -name '*.md' | wc -l | tr -d ' '; }
reset_repo() { rm -rf specs; }

# run <script> [NAME=value …] → out, rc
run() {
  local script="$1"
  shift
  out="$(env GQ_KIND=note GQ_STATUS=verified GQ_SUMMARY="self-test lesson" "$@" \
    bash ".gq-spec/$script" 2>"$tmp/err")"
  rc=$?
}

gold_before="$(gold)"

# --- unbound -----------------------------------------------------------------
unpin
run log-lesson.sh
why=""
[ "$rc" -eq 1 ] || why="want rc=1, got $rc"
[ "$(inbox_count)" -eq 0 ] || why="${why:+$why; }inbox written"
[ ! -e specs ] || why="${why:+$why; }in-repo log written"
[ -z "$out" ] || why="${why:+$why; }stdout not empty"
grep -q 'bash .gq-spec/bootstrap.sh' "$tmp/err" || why="${why:+$why; }stderr does not name bootstrap"
check "no pin → exit 1, nothing written, names bootstrap" "$why"

pin "$cap"
run log-lesson.sh
why=""
[ "$rc" -eq 1 ] || why="want rc=1, got $rc"
[ "$(inbox_count)" -eq 0 ] || why="${why:+$why; }inbox written"
check "pin is not the process library → exit 1, nothing written" "$why"

pin "$proc"
mv "$land/AGENTS.md" "$land/AGENTS.off"
run log-lesson.sh
why=""
[ "$rc" -eq 1 ] || why="want rc=1, got $rc"
[ "$(inbox_count)" -eq 0 ] || why="${why:+$why; }inbox written"
check "landing folder without AGENTS.md → exit 1, nothing written" "$why"
mv "$land/AGENTS.off" "$land/AGENTS.md"

# --- bad arguments ------------------------------------------------------------
for case in "GQ_KIND=maybe" "GQ_STATUS=sure" "GQ_LIBRARY=games" "GQ_DOC_ID=07x0" "GQ_SUMMARY="; do
  reset_repo
  run log-lesson.sh "$case"
  why=""
  [ "$rc" -eq 2 ] || why="want rc=2, got $rc"
  [ "$(inbox_count)" -eq 0 ] || why="${why:+$why; }inbox written"
  [ ! -e specs ] || why="${why:+$why; }in-repo log written"
  check "bad argument ($case) → exit 2, nothing written" "$why"
done

# --- process lesson -----------------------------------------------------------
reset_repo
run log-lesson.sh GQ_LIBRARY=process GQ_DOC_ID=700 GQ_ID=aaaaaaaa-0000-0000-0000-000000000001 \
  GQ_SUMMARY="drive step needs a settle wait" GQ_DETAIL="line one" GQ_MILESTONE=M03
f="$(find "$land/inbox" -name '*aaaaaaaa.md' | head -1)"
why=""
[ "$rc" -eq 0 ] || why="want rc=0, got $rc"
[ "$out" = "aaaaaaaa-0000-0000-0000-000000000001" ] || why="${why:+$why; }stdout is not the id: $out"
[ -n "$f" ] || why="${why:+$why; }no landing file"
if [ -n "$f" ]; then
  grep -qx 'library: process' "$f" || why="${why:+$why; }library not process"
  grep -qx 'docId: "0700"' "$f" || why="${why:+$why; }docId not padded to 0700"
  grep -qx 'project: "my-app"' "$f" || why="${why:+$why; }project is not the repo name"
  grep -qx '# drive step needs a settle wait' "$f" || why="${why:+$why; }summary heading missing"
fi
grep -q 'drive step needs a settle wait' specs/_logs/PROCESS_LESSONS.md 2>/dev/null || why="${why:+$why; }PROCESS_LESSONS.md not written"
[ ! -e specs/_logs/CAPABILITY_LESSONS.md ] || why="${why:+$why; }capability log written for a process lesson"
check "process lesson → one inbox file, PROCESS_LESSONS.md, id on stdout" "$why"

# --- duplicate ----------------------------------------------------------------
n="$(inbox_count)"
run log-lesson.sh GQ_LIBRARY=process GQ_SUMMARY="drive step needs a settle wait"
why=""
[ "$rc" -eq 0 ] || why="want rc=0, got $rc"
[ "$(inbox_count)" -eq "$n" ] || why="${why:+$why; }a second file was written"
[ "$out" = "aaaaaaaa-0000-0000-0000-000000000001" ] || why="${why:+$why; }stdout is not the first id: $out"
check "same summary again → exit 0, first id, no second file" "$why"

mv "$f" "$land/held/"
run log-lesson.sh GQ_LIBRARY=process GQ_SUMMARY="drive step needs a settle wait"
[ "$(inbox_count)" -eq 0 ] && ok "same summary waiting in held/ → not logged again" ||
  bad "same summary waiting in held/ → not logged again" "inbox has $(inbox_count)"

# --- old name -----------------------------------------------------------------
run log-capability-lesson.sh GQ_DOC_ID=0700 GQ_SUMMARY="standalone build needs the static copy"
f="$(grep -rl 'standalone build needs the static copy' "$land/inbox" | head -1)"
why=""
[ "$rc" -eq 0 ] || why="want rc=0, got $rc"
[ -n "$f" ] || why="${why:+$why; }no landing file"
[ -n "$f" ] && { grep -qx 'library: capability' "$f" || why="${why:+$why; }library not capability"; }
grep -q 'standalone build' specs/_logs/CAPABILITY_LESSONS.md 2>/dev/null || why="${why:+$why; }CAPABILITY_LESSONS.md not written"
check "log-capability-lesson.sh (old name) → lands in inbox as capability" "$why"

# --- no doc id, identity, worktree ---------------------------------------------
run log-lesson.sh GQ_LIBRARY=identity GQ_SUMMARY="vendor panel hides the env screen"
f="$(grep -rl 'vendor panel hides the env screen' "$land/inbox" | head -1)"
why=""
[ "$rc" -eq 0 ] || why="want rc=0, got $rc"
[ -n "$f" ] && { grep -qx 'docId: ""' "$f" || why="${why:+$why; }docId should be empty"; }
check "identity lesson without a doc id → accepted" "$why"

git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init 2>/dev/null
git worktree add -q "$tmp/work/feature-branch-wt" 2>/dev/null
if [ -d "$tmp/work/feature-branch-wt" ]; then
  mkdir -p "$tmp/work/feature-branch-wt/.gq-spec"
  cp .gq-spec/log-lesson.sh .gq-spec/master-app-dev-process-path "$tmp/work/feature-branch-wt/.gq-spec/"
  (cd "$tmp/work/feature-branch-wt" && GQ_KIND=note GQ_STATUS=verified GQ_SUMMARY="from a worktree" \
    bash .gq-spec/log-lesson.sh >/dev/null 2>&1)
  f="$(grep -rl 'from a worktree' "$land/inbox" | head -1)"
  if [ -n "$f" ] && grep -qx 'project: "my-app"' "$f"; then
    ok "lesson from a git worktree → project is the main repo name"
  else
    bad "lesson from a git worktree → project is the main repo name" "$(grep '^project' "$f" 2>/dev/null)"
  fi
else
  bad "lesson from a git worktree → project is the main repo name" "could not create worktree"
fi

# --- skip vault ---------------------------------------------------------------
n="$(inbox_count)"
run log-lesson.sh GQ_SKIP_VAULT=1 GQ_SUMMARY="in-repo only"
why=""
[ "$rc" -eq 0 ] || why="want rc=0, got $rc"
[ "$(inbox_count)" -eq "$n" ] || why="${why:+$why; }inbox written"
grep -q 'in-repo only' specs/_logs/CAPABILITY_LESSONS.md || why="${why:+$why; }in-repo log missing"
check "GQ_SKIP_VAULT=1 → in-repo log only" "$why"

# --- gold never touched -------------------------------------------------------
[ "$(gold)" = "$gold_before" ] && ok "gold libraries unchanged after every case" ||
  bad "gold libraries unchanged after every case" "a file under the fake libraries changed"
[ -z "$(find "$land/inbox" -name '.*.tmp')" ] && ok "no temp files left in inbox" ||
  bad "no temp files left in inbox" "found .tmp"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
