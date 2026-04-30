# Feature Audit Report

**Project:** Uniform Online Order System  
**Audited:** 30 April 2026  
**Scope:** Cross-reference of PDP requirements, UI prototypes (parent, operator, superadmin), and current codebase implementation.

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
| Stripe payment UI (mock) | ✅ Done | Card number / expiry / CVC fields; mock submit |
| Order placed confirmation | ✅ Done | Dynamic order ID; delivery method and total shown |
| Orders history page | ⚠️ Partial | Reads from static `PAST_ORDERS` in `data.ts`; newly placed orders from `useOrders` (localStorage) do **not** appear here |
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
| Recent orders feed | ⚠️ Static | Reads from `ADMIN_ORDERS` constant; does not reflect orders placed via the parent portal |
| "New product" button | ❌ Not wired | Renders but has no action |
| "Export" button | ❌ Not wired | Renders but has no action |

### Orders Board

| Feature | Status | Notes |
|---|---|---|
| 4-column Kanban (New → Packing → Ready → Collected) | ✅ Done | |
| Advance order status (Start packing → Mark ready → Collect) | ✅ Done | Persisted via `useOrders` / localStorage |
| "Notify parent" button on Ready cards | ✅ Renders | No notification is sent (expected for MVP) |
| Search by order / parent / kid | ❌ Not wired | Input is `readOnly`; not connected to the board filter |
| "Print pick slips" button | ❌ Not wired | Renders but no `onClick` / `window.print()` |
| "Email parents" button | ❌ Not wired | Renders but no action |

### Order Detail / Pick Slip

| Feature | Status | Notes |
|---|---|---|
| Pick slip with line items, GST, Stripe ref, barcode | ✅ Done | |
| Status chip | ✅ Done | |
| "Print pick slip" button | ✅ Renders | No `window.print()` wired |
| Status advance buttons on detail page | ❌ Missing | Only the Kanban board can advance status; no action buttons on the detail page |
| Refund / exchange action | ❌ Missing | PDP requires "handle refunds/exchanges" but no UI exists |
| Order detail reads live store | ❌ Not connected | `getOrderById` reads from static `ADMIN_ORDERS`; orders placed via the parent portal are not visible here |

### Catalog Management

| Feature | Status | Notes |
|---|---|---|
| Product table with category filter + search | ✅ Done | |
| Edit product name inline | ✅ Done | |
| Remove product | ✅ Done | |
| **Add product** | ❌ Not implemented | `showAddModal` state is declared but the modal/form is never rendered — button is a no-op |
| "Bulk upload CSV" button in Catalog | ❌ Not wired | Renders but does not navigate to `/admin/[tenant]/upload` |

### Bulk Upload

| Feature | Status | Notes |
|---|---|---|
| CSV drag-and-drop with inline preview | ✅ Done | |
| Error row highlighting (missing SKU, invalid price) | ✅ Done | |
| Skip-errored-rows toggle | ✅ Done | |
| Demo CSV loader | ✅ Done | |
| "Download template" button | ❌ Not wired | `href="#"`; no actual CSV file is served |

### Reports

| Feature | Status | Notes |
|---|---|---|
| Monthly revenue bar chart | ✅ Done | |
| Revenue by category breakdown | ✅ Done | |
| GST / BAS-ready summary table | ✅ Done | Gross, GST collected, net ex-GST, Stripe fees, net payout |
| "Export CSV" button | ❌ Not wired | Renders but no download logic |

### Settings

| Feature | Status | Notes |
|---|---|---|
| Shop details form (name, address, hours, email) | ✅ Done | |
| Fulfilment toggles (pickup / shipping) | ✅ Done | |
| Email notification toggles | ✅ Done | |
| **Save changes** | ❌ Not wired | Button renders but there is no form state or submit handler |
| Stripe Connect status display | ✅ Done | Shows hardcoded "Connected" state |
| **Stripe Connect — connect bank account** | ❌ Missing | No flow to actually connect a bank account (Stripe Connect OAuth onboarding); the connected state is always hardcoded |
| "Manage in Stripe →" link | ❌ Not wired | No `href` to the Stripe dashboard |

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

## 4. Data / Catalog Gaps

| Gap | Notes |
|---|---|
| Orders history not live | `app/orders/page.tsx` reads from `PAST_ORDERS` (static constant), not `useOrders` (localStorage) |
| Order detail page reads static data only | Newly placed orders stored in localStorage are not visible at `/admin/[tenant]/orders/[id]` |
| Dashboard recent orders are static | `getOrdersByTenant` reads from `ADMIN_ORDERS` constant, not localStorage |
| Missing catalog items | The NSBH paper form includes items not yet in `data.ts`: Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie |

---

## 5. Priority Ranking

### High — broken or missing core flows

1. **Add product modal** — catalog management is incomplete without it
2. **Orders search wiring** — search input is currently non-functional
3. **Orders history connected to live store** — parents can't see orders they just placed
4. **Order detail reads from live store** — admin can't open newly placed orders
5. **Stripe Connect onboarding** — no way to actually connect a bank account

### Medium — buttons that render but do nothing

6. "Bulk upload CSV" button in Catalog → navigate to upload page
7. "Print pick slips" → `window.print()`
8. "Save changes" on Settings → form state and persistence
9. "Export CSV" on Reports → generate and download CSV
10. "Download template" on Upload → serve a real CSV file
11. Status advance + refund/exchange buttons on Order Detail page

### Lower — out of MVP scope or cosmetic

12. Super-admin portal (all 4 screens)
13. Refund / exchange flow on order detail
14. Refund policy page
15. "Add another child" flow
16. Missing catalog items (Navy Shorts, Grey Socks, Scarf, etc.)
17. "Riley wore size X last year" hint driven by order history
