# CLAUDE.md

Guidance for Claude Code working in this repo.

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
- **School admin** — `app/admin/[tenant]/` — desktop sidebar via `AdminShell`. Dashboard, Orders (Kanban), Catalog, Bulk Upload, Reports, Settings.
- **Platform console** *(in design — `docs/superpowers/specs/2026-05-09-platform-portal-design.md`)* — `/platform`, gated to platform-admin emails.

`app/page.tsx` is the parent home / school picker.

### Multi-tenancy

Routes scoped to a `[tenant]` slug (`nsbh`, `rgsh` today). Layout files validate the slug and call `notFound()` on mismatch. Today's validation reads the static `TENANTS` map in `lib/data.ts`; the platform-portal plan replaces this with DB lookups (`getTenant(slug)` + visibility rules). Tenant accent colour is threaded as a prop and applied via inline `style` — not via CSS variables.

### Data layer

- **Postgres on Neon, Drizzle ORM.** Schema: `db/schema.ts`. Queries: `db/queries.ts`. Migrations: `apps/web/drizzle/`. **Use `db.batch(...)` not `db.transaction(...)`** — neon-http doesn't support transactions.
- **Auth:** Neon Auth. Helpers in `lib/auth/authorization.ts`: `getSessionUser`, `requireSessionUser`, `isPlatformAdminEmail`, `isTenantOperatorEmail`. `PLATFORM_ADMIN_EMAILS` env var drives platform-admin recognition.
- **Stripe Connect** (`type: "standard"`). Singleton via `getStripe()` in `lib/stripe.ts`. Webhook (`api/stripe/webhook/route.ts`) handles `payment_intent.succeeded`, `account.updated`, `charge.refunded`.
- **UploadThing** for catalog images (`lib/uploadthing.ts` — `catalogImage` route is gated on `tenant.platformApprovalStatus === 'approved'`).
- **PostHog:** `serverCapture()` from `lib/analytics/server`; `posthog` from `lib/analytics/client`.
- **Cart**: `lib/cart-store.ts` is `localStorage`-only (key `uo:cart:v1`). Order placement is DB-backed via `POST /api/orders`.
- **Static fallback:** `lib/data.ts` `TENANTS` / `CATALOG` / `PARENT` constants are still read by some route files; the platform-portal plan migrates these to DB-backed reads.

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

HeroUI v3 (`@heroui/react`) + HeroUI Pro (`@heroui-pro/react`) are installed; current UI is mostly bespoke Tailwind. Use HeroUI for new interactive elements.

### TypeScript

Path alias `@/*` → `apps/web/src/*`. `LayoutProps<"/[tenant]">` and `PageProps<"/[tenant]">` come from `next-env.d.ts` (Next.js 16); `params` / `searchParams` are Promises.

## Reference docs

- `docs/remaining_work.md` — pre-go-live backlog
- `docs/completed.md` — shipped features
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design specs + implementation plans
- `my_doc/UI_prototypes/project/` — Claude Design exports (`parent.jsx`, `operator.jsx`, `superadmin.jsx`); read source directly, don't screenshot
- `my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf` — paper form this project digitises
