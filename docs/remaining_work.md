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

### 2.1 Refund / exchange UI on order detail (admin) ✅

**Status: DONE (PR #4 — feat/posthog-and-hostinger-deploy).**
- Refund button + partial-amount dialog on admin order detail.
- `POST /api/orders/[orderId]/refund` — Stripe `refunds.create` with idempotency key, partial and full refund supported.
- `order_refunds` table (migration `0003_futuristic_snowbird`) records each refund with operator user ID, stripe refund ID, amount, reason.
- `order_status` enum extended: `partially_refunded`, `refunded`. Status chip updates accordingly.
- `charge.refunded` webhook handler records out-of-band refunds from Stripe Dashboard.

**Post-merge test item — Test 3 (refund E2E) blocked pending Stripe Connect:**
The smoke-test refund flow (place order → partial refund → full refund → 409 on third attempt → idempotency replay) could not be completed because NSBH has no onboarded Stripe Express account (`stripe_account_id` is null in dev DB). To run Test 3:
1. Complete Stripe Express onboarding for the NSBH test account (Stripe Dashboard → Connect → Accounts).
2. Update `tenants.stripe_account_id` and verify `stripe_charges_enabled = true` is synced via the `account.updated` webhook.
3. Re-run Test 3 from the smoke-test plan.

### 2.2 Super-admin / platform portal — none of 4 screens exist

**Where:** No `/platform` or `/superadmin` routes. Prototype lives at `my_doc/UI_prototypes/project/superadmin.jsx`.

Without this, onboarding a second school requires running a SQL seed script. For multi-tenant go-live this is a blocker for tenant #2 (RGSH already exists from seed but cannot be edited via UI).

**Required:**
- `/platform` (or `/superadmin`) section gated to platform-admin role.
- Tenants list with KPIs and status badges.
- "Provision new tenant" 6-step wizard (identity, branding, billing/Stripe, operator, catalog import, go-live).
- Platform-level Stripe payouts overview.
- Branding editor (logo upload, accent colour picker, live parent preview).

### 2.3 Stripe webhook handler ✅

**Status: DONE.** `POST /api/stripe/webhook` has signature verification and idempotent handling for:
- `payment_intent.succeeded` — atomically transitions `pending_payment → new`, sends confirmation email
- `account.updated` — syncs Stripe Connect account status to `tenants` (payouts/charges enabled)
- `charge.refunded` — records out-of-band refunds from Stripe Dashboard, updates `orderRefunds` table, recalculates total refunded, transitions order to `partially_refunded` or `refunded`

### 2.6 Production environment configuration ✅

**Status: DONE (code).** `apps/web/next.config.ts` (`headers()` block) emits production security headers:
- `Strict-Transport-Security` (max-age 63072000, includeSubDomains, preload)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` allowing Stripe, PostHog, and Resend domains

**Remaining (ops):** Switch from Stripe test keys to live keys, pin production DB URL, configure Hostinger Node.js app env vars (preview vs production), and assign production domain + TLS before deploy.

### 2.7 Error handling, logging, observability ✅

**Status: DONE (code).**
- `posthog-js` + `posthog-node` installed.
- Client: `lib/analytics/client.ts` + `<PostHogProvider>` in root layout — captures `$pageview`, `identifyUser`, `resetUser`.
- Server: `lib/analytics/server.ts` — lazy `PostHog` client with `serverCaptureException`.
- `error.tsx` forwards unhandled errors to PostHog alongside `console.error`.
- API routes (`/api/orders`, `/api/orders/[orderId]`, `/api/orders/[orderId]/refund`, `/api/stripe/webhook`) all send exceptions to PostHog.

**Remaining:** Verify PostHog project key is set in production Hostinger env vars.

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

1. [x] Refund/exchange action on order detail (§2.1 — done in PR #4; E2E test pending Stripe Connect setup, see §2.1 note)
2. [x] Stripe webhook endpoint (§2.3 — `payment_intent.succeeded`, `account.updated`, `charge.refunded` all wired)
3. [x] Production env config — `next.config.ts` security headers, CSP, HSTS (§2.6 — code done; ops: live Stripe keys + domain + TLS still needed)
4. [x] PostHog (error tracking + logs) + error/not-found pages (§2.7 — client + server SDK wired, API routes instrumented, branded pages already done)
5. [ ] Catalog seeded with full NSBH paper-form items (§3.1)
6. [ ] Accountant sign-off on GST report (§3.6)
7. [ ] Manual end-to-end test: parent orders → Stripe charge → operator marks ready → parent receives email → operator refunds one line → Stripe refund visible

The super-admin portal (§2.2) is required for onboarding tenant #3 and beyond, but the launch tenant (NSBH) can ship without it provided RGSH stays on seed data.
