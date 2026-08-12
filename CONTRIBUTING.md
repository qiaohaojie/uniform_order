# Contributing to UniformOrder

Thanks for helping improve UniformOrder. This guide covers how to set up a local environment, the checks we expect on every change, and how to open a pull request.

## Ground rules

- **Never commit secrets.** No `.env.local`, live Stripe keys, Neon connection strings, UploadThing tokens, or Hostinger credentials. Use the `*.example` templates only.
- **Security bugs** go through private disclosure — see [`SECURITY.md`](SECURITY.md). Do not open a public issue for payment bypasses, auth holes, or tenant isolation leaks.
- Be respectful. We follow the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 10+
- A Neon Postgres database (free tier is fine for local work)
- Stripe **test** keys with Connect enabled
- Optional: Neon Auth, UploadThing, PostHog, Emailit

## Local setup

```bash
git clone https://github.com/qiaohaojie/uniform_order.git
cd uniform_order
pnpm install

cp apps/web/.env.example apps/web/.env.local
# Fill DATABASE_URL, Neon Auth, Stripe test keys, etc.
```

Apply migrations and seed demo tenants:

```bash
pnpm --filter web exec drizzle-kit migrate
cd apps/web && node scripts/seed.mjs && cd ../..
```

Run the app:

```bash
pnpm dev:web          # http://localhost:3000 — parent + admin + platform
pnpm dev:landing      # marketing site (separate port)
```

Full env and Hostinger notes: [`docs/Deployment/LOCAL_DEVELOPMENT.md`](docs/Deployment/LOCAL_DEVELOPMENT.md).

### Local-only auth shortcut

In development only (`NODE_ENV=development`), `/api/dev/login?email=you@example.com` sets a session cookie so you can exercise admin/platform flows without a full Neon Auth round-trip. These routes return **404 in production** and must never be enabled on a public host.

## What to change where

| Area | Path |
|---|---|
| Parent shop | `apps/web/src/app/[tenant]/` |
| School admin | `apps/web/src/app/admin/[tenant]/` |
| Platform console | `apps/web/src/app/platform/` |
| API routes | `apps/web/src/app/api/` |
| Schema / queries | `apps/web/src/db/` |
| Shared UI | `apps/web/src/components/` |
| Marketing landing | `apps/landing/` |

- Prefer adding DB reads/writes in `apps/web/src/db/queries.ts`.
- Use `db.batch(...)`, not `db.transaction(...)` — neon-http does not support interactive transactions.
- Server components fetch data; interactive UI lives in `"use client"` companions (`*-screen.tsx` / `*-client.tsx`).
- Tenant accent colour is passed as props / inline styles, not CSS variables.

Deeper agent-oriented architecture notes: [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md).

## Checks before you open a PR

There is no unit/e2e suite in-repo yet. **Type-checking is the primary gate.**

```bash
pnpm check-types          # whole monorepo
pnpm check-types:web      # apps/web only
pnpm build:web            # production build (catches more than tsc alone)
```

CI on `main` runs `next typegen` then `pnpm check-types` (see `.github/workflows/check-types.yml`).

If `.next` was deleted and generated `PageProps` / `LayoutProps` types are missing:

```bash
pnpm --filter web exec next typegen
```

## Pull requests

1. Branch from `main`.
2. Keep the diff focused — one concern per PR when practical.
3. Describe **what** changed and **why**.
4. Note how you verified (e.g. `pnpm check-types`, manual path through catalog → checkout, admin order board).
5. Do not include generated secrets, `.env*`, recordings (`.webm`/`.mp4`), or local Playwright storage state.

## Scope tips

- **Deploy target is Hostinger Node.js** (`output: "standalone"`), not Vercel. Avoid `@vercel/*` packages, Edge-only APIs, and Vercel-specific config.
- Production domain is `uniformorder.online` (not `.com.au`).
- Demo tenants (`imhs`, `rgsh`, `demo-*`) are synthetic. Do not introduce real school names, personal phones, or live customer data into seeds or fixtures.

## Questions

- Product / ops: `support@pimspace.com`
- Security: private report only — [`SECURITY.md`](SECURITY.md)
