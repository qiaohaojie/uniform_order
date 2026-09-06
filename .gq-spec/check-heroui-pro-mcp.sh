#!/usr/bin/env bash
#
# check-heroui-pro-mcp.sh — HARD GATE for any UI work in a HeroUI project.
#
# Proves that the HeroUI Pro MCP server (https://mcp.heroui.pro/mcp) is
# reachable with a valid personal token from THIS machine. Agent-neutral:
# Cursor, Claude Code, Codex, and Grok Build can all run it before touching JSX.
#
# Token resolution (first usable hit wins; never printed, never committed):
#   1. $HEROUI_PERSONAL_TOKEN
#   2. HEROUI_PERSONAL_TOKEN.txt at the git root (gitignored)
#   3. ~/.cursor/mcp.json          mcpServers["heroui-pro"].headers
#   4. .cursor/mcp.json            (skip ${env:...} placeholders)
#   5. ~/.claude.json              mcpServers["heroui-pro"].headers
#   6. .mcp.json                   Claude Code project (skip ${...})
#   7. ~/.grok/config.toml         [mcp_servers.heroui-pro.headers]
#   8. .grok/config.toml           Grok Build project (skip ${...})
#   9. ~/.codex/config.toml        [mcp_servers.heroui-pro] http_headers
#
# Exit codes:
#   0  reachable; prints "heroui-pro-mcp: OK <serverName> <version>"
#   2  no token found on this machine
#   3  server rejected the token (401) or returned no serverInfo
#   4  network / transport failure
#
# Usage: bash .gq-spec/check-heroui-pro-mcp.sh [--quiet]
# Setup: docs/runbooks/heroui-pro-mcp.md

set -euo pipefail

quiet=0
[ "${1:-}" = "--quiet" ] && quiet=1

url="${HEROUI_PRO_MCP_URL:-https://mcp.heroui.pro/mcp}"
token="${HEROUI_PERSONAL_TOKEN:-}"

usable() {
  local t="$1"
  [ -n "$t" ] || return 1
  case "$t" in
    *'${'*|*'${env:'*|CHANGE_ME*|your-token*|'<token>'*) return 1 ;;
  esac
  return 0
}

read_json_token() {
  local f="$1"
  [ -r "$f" ] || return 1
  python3 - "$f" <<'PY' 2>/dev/null || return 1
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
servers = d.get("mcpServers") or d.get("mcp_servers") or {}
pro = servers.get("heroui-pro") or {}
headers = pro.get("headers") or pro.get("http_headers") or {}
print(headers.get("x-heroui-personal-token") or headers.get("X-HeroUI-Personal-Token") or "")
PY
}

read_toml_token() {
  local f="$1"
  [ -r "$f" ] || return 1
  # Matches:  x-heroui-personal-token = "TOKEN"   or   { "x-heroui-personal-token" = "TOKEN" }
  sed -nE 's/.*"?x-heroui-personal-token"?[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$f" | head -n1 | grep . || return 1
}

read_token_file() {
  local f="$1"
  [ -r "$f" ] || return 1
  local t
  t="$(head -n1 "$f" | tr -d '\r')"
  printf '%s' "$t"
}

take() {
  local t="$1"
  t="${t#"${t%%[![:space:]]*}"}"
  t="${t%"${t##*[![:space:]]}"}"
  if usable "$t"; then
    token="$t"
    return 0
  fi
  return 1
}

if ! usable "$token"; then token=""; fi

if [ -z "$token" ]; then take "$(read_token_file "HEROUI_PERSONAL_TOKEN.txt" || true)" || true; fi
if [ -z "$token" ]; then take "$(read_json_token "$HOME/.cursor/mcp.json" || true)" || true; fi
if [ -z "$token" ]; then take "$(read_json_token ".cursor/mcp.json" || true)" || true; fi
if [ -z "$token" ]; then take "$(read_json_token "$HOME/.claude.json" || true)" || true; fi
if [ -z "$token" ]; then take "$(read_json_token ".mcp.json" || true)" || true; fi
if [ -z "$token" ]; then take "$(read_toml_token "$HOME/.grok/config.toml" || true)" || true; fi
if [ -z "$token" ]; then take "$(read_toml_token ".grok/config.toml" || true)" || true; fi
if [ -z "$token" ]; then take "$(read_toml_token "$HOME/.codex/config.toml" || true)" || true; fi

if [ -z "$token" ]; then
  echo "heroui-pro-mcp: FAIL no personal token found (set HEROUI_PERSONAL_TOKEN or register the server; see docs/runbooks/heroui-pro-mcp.md)" >&2
  exit 2
fi

body='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"gq-spec-gate","version":"1"}}}'
resp="$(curl -sS -m 20 -X POST "$url" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-heroui-personal-token: $token" \
  -d "$body" 2>/dev/null || true)"

if [ -z "$resp" ]; then
  echo "heroui-pro-mcp: FAIL no response from $url (network/transport)" >&2
  exit 4
fi

# The server may answer as plain JSON or as an SSE frame ("data: {...}").
json_line="$(printf '%s\n' "$resp" | sed -nE 's/^data: (.*)$/\1/p' | head -n1)"
[ -z "$json_line" ] && json_line="$resp"

result="$(printf '%s' "$json_line" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
except Exception:
    print("PARSE"); sys.exit(0)
if "error" in d:
    print("ERR " + str(d["error"].get("message", "")))
elif "result" in d and "serverInfo" in d["result"]:
    si = d["result"]["serverInfo"]
    print("OK " + si.get("name", "?") + " " + si.get("version", "?"))
else:
    print("NOINFO")
')"

case "$result" in
  OK*)
    [ "$quiet" = 1 ] || echo "heroui-pro-mcp: $result"
    exit 0 ;;
  ERR*)
    echo "heroui-pro-mcp: FAIL server rejected the request — ${result#ERR } (rotate/replace the personal token at heroui.pro)" >&2
    exit 3 ;;
  *)
    echo "heroui-pro-mcp: FAIL unexpected response from $url" >&2
    exit 3 ;;
esac
