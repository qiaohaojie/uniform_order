#!/usr/bin/env bash
#
# capability-resolver.test.sh — regression test for app capability binding in
# resolve-capability-docs-dir.sh. (The lesson logger no longer writes to the
# capability vault; its test is log-lesson.test.sh.)
#
# Rule under test: the gitignored pin is the only source, and it must be the
# app capability vault. GQ_CAPABILITY_DOCS_DIR is never read, whatever it
# points at.
#
# Builds a throwaway repo, a fake app vault and a second, unrelated library
# under a temp dir. Never reads or writes the real vault: every case runs from
# the throwaway repo, so real pins are out of reach.
#
# Usage:
#   bash .gq-spec/tests/capability-resolver.test.sh
#   GQ_TEST_SCRIPTS_DIR=/other/.gq-spec bash …   # test another copy of the scripts
#
# Exit: 0 all cases pass · 1 any case fails

set -uo pipefail

src="${GQ_TEST_SCRIPTS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/gq-cap-test.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

app="$tmp/vault/220_Dev_Project/Master_App_Capability"
other="$tmp/vault/Some Other Library"
repo="$tmp/repo"
mkdir -p "$app" "$other" "$repo/.gq-spec"

# The other library shares the 0010 filename and the 0800 id. Only the app
# vault has 0600 - UI Adapter.md.
idx="0010 - Guideline of Capability Documents Maintenance.md"
printf '# index\n' > "$app/$idx"
printf '# index\n' > "$other/$idx"
printf '# UI Adapter\n' > "$app/0600 - UI Adapter.md"
printf '# Native Adapter\n\n### Implementation log\n\n' > "$app/0800 - Native Adapter.md"
printf '# Unrelated\n\n### Implementation log\n\n' > "$other/0800 - Unrelated Topic.md"

cp "$src/resolve-capability-docs-dir.sh" "$repo/.gq-spec/"
chmod +x "$repo/.gq-spec/"*.sh
cd "$repo" || exit 1

pass=0
fail=0
out=""
rc=0
ok() { pass=$((pass + 1)); printf 'ok   %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n       %s\n' "$1" "$2"; }

pin() { printf '%s\n' "$1" > .gq-spec/capability-docs-path; }
unpin() { rm -f .gq-spec/capability-docs-path; }
snap() { (cd "$tmp/vault" && find . -type f -exec cksum {} + | sort); }

# resolve <env dir or ""> → out, rc
resolve() {
  if [ -n "$1" ]; then
    out="$(GQ_CAPABILITY_DOCS_DIR="$1" bash .gq-spec/resolve-capability-docs-dir.sh --quiet 2>"$tmp/err")"
    rc=$?
  else
    out="$(env -u GQ_CAPABILITY_DOCS_DIR bash .gq-spec/resolve-capability-docs-dir.sh --quiet 2>"$tmp/err")"
    rc=$?
  fi
}

# expect_resolve <name> <env dir or ""> <want rc> <want stdout>
expect_resolve() {
  resolve "$2"
  if [ "$rc" -eq "$3" ] && [ "$out" = "$4" ]; then
    ok "$1"
  else
    bad "$1" "want rc=$3 out='$4'; got rc=$rc out='$out'"
  fi
}

# expect_stderr_names_bootstrap <name>
expect_stderr_names_bootstrap() {
  if grep -q 'bash .gq-spec/bootstrap.sh' "$tmp/err"; then
    ok "$1"
  else
    bad "$1" "stderr: $(tr '\n' ' ' < "$tmp/err")"
  fi
}

# --- resolver ---------------------------------------------------------------

unpin
expect_resolve "resolver: no pin + env unset → exit 1" "" 1 ""
expect_stderr_names_bootstrap "resolver: unbound message names bash .gq-spec/bootstrap.sh"
expect_resolve "resolver: no pin + env=other library → exit 1 (env is never read)" "$other" 1 ""
expect_resolve "resolver: no pin + env=app vault → exit 1 (env is never read)" "$app" 1 ""

pin "$app"
expect_resolve "resolver: pin=app + env unset → exit 0, app vault" "" 0 "$app"
expect_resolve "resolver: pin=app + env=other library → exit 0, app vault" "$other" 0 "$app"

exported="$(GQ_CAPABILITY_DOCS_DIR="$other" bash .gq-spec/resolve-capability-docs-dir.sh --export 2>/dev/null)"
if (eval "$exported" && [ "$GQ_CAPABILITY_DOCS_DIR" = "$app" ]); then
  ok "resolver: --export emits the pinned app vault"
else
  bad "resolver: --export emits the pinned app vault" "got: $exported"
fi

pin "$other"
expect_resolve "resolver: pin=other library + env=app → exit 2 (pin must be the app vault)" "$app" 2 ""
expect_stderr_names_bootstrap "resolver: bad-pin message names bash .gq-spec/bootstrap.sh"

pin "$tmp/no-such-dir"
expect_resolve "resolver: pin=missing dir + env=app → exit 2" "$app" 2 ""

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
