# AGENTS.md

Guidance for Codex when working in this repository.

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

Use `.tnum` for prices and numeric displays. HeroUI v3 (`@heroui/react`) is installed; use it for new interactive elements when it fits. Existing UI is mostly bespoke Tailwind.

`components/garment.tsx` renders SVG product vectors by item ID; product imagery is not image-based.

## Design References

Read prototypes as source references only. Do not copy their internal structure into the app.

- Paper form: `my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf`
- Design system: `my_doc/UI_prototypes/project/Design System.html`
- Parent/admin/superadmin prototypes: `my_doc/UI_prototypes/project/`
- Supporting HeroUI references: `my_doc/HeroUI/design/data.jsx`, `my_doc/HeroUI/design/primitives.jsx`
