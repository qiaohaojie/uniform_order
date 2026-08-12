# UniformOrder — Technical overview

Developer-facing reference: stack, architecture, local setup, and layout.  
Product positioning and use cases live in the root [`README.md`](../README.md).

**Website:** [uniformorder.online](https://uniformorder.online)

---

## Architecture

```
uniform_order/                  # pnpm monorepo
├── apps/web                    # Next.js 16 App Router (parent + admin + platform)
├── apps/landing                # Astro marketing site
├── docs/                       # Specs, plans, deployment notes, this file
└── demo/                       # Demo seed data + product walkthroughs
```

| Layer | Choice |
|---|---|
| App framework | Next.js 16 (App Router, RSC + client companions), `output: "standalone"` |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + HeroUI v3 |
| Database | Neon Postgres + Drizzle ORM |
| Auth | Neon Auth (magic link + Google) |
| Payments | Stripe Connect Standard + Payment Element |
| Email | Emailit (React Email templates) |
| Images | UploadThing |
| Analytics | PostHog |
| Deploy | Hostinger Cloud Startup (Node.js) — **not Vercel** |
| Region | AU — Neon in `ap-southeast-2` (Sydney) |

**Server / client pattern:** route `page.tsx` files fetch data on the server and pass props into `"use client"` companions (`*-screen.tsx` / `*-client.tsx`). Path alias `@/*` → `apps/web/src/*`.

**Tenants today:** demo slugs `imhs` (Illawarra Modern High School) and `rgsh` (Riverside Academy). Production tenants are provisioned through the platform portal and stored in Postgres.

### Portals (code paths)

| Portal | Who | Route area |
|---|---|---|
| **Parent shop** | Families | `apps/web/src/app/[tenant]/` — catalog → size guide → cart → Stripe → pickup confirmation |
| **School admin** | P&C / operators | `apps/web/src/app/admin/[tenant]/` — Kanban fulfilment, pick slips, catalog, GST/CSV, settings |
| **Platform console** | UniformOrder operators | `apps/web/src/app/platform/` — tenant onboarding, approval queue, Stripe Connect status |

### Product capabilities (implementation notes)

- **Multi-tenant** — each school has its own slug, accent colour, catalog, legal policy, and Stripe Connect account  
- **Stripe Connect (Standard)** destination charges — schools receive funds directly; optional platform application fee  
- **Fulfilment workflow** — paid → packing → ready → collected, with audit log and transactional email  
- **Multi-child parents** — one login, multiple children, cross-school order history  
- **GST-aware exports** — CSV for BAS-friendly reporting  
- **Versioned refund policies** — per-tenant text or external URL, consented at checkout  
- **Catalog self-service** — variants, sizes, size guides, image uploads (UploadThing), platform approval gate  

---

## Quick start

### Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 10+
- A [Neon](https://neon.tech) Postgres database
- Stripe test keys (Connect enabled)
- Optional: Neon Auth project, UploadThing, PostHog, Emailit

### Install

```bash
git clone https://github.com/qiaohaojie/uniform_order.git
cd uniform_order
pnpm install
```

### Configure

```bash
cp apps/web/.env.example apps/web/.env.local
# Fill in DATABASE_URL, Neon Auth, Stripe, and the rest
```

See [`apps/web/.env.example`](../apps/web/.env.example) for every variable. Minimum to boot the shop UI with static fallbacks is `DATABASE_URL` + Neon Auth + Stripe test keys; platform features need `PLATFORM_ADMIN_EMAILS`.

### Database

```bash
# Apply migrations (from apps/web)
pnpm --filter web exec drizzle-kit migrate

# Product tenants (imhs / rgsh) + catalog — day-to-day local shop data
cd apps/web && node scripts/seed.mjs

# Optional: isolated sales/QA demo tenants (demo-blank / demo-academy)
# See demo/demo_data/README.md for full setup (copy .env.demo, Neon Auth users)
cp demo/demo_data/.env.demo.example demo/demo_data/.env.demo
# set DATABASE_URL in .env.demo (usually same as apps/web/.env.local)
pnpm --filter web demo:seed
```

| Seeder | Tenants | When to use |
|---|---|---|
| `apps/web/scripts/seed.mjs` | `imhs`, `rgsh` | Default local product data |
| `pnpm --filter web demo:seed` | `demo-blank`, `demo-academy` | Sales demos, Kanban samples, product recordings |

> **Note:** Neon HTTP does not support interactive transactions. Prefer `db.batch(...)` over `db.transaction(...)` when extending query code.

### Run

```bash
# Parent + admin + platform app (http://localhost:3000)
pnpm dev:web

# Marketing landing (separate port; see apps/landing)
pnpm dev:landing
```

### Checks

```bash
pnpm check-types          # whole monorepo
pnpm check-types:web      # apps/web only
pnpm build:web            # production build
```

CI runs `next typegen` then `pnpm check-types` on every push/PR to `main` (see `.github/workflows/check-types.yml`). There is no unit/e2e suite in-repo yet; type-checking is the primary gate.

Also see [`CONTRIBUTING.md`](../CONTRIBUTING.md) and [`docs/Deployment/LOCAL_DEVELOPMENT.md`](Deployment/LOCAL_DEVELOPMENT.md).

---

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `NEON_AUTH_BASE_URL` | Neon Auth host |
| `NEON_AUTH_COOKIE_SECRET` | ≥32-byte cookie secret |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated platform-admin allowlist |
| `NEXT_PUBLIC_APP_URL` | Public app origin (e.g. `http://localhost:3000`) |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_APPLICATION_FEE_BPS` | Platform fee in basis points (`0` = none) |
| `UPLOADTHING_TOKEN` | Catalog image uploads |
| `EMAILIT_API_KEY` / `FROM_EMAIL` | Transactional email |
| `NEXT_PUBLIC_POSTHOG_*` / `POSTHOG_*` | Product analytics |

Never commit `.env.local` or live keys. Production secrets live in Hostinger hPanel and require an app restart after changes.

---

## Project layout (web app)

```
apps/web/src/
├── app/
│   ├── [tenant]/          # Parent shop (catalog, item, cart, checkout, orders)
│   ├── admin/[tenant]/    # School operator UI
│   ├── platform/          # Platform console
│   ├── api/               # Orders, catalog, tenant, Stripe webhooks
│   ├── auth/              # Sign-in / session
│   ├── terms/ privacy/    # Legal pages
│   └── page.tsx           # School picker / home
├── components/            # Shared UI (shells, garment SVGs, …)
├── db/                    # schema.ts, queries.ts, Drizzle client
└── lib/                   # auth, stripe, email, cart, analytics
```

Deeper agent/developer guidance: [`AGENTS.md`](../AGENTS.md), [`CLAUDE.md`](../CLAUDE.md).  
Local development: [`Deployment/LOCAL_DEVELOPMENT.md`](Deployment/LOCAL_DEVELOPMENT.md).  
Production: [`Deployment/PRODUCTION_DEPLOYMENT.md`](Deployment/PRODUCTION_DEPLOYMENT.md).

---

## Security notes

- Admin and platform routes require an authenticated session; tenant access is email-gated (operator `shop_email` or platform-admin allowlist).
- Parent order APIs require auth and email ownership checks.
- Stripe webhooks verify signatures; order creation is idempotent on PaymentIntent ID.
- Security headers (HSTS, CSP with per-request nonces, frame denial, etc.) are set in Next config + middleware.
- Report vulnerabilities privately via GitHub Security Advisories or by emailing `support@pimspace.com` (see [`SECURITY.md`](../SECURITY.md)). Do not file public issues for live secrets or payment bugs.
- `/api/dev/*` login helpers exist for **local development only** and return 404 when `NODE_ENV=production`.

---

## Related docs

- [User manuals hub](User_Manuals/README.md)  
- [Docs index](README.md)  
- [Contributing](../CONTRIBUTING.md)  
