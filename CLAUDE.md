# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project exception — HeroUI OSS only

This repo is **open source**. Use **HeroUI OSS** (`@heroui/react`) only.

- Do not install `@heroui-pro/react` or any `@heroui-pro/*` package.
- Do not require the `heroui-pro` MCP. Process `0200` Step 3a does **not** apply here.
- For component docs, use OSS HeroUI sources (`heroui-react` skill / `@heroui/react` docs).
- New interactive UI: OSS primitives plus the existing Tailwind tokens. Do not pull Pro components.

## Commands

```bash
pnpm dev:web          # Next.js dev server
pnpm build:web        # Production build
pnpm check-types:web  # TypeScript check (apps/web)
pnpm check-types      # TypeScript check (all packages)
```

No test suite or linter — `check-types` is the correctness gate.

## Deployment

**Target host:** Hostinger "Cloud Startup" Node.js app — **not** Vercel. No `vercel.json`, no Edge runtime, no `@vercel/*` packages.

**Production domain:** `uniformorder.online` (TLD `.online`, **not** `.com.au`). Some prototypes show stale `.com.au` — ignore.

- Security headers set in `apps/web/next.config.ts` `async headers()` (works under `next start`).
- `output: "standalone"` produces a self-contained `.next/standalone/` bundle.
- Env vars: hPanel → Advanced → Node.js → Environment Variables. Restart the Node.js app after changes.

## Architecture

pnpm monorepo with one app: `apps/web` (Next.js 16, App Router, RSC + server actions).

### Portals

- **Parent shop** — `app/[tenant]/` — mobile-first via `MobileShell` (max 430px): catalog → item → cart → checkout → confirmation.
- **School admin** — `app/admin/[tenant]/` — desktop sidebar via `AdminShell`. Dashboard, Orders (Kanban), Catalog, Preloved (Intake, stock, write-offs), Bulk Upload, Reports, Settings.
- **Platform console** *(in design — `docs/superpowers/specs/2026-05-09-platform-portal-design.md`)* — `/platform`, gated to platform-admin emails.

`app/page.tsx` is the parent home / school picker.

### Multi-tenancy

Routes scoped to a `[tenant]` slug (`imhs`, `rgsh` today). Layout files validate the slug and call `notFound()` on mismatch. Today's validation reads the static `TENANTS` map in `lib/data.ts`; the platform-portal plan replaces this with DB lookups (`getTenant(slug)` + visibility rules). Tenant accent colour is threaded as a prop and applied via inline `style` — not via CSS variables.

### Data layer

- **Postgres on Neon, Drizzle ORM.** Schema: `db/schema.ts`. Queries: `db/queries.ts`. Migrations: `apps/web/drizzle/`. **Use `db.batch(...)` not `db.transaction(...)`** — neon-http doesn't support transactions.
- **Auth:** Neon Auth. Helpers in `lib/auth/authorization.ts`: `getSessionUser`, `requireSessionUser`, `isPlatformAdminEmail`, `isTenantOperatorEmail`. `PLATFORM_ADMIN_EMAILS` env var drives platform-admin recognition.
- **Stripe Connect** (`type: "standard"`). Singleton via `getStripe()` in `lib/stripe.ts`. Webhook (`api/stripe/webhook/route.ts`) handles `payment_intent.succeeded`, `account.updated`, `charge.refunded`.
- **UploadThing** for catalog images (`lib/uploadthing.ts` — `catalogImage` route is gated on `tenant.platformApprovalStatus === 'approved'`).
- **PostHog:** `serverCapture()` from `lib/analytics/server`; `posthog` from `lib/analytics/client`.
- **Cart**: `lib/cart-store.ts` is `localStorage`-only (key `uo:cart:v1`). Order placement is DB-backed via `POST /api/orders`.
- **Static fallback:** `lib/data.ts` `TENANTS` / `CATALOG` constants are still read by some route files; the platform-portal plan migrates these to DB-backed reads.

### Server / client split

RSC `page.tsx` does data fetching + passes props to a `"use client"` companion (`*-screen.tsx` / `*-client.tsx`). `params` and `searchParams` are async — must be `await`ed.

### Design system

Tailwind CSS v4 (`@import "tailwindcss"`) with custom tokens in `src/index.css` `@theme`:

| Token | Value |
|---|---|
| `--color-navy-deep` | `#081A2D` (admin sidebar) |
| `--color-parchment` | `#FAF6EE` (page background) |
| `--color-paper` | `#FDFBF6` (card background) |
| `--color-rule` | `#E5DFD2` (borders) |
| `--color-gold` | `#B08A3E` (accents) |
| `--font-serif` | Newsreader |
| `--font-sans` | Inter |

`.tnum` class for numeric/price displays. `GarmentVector` (`components/garment.tsx`) renders product SVGs keyed by item ID — no raster images.

HeroUI v3 OSS (`@heroui/react`) is installed; current UI is mostly bespoke Tailwind. Use HeroUI OSS for new interactive elements. **Pro is forbidden in this repo** (open-source exception; see top of this file).

### TypeScript

Path alias `@/*` → `apps/web/src/*`. `LayoutProps<"/[tenant]">` and `PageProps<"/[tenant]">` come from `next-env.d.ts` (Next.js 16); `params` / `searchParams` are Promises.

## Reference docs

- `docs/remaining_work.md` — pre-go-live backlog
- `docs/completed.md` — shipped features
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design specs + implementation plans
- Synthetic UI prototype references (`parent.jsx`, `operator.jsx`, `superadmin.jsx`; see `apps/landing/src/components/landing.jsx` and `apps/landing/src/lib/tokens.jsx`)
- Synthetic uniform order paper form reference (catalog model in `apps/web/src/lib/data.ts`)

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
