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

### 1.1 Stripe Connect payments do not actually route to the school ✅

**Where:** [apps/web/src/app/api/stripe/payment-intent/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/stripe/payment-intent/route.ts)

**Status: DONE.** The `PaymentIntent` now uses destination charges with `transfer_data.destination`, `on_behalf_of`, and optional `application_fee_amount` based on `STRIPE_APPLICATION_FEE_BPS`. The route also gates on `tenant.stripeChargesEnabled === true`.

### 1.2 Admin portal has no authentication guard ✅

**Where:** [apps/web/src/app/admin/[tenant]/layout.tsx](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/admin/%5Btenant%5D/layout.tsx)

**Status: DONE.** The admin layout now enforces `getSessionUser()`, redirects unauthenticated users to `/auth/sign-in`, and checks `isPlatformAdminEmail()` / `isTenantOperatorEmail()` before rendering. API routes (`GET/PATCH /api/orders`, etc.) apply the same `requireSessionUser` + `ensureTenantAccess` / `ensureParentEmailAccess` guards, plus per-endpoint rate limiting.

### 1.3 Customer order data API is unauthenticated ✅

**Where:** [apps/web/src/app/api/orders/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/orders/route.ts), [apps/web/src/app/api/orders/[orderId]/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/orders/%5BorderId%5D/route.ts)

**Status: DONE.** Both endpoints now require `requireSessionUser()`. `GET /api/orders` enforces `ensureParentEmailAccess` (parents can only read their own email) or `ensureTenantAccess` (operators see their tenant). Per-endpoint rate limits are applied (`orders:parent:*`, `orders:tenant:*`, `order-detail:*`).

### 1.4 Transactional email — order confirmation and "ready for pickup" ✅

**Where:** [apps/web/src/lib/email/index.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/lib/email/index.ts)

**Status: DONE (code).** React Email + Resend is wired in. `sendOrderConfirmationEmail()` is called on `POST /api/orders` success and `sendOrderReadyEmail()` is called automatically when `PATCH /api/orders/[id]` transitions status to `ready`. Both use `@react-email/render` with branded HTML + plain-text templates, and idempotency is enforced via JSONB stamps on `orders.emails_sent`.

**End-to-end verification still owed:**
1. `stripe listen --forward-to localhost:3000/api/stripe/webhook` and trigger a real `payment_intent.succeeded` for an order created via the checkout flow. Confirm the row flips `pending_payment → new` and the confirmation email arrives.
2. `stripe events resend <evt_id>` — confirm no second email (atomic UPDATE no-op, `console.info` ignored line).
3. PATCH `/api/orders/{id}` with `{status: "ready"}` twice in quick succession — confirm one ready email, one no-op.
4. Render both `OrderConfirmation` and `OrderReady` in Gmail (web + iOS) and Outlook web; verify no clipped layout, working refund-policy link, accent colour intact.
5. Block Emailit (e.g. invalid API key) and confirm: PATCH/webhook still succeeds, error logged with `orderId`, `emails_sent.{confirmation|ready}` not stamped (so manual retry path works).
6. Stamp the verification chore commit referenced in the plan.

### 1.5 Refund / exchange policy not enforced or shown ✅

**Where:** Checkout footer mentions "agree to refund policy"; no `/refund-policy` route exists. PDP §4 explicitly says: "the platform will enforce refund/exchange policies directly at checkout (e.g., items must be in original packaging with tags; shirts cannot be refunded if opened)."

**Status: DONE.**
- Static content page at `/[tenant]/refund-policy` exists.
- Checkout tickbox (`acceptedPolicy` state) blocks the Pay button until checked; links to refund policy, Terms, and Privacy pages.
- Consent is persisted on the order record via the order API. Operator-facing refund/exchange action remains tracked in §2.1.

### 1.6 No legal pages — Terms, Privacy ✅

For a payment site collecting student PII, AU consumer law and the Privacy Act 1988 require accessible Privacy Policy and Terms of Service before launch.

**Status: DONE.** Static `/terms` and `/privacy` pages exist, linked from the checkout consent step and footer.

### 1.7 No platform-approval gate on connected tenants (Stripe Connect compliance) ✅

**Where:** [apps/web/src/app/api/stripe/payment-intent/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/stripe/payment-intent/route.ts), `tenants` schema in [src/db/schema.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/db/schema.ts)

**Status: DONE.** Schema includes `platformApprovalStatus` (pending / approved / rejected), `platformApprovedAt`, `platformApprovedBy`, `platformRejectionReason`. The `POST /api/stripe/payment-intent` route checks `tenant.platformApprovalStatus === "approved"` before creating the PaymentIntent and returns a 403 with a clear message if not. Super-admin approval queue remains tracked in §2.2.

#### 1.7.1 Original requirement — Platform Approval Gate for Connected Tenants

> **Severity:** 🔴 Blocker (compliance — Stripe Connect Platform Agreement)
> **Date:** 6 May 2026
> **Related:** [FEATURE_AUDIT.md](./FEATURE_AUDIT.md), Stripe Connect "Platform"-liability acknowledgement

**Background.** When provisioning the platform's Stripe Connect account, we accepted **Platform** liability for refunds, chargebacks, and seller compliance. Stripe's Connect Platform Agreement explicitly requires that we:

> "review each seller to ensure they're not operating in a restricted business category or selling restricted products."

Today, the moment a uniform shop completes Stripe Express onboarding, the `tenants.stripe_charges_enabled` flag flips to `true` (via the `account.updated` webhook, when implemented in §2.3) and the tenant becomes immediately able to take live payments through `POST /api/stripe/payment-intent`. This means an un-vetted shop could take real parent money before any human at the platform has confirmed:

- The shop is a legitimate uniform retailer (and not selling something else under that account).
- The shop is not on Stripe's [restricted businesses](https://stripe.com/legal/restricted-businesses) list.
- The school has actually nominated this shop as their supplier.

Without an explicit human-approval step we are in breach of the Stripe Connect Platform Agreement and exposed to chargeback / fines liability we have already accepted.

**Goal.** Introduce a **platform approval gate** — a separate, human-driven approval state on each tenant — that must be `approved` before any `PaymentIntent` can be created for that tenant, regardless of what Stripe reports about the connected account's readiness. Stripe-readiness (`stripe_charges_enabled`) and platform-approval are **independent prerequisites**; both must be `true` for live payments.

**Functional requirements.**

*Schema — `tenants` table additions* in [src/db/schema.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/db/schema.ts):

| Column | Type | Default | Notes |
|---|---|---|---|
| `platform_approval_status` | `text` (`"pending" \| "approved" \| "rejected"`) | `"pending"` | Authoritative gate |
| `platform_approved_at` | `timestamp` | `NULL` | Set when status flips to `approved` |
| `platform_approved_by` | `text` | `NULL` | Email of the super-admin who approved |
| `platform_rejection_reason` | `text` | `NULL` | Required when status is `rejected`; surfaced to the shop |

A Drizzle migration must be added (this also covers item §4.8 — migrations checked into the repo).

*Payment intent gate.* In [api/stripe/payment-intent/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/stripe/payment-intent/route.ts), reject creation when `tenant.platform_approval_status !== "approved"`:

```ts
if (tenant.platformApprovalStatus !== "approved") {
  return NextResponse.json(
    { error: "Tenant not yet approved by platform" },
    { status: 409 }
  );
}
```

This check sits **alongside** the existing `stripeChargesEnabled` check, not in place of it.

*Super-admin approval surface.* A new super-admin section is required (separate from the per-school admin at `/admin/[tenant]`).

- **Route:** `app/super-admin/tenants/page.tsx` (or `/platform/tenants` if super-admin work in §2.2 lands first).
- **Access control:** restricted to a hard-coded platform-admin email allowlist (`PLATFORM_ADMIN_EMAILS` env var) until full RBAC lands.

Tenant review queue must show, per pending tenant:

- School / tenant name and slug.
- Shop legal name (pulled from Stripe `account.business_profile.name`).
- Shop email and primary contact.
- MCC, country, and business type (from Stripe `account`).
- Deep link to the connected account in the Stripe Dashboard.
- Current Stripe readiness flags (`charges_enabled`, `payouts_enabled`, `details_submitted`).
- Free-text notes field (operator-only).

Actions:

- **Approve** → `PATCH /api/super-admin/tenants/[tenantId]/approval` with `{ status: "approved" }`. Writes `platform_approved_at = now()`, `platform_approved_by = currentUser.email`, clears `platform_rejection_reason`.
- **Reject** → same route with `{ status: "rejected", reason: "..." }`. Reason is mandatory and ≤ 500 chars.
- **Re-open / mark pending** → reverts to `pending` (e.g. when re-reviewing after the shop fixed an issue).

All transitions are logged (operator email + timestamp + previous status) — a lightweight `tenant_approval_audit` table is acceptable, or rely on a structured log line if a full audit-log table is deferred.

*Shop-facing status banner.* In the per-tenant admin (settings page, and a persistent banner across `/admin/[tenant]/*` until resolved), surface the current platform approval state to the shop:

- `pending` → *"Pending platform review — your store cannot accept live payments yet. We'll email you once approved."*
- `approved` → no banner needed (or a subtle ✓ badge in settings).
- `rejected` → *"Your account was not approved: {reason}. Contact support to resolve."*

This prevents shops from being confused by the situation where Stripe says "ready" but the platform still blocks payments.

*Webhook interaction.* When the `account.updated` Stripe webhook handler is implemented (§2.3):

- It updates `stripe_charges_enabled` / `stripe_payouts_enabled` only.
- It must **not** auto-approve the platform gate.
- If a tenant is currently `approved` and Stripe later reports the account is no longer in good standing (e.g. `requirements.disabled_reason` becomes set), revert `platform_approval_status` to `pending` and notify the platform admin.

**Non-functional requirements.**

- **Backwards compatibility:** existing seeded tenants (NSBH, RGSH) should be back-filled as `approved` in the migration so live-data flows in dev are not broken. Production deploy must run the migration before live cutover.
- **Auditability:** every status transition must be attributable to a real user; system-driven reverts should be logged as `system`.
- **Idempotency:** approving an already-approved tenant is a no-op (200 OK), not a 409.
- **Rate limit / authn:** super-admin route is gated by session + allowlist; rate-limit consistent with the rest of the admin API.

**Out of scope.**

- Full RBAC for multiple platform-admin users with granular permissions (single allowlist suffices for v1).
- Automated risk scoring or document review (manual review only).
- Periodic re-review cadence (will be revisited once we onboard >5 schools).

**Acceptance criteria.**

1. A newly-onboarded tenant with `stripe_charges_enabled = true` is **rejected** by `POST /api/stripe/payment-intent` with HTTP 409 until a platform admin approves it.
2. Once approved, the same tenant successfully creates a `PaymentIntent` end-to-end.
3. The shop sees a clear status banner in their admin reflecting all three states.
4. Rejection writes a reason and the shop sees it.
5. The migration backfills existing tenants as `approved` and a fresh dev `db push` produces a working stack.
6. Super-admin route is unreachable to non-allowlisted users (returns 403).
7. Approval / rejection events are persisted with operator identity and timestamp.

**Effort estimate.** ~½ engineering day:

- Schema + migration: 30 min
- API gate + super-admin route: 1 hr
- Super-admin UI (list + approve/reject): 2 hr
- Shop-facing banner + settings surface: 1 hr
- Tests + manual end-to-end check: 1 hr

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

### 2.3 Stripe webhook handler — partially done

**Status: PARTIAL.** `POST /api/stripe/webhook` exists with signature verification and idempotent handling for `payment_intent.succeeded` (atomically transitions `pending_payment → new` and sends confirmation email). `account.updated` and `charge.refunded` are not yet handled — the latter two remain required for reliable Connect onboarding sync and out-of-band refund reconciliation.

### 2.4 Order placement is not idempotent / not atomic with payment ✅

**Where:** [apps/web/src/app/[tenant]/checkout/checkout-screen.tsx](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/%5Btenant%5D/checkout/checkout-screen.tsx)

**Status: DONE.** The DB schema has a unique index on `orders.stripePaymentIntentId`. `POST /api/orders` uses the PaymentIntent ID as an idempotency key; a duplicate request returns the existing order with a 200 (no-op). The webhook handler atomically transitions `pending_payment → new` and stamps `emailsSent` so retries are idempotent.

### 2.5 Cart is `localStorage`-only and seeded with `SAMPLE_CART` ✅

**Where:** [apps/web/src/lib/cart-store.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/lib/cart-store.ts)

**Status: DONE.** Cart initializes empty; `SAMPLE_CART` remains as a fixture only (not seeded at runtime).

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

1. [x] Stripe Connect destination charges in `payment-intent` route (§1.1)
2. [x] Admin auth + per-tenant authorization (§1.2)
   - **Note:** Current tenant authorization still supports one operator email per tenant (`tenants.shop_email`). Multi-operator RBAC remains pending.
3. [x] Parent orders API gated by auth or token (§1.3)
4. [x] Transactional email — order placed + order ready (§1.4 — code complete; end-to-end verification still owed)
5. [x] Refund policy page + checkout consent (§1.5)
6. [x] Terms + Privacy pages (§1.6)
7. [x] Platform approval gate on connected tenants (§1.7)
8. [ ] Refund/exchange action on order detail (§2.1)
9. [~] Stripe webhook endpoint (§2.3 — `payment_intent.succeeded` done; `account.updated` + `charge.refunded` pending)
10. [x] Idempotent order creation tied to PaymentIntent (§2.4)
11. [x] Empty initial cart, no demo seed (§2.5)
12. [ ] Production env, live Stripe keys, security headers (§2.6)
13. [~] PostHog (error tracking + logs) + error/not-found pages (§2.7 — branded error/not-found done; PostHog wiring pending)
14. [ ] Catalog seeded with full NSBH paper-form items (§3.1)
15. [ ] Accountant sign-off on GST report (§3.6)
16. [ ] Manual end-to-end test: parent orders → Stripe charge → operator marks ready → parent receives email → operator refunds one line → Stripe refund visible

The super-admin portal (§2.2) is required for onboarding tenant #3 and beyond, but the launch tenant (NSBH) can ship without it provided RGSH stays on seed data.
