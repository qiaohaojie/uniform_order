# UniformOrder

**The online uniform shop for Australian schools and P&C committees.**

UniformOrder replaces the paper form, the spreadsheet, and the volunteer-run cash box with a school-branded online shop. Parents order from their phone. Operators pack from a tablet. Payouts land in the school’s bank account via Stripe Connect.

**Live product:** [uniformorder.online](https://uniformorder.online) · **App:** [app.uniformorder.online](https://app.uniformorder.online)

---

## What you get

| Portal | Who | What |
|---|---|---|
| **Parent shop** | Families | Mobile-first catalog → size guide → cart → Stripe checkout → pickup confirmation |
| **School admin** | P&C / uniform shop operators | Kanban fulfilment, batch pick-slip print, catalog editor, GST/CSV reports, settings |
| **Platform console** | UniformOrder operators | Tenant onboarding wizard, approval queue, Stripe Connect status |

### Highlights

- **Multi-tenant** — each school gets its own slug, accent colour, catalog, legal policy, and Stripe Connect account
- **Stripe Connect (Standard)** destination charges — schools receive funds directly; optional platform application fee
- **Fulfilment workflow** — order statuses from paid → packing → ready → collected, with audit log and transactional email
- **Multi-child parents** — one login, multiple children, cross-school order history
- **GST-aware exports** — CSV for BAS-friendly reporting
- **Versioned refund policies** — per-tenant text or external URL, consented at checkout
- **Catalog self-service** — variants, sizes, size guides, image uploads (UploadThing), platform approval gate

---

## Architecture

```
uniform_order/                  # pnpm monorepo
├── apps/web                    # Next.js 16 App Router (parent + admin + platform)
├── apps/landing                # Astro marketing site
├── docs/                       # Specs, plans, deployment notes
└── GTM/                        # Demo seed data + product walkthroughs
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

See [`apps/web/.env.example`](apps/web/.env.example) for every variable. Minimum to boot the shop UI with static fallbacks is `DATABASE_URL` + Neon Auth + Stripe test keys; platform features need `PLATFORM_ADMIN_EMAILS`.

### Database

```bash
# Apply migrations (from apps/web)
pnpm --filter web exec drizzle-kit migrate

# Optional: seed demo tenants + catalog
cd apps/web && node scripts/seed.mjs
```

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

Deeper agent/developer guidance lives in [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md). Feature history and backlog: [`docs/completed.md`](docs/completed.md), [`docs/remaining_work.md`](docs/remaining_work.md). Deployment runbook: [`docs/prod_deployment.md`](docs/prod_deployment.md).

---

## Security notes

- Admin and platform routes require an authenticated session; tenant access is email-gated (operator `shop_email` or platform-admin allowlist).
- Parent order APIs require auth and email ownership checks.
- Stripe webhooks verify signatures; order creation is idempotent on PaymentIntent ID.
- Security headers (HSTS, CSP with per-request nonces, frame denial, etc.) are set in Next config + middleware.
- Report vulnerabilities privately via GitHub Security Advisories or by emailing `support@pimspace.com` (see [`SECURITY.md`](SECURITY.md)). Do not file public issues for live secrets or payment bugs.

---

## License

[MIT](LICENSE) © 2026 PimSpace

---

## Status

Actively developed product used for Australian school uniform shops. Demo tenants and GTM fixtures are synthetic. Production configuration (live Stripe, Hostinger env, school onboarding) is out of band and not included in this repository.
