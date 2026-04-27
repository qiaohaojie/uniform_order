# HeroUI + HeroUI Pro — Agent Install Instructions

> **Read this entire file before doing anything.** This is an executable spec. Every section ends with concrete edits or commands. When this file calls something a *Decision*, that decision is already made — do not re-debate it.

**Goal:** install HeroUI v3 (OSS) + HeroUI Pro for `apps/web` (Next.js 16 + Tailwind v4 + Turbopack) and optionally `apps/native` (Expo + Uniwind), wire up project-local MCP servers, install the matching agent skills, and leave the project in a verified working state.

**What this doc does for you:** end-to-end automated setup. With the personal token below already embedded, a fresh agent can run this start-to-finish without further user input beyond an initial scope confirmation (web-only vs web+native) and an ack of the final report. The agent automates: bootstrapping the monorepo if absent, installing all packages, wiring CSS, verifying types/build, opening a browser canary, installing skills, and cleaning up the smoke-test route.

---

## Secrets used by this doc

> ⚠️ **This file contains a credential.** The personal token below grants access to the user's HeroUI Pro account. Do **not** commit `my_doc/` to a public repo. Add `my_doc/` to `.gitignore` if this repo is or will be public, or revoke the token at https://heroui.pro/dashboard if it leaks.

```bash
HEROUI_PERSONAL_TOKEN=$(cat my_doc/HeroUI/HEROUI_PERSONAL_TOKEN.txt)
```

The agent uses this for skill installs (A9). It is read from the external text file.


---

## Pre-flight — detect the starting state

Run this first. The output drives the next decision.

```bash
# What's already on disk?
[ -f package.json ] && echo "ROOT_PKG=yes" || echo "ROOT_PKG=no"
[ -d apps/web ] && echo "WEB_DIR=yes" || echo "WEB_DIR=no"
[ -f apps/web/package.json ] && echo "WEB_PKG=yes" || echo "WEB_PKG=no"
grep -E '"shadcn"|"@base-ui/react"|"@radix-ui/' apps/web/package.json 2>/dev/null && echo "HAS_SHADCN=yes" || echo "HAS_SHADCN=no"
[ -d apps/web/src/components/ui ] && echo "HAS_UI_DIR=yes" || echo "HAS_UI_DIR=no"

# Leftovers from a previous failed run that will trip A7/A8 (delete unconditionally)
[ -e apps/web/src/app/scratch ]      && echo "STALE_SCRATCH=yes"      && rm -rf apps/web/src/app/scratch
[ -e apps/web/src/app/heroui-scratch ] && echo "STALE_SCRATCH=yes"  && rm -rf apps/web/src/app/heroui-scratch

# Existing dev server holding port 3000 — A8 needs to know
lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print "PORT_3000_PID="$2}'
```

| State | Action |
|---|---|
| `ROOT_PKG=no` and `WEB_DIR=no` | **Empty repo** → run **Step 0** (full bootstrap) → then **Scenario A** |
| `WEB_PKG=yes`, `HAS_SHADCN=no`, `HAS_UI_DIR=no` | **Existing greenfield monorepo** → skip Step 0 → **Scenario A** starting at P1 |
| `HAS_SHADCN=yes` or `HAS_UI_DIR=yes` | **Existing project with shadcn** → confirm scope with user once, then **Scenario A** (replace) or **Scenario B** (coexist). Both skip Step 0. |

Also confirm scope once with the user before doing anything destructive: **web only** or **web + native**? If the answer isn't already in the conversation, ask once. The default for a fresh repo is web-only — native is heavier and most users add it later.

---

## Step 0 — Bootstrap monorepo (only when empty repo)

This bootstraps a pnpm workspace + Next 16 + React 19 + TypeScript + Tailwind v4 in `apps/web`, ready for HeroUI install. Run from the repo root.

### 0.1 — Workspace skeleton

Create these files exactly:

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "apps/*"
```

**`package.json`** (root):
```json
{
  "name": "uniform-order",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter web dev",
    "build:web": "pnpm --filter web build",
    "start:web": "pnpm --filter web start",
    "check-types": "pnpm -r check-types",
    "check-types:web": "pnpm --filter web check-types"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "heroui-pro",
      "@heroui-pro/react",
      "@tailwindcss/oxide",
      "sharp",
      "unrs-resolver"
    ]
  }
}
```

If `apps/native` is in scope, append `"heroui-native-pro"` to `onlyBuiltDependencies`.

**`.gitignore`:**
```
node_modules/
.pnpm-store/
.next/
out/
dist/
build/
*.tsbuildinfo
next-env.d.ts
.env
.env.local
.env.*.local
*.log
pnpm-debug.log*
.DS_Store
.idea/
.vscode/
```

### 0.2 — `apps/web/` scaffold

**`apps/web/package.json`:**
```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "check-types": "tsc --noEmit"
  }
}
```

**`apps/web/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

(Next.js will tweak `jsx` to `react-jsx` and add `.next/dev/types/**/*.ts` to `include` on first build — that's expected, leave the auto-edits in place.)

**`apps/web/next.config.ts`:**
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

**`apps/web/postcss.config.mjs`:**
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**`apps/web/src/index.css`:**
```css
@import "tailwindcss";
```

(HeroUI imports are added in step A4 — leave this minimal for now.)

**`apps/web/src/app/layout.tsx`:**
```tsx
import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "Uniform Order",
  description: "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**`apps/web/src/app/page.tsx`:**
```tsx
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Uniform Order</h1>
    </main>
  );
}
```

### 0.3 — Install Next.js + React + Tailwind v4 base

```bash
pnpm --filter web add next react react-dom
pnpm --filter web add -D typescript @types/node @types/react @types/react-dom tailwindcss@^4 @tailwindcss/postcss@^4
```

Expected resolution at time of writing: `next@^16.2`, `react@^19.2`, `react-dom@^19.2`, `tailwindcss@^4.2`, `@tailwindcss/postcss@^4.2`. The postinstall whitelist in 0.1 lets Tailwind's oxide binary, sharp, and unrs-resolver build automatically.

After 0.3, `apps/web` is a clean Next 16 / React 19 / Tailwind v4 app with no UI library yet. Proceed to **Common prerequisites** (skip P2 — Tailwind v4 is already installed).

---

# Common prerequisites (both scenarios)

## P1 — Authenticate with HeroUI Pro (once per machine)

```bash
npx heroui-pro@latest login    # opens browser for GitHub auth; or: pnpm dlx heroui-pro@latest login
npx heroui-pro@latest status   # must say "logged in"
```

Sessions remain valid for 180 days. For CI/CD, set `HEROUI_AUTH_TOKEN` instead (CI/CD Token from heroui.pro/dashboard — different from the Personal Token at the top of this file).

If `status` is not logged in, **stop** and ask the user to authenticate. Do not proceed.

## P2 — Verify Tailwind v4 is configured

HeroUI v3 requires Tailwind v4. On v3 it silently produces no styles.

```bash
pnpm --filter web list tailwindcss @tailwindcss/postcss
```

Expected: `tailwindcss@^4.x` and `@tailwindcss/postcss@^4.x`. If either is missing or on v3:

```bash
pnpm --filter web add -D tailwindcss@^4 @tailwindcss/postcss@^4
```

Confirm `apps/web/postcss.config.*` uses the v4 plugin:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

The main CSS file must start with `@import "tailwindcss";` (v4 syntax) — not `@tailwind base/components/utilities` (v3). Replace v3 directives with the v4 import if found.

## P3 — Root `package.json` postinstall whitelist

pnpm blocks postinstall scripts by default; HeroUI Pro and Tailwind v4 + Next.js need them. Edit the **root** `package.json`:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": [
      "heroui-pro",
      "@heroui-pro/react",
      "@tailwindcss/oxide",
      "sharp",
      "unrs-resolver"
    ]
  }
}
```

Why each entry:
- `heroui-pro`, `@heroui-pro/react` — Pro packages fetch licensed CSS/JS via postinstall (without these, Pro components ship as JS without their styles)
- `@tailwindcss/oxide` — Tailwind v4's native Rust parser (downloads platform-specific binary)
- `sharp` — Next.js image optimization (downloads platform-specific binary)
- `unrs-resolver` — Next.js module resolver (downloads platform-specific binary)

Add `heroui-native-pro` only if `apps/native` is in scope.

If `pnpm.onlyBuiltDependencies` already exists, **merge** these entries — don't replace. After editing, run `pnpm install` once at the repo root so postinstalls fire on packages that didn't get to run them on first install. The `pnpm install` warning `Ignored build scripts:` is fine to ignore for unrelated transitive deps (e.g. `@zowe/secrets-for-zowe-sdk`) that aren't in our whitelist.

---

# Scenario A — Greenfield (HeroUI only)

Use when there is no existing UI library, or the user has explicitly asked for a hard-replace.

## A1 — Remove shadcn / radix / @base-ui (skip if greenfield with nothing installed)

If the pre-flight detection found shadcn artifacts:

1. **Uninstall packages:**
   ```bash
   pnpm --filter web remove shadcn @base-ui/react class-variance-authority tailwind-merge tw-animate-css
   ```
   Plus any `@radix-ui/*` packages found in `apps/web/package.json`.

2. **Delete shadcn drop directory:**
   ```bash
   rm -rf apps/web/src/components/ui
   ```

3. **Delete `cn()` helper if it's the only thing in `apps/web/src/lib/utils.ts`** (HeroUI components don't need it).

4. **Edit `apps/web/src/index.css`:** strip everything shadcn-owned. Remove these if present:
   - `@import "tw-animate-css";`
   - `@import "shadcn/tailwind.css";`
   - The entire `:root { --background: ...; --foreground: ...; ...; --radius: ...; }` block of shadcn tokens
   - The entire `.dark { ... }` block of shadcn tokens
   - The `@theme inline { --color-* : var(--*); ... }` block that maps shadcn vars
   - The `@layer base { * { @apply border-border outline-ring/50; } }` block
   - Any `@apply bg-background text-foreground` on `body`

   Keep: `@import "tailwindcss";`, font setup, app-specific keyframes the app actually uses.

5. **Rewrite all shadcn callsites:**
   ```bash
   grep -rn "from \"@/components/ui" apps/web/src
   ```
   For each match, replace with the HeroUI equivalent. Use the `heroui-react` MCP (`list_components`, then `get_component_docs`) to find replacements. If a shadcn component has no clean 1:1 HeroUI counterpart, pick the closest match and flag it in your final report so the user can review.

## A2 — Disable shadcn-related MCPs and tooling for this repo

Only if Scenario A removed shadcn. Goal: the agent should not see shadcn-related tools in this repo even if the user has them globally. We disable at the **project** scope; we do not touch user-scope (`~/.claude.json`) since other projects may still need them.

1. **Edit `.mcp.json` at the repo root.** Remove any shadcn MCP entry. Typical name to remove:
   ```json
   "shadcn": { ... }
   ```
   If `.mcp.json` doesn't have a shadcn entry but the agent still has access to `mcp__shadcn__*` tools, those are coming from user scope.

2. **Disable user-scope shadcn MCP just for this project.** Edit `.claude/settings.json` (project-local, checked in):
   ```json
   {
     "disabledMcpjsonServers": ["shadcn"]
   }
   ```
   This blocks the named server in this repo only. Other repos remain unaffected.

3. **Audit for any other shadcn-supporting tooling** in `.mcp.json`, `.claude/settings.json`, and `.claude/settings.local.json`:
   - Look for entries with `shadcn`, `radix`, or `cva`/`class-variance-authority` in name or args.
   - For each found, decide: is it strictly shadcn-supporting (disable) or general-purpose (keep)? When unclear, flag in your report and ask.

## A3 — Install web packages

The fastest path is the Pro CLI (auto-detects peer deps and pins correct versions):

```bash
pnpm dlx heroui-pro@latest install      # adds @heroui-pro/react + auto-installs peers
```

If you prefer the manual install (deterministic, what we use in this doc — three commands so the Pro pin stays exact):

```bash
# Runtime: HeroUI OSS + Pro peers
pnpm --filter web add \
  @heroui/react @heroui/styles \
  motion react-aria-components recharts \
  embla-carousel embla-carousel-react \
  react-resizable-panels @number-flow/react tailwind-variants

# Pro (exact pin — beta, breaking changes between releases)
pnpm --filter web add -E @heroui-pro/react@latest
```

The peers (`motion` through `tailwind-variants`) are required by Pro components — install them all even if you can't see immediate use.

The Pro postinstall will report `Installed HeroUI React Pro ✓` if P1 (auth) and P3 (whitelist) are correct. If you instead see `EACCES` or `Failed to fetch licensed package`, P1 expired — re-run `pnpm dlx heroui-pro login`.

### ⚠️ Pro and OSS export different components — don't import OSS components from Pro

`@heroui-pro/react` exports **only** Pro components (charts, kanban, command palette, kpi, sidebar, etc.). It does **not** re-export OSS components like `Button`, `Input`, `Modal`, `Card`. Import OSS pieces from `@heroui/react`, Pro pieces from `@heroui-pro/react`:

```tsx
import { Button, Input, Modal } from "@heroui/react";        // OSS
import { Command, Kpi, BarChart } from "@heroui-pro/react";  // Pro
```

A common smoke-test mistake: `import { Button } from "@heroui-pro/react"` — type-checks fail with `Module '"@heroui-pro/react"' has no exported member 'Button'`. The full Pro export list is in `node_modules/.pnpm/@heroui-pro+react@*/node_modules/@heroui-pro/react/dist/components/index.d.ts`, or query the `heroui-pro` MCP via `list_components`.

## A4 — Wire up web CSS imports

Edit `apps/web/src/index.css`. The official imports (per HeroUI docs) are:

```css
@import "tailwindcss";
@import "@heroui/styles";
@import "@heroui-pro/react/css";
```

**Order matters.** Anything else (fonts, app-specific keyframes) goes below.

### ⚠️ Known issue: Turbopack / Next 16 — use `/css` subpath

This repo runs Next 16 with Turbopack, where `@import "@heroui/styles";` silently delivers **zero** rules. The `@heroui/styles` package's `exports` map declares `"style": "./dist/index.css"` for the `.` entry, but Turbopack doesn't honor the `"style"` export condition — it expects `default`. The bundle compiles clean, but no HeroUI tokens reach the browser. Verified empirically: bare import → 0 HeroUI rules; `/css` subpath → ~10K lines / ~600KB.

**For Next 16 + Turbopack, use the `/css` subpath instead:**

```css
@import "tailwindcss";
@import "@heroui/styles/css";    /* /css subpath required under Turbopack */
@import "@heroui-pro/react/css";
```

The `./css` export sets `default` directly, so it works under any bundler. Revisit this once HeroUI ships a fix or Turbopack adds `"style"` condition support.

## A5 — Native install + provider

**Web-only run: skip this section entirely.**

The fastest path for Pro is the CLI:

```bash
pnpm dlx heroui-pro@latest install     # detects native, adds heroui-native-pro + peers
```

Manual equivalent:

```bash
pnpm --filter native add heroui-native heroui-native-pro
```

Mandatory peers (versions per official quick-start — pin these exact ranges):

```bash
pnpm --filter native add \
  react-native-reanimated@^4.1.1 \
  react-native-gesture-handler@^2.28.0 \
  react-native-worklets@^0.5.1 \
  react-native-safe-area-context@^5.6.0 \
  react-native-svg@^15.12.1 \
  tailwind-variants@^3.2.2 \
  tailwind-merge@^3.4.0
```

Optional peers (install only if the app uses these surfaces):
- `react-native-screens@^4.16.0` — required by BottomSheet, Dialog, Menu, Popover, Select, Toast
- `@gorhom/bottom-sheet@^5.2.8` — required by BottomSheet and bottom-sheet presentations

For canonical guidance, query the `heroui-native` MCP: `get_docs({ path: "/docs/native/getting-started/quick-start" })`.

Edit `apps/native/global.css` — note `/styles` (not `/css`) and the Tailwind v4 `@source` directives that scan HeroUI's lib for class strings:

```css
@import "tailwindcss";
@import "uniwind";

@import "heroui-native/styles";
@import "heroui-native-pro/styles";

@source "./node_modules/heroui-native/lib";
@source "./node_modules/heroui-native-pro/lib";
```

`@source` paths are relative to `global.css` — adjust if `global.css` lives outside the app root. Without `@source`, Tailwind won't see class names referenced inside HeroUI's compiled lib and will purge their utilities.

Wrap the app root (`apps/native/app/_layout.tsx`) so `<GestureHandlerRootView>` is the outermost provider, with `<HeroUINativeProvider>` immediately inside:

```tsx
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        {/* Stack / Drawer / Tabs go here */}
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
```

`heroui-native-pro` does **not** ship its own provider — `HeroUINativeProvider` from `heroui-native` covers both. Pro on web does not need any provider.

## A6 — Verify HeroUI MCP servers are reachable

There are **four** HeroUI MCP servers; each pairs with a skill (skill names differ slightly from MCP names — see the table):

| MCP server | Type | Source | Paired skill |
|---|---|---|---|
| `heroui-react` (web OSS) | stdio | `npx -y @heroui/react-mcp@latest` | `heroui-react` |
| `heroui-native` (native OSS) | stdio | `npx -y @heroui/native-mcp@latest` | `heroui-native` |
| `heroui-pro` (web Pro) | HTTP | `https://mcp.heroui.pro/mcp` + `x-heroui-personal-token` header | `heroui-react-pro` |
| `heroui-native-pro` (native Pro) | HTTP | `https://native-mcp.heroui.pro/mcp` + `x-heroui-personal-token` header | `heroui-native-pro` |

There is also one cross-cutting skill: `heroui-pro-design-taste` (design principles shared across all four). Skill installation happens automatically in **A9**.

**Default action: do nothing in the project.** All four servers must be configured at **user scope**, which means the **top-level `mcpServers` block** in `~/.claude.json` — *not* nested under `projects.<path>.mcpServers`. Project-nested entries only register when Claude Code's CWD matches that exact path; from any other repo they're invisible to `/mcp`. (`$HOME` may not be `/Users/<user>` — on this machine it's `/Volumes/T7/georgeqiao`. Use `~` or `$HOME`, never hard-code `/Users/...`.)

**Automated check** the agent runs to confirm placement is correct (a plain `grep` for the keys is not enough — it can't distinguish top-level from nested):

```bash
python3 - <<'PY'
import json, os
data = json.load(open(os.path.expanduser("~/.claude.json")))
top = sorted(k for k in data.get("mcpServers", {}) if k.startswith("heroui"))
nested = {p: sorted(k for k in (cfg.get("mcpServers") or {}) if k.startswith("heroui"))
          for p, cfg in data.get("projects", {}).items()}
nested = {p: ks for p, ks in nested.items() if ks}
print("top-level:", top)
print("project-nested:", nested or "(none)")
PY
```

Expected for a healthy install (web-only needs the first two at top-level; full setup has all four):
```
top-level: ['heroui-native', 'heroui-native-pro', 'heroui-pro', 'heroui-react']
project-nested: (none)
```

- All four (or both web ones) at top-level and nothing nested → MCPs are wired. The user must restart Claude Code to see them in `/mcp`. Note this in the final report.
- Entries show up under `project-nested` (a previous setup placed them inside one project's block) → **move them to top-level.** Mechanical fix:
  ```bash
  cp ~/.claude.json ~/.claude.json.bak.$(date +%Y%m%d_%H%M%S)
  python3 - <<'PY'
  import json, os
  from pathlib import Path
  p = Path(os.path.expanduser("~/.claude.json"))
  data = json.loads(p.read_text())
  top = data.setdefault("mcpServers", {})
  for proj in data.get("projects", {}).values():
      mcp = proj.get("mcpServers") or {}
      for k in list(mcp):
          if k.startswith("heroui"):
              if k not in top:
                  top[k] = mcp.pop(k)
              else:
                  del mcp[k]   # already at top-level — drop the duplicate
  p.write_text(json.dumps(data, indent=2) + "\n")
  PY
  ```
  Re-run the check; expect `project-nested: (none)` after.
- Missing entirely → ask the user. If they want the agent to add them, insert these into the top-level `mcpServers` object (Pro entries' token is the Personal Token from the Secrets section at the top of this file):
  ```json
  "heroui-react":      { "type": "stdio", "command": "npx", "args": ["-y", "@heroui/react-mcp@latest"] },
  "heroui-native":     { "type": "stdio", "command": "npx", "args": ["-y", "@heroui/native-mcp@latest"] },
  "heroui-pro":        { "type": "http", "url": "https://mcp.heroui.pro/mcp",        "headers": { "x-heroui-personal-token": "<TOKEN>" } },
  "heroui-native-pro": { "type": "http", "url": "https://native-mcp.heroui.pro/mcp", "headers": { "x-heroui-personal-token": "<TOKEN>" } }
  ```

**Only if the user wants project-scope MCP** (e.g., to pin OSS versions or override user scope for one repo), add **only the OSS servers** to `.mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "heroui-react": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@heroui/react-mcp@latest"]
    },
    "heroui-native": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@heroui/native-mcp@latest"]
    }
  }
}
```

**Do NOT add `heroui-pro` or `heroui-native-pro` to project `.mcp.json`.** They require a personal token in an HTTP header. `.mcp.json` is committed to the repo, and the token grants access to the user's paid Pro license — committing it leaks credentials. Pro MCPs must stay user-scope. (The Personal Token at the top of *this* file is for skill installs only, and `my_doc/` is the user's responsibility to keep out of public repos.)

## A7 — Verify build & types

```bash
pnpm --filter web check-types
pnpm --filter web build      # Next 16 catches CSS ordering bugs that dev mode hides
```

Both must succeed. After build, sanity-check the bundled CSS contains HeroUI tokens:

```bash
CSS=$(find apps/web/.next -name '*.css' -type f | head -1)
echo "size: $(wc -c < "$CSS") bytes"
echo "--snow:    $(grep -o -- '--snow' "$CSS" | wc -l)"
echo "--eclipse: $(grep -o -- '--eclipse' "$CSS" | wc -l)"
echo "--default: $(grep -o -- '--default-' "$CSS" | wc -l)"
echo "oklch:     $(grep -o -- 'oklch(' "$CSS" | wc -l)"
```

Expected: ~600KB CSS, all four counts ≥ 1. If any are 0, redo A4 with the `/css` subpath — single most common silent failure mode.

## A8 — Smoke test a Pro component (browser-automated)

This step proves three things end-to-end: Pro types resolve, Pro CSS reaches the browser, and a Pro component mounts without runtime errors. The smoke component is **deliberately one that renders visibly inline** (no trigger, no modal state) — earlier revisions used `Command`, but Pro's `Command` is a controlled modal whose `Container` has no public `isOpen`/`defaultOpen` prop, so its DOM is hidden by default and `read_page` returns empty even on a healthy install. `EmptyState` is the simplest always-visible Pro component and matches the smoke-test contract exactly.

Create `apps/web/src/app/scratch/page.tsx`. **Note: name is `scratch`, not `_scratch`.** Next.js App Router treats `_`-prefixed folders as private and excludes them from routing — `_scratch/page.tsx` would build cleanly but `/_scratch` would be unreachable. (If pre-flight already deleted a stale `scratch/` directory, just create it fresh now.)

```tsx
"use client";
import { EmptyState } from "@heroui-pro/react";

export default function Page() {
  return (
    <main className="p-8">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Title>HeroUI Pro Smoke Test</EmptyState.Title>
          <EmptyState.Description>If you can read this, Pro is loaded.</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </main>
  );
}
```

If `EmptyState`'s subcomponent names differ in your installed Pro beta, query the `heroui-pro` MCP (`get_component_docs({ component: "empty-state" })`) for the current API. Any always-visible Pro component works for the smoke test — `Kpi`, `TrendChip`, and `Rating` are also good candidates.

Then run the **automated browser verification** (the agent does this — do not skip and do not ask the user to do it manually):

### A8.1 — Load chrome MCP tools

The chrome MCP tools are deferred. Load them first (include `read_console_messages` so step A8.5's failure path is reachable in one batch):

```
ToolSearch query: "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__read_console_messages"
max_results: 10
```

### A8.2 — Start (or reuse) the dev server in the background

Pre-flight emitted `PORT_3000_PID=<pid>` if a `next dev` was already running. Two cases:

- **Port 3000 free** → run `pnpm dev:web` with `run_in_background: true`. Watch the log for `Ready in` (use `until grep -q "Ready in" /tmp/dev.log; do sleep 0.5; done` from a Bash run-in-background command — gives you a single notification when ready). Then extract the port from the `Local:` line. If port 3000 was held, Next will silently switch to 3001 and log `Port 3000 is in use by process <pid>, using available port 3001 instead.` Use whichever port Next reports.

- **Port 3000 already serving this same `apps/web/`** (common when the user kept dev running) → skip the spawn and reuse it. Verify with `curl -sI http://localhost:3000 -o /dev/null -w "%{http_code}\n"` (expect `200`) and confirm the `next-server` PID matches the pre-flight reading. If it's a *different* project's dev server, kill it (`kill <pid>`) before starting yours, otherwise routing collides.

Do not just run `pnpm dev:web` blindly — Next 16 hard-fails with `Another next dev server is already running.` and the background command exits non-zero, leaving you with no server. Detect first, decide, then act.

### A8.3 — Open the scratch route in Chrome

```
mcp__claude-in-chrome__tabs_context_mcp(createIfEmpty=true)   # check existing tabs first
mcp__claude-in-chrome__tabs_create_mcp()                      # then navigate(tabId, url=...) — tabs_create_mcp does not accept a url arg
mcp__claude-in-chrome__navigate(tabId=<id>, url="http://localhost:<port>/scratch")
```

(`tabs_create_mcp` in some chrome-MCP versions takes no arguments and creates a blank tab; navigate after creation. If a previous run left a tab on `/scratch`, just `navigate` it again to force a reload.) Wait ~2 seconds for hydration.

### A8.4 — Run the canary JS

```
mcp__claude-in-chrome__javascript_tool(
  tabId: <id>,
  action: "javascript_exec",
  text: `
    const cs = getComputedStyle(document.documentElement);
    const probe = (name) => cs.getPropertyValue(name).trim();
    JSON.stringify({
      snow:    probe('--snow'),
      eclipse: probe('--eclipse'),
      // HeroUI v3 doesn't define numbered tokens like --default-100 — only the generic --default-* family.
      // Probe a real token from a Pro component (--accent-default is a stable signal).
      accent:  probe('--accent-default')
    })
  `
)
```

Expected: all three keys return non-empty values. Browsers may return `oklch(...)` or its `lab(...)` equivalent — Chromium converts oklch to lab in `getComputedStyle` for some color spaces. Both are healthy; only an empty string means CSS is broken. If any value is empty → CSS imports wrong, redo A4 (the `/css` subpath).

If `--accent-default` doesn't exist on your Pro version, fall back to the bundle grep from A7 — `--snow` and `--eclipse` being non-empty is the load-bearing signal that Pro CSS reached the browser.

### A8.5 — Confirm the Pro component renders

```
mcp__claude-in-chrome__read_page(tabId=<id>, filter="all", depth=20)
```

The rendered text must include `HeroUI Pro Smoke Test` (the EmptyState title) — proves the Pro component mounted, not just compiled. If `read_page` returns only `Viewport: ...` with no body text, the component failed to render — check console:

```
mcp__claude-in-chrome__read_console_messages(tabId=<id>, pattern="error|Error|Warning|exception", onlyErrors=true)
```

A clean console + empty body usually means the Pro component is rendered but visually hidden (modal, portal, etc.). Switch to a different always-visible Pro component (`Kpi`, `TrendChip`) and retry — don't waste cycles fighting a closed-by-default modal.

### A8.6 — Stop the dev server (only if A8.2 spawned one)

If A8.2 reused an existing dev server, **leave it running** (the user may still want it). If A8.2 spawned a new one in the background, kill that background bash now. Cleanup of the scratch route happens in A10.

If any A8 step fails, **stop and report** rather than retrying. The most common failures and fixes:
- Empty `--snow`/`--eclipse` → CSS imports wrong, redo A4
- Network error / page won't load → dev server didn't start; check for port conflict (A8.2) or missing dep
- `read_page` empty body, no console errors → smoke component is hidden-by-default; swap to a visible Pro component (see A8.5)
- "Module not found: @heroui-pro/react" → P1 auth missing or P3 postinstall whitelist missing

## A9 — Install agent skills (automated, uses embedded token)

The agent runs these directly with the token from the Secrets section. **Do not ask the user for the token — it is already in this file.**

For **web-only** scope, install three skills:

```bash
TOKEN="$HEROUI_PERSONAL_TOKEN"   # value from top of this file
curl -fsSL https://heroui.com/install | bash -s heroui-react
curl -fsSL https://heroui.pro/docs/install | HEROUI_PERSONAL_TOKEN="$TOKEN" bash -s -- heroui-react-pro
curl -fsSL https://heroui.pro/docs/install | HEROUI_PERSONAL_TOKEN="$TOKEN" bash -s -- heroui-pro-design-taste
```

For **web + native** scope, also install:

```bash
curl -fsSL https://heroui.com/install | bash -s heroui-native
curl -fsSL https://heroui.pro/docs/install | HEROUI_PERSONAL_TOKEN="$TOKEN" bash -s -- heroui-native-pro
```

Skills install to `~/.claude/skills/` (user scope). Re-running on a machine that already has a skill installed is idempotent — the installer overwrites with the latest version.

Skills only become active in the **next** Claude Code session. Note this in the final report so the user knows to restart.

If a curl fails:
- HTTP 401 / `unauthorized` → token revoked or wrong; ask user to issue a new one at https://heroui.pro/dashboard and update the Secrets section
- HTTP 404 → skill name typo; recheck against the table in A6
- Network error → ask the user; do not retry indefinitely

## A10 — Cleanup (automated)

Once A8 verification passes:

```bash
rm -rf apps/web/src/app/scratch
```

Re-run the build to confirm nothing else depends on it:

```bash
pnpm --filter web build
```

The route table should drop back to `/` and `/_not-found` only. If anything else broke, the cleanup hit something it shouldn't have.

**Do not auto-commit.** The user commits when they're ready.

## A — Done-when checklist

### Agent does these automatically (verify before reporting)

- [ ] Pre-flight detection ran; correct branch chosen (Step 0 / A / B)
- [ ] If empty repo: Step 0 bootstrap completed, all files created, `pnpm install` succeeded
- [ ] P1: `npx heroui-pro@latest status` says logged in
- [ ] P2: Tailwind v4 installed (`tailwindcss@^4`, `@tailwindcss/postcss@^4`)
- [ ] P3: Root `package.json` has `pnpm.onlyBuiltDependencies` with at least `heroui-pro`, `@heroui-pro/react`, `@tailwindcss/oxide`, `sharp`, `unrs-resolver`
- [ ] A1/A2: shadcn cleanup done (only if existing shadcn) or skipped (greenfield)
- [ ] A3: web HeroUI packages installed; Pro postinstall printed `Installed HeroUI React Pro ✓`
- [ ] A4: `apps/web/src/index.css` first three lines are `tailwindcss`, `@heroui/styles/css`, `@heroui-pro/react/css` (with `/css` subpath under Turbopack)
- [ ] A5: native packages + peers + CSS imports + provider (only if native in scope)
- [ ] A6: HeroUI MCPs confirmed at top-level `mcpServers` in `~/.claude.json` (Python check returns `project-nested: (none)`)
- [ ] A7: `check-types` and `build` pass; built CSS shows non-zero counts for `--snow`, `--eclipse`, `--default-`, `oklch(`
- [ ] A8: scratch route created (NOT `_scratch`); pre-existing dev server detected and reused-or-killed; browser canary returns non-empty values for `--snow` and `--eclipse` (oklch or lab format both fine); always-visible Pro component (`EmptyState`/`Kpi`) rendered with its title text picked up by `read_page`
- [ ] A9: skills installed via curl with embedded token
- [ ] A10: scratch route deleted; rebuild confirms no leftover refs

### User must do these (mention in final report)

- [ ] **Restart Claude Code** to pick up newly installed skills (A9) and to refresh `/mcp` view
- [ ] After restart, run `/mcp` and confirm all four (or two for web-only) HeroUI servers show `Connected`
- [ ] Make initial commit (or whatever VCS step they want)
- [ ] If `my_doc/` is committed to a public repo, add it to `.gitignore` or rotate the token

---

# Scenario B — Coexist (HeroUI alongside existing shadcn)

Use when shadcn is already in production use and the user does **not** want a migration. Existing shadcn pages stay untouched and keep working; HeroUI is available for new components and pages going forward.

**Hard rules for Scenario B (do not violate):**
- **Do not** uninstall any shadcn / radix / @base-ui / cva / tailwind-merge / tw-animate-css package.
- **Do not** delete `apps/web/src/components/ui/`.
- **Do not** rewrite any existing `from "@/components/ui/..."` import.
- **Do not** remove or rename any shadcn-owned CSS variables (`--background`, `--foreground`, `--primary`, `--radius`, `.dark { ... }`, etc.).
- **Do not** disable the shadcn MCP — the user still uses it.

If you find yourself wanting to "clean up" shadcn, stop. That's Scenario A, not B.

## B1 — Install web packages (additive)

```bash
pnpm --filter web add \
  @heroui/react @heroui/styles \
  motion react-aria-components recharts \
  embla-carousel embla-carousel-react \
  react-resizable-panels @number-flow/react tailwind-variants

pnpm --filter web add -E @heroui-pro/react@latest
```

These add to the existing dependencies. Nothing is removed.

## B2 — Add HeroUI CSS imports without disturbing shadcn

Edit `apps/web/src/index.css`. Insert the two HeroUI imports immediately after the existing `@import "tailwindcss";` line, **before** any shadcn imports.

Official HeroUI form is bare `@heroui/styles`, but Next 16 + Turbopack silently drops it (see A4 known-issue note). **Use the `/css` subpath here too:**

```css
@import "tailwindcss";
@import "@heroui/styles/css";          /* NEW — /css subpath required under Turbopack */
@import "@heroui-pro/react/css";       /* NEW */
@import "tw-animate-css";              /* keep if present */
@import "shadcn/tailwind.css";         /* keep if present */
/* keep all existing :root, .dark, @theme inline blocks below, untouched */
```

**Why this order:** later `@import` rules win on cascade conflicts. Putting HeroUI imports **above** shadcn means shadcn's `:root` tokens override HeroUI's wherever they share a name (`--background`, `--foreground`, `--primary`, `--radius`, etc.). That's what we want — existing shadcn-styled pages keep their look.

HeroUI's unique tokens (`--snow`, `--eclipse`, `--default-*`, etc.) and HeroUI components reference HeroUI's own internal tokens — they will work correctly. The only conflict is on the small set of generic names shadcn uses, and shadcn's win is by design here.

**Do not** strip or move any existing shadcn `:root`, `.dark`, or `@theme inline` block. Leave them exactly where they are.

## B3 — Native install + provider (same as Scenario A)

Native typically doesn't have shadcn (shadcn is web-only), so the native install is identical to Scenario A. See **A5**.

## B4 — Verify HeroUI MCP servers are reachable

Same as **A6** — including the automated top-level-vs-nested Python check on `~/.claude.json`. Do **not** disable the shadcn MCP — both shadcn and HeroUI MCPs must remain available in Scenario B.

## B5 — Document the policy

Add a short paragraph to `apps/web/README.md` (create if missing) so future contributors know which library to reach for:

```md
## UI components

This app uses two component systems side by side:

- **shadcn/ui** — existing pages and components in `src/components/ui/` and the
  pages that import from there. Do not migrate these unless explicitly asked.
- **HeroUI v3 + HeroUI Pro** — for new components and pages. Import from
  `@heroui/react` (base) and `@heroui-pro/react` (Pro).

When building something new, prefer HeroUI. Don't mix the two libraries inside
a single component — pick one per component.
```

## B6 — Verify (build + visual regression)

```bash
pnpm --filter web check-types
pnpm dev:web
pnpm --filter web build
```

Open every page that previously rendered, in this order:
1. **shadcn-owned pages** (anything that imports from `@/components/ui`) — **must look identical to before the install**. If colors, radii, or spacing shifted, the import order in B2 is wrong (HeroUI is overriding shadcn). Fix by ensuring HeroUI imports come **before** shadcn imports in `index.css`.
2. **A scratch page using HeroUI** (see B7).

DevTools canary on any page (run via the same A8 browser automation):
```js
const cs = getComputedStyle(document.documentElement);
JSON.stringify({
  snow: cs.getPropertyValue('--snow').trim(),         // HeroUI — must be set
  eclipse: cs.getPropertyValue('--eclipse').trim(),   // HeroUI — must be set
  background: cs.getPropertyValue('--background').trim(), // shadcn wins — should be shadcn's value
  primary: cs.getPropertyValue('--primary').trim(),       // shadcn wins
})
```

`--snow` and `--eclipse` must be set (HeroUI loaded). `--background` and `--primary` must match shadcn's previous values (shadcn still wins on shared names).

## B7 — Smoke test on a NEW route + skills + cleanup

Create `apps/web/src/app/heroui-scratch/page.tsx` with the same Pro `EmptyState` snippet from A8 (or any always-visible Pro component — see A8 rationale). Use the same A8.1–A8.6 browser automation flow. **Do not** add HeroUI to any existing shadcn page.

Then run **A9** (skills install) and **A10** (cleanup — `rm -rf apps/web/src/app/heroui-scratch`).

## B — Done-when checklist

### Agent does these automatically

- [ ] All B1 packages installed; no existing packages removed
- [ ] HeroUI imports added in `apps/web/src/index.css` between `tailwindcss` and shadcn imports (B2), using `/css` subpath
- [ ] All existing shadcn `:root`, `.dark`, `@theme inline` blocks present and untouched
- [ ] `apps/web/src/components/ui/` still exists, untouched
- [ ] No existing `from "@/components/ui/..."` imports rewritten
- [ ] B3: native packages + CSS + `<HeroUINativeProvider>` (only if native in scope)
- [ ] B4: MCPs verified via grep; shadcn MCP still available
- [ ] B5: `apps/web/README.md` documents two-library policy
- [ ] B6: types + build pass; CSS canary shows HeroUI tokens AND shadcn tokens both present
- [ ] B7: scratch route browser-verified, then deleted
- [ ] A9 skills installed
- [ ] No HeroUI Pro server entry committed to project `.mcp.json` (Pro tokens stay user-scope)
- [ ] Root `package.json` has the postinstall whitelist (P3)

### User must do these

- [ ] Restart Claude Code (skills + MCP refresh)
- [ ] Visually confirm shadcn pages look unchanged
- [ ] Make initial commit

---

# Agent Skills reference (install is automated by A9)

MCP servers expose tools (queries against component docs); **skills** are markdown rulebooks that teach the agent *how* to use those tools and which conventions matter. You want both. Skills are installed once per machine via curl scripts (see A9) and live in `~/.claude/skills/` (auto-discovered by Claude Code, Cursor, OpenCode, Codex, Antigravity).

| Skill | Scope | Pairs with MCP |
|---|---|---|
| `heroui-react` | web OSS (`@heroui/react`) | `heroui-react` |
| `heroui-native` | native OSS (`heroui-native`) | `heroui-native` |
| `heroui-react-pro` | web Pro (`@heroui-pro/react`) | `heroui-pro` |
| `heroui-native-pro` | native Pro (`heroui-native-pro`) | `heroui-native-pro` |
| `heroui-pro-design-taste` | cross-cutting design principles (works with all four) | — |

After A9, restart Claude Code to activate skills. Run `/skills` (or your client's equivalent) to verify each installed skill appears.

If `/mcp` shows the MCP server as `Connected` but the agent still doesn't follow HeroUI conventions (e.g., suggests v2 patterns, uses `onClick` instead of `onPress`, wraps in a Provider when not needed), the skill is the missing piece — verify it installed.

---

# Background — why these decisions

You don't need to act on this section. It explains the *why* so you can reason about edge cases.

- **Step 0 bootstrap exists because Scenario A's first run on an empty repo failed** without it — the spec assumed `apps/web/` was already scaffolded. The full file content in 0.1–0.2 is the minimum that makes Next 16 + Tailwind v4 + Turbopack work, validated end-to-end.
- **`/css` subpath:** the package's `exports` map declares `"style": "./dist/index.css"` for the `.` entry, but Turbopack/Next 16 don't read the `style` condition — they expect `default`. The `./css` entry sets `default` directly, so it works under any bundler. Verified empirically: bare import bundled 0 HeroUI rules; `/css` import bundled ~10K lines.
- **`scratch` not `_scratch`:** Next.js App Router treats folders prefixed with `_` as private — they exist on disk for organization but emit no route. `_scratch/page.tsx` builds clean (TypeScript happy, bundle compiles) but `/_scratch` is a 404. The original spec said `_scratch`; corrected to `scratch` for browser verifiability.
- **Smoke component is `EmptyState`, not `Command`:** earlier revisions used Pro's `Command` palette as the smoke test, but `Command.Container` is a controlled modal — its public props (`CommandContainerProps`) include neither `isOpen` nor `defaultOpen`, so it renders closed by default with no DOM body for `read_page` to inspect. A healthy install would still fail A8.5 visually. `EmptyState` is the simplest Pro component that renders inline and exposes verifiable text, so it's the new default. Any always-visible Pro component (`Kpi`, `TrendChip`, `Rating`) works too.
- **Canary uses `--accent-default`, not `--default-100`:** HeroUI v3 doesn't define numbered theme tokens like `--default-100` as CSS variables — only the generic `--default-*` family appears in the bundle (the `100`/`200`/etc. are scale names baked into utilities, not exposed as `--var`). The earlier canary's `--default-100` probe always returned an empty string even on healthy installs. `--snow` and `--eclipse` are the load-bearing signals; `--accent-default` is a stable third probe.
- **Browsers may return `lab(...)` instead of `oklch(...)`:** Chromium normalizes `oklch()` to `lab()` in `getComputedStyle` for some color spaces. Both formats are healthy; only an empty string means CSS failed to load. The earlier "all three keys return non-empty oklch values" wording would false-fail on Chromium even when CSS was fine.
- **Pre-flight scrubs leftover scratch routes and detects port-3000 holders:** the most common silent A8 failure was a `Button` (or partial `Command`) page left over from a previous run that breaks `check-types`, plus `pnpm dev:web` exiting non-zero because another `next dev` already held port 3000. Pre-flight now `rm -rf`s any `scratch/` or `heroui-scratch/` directory and reports `PORT_3000_PID` so A8.2 can decide between reuse, kill, or accept Next's auto-fallback to 3001.
- **Pro and OSS export different components:** `@heroui-pro/react` exports only Pro components — no `Button`, `Input`, `Modal`, `Card` (those live in `@heroui/react`). The smoke-test typo `import { Button } from "@heroui-pro/react"` produces `Module '"@heroui-pro/react"' has no exported member 'Button'` and breaks A7. The A3 export-map note is now explicit so future agents don't repeat the mistake.
- **Postinstall whitelist additions (`@tailwindcss/oxide`, `sharp`, `unrs-resolver`):** Tailwind v4's parser is a Rust binary that downloads via postinstall; Next.js's image optimization (`sharp`) and module resolver (`unrs-resolver`) are the same. pnpm v9+ blocks all postinstalls by default; without whitelisting these, you get warnings on first install and broken builds on second.
- **Why HeroUI imports come before shadcn in Scenario B:** `@import` cascade is "later wins." Putting shadcn last means shadcn tokens override HeroUI's on the names they share, preserving the look of existing shadcn pages. This is the smallest-blast-radius integration. HeroUI components don't reference shadcn-named tokens (`--background` etc.), so they get their own correct values from their unique tokens (`--snow`, `--eclipse`, `--accent-default`, etc.).
- **Why disable shadcn MCP only in Scenario A:** in greenfield mode the agent should not be tempted to suggest shadcn primitives when HeroUI is the system. In coexist mode both are valid — keep both available.
- **Pro postinstall whitelist:** pnpm v9+ requires `onlyBuiltDependencies` to opt packages into running postinstalls. HeroUI Pro uses postinstalls to fetch licensed CSS/JS artifacts; without the whitelist, fresh clones get an unstyled or broken Pro install.
- **Pro is beta:** `@heroui-pro/react@1.0.0-beta.x` ships breaking changes between betas. Pin exact (`-E` flag); don't use caret ranges until Pro hits stable.
- **Personal Token vs CI/CD Token:** The token at the top of this file is the **Personal Token**, which authenticates skill installs and Pro MCP HTTP servers. The CI/CD Token (also at heroui.pro/dashboard) is for non-interactive `HEROUI_AUTH_TOKEN` usage in pipelines and is stored separately. Don't mix them.
