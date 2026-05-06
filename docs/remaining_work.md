# Remaining Work — Pre-Go-Live Backlog

**Project:** Uniform Online Order System
**Author:** Engineering audit
**Date:** 5 May 2026
**Sources:** [PDP](../my_doc/PDP.md), [FEATURE_AUDIT.md](./FEATURE_AUDIT.md), live codebase scan

This document lists every item that must be resolved (or explicitly deferred) before the platform can go live with a paying NSW school. Items are grouped by severity. Each item maps back to either a PDP requirement, an unfinished feature from the audit, or a production-readiness gap discovered during the codebase scan.

---

## Severity legend

| Level | Meaning |
|---|---|
| 🔴 **Blocker** | Cannot go live — money flow, legal, or security risk |
| 🟠 **High** | Must ship for an acceptable v1 launch |
| 🟡 **Medium** | Required by PDP / prototype but tolerable for soft launch |
| 🟢 **Low** | Nice-to-have, post-launch acceptable |

---

## 2. 🟠 High — required for an acceptable v1

### 2.1 Refund / exchange UI on order detail (admin)

**Where:** `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx`

PDP §2 names "handle refunds/exchanges" as a core operator capability. No UI exists. The audit lists this as item 13.

**Required:**
- "Refund full / refund line / exchange" actions on order detail.
- Stripe refund call (`stripe.refunds.create`) — partial-amount supported.
- New `order_refunds` table (or `order_lines.refunded_qty`) to record refunded items, reason, operator userId, refundedAt.
- Status chip should reflect "Partially refunded" / "Refunded".

### 2.2 Super-admin / platform portal — none of 4 screens exist

**Where:** No `/platform` or `/superadmin` routes. Prototype lives at `my_doc/UI_prototypes/project/superadmin.jsx`.

Without this, onboarding a second school requires running a SQL seed script. For multi-tenant go-live this is a blocker for tenant #2 (RGSH already exists from seed but cannot be edited via UI).

**Required:**
- `/platform` (or `/superadmin`) section gated to platform-admin role.
- Tenants list with KPIs and status badges.
- "Provision new tenant" 6-step wizard (identity, branding, billing/Stripe, operator, catalog import, go-live).
- Platform-level Stripe payouts overview.
- Branding editor (logo upload, accent colour picker, live parent preview).

### 2.3 Stripe webhook handler — partially done

**Status: PARTIAL.** `POST /api/stripe/webhook` exists with signature verification and idempotent handling for `payment_intent.succeeded` (atomically transitions `pending_payment → new` and sends confirmation email). `account.updated` and `charge.refunded` are not yet handled — the latter two remain required for reliable Connect onboarding sync and out-of-band refund reconciliation.

### 2.6 Production environment configuration

- Switch from Stripe **test** keys to **live** keys (today `.env.local` is test mode per audit).
- Production database URL pinned to a non-shared Neon branch.
- `NEXT_PUBLIC_*` keys reviewed (no secret leaks).
- Vercel project (or chosen host) with environment groups for `preview` / `production`.
- Domain + TLS (`uniformsonline.com.au` or per-tenant subdomains).
- Add `vercel.json` headers (`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, basic CSP).

### 2.7 Error handling, logging, observability — partially done

**Status: PARTIAL.**
- Global `error.tsx` and `not-found.tsx` exist, styled to brand.
- PostHog (error tracking + logs + product analytics) is not yet wired in.
- API routes still use `console.error` only — failures are silent in production without a log aggregator.

**Remaining required:** Wire PostHog SDK to both client (`posthog-js`) and server (`posthog-node`) with error tracking and log capture enabled, request-id correlation in logs.

---

## 3. 🟡 Medium — required by PDP/prototype, tolerable for soft launch

### 3.1 Missing catalog items from the paper form

**Where:** `apps/web/src/db/queries.ts` seed data; audit §4.

NSBH paper form items missing from the seed: Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie. PDP §4 lists these explicitly.

**Required:** Update seed + run a one-off insert against production for both NSBH and RGSH (RGSH catalog needs review with the school).

### 3.2 Refund-policy *page* (the actual content)

Already counted in §1.5 as a blocker for the consent step. Listed again here because the content itself (copy, signed off by each school's bursar) is a content task, not a code task.

### 3.3 "Add another child" flow on school picker

**Where:** `apps/web/src/app/page.tsx`

Button renders, has no `onClick`. Audit item 15. PDP allows ordering for multiple children — without this, families with siblings have to re-checkout per child.

### 3.4 Order tracking page for parents

PDP §3.1 mentions "order tracking" beyond an emailed receipt. Today the parent orders list shows status text but no per-order timeline (placed → packing → ready → collected). Add a parent-facing detail page at `/[tenant]/order/[orderId]` keyed by parent email + order ID.

### 3.5 Stripe Connect onboarding completion polling / webhook

`GET /api/stripe/connect` reads `stripePayoutsEnabled` from the DB but the field is only updated when the operator returns to the page. A drop-off mid-onboarding leaves the school looking "not connected" forever. Tied to webhook work in §2.3 (`account.updated`).

### 3.6 GST / BAS report — auditor sign-off

The reports page produces monthly GST totals client-side. Before go-live, have an Australian accountant confirm the formula (1/11 of GST-inclusive total), the rounding rules, and the Stripe-fee deduction model.

### 3.7 Print stylesheet QA

`window.print()` works for pick slips, but needs verification on real A4 in Chrome and Safari (page breaks for multi-page picks, single-slip-per-page mode for batch printing).

### 3.8 Accessibility audit

No automated a11y tests run today. At minimum: keyboard nav through the parent flow, `aria-label`s on icon buttons (cart, add-to-cart, status pills), colour-contrast on the burgundy `#7A1F2B` accent.

### 3.9 Mobile shell viewport edge cases

`MobileShell` caps at 430px. Verify behaviour on iPhone SE (375px), Android landscape, and iPad split-view.

---

## 4. 🟢 Low — post-launch acceptable

| # | Item | Source |
|---|---|---|
| 4.1 | "Riley wore size X last year" hint driven from live order history (see §4.9) | Audit item 17 |
| 4.2 | "New product" and "Export" buttons on Dashboard wired up | Audit §2 / Dashboard |
| 4.3 | Bulk operator "Email parents" with real send (currently `mailto:`) | Orders board |
| 4.4 | i18n scaffolding for future non-NSW expansion (PDP §7 Phase 3) | PDP roadmap |
| 4.5 | Inventory stock counts (the schema has none — quantities are unbounded) | PDP §3.2 hints at "Update stock levels" |
| 4.6 | Operator audit log (who marked the order ready, who refunded) | Inferred from refund work |
| 4.7 | Catalog sortable / drag-to-reorder | Prototype only |
| 4.8 | Drizzle migrations checked into the repo (currently schema is push-only) | Ops |
| 4.9 | Implementation detail for §4.1 — replace hardcoded size hint (see below) | known_issues #1 |
| 4.10 | Note: transactional-email webhook commit was not split as planned (`3ce98b1` collapsed Task 6 Steps 3 & 4). Functionality correct; history/bisect deviation only — not worth rewriting. | known_issues #3 |

### 4.9 Replace hardcoded "Riley wore size X last year" hint

**File:** `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx:147`

**Problem:** The size hint shown beneath the size selector on the item detail page is a static string `"Riley wore size 14 last year"`. It does not reflect the actual parent's order history or their child's name.

**Proper fix — three pieces:**

#### 1. New db query (`apps/web/src/db/queries.ts`)

```ts
export async function getPreviousSizeHint(tenantId: string, email: string, itemId: string) {
  const rows = await db
    .select({ studentName: orders.studentName, variantLabel: orderLines.variantLabel, createdAt: orders.createdAt })
    .from(orders)
    .innerJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(and(eq(orders.tenantId, tenantId), eq(orders.parentEmail, email), eq(orderLines.itemId, itemId)))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
```

#### 2. New API route

`GET /api/orders/size-hint?tenantId=...&email=...&itemId=...`

Returns `{ studentName, variantLabel }` or `null`. A dedicated route is cleaner than extending the existing orders route.

#### 3. Wire `interactive.tsx`

Add a `useEffect` that:
1. Calls `readStudentDetails()` (from `@/lib/order-store`) to get the parent's email from `uo:student:v1` localStorage
2. Fetches `/api/orders/size-hint?tenantId=...&email=...&itemId=${item.id}`
3. If a result is returned, renders `"{studentName} wore {variantLabel} last year"` dynamically
4. If no result (first-time buyer or item never ordered), hides the hint entirely

**Notes:**
- The email and student name are already persisted to localStorage during checkout via `writeStudentDetails()` — no new storage needed
- The hint should only appear when there is a real match; don't fall back to any hardcoded value

---

## 5. Suggested go-live checklist (one page)

1. [ ] Refund/exchange action on order detail (§2.1)
2. [~] Stripe webhook endpoint (§2.3 — `payment_intent.succeeded` done; `account.updated` + `charge.refunded` pending)
3. [ ] Production env, live Stripe keys, security headers (§2.6)
4. [~] PostHog (error tracking + logs) + error/not-found pages (§2.7 — branded error/not-found done; PostHog wiring pending)
5. [ ] Catalog seeded with full NSBH paper-form items (§3.1)
6. [ ] Accountant sign-off on GST report (§3.6)
7. [ ] Manual end-to-end test: parent orders → Stripe charge → operator marks ready → parent receives email → operator refunds one line → Stripe refund visible

The super-admin portal (§2.2) is required for onboarding tenant #3 and beyond, but the launch tenant (NSBH) can ship without it provided RGSH stays on seed data.
