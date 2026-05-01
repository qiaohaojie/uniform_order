# Feature Audit Report

**Project:** Uniform Online Order System  
**Originally audited:** 30 April 2026  
**Last updated:** 2 May 2026  
**Scope:** Cross-reference of PDP requirements, UI prototypes (parent, operator, superadmin), and current codebase implementation.

---

## Changelog

| Date | What changed |
|---|---|
| 30 Apr 2026 | Initial audit — baseline snapshot of implemented vs missing features |
| 1 May 2026 | **High-priority items 1–5 completed:** Add product modal, orders search, live orders history, live order detail, Stripe Connect onboarding. Neon PostgreSQL backend added (Drizzle ORM, 6-table schema, seeded). 7 API routes created. Checkout now persists to DB. |
| 2 May 2026 | **Medium-priority items 6–11 completed:** Bulk upload CSV navigation, print pick slips (`window.print()` + print CSS), save changes on settings (live PATCH API), export CSV on reports (client-side blob download), download template (real CSV file served from `/public`), status advance buttons on order detail (live end-to-end tested). |

---

## 1. Parent / Guardian Portal

| Feature | Status | Notes |
|---|---|---|
| School picker | ✅ Done | Auto-redirects when only one child is enrolled |
| Catalog by category | ✅ Done | Category pill filter; defaults to Winter |
| Item detail with size guide | ✅ Done | Collapsible size guide table; variant selector |
| Add to cart / qty stepper | ✅ Done | Persisted to localStorage via `cart-store` |
| Cart screen with GST breakdown | ✅ Done | GST shown as 1/11 of subtotal |
| Checkout with student details form | ✅ Done | Name, year, roll class, parent name, mobile, email; validated before submit |
| Delivery toggle (Pickup / Ship $9.50) | ✅ Done | |
| Stripe payment UI (mock) | ✅ Done | Card number / expiry / CVC fields; `POST /api/stripe/payment-intent` creates real Stripe PaymentIntent in test mode |
| Order placed confirmation | ✅ Done | Dynamic order ID from DB; delivery method and total shown |
| Orders history page | ✅ Done | Fetches live orders from Neon DB via `GET /api/orders?email=...`; newly placed orders appear immediately |
| "Add another child" button | ❌ Not wired | Button renders on school picker but has no `onClick` or navigation |
| Refund policy page | ❌ Missing | Checkout footer says "agree to refund policy" but there is no linked page |
| "Riley wore size X last year" hint | ⚠️ Hardcoded | Static string on item detail; not derived from order history |

---

## 2. Admin / Operator Portal

### Dashboard

| Feature | Status | Notes |
|---|---|---|
| Revenue / orders / avg-order / awaiting-pickup KPIs | ✅ Done | |
| Sparkline charts on KPI cards | ✅ Done | |
| Top-selling items table with share bars | ✅ Done | |
| Needs-attention alerts | ✅ Done | |
| Recent orders feed | ⚠️ Static | Reads from `ADMIN_ORDERS` constant; does not yet reflect orders placed via the parent portal |
| "New product" button | ❌ Not wired | Renders but has no action |
| "Export" button | ❌ Not wired | Renders but has no action |

### Orders Board

| Feature | Status | Notes |
|---|---|---|
| 4-column Kanban (New → Packing → Ready → Collected) | ✅ Done | Fetches live orders from Neon DB |
| Advance order status (Start packing → Mark ready → Collect) | ✅ Done | `PATCH /api/orders/[orderId]` persists to Neon; board re-fetches on change |
| "Notify parent" button on Ready cards | ✅ Done | Opens pre-filled `mailto:` with order ID, student name, and collection instructions |
| Search by order / parent / student | ✅ Done | Live search filters Kanban columns by order ID, parent name, or student name |
| "Print pick slips" button | ✅ Done | `window.print()` — print CSS hides sidebar/topbar, shows only pick slip content |
| "Email parents" button | ✅ Done | Opens `mailto:` for bulk notification |

### Order Detail / Pick Slip

| Feature | Status | Notes |
|---|---|---|
| Pick slip with line items, GST, Stripe ref, barcode | ✅ Done | |
| Status chip | ✅ Done | Reflects live status from Neon DB |
| "Print pick slip" button | ✅ Done | `PrintButton` client component; print CSS hides admin chrome |
| Status advance buttons on detail page | ✅ Done | `OrderDetailActions` client component: "Start packing" → "Mark ready" → "Mark collected"; `PATCH /api/orders/[orderId]`; `router.refresh()` updates badge and button label; "Notify parent" `mailto:` shown when status is `ready`; buttons hidden at `collected` (terminal state). Live end-to-end tested. |
| Order detail reads live store | ✅ Done | `GET /api/orders/[orderId]` fetches from Neon; newly placed orders are visible immediately |
| Refund / exchange action | ❌ Missing | PDP requires "handle refunds/exchanges" but no UI exists |

### Catalog Management

| Feature | Status | Notes |
|---|---|---|
| Product table with category filter + search | ✅ Done | Fetches live items from Neon DB via `GET /api/catalog?tenantId=...` |
| Edit product name inline | ✅ Done | |
| Remove product | ✅ Done | `DELETE /api/catalog/[itemId]` |
| **Add product modal** | ✅ Done | Full form: name, category, description, and up to 5 variants (label + price); `POST /api/catalog` saves to Neon DB; table refreshes on success |
| "Bulk upload CSV" button in Catalog | ✅ Done | `<Link href="/admin/[tenant]/upload">` — navigates to the upload page |

### Bulk Upload

| Feature | Status | Notes |
|---|---|---|
| CSV drag-and-drop with inline preview | ✅ Done | |
| Error row highlighting (missing SKU, invalid price) | ✅ Done | |
| Skip-errored-rows toggle | ✅ Done | |
| Demo CSV loader | ✅ Done | |
| "Download template" button | ✅ Done | `href="/catalog-template.csv"` with `download` attribute; real 10-row CSV served from `/public` |

### Reports

| Feature | Status | Notes |
|---|---|---|
| Monthly revenue bar chart | ✅ Done | |
| Revenue by category breakdown | ✅ Done | |
| GST / BAS-ready summary table | ✅ Done | Gross, GST collected, net ex-GST, Stripe fees, net payout |
| "Export CSV" button | ✅ Done | `ExportCsvButton` client component generates a CSV blob in the browser from the GST summary rows and triggers a file download (e.g. `nsbh-gst-report.csv`) — no API round-trip |

### Settings

| Feature | Status | Notes |
|---|---|---|
| Shop details form (name, address, hours, email) | ✅ Done | |
| Fulfilment toggles (pickup / shipping) | ✅ Done | |
| Email notification toggles | ✅ Done | |
| **Save changes** | ✅ Done | `SettingsClient` calls `PATCH /api/tenant/[tenantId]`; shows "Saving…" spinner and "✓ Saved" confirmation |
| **Stripe Connect — connect bank account** | ✅ Done | `GET /api/stripe/connect` checks connection status; "Connect bank account" button calls `POST /api/stripe/connect` to create a real Stripe Account Link and redirects to Stripe's hosted onboarding; returns to settings with success/refresh banner |
| "Manage in Stripe →" link | ✅ Done | Links to `https://dashboard.stripe.com` when account is connected |

---

## 3. Super-admin / Platform Portal

The prototype (`my_doc/UI_prototypes/project/superadmin.jsx`) defines four screens. **None are implemented** in the current codebase — there are no routes under `/platform` or `/superadmin`.

| Screen | Status |
|---|---|
| Platform tenants list (all schools, KPIs, status badges) | ❌ Not built |
| Provision new tenant — 6-step wizard (identity, branding, billing/Stripe, operator, catalog import, go live) | ❌ Not built |
| Platform-level billing / Stripe payouts overview | ❌ Not built |
| School branding editor (logo upload, accent colour picker, live parent preview) | ❌ Not built |

---

## 4. Backend / Data Layer

| Item | Status | Notes |
|---|---|---|
| Neon PostgreSQL database | ✅ Done | Serverless Postgres on `aws-ap-southeast-2`; project `cool-wind-76972110` |
| Drizzle ORM schema | ✅ Done | 6 tables: `tenants`, `catalog_items`, `catalog_variants`, `orders`, `order_lines`, `stripe_accounts` |
| Seed data | ✅ Done | 2 tenants (NSBH, RGHS), 19 catalog items, 30 variants, 3 sample orders |
| Neon Auth integration | ✅ Done | `@neondatabase/auth` configured; `GET/POST /api/auth/[...path]` route handler |
| Stripe SDK | ✅ Done | `stripe` v17 installed; test-mode keys configured in `.env.local` |
| Orders API | ✅ Done | `GET /api/orders`, `POST /api/orders`, `GET /api/orders/[id]`, `PATCH /api/orders/[id]` |
| Catalog API | ✅ Done | `GET /api/catalog`, `POST /api/catalog`, `DELETE /api/catalog/[id]` |
| Stripe payment intent API | ✅ Done | `POST /api/stripe/payment-intent` |
| Stripe Connect API | ✅ Done | `GET /api/stripe/connect`, `POST /api/stripe/connect` |
| Tenant settings API | ✅ Done | `PATCH /api/tenant/[tenantId]` |
| Dashboard recent orders live | ❌ Not connected | Still reads from `ADMIN_ORDERS` static constant |
| Missing catalog items | ❌ Not seeded | NSBH paper form items not yet in DB: Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie |

---

## 5. Remaining Work

### Remaining lower-priority items

| # | Item | Priority |
|---|---|---|
| 12 | Super-admin portal — all 4 screens | Lower |
| 13 | Refund / exchange flow on order detail | Lower |
| 14 | Refund policy page | Lower |
| 15 | "Add another child" flow on school picker | Lower |
| 16 | Missing catalog items (Navy Shorts, Grey Socks, Scarf, etc.) | Lower |
| 17 | "Riley wore size X last year" hint driven by live order history | Lower |
| 18 | Dashboard recent orders connected to live Neon DB | Lower |

### Items completed since initial audit

All **11 high- and medium-priority items** from the original backlog are now complete:

- ✅ 1 — Add product modal
- ✅ 2 — Orders search wiring
- ✅ 3 — Orders history connected to live DB
- ✅ 4 — Order detail reads from live DB
- ✅ 5 — Stripe Connect onboarding (connect bank account)
- ✅ 6 — Bulk upload CSV button navigates to upload page
- ✅ 7 — Print pick slips (`window.print()` + print CSS)
- ✅ 8 — Save changes on Settings (live PATCH API)
- ✅ 9 — Export CSV on Reports (client-side blob download)
- ✅ 10 — Download template on Upload (real CSV from `/public`)
- ✅ 11 — Status advance buttons on Order Detail (live end-to-end tested)
