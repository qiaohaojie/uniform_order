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

## 1. 🔴 Blockers — must fix before any real money moves

### 1.1 Stripe Connect payments do not actually route to the school

**Where:** [apps/web/src/app/api/stripe/payment-intent/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/stripe/payment-intent/route.ts)

The PDP names **Stripe Connect** as the payment provider so that "payments route directly to the respective school's bank account." The current `PaymentIntent` is created on the **platform account only** — there is no `transfer_data.destination`, no `on_behalf_of`, and no `application_fee_amount`. Even though `tenants.stripe_account_id` is fetched, it is never passed to Stripe.

**Required:**
- Add `transfer_data: { destination: tenant.stripeAccountId }` (or use destination charges / direct charges, decide model).
- Optional `application_fee_amount` for platform revenue share.
- Refuse to create the intent if `tenant.stripeChargesEnabled !== true`.
- Document the Connect model chosen (destination vs direct vs separate charges & transfers).

### 1.2 Admin portal has no authentication guard

**Where:** [apps/web/src/app/admin/[tenant]/layout.tsx](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/admin/%5Btenant%5D/layout.tsx), [apps/web/src/components/admin-shell.tsx](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/components/admin-shell.tsx)

Anyone who knows the URL `/admin/nsbh/orders` can read every order, mutate status, edit catalog, change settings, and trigger Stripe Connect onboarding. Neon Auth is installed but not enforced anywhere on `/admin/*` or on the corresponding API routes.

**Required:**
- Add a server-side session check in the admin layout; redirect unauthenticated users to a sign-in page.
- Add an authorization check linking `userId` → `tenantId` (operators must only see their school).
- Apply the same check to every mutating API route (`POST/PATCH/DELETE /api/orders`, `/api/catalog`, `/api/tenant`, `/api/stripe/connect`).

### 1.3 Customer order data API is unauthenticated

**Where:** [apps/web/src/app/api/orders/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/orders/route.ts), [apps/web/src/app/api/orders/[orderId]/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/orders/%5BorderId%5D/route.ts)

`GET /api/orders?email=...` returns full PII (parent name, mobile, student name and class) for any email passed in. This is an enumeration vector and a privacy breach under the Australian Privacy Principles.

**Required:**
- Either gate behind a parent sign-in (Neon Auth) and filter by `userId`, or send a verification token to the parent email and require it on read.
- Apply rate limiting on `GET /api/orders` and `/api/orders/[id]`.

### 1.4 No transactional email — order confirmation and "ready for pickup"

**Where:** No mail provider (Resend / SendGrid / Postmark / SES) is in `package.json`; only `mailto:` links exist.

PDP §3.1 requires "automated email notifications when orders are placed and when they are ready for pick-up." The "Notify parent" button on Ready cards merely opens the operator's mail client.

**Required:**
- Pick a provider (Resend recommended for Next.js + AU compliance).
- Send order confirmation on `POST /api/orders` success.
- Send "ready for pickup" automatically when status transitions to `ready` in `PATCH /api/orders/[id]`.
- Send "your order has been collected" optional acknowledgement.
- Templates with tenant branding (accent colour, school name).

### 1.5 Refund / exchange policy not enforced or shown

**Where:** Checkout footer mentions "agree to refund policy"; no `/refund-policy` route exists. PDP §4 explicitly says: "the platform will enforce refund/exchange policies directly at checkout (e.g., items must be in original packaging with tags; shirts cannot be refunded if opened)."

**Required:**
- Static content page at `/[tenant]/refund-policy` (or `/policies/refunds`) — copy reviewed by school.
- Tickbox at checkout that blocks payment until accepted; persist consent on the order.
- Operator-facing refund/exchange action on order detail (see §2.1).

### 1.6 No legal pages — Terms, Privacy

For a payment site collecting student PII, AU consumer law and the Privacy Act 1988 require accessible Privacy Policy and Terms of Service before launch.

**Required:** `/terms`, `/privacy` static pages, linked in the footer of both portals.

### 1.7 No platform-approval gate on connected tenants (Stripe Connect compliance)

**Where:** [apps/web/src/app/api/stripe/payment-intent/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/stripe/payment-intent/route.ts), `tenants` schema in [src/db/schema.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/db/schema.ts)

We accepted **Platform** liability when configuring Stripe Connect, which contractually obliges us to "review each seller to ensure they're not operating in a restricted business category or selling restricted products." Today, the moment Stripe reports `charges_enabled = true` for a connected account, the tenant can immediately take live payments — no human at the platform has confirmed the shop is legitimate, the school nominated them, or that they're not on Stripe's restricted-businesses list. This is a Stripe Connect Platform Agreement breach and a chargeback/fines exposure.

**Required:** Add a separate `platform_approval_status` field on tenants (`pending` / `approved` / `rejected`); gate `POST /api/stripe/payment-intent` on `approved`; add a super-admin approval queue; surface status to the shop. Full requirements doc: [platform_approval_gate.md](./platform_approval_gate.md).

---

## 2. 🟠 High — required for an acceptable v1

### 2.1 Refund / exchange UI on order detail (admin)

**Where:** [apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/admin/%5Btenant%5D/orders/%5BorderId%5D/page.tsx)

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

### 2.3 Stripe webhook handler

No webhook endpoint exists. Without it the system cannot reliably reconcile:
- `payment_intent.succeeded` / `.payment_failed` (currently relies on client-side confirmation only — a closed browser between confirm and `POST /api/orders` produces a paid Stripe charge with no order in the DB).
- `account.updated` (Stripe Connect onboarding completion — `stripePayoutsEnabled` / `stripeChargesEnabled` go stale).
- `charge.refunded` (out-of-band refunds done in Stripe Dashboard).

**Required:** `POST /api/stripe/webhook` with signature verification and idempotent handling for those three events.

### 2.4 Order placement is not idempotent / not atomic with payment

**Where:** [apps/web/src/app/[tenant]/checkout/checkout-screen.tsx](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/%5Btenant%5D/checkout/checkout-screen.tsx)

Confirm-then-create-order means a transient network failure between Stripe confirm and `POST /api/orders` charges the parent without creating an order. Refunds would have to be done manually.

**Required:**
- Create the DB order in `pending` status before payment, then transition on webhook.
- Or use a one-shot idempotency key on `POST /api/orders` derived from the PaymentIntent ID.

### 2.5 Cart is `localStorage`-only and seeded with `SAMPLE_CART`

**Where:** [apps/web/src/lib/cart-store.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/lib/cart-store.ts)

A first-time visitor sees pre-populated demo items in their cart. Acceptable for a prototype, unacceptable for production.

**Required:** Empty initial cart; remove `SAMPLE_CART` seeding (keep as fixture only in dev/storybook).

### 2.6 Production environment configuration

- Switch from Stripe **test** keys to **live** keys (today `.env.local` is test mode per audit).
- Production database URL pinned to a non-shared Neon branch.
- `NEXT_PUBLIC_*` keys reviewed (no secret leaks).
- Vercel project (or chosen host) with environment groups for `preview` / `production`.
- Domain + TLS (`uniformsonline.com.au` or per-tenant subdomains).
- Add `vercel.json` headers (`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, basic CSP).

### 2.7 Error handling, logging, observability

- No error boundary / global `error.tsx` / `not-found.tsx` styled to brand.
- No structured logging or monitoring — PostHog (error tracking + logs + product analytics) is not yet wired in.
- API routes only `console.error` — failures are silent in production.

**Required:** `error.tsx`, `not-found.tsx`, PostHog SDK wired to both client (`posthog-js`) and server (`posthog-node`) with error tracking and log capture enabled, request-id correlation in logs.

---

## 3. 🟡 Medium — required by PDP/prototype, tolerable for soft launch

### 3.1 Missing catalog items from the paper form

**Where:** [apps/web/src/db/queries.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/db/queries.ts) seed data; audit §4.

NSBH paper form items missing from the seed: Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie. PDP §4 lists these explicitly.

**Required:** Update seed + run a one-off insert against production for both NSBH and RGSH (RGSH catalog needs review with the school).

### 3.2 Refund-policy *page* (the actual content)

Already counted in §1.5 as a blocker for the consent step. Listed again here because the content itself (copy, signed off by each school's bursar) is a content task, not a code task.

### 3.3 "Add another child" flow on school picker

**Where:** [apps/web/src/app/page.tsx](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/page.tsx)

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
| 4.1 | "Riley wore size X last year" hint driven from live order history | Audit item 17 |
| 4.2 | "New product" and "Export" buttons on Dashboard wired up | Audit §2 / Dashboard |
| 4.3 | Bulk operator "Email parents" with real send (currently `mailto:`) | Orders board |
| 4.4 | i18n scaffolding for future non-NSW expansion (PDP §7 Phase 3) | PDP roadmap |
| 4.5 | Inventory stock counts (the schema has none — quantities are unbounded) | PDP §3.2 hints at "Update stock levels" |
| 4.6 | Operator audit log (who marked the order ready, who refunded) | Inferred from refund work |
| 4.7 | Catalog sortable / drag-to-reorder | Prototype only |
| 4.8 | Drizzle migrations checked into the repo (currently schema is push-only) | Ops |

---

## 5. Suggested go-live checklist (one page)

1. [x] Stripe Connect destination charges in `payment-intent` route (§1.1)
2. [x] Admin auth + per-tenant authorization (§1.2)
   - **Note:** Current tenant authorization still supports one operator email per tenant (`tenants.shop_email`). Multi-operator RBAC remains pending.
3. [x] Parent orders API gated by auth or token (§1.3)
4. [ ] Transactional email — order placed + order ready (§1.4)
5. [x] Refund policy page + checkout consent (§1.5)
6. [x] Terms + Privacy pages (§1.6)
7. [ ] Platform approval gate on connected tenants (§1.7 — see [platform_approval_gate.md](./platform_approval_gate.md))
8. [ ] Refund/exchange action on order detail (§2.1)
9. [ ] Stripe webhook endpoint (§2.3)
10. [ ] Idempotent order creation tied to PaymentIntent (§2.4)
11. [x] Empty initial cart, no demo seed (§2.5)
12. [ ] Production env, live Stripe keys, security headers (§2.6)
13. [ ] PostHog (error tracking + logs) + error/not-found pages (§2.7)
14. [ ] Catalog seeded with full NSBH paper-form items (§3.1)
15. [ ] Accountant sign-off on GST report (§3.6)
16. [ ] Manual end-to-end test: parent orders → Stripe charge → operator marks ready → parent receives email → operator refunds one line → Stripe refund visible

The super-admin portal (§2.2) is required for onboarding tenant #3 and beyond, but the launch tenant (NSBH) can ship without it provided RGSH stays on seed data.
