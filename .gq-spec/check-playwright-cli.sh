#!/usr/bin/env bash
#
# check-playwright-cli.sh — HARD GATE for web drive / self-ver.
#
# Proves playwright-cli is invocable on THIS machine with the commands
# process 0700 / 0800 need. Agent-neutral: Cursor, Claude Code, Codex,
# and Grok Build all run it before driving a browser.
#
# Resolution (first hit wins):
#   1. playwright-cli on PATH
#   2. npx --no-install playwright-cli  (already in node_modules; never -y)
#
# Exit codes:
#   0  ready; prints "playwright-cli: OK <bin> <version>"
#   2  not installed
#   3  installed but missing required commands (too old / wrong package)
#   4  Chromium browser not installed
#
# Usage: bash .gq-spec/check-playwright-cli.sh [--quiet]
# Setup: docs/runbooks/playwright-cli.md

set -euo pipefail

quiet=0
[ "${1:-}" = "--quiet" ] && quiet=1

bin=""
version=""

if command -v playwright-cli >/dev/null 2>&1; then
  bin="playwright-cli"
elif npx --no-install playwright-cli --version >/dev/null 2>&1; then
  bin="npx --no-install playwright-cli"
else
  echo "playwright-cli: FAIL not installed (see docs/runbooks/playwright-cli.md — npm install -g @playwright/cli@latest)" >&2
  exit 2
fi

version="$($bin --version 2>/dev/null | head -n1 | tr -d '\r' || true)"
[ -n "$version" ] || version="unknown"

help_out="$($bin --help 2>/dev/null || true)"
if [ -z "$help_out" ]; then
  echo "playwright-cli: FAIL $bin --help produced no output" >&2
  exit 3
fi

missing=""
for cmd in screenshot resize video-start video-stop snapshot; do
  if ! printf '%s\n' "$help_out" | grep -Eq "^[[:space:]]*${cmd}([[:space:]]|$)"; then
    missing="${missing} ${cmd}"
  fi
done
if [ -n "$missing" ]; then
  echo "playwright-cli: FAIL $bin ${version} missing required commands:${missing} (upgrade: npm install -g @playwright/cli@latest)" >&2
  exit 3
fi

list_out="$($bin install-browser --list 2>/dev/null || true)"
if ! printf '%s\n' "$list_out" | grep -qi 'chromium'; then
  echo "playwright-cli: FAIL Chromium not installed (run: $bin install-browser chromium). See docs/runbooks/playwright-cli.md" >&2
  exit 4
fi

[ "$quiet" = 1 ] || echo "playwright-cli: OK ${bin} ${version}"
exit 0
