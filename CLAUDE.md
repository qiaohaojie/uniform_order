# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root via pnpm workspaces.

```bash
pnpm dev:web          # Start Next.js dev server (apps/web)
pnpm build:web        # Production build
pnpm check-types      # TypeScript check across all packages
pnpm check-types:web  # TypeScript check for apps/web only
```

There is no test suite or linter configured. Type-checking (`check-types`) is the primary correctness gate.

To run a single Next.js route in isolation, use the dev server and navigate to the route directly.

## Deployment

**Target host:** Hostinger "Cloud Startup" Node.js app — **not** Vercel. Do not add `vercel.json`, Vercel-specific config, or assume Vercel runtime features (Edge runtime, Vercel KV, Vercel Cron, `@vercel/*` packages, etc.).

**Production domain:** `uniformorder.online` (TLD `.online`, **not** `.com.au`). Some older UI prototypes show `uniformorder.com.au` — that is wrong; ignore it. All copy, emails, links, subdomain references, and seller-of-record text must use `uniformorder.online`.

- Security headers (HSTS, CSP, X-Frame-Options, etc.) are set in `apps/web/next.config.ts` via `async headers()` so they apply under `next start` on any host.
- `next.config.ts` uses `output: "standalone"` so the build produces a self-contained `.next/standalone/` bundle that Hostinger's Node.js app can run directly.
- Env vars are configured in the Hostinger Node.js app panel (hPanel → Advanced → Node.js → Environment Variables), **not** via `vercel env`. After adding/changing an env var, restart the Node.js app from the same panel for it to take effect.

## Architecture

### Monorepo structure

pnpm workspace with one app: `apps/web` (Next.js). The root `package.json` only contains workspace scripts.

### Two portals, one codebase

**Parent portal** — `apps/web/src/app/[tenant]/`  
Mobile-first shopping flow: catalog → item detail → cart → checkout → order confirmation. Wrapped in `MobileShell` (max-width 430px, centered on desktop).

**Admin portal** — `apps/web/src/app/admin/[tenant]/`  
Desktop sidebar layout via `AdminShell`. Sections: Dashboard, Orders (Kanban board), Catalog, Bulk Upload, Reports, Settings.

`apps/web/src/app/page.tsx` is the parent home / school picker. It auto-redirects when there is only one child in `PARENT.kids`.

### Multi-tenancy

Every route is scoped to a `[tenant]` slug (`imhs` or `rgsh`). The layout files (`app/[tenant]/layout.tsx`, `app/admin/[tenant]/layout.tsx`) validate the slug against `TENANTS` in `lib/data.ts` and call `notFound()` on mismatch.

Tenant accent colour (e.g. `#7A1F2B` for IMHS) is threaded through props into components rather than read from CSS — components apply it via inline `style` on borders, backgrounds, and text.

### Data layer (all mock, no backend)

`lib/data.ts` — Static catalog (`CATALOG`), tenant definitions (`TENANTS`), parent/child definitions (`PARENT`), and past orders (`PAST_ORDERS`). This is the source of truth for the catalog.

`lib/admin-data.ts` — Mock admin orders (`ADMIN_ORDERS`) and sales analytics (`SALES_DATA`).

`lib/cart-store.ts` — `useCart()` hook. Persists to `localStorage` (key `uo:cart:v1`). Seeds from `SAMPLE_CART` on first visit.

`lib/order-store.ts` — `useOrders()` hook. Persists to `localStorage` (key `uo:orders:v1`). `placeOrder()` creates a new `AdminOrder` in state; `updateStatus()` advances order status on the Kanban board.

**Known data gap (see `docs/FEATURE_AUDIT.md`):** Newly placed orders (written to localStorage via `useOrders`) are not visible in the admin order detail (`getOrderById` reads static `ADMIN_ORDERS`), the dashboard recent-orders feed, or the parent orders history page (which reads `PAST_ORDERS`). Connecting these requires threading `useOrders` through those pages.

### Server / client split pattern

Next.js App Router server components do data fetching and pass props down. Pages with interactivity are split into a server `page.tsx` + a `"use client"` companion (`*-screen.tsx` or `*-client.tsx`). Example: `app/[tenant]/checkout/page.tsx` is a thin server wrapper; `checkout-screen.tsx` owns all state.

### Design system

Tailwind CSS v4 (`@import "tailwindcss"`) with custom design tokens defined in `src/index.css` under `@theme`:

| Token | Value |
|---|---|
| `--color-navy-deep` | `#081A2D` (admin sidebar) |
| `--color-parchment` | `#FAF6EE` (page background) |
| `--color-paper` | `#FDFBF6` (card background) |
| `--color-rule` | `#E5DFD2` (borders) |
| `--color-gold` | `#B08A3E` (accents) |
| `--font-serif` | Newsreader (headings) |
| `--font-sans` | Inter (body) |

Add `.tnum` class (`font-feature-settings: "tnum"`) on any price or numeric display.

HeroUI v3 (`@heroui/react`) and HeroUI Pro (`@heroui-pro/react`) are installed but the current UI is built primarily with bespoke Tailwind components. Use HeroUI components when adding new interactive elements.

`GarmentVector` in `components/garment.tsx` renders flat-vector SVG product illustrations keyed by item ID — no images are used.

### Design references

**Paper form:** `my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf` — the original paper order form this project digitizes.

**Design system:** `my_doc/UI_prototypes/project/Design System.html` — canonical tokens, typography, and component styles.

**UI prototypes:** `my_doc/UI_prototypes/project/` contains HTML/JSX prototypes exported from Claude Design covering three flows:
- `parent.jsx` — parent shopping flow
- `operator.jsx` — admin/operator flow
- `superadmin.jsx` — platform super-admin flow

Read the prototype source directly; do not render or screenshot it. Match the visual output in React — do not copy the prototype's internal structure into the app. `my_doc/HeroUI/design/data.jsx` and `primitives.jsx` are supporting references used by the prototypes.

### TypeScript

Path alias `@/*` maps to `apps/web/src/*`. Use `@/lib/data`, `@/components/...` etc.

`LayoutProps<"/[tenant]">` and `PageProps<"/[tenant]">` are Next.js 16 generated types from `next-env.d.ts`; `params` must be `await`ed in async server components.
