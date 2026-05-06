# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Superpowers Framework: Execution Protocol

### Phase 1: Discovery & Specification (Branch: **Base Branch**)

- **Initialize:** Call `superpowers:brainstorming` to define the "What" and "Why."
- **Iterate:** Propose architectural choices and edge cases; wait for my review/questions.
- **Commit:** Once I approve the spec, save and commit the document to your current **Base Branch**.

### Phase 2: Isolation & Baseline

- **Isolate:** Call `superpowers:using-git-worktrees` to branch off the Base Branch into a new, isolated directory.
- **Verify:** Run the existing test suite immediately to ensure a clean **"Green"** baseline before making changes.

### Phase 3: Tactical Planning (Inside Worktree)

- **Initialize:** Call `superpowers:writing-plans` within the newly created worktree.
- **Finalize:** Present the implementation tasks for my explicit approval. Ensure all file paths are grounded in the worktree filesystem.

### Phase 4: Execution (Agentic Mode)

- **Directive:** Call `superpowers:subagent-driven-development` (or preferred execution skill).
- **Autonomy:** Operate **agentically**. Chain tasks together automatically without asking for sign-off between each successful task.
- **Pause Only If:**
  - A terminal command or build fails.
  - A critical architectural decision/deviation is required.
  - The entire Phase is successfully completed.

## Commands

All commands run from the repo root via pnpm workspaces.

```bash
pnpm dev:web          # Start Next.js dev server (apps/web)
pnpm build:web        # Production build
pnpm check-types      # TypeScript check across all packages
pnpm check-types:web  # TypeScript check for apps/web only
```

There is no test suite or linter configured. Type-checking (`check-types`) is the primary correctness gate.
If `.next` has been deleted and `PageProps` / `LayoutProps` are missing, regenerate Next.js route types first:

```bash
pnpm --filter web exec next typegen
```

To run a single Next.js route in isolation, use the dev server and navigate to the route directly.

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

Every route is scoped to a `[tenant]` slug (`nsbh` or `rgsh`). The layout files (`app/[tenant]/layout.tsx`, `app/admin/[tenant]/layout.tsx`) validate the slug against `TENANTS` in `lib/data.ts` and call `notFound()` on mismatch.

Tenant accent colour (e.g. `#7A1F2B` for NSBH) is threaded through props into components rather than read from CSS — components apply it via inline `style` on borders, backgrounds, and text.

### Data layer

The app now has a Neon PostgreSQL backend via Drizzle ORM. Static data remains for tenant metadata, parent demo data, legacy mock orders, and UI fallbacks, but live catalog, tenant settings, and order workflows should go through the DB/API layer.

`src/db/schema.ts` — Drizzle schema for tenants, catalog items/variants, orders/order lines, and Stripe account fields.

`src/db/index.ts` — Lazy Neon/Drizzle client. Do not instantiate DB clients at module import time; production builds collect route data without runtime env vars.

`src/db/queries.ts` — Shared query helpers for catalog, orders, and tenant settings. Prefer adding DB access here rather than duplicating query logic in route handlers.

`app/api/orders`, `app/api/catalog`, `app/api/tenant`, and `app/api/stripe/*` — Route handlers for live workflows. They are the client-facing write surface; client components should check `res.ok` and surface errors instead of assuming writes succeed.

`lib/data.ts` — Tenant definitions (`TENANTS`), parent/child demo definitions (`PARENT`), static fallback catalog data, and helpers.

`lib/admin-data.ts` — Legacy mock admin orders and sales analytics. Dashboard recent orders and sales KPIs still read this mock data.

`lib/cart-store.ts` — `useCart()` hook. Persists the current cart to `localStorage` (key `uo:cart:v1`). Seeds from `SAMPLE_CART` on first visit.

`lib/order-store.ts` — Legacy localStorage order helper plus student-detail persistence (`uo:student:v1`). Current checkout persists orders to Neon via `POST /api/orders`; the parent order history uses the saved student email to fetch live DB orders.

**Known data gap (see `docs/FEATURE_AUDIT.md`):** Dashboard recent orders are still static (`ADMIN_ORDERS`) and do not reflect live Neon orders. Reports and sales KPIs are also mock analytics data.

### Server / client split pattern

Next.js App Router server components do data fetching and pass props down. Pages with interactivity are split into a server `page.tsx` + a `"use client"` companion (`*-screen.tsx` or `*-client.tsx`). Example: `app/[tenant]/checkout/page.tsx` is a thin server wrapper; `checkout-screen.tsx` owns all state.

### Design system

Tailwind CSS v4 (`@import "tailwindcss"`) with custom design tokens defined in `src/index.css` under `@theme`:

| Token               | Value                       |
| ------------------- | --------------------------- |
| `--color-navy-deep` | `#081A2D` (admin sidebar)   |
| `--color-parchment` | `#FAF6EE` (page background) |
| `--color-paper`     | `#FDFBF6` (card background) |
| `--color-rule`      | `#E5DFD2` (borders)         |
| `--color-gold`      | `#B08A3E` (accents)         |
| `--font-serif`      | Newsreader (headings)       |
| `--font-sans`       | Inter (body)                |

Add `.tnum` class (`font-feature-settings: "tnum"`) on any price or numeric display.

HeroUI v3 (`@heroui/react`) and HeroUI Pro (`@heroui-pro/react`) are installed but the current UI is built primarily with bespoke Tailwind components. Use HeroUI components when adding new interactive elements.

`GarmentVector` in `components/garment.tsx` renders flat-vector SVG product illustrations keyed by item ID — no images are used.

### Design references

**Paper form:** `my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf` — the original paper order form this project digitizes.

**Design system:** `my_doc/UI_prototypes/project/Design System.html` — canonical tokens, typography, and component styles.

**UI prototypes:** `my_doc/UI_prototypes/project/` contains HTML/JSX prototypes exported from Codex Design covering three flows:

- `parent.jsx` — parent shopping flow
- `operator.jsx` — admin/operator flow
- `superadmin.jsx` — platform super-admin flow

Read the prototype source directly; do not render or screenshot it. Match the visual output in React — do not copy the prototype's internal structure into the app. `my_doc/HeroUI/design/data.jsx` and `primitives.jsx` are supporting references used by the prototypes.

### TypeScript

Path alias `@/*` maps to `apps/web/src/*`. Use `@/lib/data`, `@/components/...` etc.

`LayoutProps<"/[tenant]">` and `PageProps<"/[tenant]">` are Next.js 16 generated route types; `params` must be `await`ed in async server components.
