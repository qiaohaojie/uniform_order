# AGENTS.md

Guidance for Codex when working in this repository.

## Project exception — HeroUI OSS only

This repo is **open source**. Use **HeroUI OSS** (`@heroui/react`) only.

- Do not install `@heroui-pro/react` or any `@heroui-pro/*` package.
- Do not require the `heroui-pro` MCP. Process `0200` Step 3a does **not** apply here.
- For component docs, use OSS HeroUI sources (`heroui-react` skill / `@heroui/react` docs).
- New interactive UI: OSS primitives plus the existing Tailwind tokens. Do not pull Pro components.

## Workflow

Use the Superpowers workflow unless the user gives a narrower instruction.

1. Discovery/spec on the base branch: use `superpowers:brainstorming`, iterate with the user, then commit the approved spec.
2. Isolation/baseline: use `superpowers:using-git-worktrees`, branch from the base branch, and run the existing gates before edits.
3. Planning in the worktree: use `superpowers:writing-plans`, ground paths in the worktree, and wait for explicit plan approval.
4. Execution: use `superpowers:subagent-driven-development` or the preferred execution skill. Continue agentically between successful tasks; pause only for failures, major design deviations, or phase completion.

## Commands

Run from the repo root via pnpm workspaces.

```bash
pnpm dev:web          # Start Next.js dev server (apps/web)
pnpm build:web        # Production build
pnpm check-types      # TypeScript check across all packages
pnpm check-types:web  # TypeScript check for apps/web only
```

No test suite or linter is configured. Type-checking is the main correctness gate.

If `.next` was deleted and generated route types such as `PageProps` / `LayoutProps` are missing, run:

```bash
pnpm --filter web exec next typegen
```

To isolate a Next.js route, start the dev server and navigate to the route directly.

## Deployment

Target host: Hostinger Cloud Startup Node.js app, not Vercel. Do not add Vercel config, Vercel runtime assumptions, Vercel KV/Cron, or `@vercel/*` packages.

Production domain: `uniformorder.online`. Older `uniformorder.com.au` prototype text is wrong and must not be reused.

Security headers live in `apps/web/next.config.ts` via `async headers()`. The app uses `output: "standalone"` for Hostinger Node.js deployment. Env vars are managed in Hostinger hPanel and require an app restart after changes.

## Architecture

- Monorepo: pnpm workspace with one app, `apps/web`.
- Parent portal: `apps/web/src/app/[tenant]/`, mobile shopping flow in `MobileShell`.
- Admin portal: `apps/web/src/app/admin/[tenant]/`, desktop operations UI in `AdminShell`.
- Home: `apps/web/src/app/page.tsx`, school picker and one-child auto-redirect.
- Tenants: `[tenant]` must be `imhs` or `rgsh`; layouts validate via `TENANTS` in `lib/data.ts`.
- Tenant accent color is passed through props and applied inline where needed.

## Data

Neon PostgreSQL plus Drizzle backs live catalog, tenant settings, orders, and Stripe account fields.

- `src/db/schema.ts`: database schema.
- `src/db/index.ts`: lazy Neon/Drizzle client. Do not create DB clients at module import time.
- `src/db/queries.ts`: shared catalog, order, and tenant query helpers. Prefer adding DB reads/writes here.
- `app/api/orders`, `app/api/catalog`, `app/api/tenant`, `app/api/stripe/*`: client-facing live write surfaces. Client code must check `res.ok` and surface errors.
- `lib/data.ts`: tenant metadata, parent/child demo data, static fallback catalog, helpers.
- `lib/admin-data.ts`: legacy mock admin orders and sales analytics.
- `lib/cart-store.ts`: cart localStorage store, key `uo:cart:v1`.
- `lib/order-store.ts`: legacy localStorage orders plus `uo:student:v1`; checkout now writes orders to Neon.

Known gap: dashboard recent orders, reports, and sales KPIs still use mock data. See `docs/FEATURE_AUDIT.md`.

## Server/Client Pattern

App Router server components fetch data and pass props to interactive client companions named like `*-screen.tsx` or `*-client.tsx`. Next.js 16 generated `PageProps` / `LayoutProps` params must be awaited in async server components.

Path alias: `@/*` maps to `apps/web/src/*`.

## UI

Tailwind CSS v4 tokens live in `apps/web/src/index.css`. Core tokens include `navy-deep`, `parchment`, `paper`, `rule`, `gold`, Newsreader headings, and Inter body text.

Use `.tnum` for prices and numeric displays. HeroUI v3 OSS (`@heroui/react`) is installed; use it for new interactive elements when it fits. Existing UI is mostly bespoke Tailwind. **Pro is forbidden in this repo** (open-source exception; see top of this file).

`components/garment.tsx` renders SVG product vectors by item ID; product imagery is not image-based.

## Design References

Read prototypes as source references only. Do not copy their internal structure into the app.

- Paper form: synthetic uniform order form reference (catalog modeled in `apps/web/src/lib/data.ts`)
- Design system: synthetic design system tokens (`apps/web/src/index.css`, `apps/landing/src/lib/tokens.jsx`)
- Parent/admin/superadmin prototypes: synthetic UI prototype references (`apps/landing/src/components/landing.jsx`)
- Supporting HeroUI references: HeroUI v3 documentation and primitives

<!-- app-master-process:start -->
## App master development process — automatic

This repo must be **bound** before any app work. Bound means the gitignored
pins `.gq-spec/master-app-dev-process-path` and
`.gq-spec/capability-docs-path` point at the app libraries
(`0010 - Master App Development Process Index.md` and
`0600 - UI Adapter.md`). If unbound, run `bash .gq-spec/bootstrap.sh` and
stop on failure. Do not treat a Unity/game vault as bound.

For every web, mobile, or app implementation, fix, refactor, debug, test,
UI, API, deploy, or process-documentation task, resolve the process library
from the valid process pin, then from the valid
`GQ_MASTER_APP_DEV_PROCESS_DIR` fallback. A valid library contains readable
processes `0000` and `0010` plus every document indexed by `0010`. If still
unbound, stop and ask the user to read
`PimSpace/220_Dev_Project/Starter_Kit/Starter_Kit.md` or run process `0000`.

Before acting, read `0010` in full, use its task router, and read every selected
process document in full. The user does not need to mention the library or a
process ID. Verify `package.json` / lockfile, Expo SDK when native, and live
CLI/MCP capabilities before relying on version-sensitive guidance. HeroUI +
Tailwind v4 is the UI baseline; Expo is the native runtime. Preserve the
project's declared versions; add labelled notes for verified differences. UI
edits require a live `heroui-pro` MCP (`0200` Step 3a). Web drive and self-ver
require `playwright-cli` (`0200` Step 3b).

Name *pair* or *handoff* from `0010` §1, then finish at that depth. Visual
*handoff* is self-ver (`0800` live chrome + `1300` hosted proof). *Pair*
completes on typecheck/lint plus one runtime oracle; persist `1300`/`1400`
when the user asks or on the next handoff. *Handoff* completes through `1300`
and then `1400`: keep project-only choices in project decisions/logs; add
reusable works/fails/notes to the owning process; update canonical guidance
only from reusable evidence with its version, changelog, and Implementation
log. If no existing process owns an activity, use `1400` to extend the
correct document or create a new process in an unused numbering gap, then
update `0010`. Ask only when the change would alter library-wide safety,
authority, or numbering policy.
<!-- app-master-process:end -->

## Project override of the managed block

Ignore the managed-block line “UI edits require a live `heroui-pro` MCP”. This repo is HeroUI OSS only (see **Project exception — HeroUI OSS only** at the top of this file). Web drive / self-ver still require `playwright-cli` (`0200` Step 3b).
