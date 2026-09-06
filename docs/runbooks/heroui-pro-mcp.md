# HeroUI Pro MCP — bind before any UI work

This repo is HeroUI-only. Agents get component docs, props, and CSS tokens from
the HeroUI Pro MCP server, which also serves the OSS `@heroui/react` docs. If
the server is not in the **current session** tool catalog, agents silently fall
back to OSS primitives and the Pro package sits unused.

## Hard gate

Run from the repo root before writing or restyling any `.tsx` / `.jsx` / `.css`:

```bash
bash .gq-spec/check-heroui-pro-mcp.sh
```

Exit 0 prints `heroui-pro-mcp: OK @heroui-pro/react-mcp <version>`. Any other
exit code means **stop**: do not build UI against OSS-only docs, do not guess
Pro APIs. Fix the binding first, then start a **new session**. Tool catalogs
are fixed per session.

`.gq-spec/bootstrap.sh` runs this check and reports it. A failing check is a
warning at bootstrap time and a hard stop at UI-coding time (process `0200`
Step 3a).

In-session proof: call MCP `heroui-pro` → `list_components`. The response must
list both `@heroui/react` and `@heroui-pro/react`. If the `heroui-pro`
namespace is absent from the session tool list, enable the server, then start
a new chat.

## Server

| Field | Value |
| --- | --- |
| Name (all agents) | `heroui-pro` |
| Transport | streamable HTTP |
| URL | `https://mcp.heroui.pro/mcp` |
| Auth header | `x-heroui-personal-token: <personal token>` |
| Token source | heroui.pro account → personal token (Pro licence; human gate) |

The token is a secret. It lives only in per-user agent config, `HEROUI_PERSONAL_TOKEN`
in the shell environment, or gitignored `HEROUI_PERSONAL_TOKEN.txt`. Never commit
it. If it appears in a transcript or log, rotate it at heroui.pro.

## Per-agent binding

Set the env var once so scripts and every agent can find it:

```bash
# ~/.zshrc (macOS) / ~/.bashrc
export HEROUI_PERSONAL_TOKEN="<token>"
```

This repo already commits secret-free project MCP configs that read that env var:

| Agent | Project file (committed, no secret) |
| --- | --- |
| Cursor | `.cursor/mcp.json` (`${env:HEROUI_PERSONAL_TOKEN}`) |
| Claude Code | `.mcp.json` (`${HEROUI_PERSONAL_TOKEN}`) |
| Grok Build | `.grok/config.toml` (`${HEROUI_PERSONAL_TOKEN}`) |
| Codex | user-scope `~/.codex/config.toml` (see below) |

### Cursor

User file `~/.cursor/mcp.json` may also list the server. Project file is enough
when the env var is set:

```json
{
  "mcpServers": {
    "heroui-pro": {
      "type": "http",
      "url": "https://mcp.heroui.pro/mcp",
      "headers": { "x-heroui-personal-token": "${env:HEROUI_PERSONAL_TOKEN}" }
    }
  }
}
```

Then Cursor Settings → Tools & MCP → confirm `heroui-pro` is enabled and shows
tools. Start a new chat.

### Claude Code

Project `.mcp.json` is committed. User-scope add (one machine):

```bash
claude mcp add --transport http --scope user heroui-pro https://mcp.heroui.pro/mcp \
  --header "x-heroui-personal-token: $HEROUI_PERSONAL_TOKEN"
claude mcp get heroui-pro
```

Must say Connected. If "Disabled for this project", run `/mcp` and enable, then
start a new session.

### Grok Build

Project `.grok/config.toml` is committed (`[mcp_servers.heroui-pro]` with
`${HEROUI_PERSONAL_TOKEN}`). User-scope add (one machine):

```bash
grok mcp add --scope user -t http heroui-pro https://mcp.heroui.pro/mcp \
  -H "x-heroui-personal-token: $HEROUI_PERSONAL_TOKEN"
grok mcp list
```

`heroui-pro` must not appear in `disabled_mcp_servers` in `~/.grok/config.toml`.
Grok also scans Cursor/Claude MCP configs when `compat.cursor.mcps` /
`compat.claude.mcps` are on (defaults). Start a new session after enabling.

### Codex

User-scope `~/.codex/config.toml` (do not commit a token):

```toml
[mcp_servers.heroui-pro]
type = "http"
url = "https://mcp.heroui.pro/mcp"
http_headers = { "x-heroui-personal-token" = "<token>" }
```

Prefer the env var in the shell that launches Codex. Start a new session.

## Verify

```bash
bash .gq-spec/check-heroui-pro-mcp.sh   # transport + token (all agents)
claude mcp get heroui-pro                # Claude Code
grok mcp list                            # Grok Build
```

In a fresh Cursor / Claude Code / Codex / Grok session, ask the agent to call
`heroui-pro.list_components`. The response must list both `@heroui/react` and
`@heroui-pro/react`.

## What agents must do once bound

1. Read skills `heroui-react`, `heroui-react-pro`, `heroui-pro-design-taste` (web)
   or the native trio.
2. `list_components`, then `get_component_docs` for **every** component to mount.
3. Prefer Pro compounds where they exist: `AppLayout` / `Sidebar` / `Navbar` for
   shells, `DataGrid` / `ListView` for tables and lists, `Timeline`, `Stepper`,
   `KPI`, `EmptyState`, `DropZone`, `Sheet`, `CodeBlock`, `Rating`, `Map`. OSS
   primitives stay the building blocks inside them.
4. Import OSS from `@heroui/react`, Pro from `@heroui-pro/react` (or its
   documented subpath). CSS order: `tailwindcss` → `@heroui/styles` →
   `@heroui-pro/react/css`.

Owner: capability **0600** (UI Adapter). Gate owner: process **0200**.
