# Completed Work — Pre-Go-Live

**Project:** Uniform Online Order System
**Date:** 6 May 2026

---

## ✅ Completed go-live checklist items

1. ✅ Stripe Connect destination charges in `payment-intent` route (§1.1)
2. ✅ Admin auth + per-tenant authorization (§1.2)
   - **Note:** Current tenant authorization still supports one operator email per tenant (`tenants.shop_email`). Multi-operator RBAC remains pending.
3. ✅ Parent orders API gated by auth or token (§1.3)
4. ✅ Transactional email — order placed + order ready (§1.4 — code complete; end-to-end verification still owed)
5. ✅ Refund policy page + checkout consent (§1.5)
6. ✅ Terms + Privacy pages (§1.6)
7. ✅ Platform approval gate on connected tenants (§1.7)
8. ✅ Idempotent order creation tied to PaymentIntent (§2.4)
9. ✅ Empty initial cart, no demo seed (§2.5)

---

## 1. 🔴 Blockers (resolved)

### 1.1 Stripe Connect payments do not actually route to the school ✅

**Where:** `apps/web/src/app/api/stripe/payment-intent/route.ts`

**Status: DONE.** The `PaymentIntent` now uses destination charges with `transfer_data.destination`, `on_behalf_of`, and optional `application_fee_amount` based on `STRIPE_APPLICATION_FEE_BPS`. The route also gates on `tenant.stripeChargesEnabled === true`.

### 1.2 Admin portal has no authentication guard ✅

**Where:** `apps/web/src/app/admin/[tenant]/layout.tsx`

**Status: DONE.** The admin layout now enforces `getSessionUser()`, redirects unauthenticated users to `/auth/sign-in`, and checks `isPlatformAdminEmail()` / `isTenantOperatorEmail()` before rendering. API routes (`GET/PATCH /api/orders`, etc.) apply the same `requireSessionUser` + `ensureTenantAccess` / `ensureParentEmailAccess` guards, plus per-endpoint rate limiting.

### 1.3 Customer order data API is unauthenticated ✅

**Where:** `apps/web/src/app/api/orders/route.ts`, `apps/web/src/app/api/orders/[orderId]/route.ts`

**Status: DONE.** Both endpoints now require `requireSessionUser()`. `GET /api/orders` enforces `ensureParentEmailAccess` (parents can only read their own email) or `ensureTenantAccess` (operators see their tenant). Per-endpoint rate limits are applied (`orders:parent:*`, `orders:tenant:*`, `order-detail:*`).

### 1.4 Transactional email — order confirmation and "ready for pickup" ✅

**Where:** `apps/web/src/lib/email/index.ts`

**Status: DONE (code).** React Email + Resend is wired in. `sendOrderConfirmationEmail()` is called on `POST /api/orders` success and `sendOrderReadyEmail()` is called automatically when `PATCH /api/orders/[id]` transitions status to `ready`. Both use `@react-email/render` with branded HTML + plain-text templates, and idempotency is enforced via JSONB stamps on `orders.emails_sent`.

**End-to-end verification still owed:**
1. `stripe listen --forward-to localhost:3000/api/stripe/webhook` and trigger a real `payment_intent.succeeded` for an order created via the checkout flow. Confirm the row flips `pending_payment → new` and the confirmation email arrives.
2. `stripe events resend <evt_id>` — confirm no second email (atomic UPDATE no-op, `console.info` ignored line).
3. PATCH `/api/orders/{id}` with `{status: "ready"}` twice in quick succession — confirm one ready email, one no-op.
4. Render both `OrderConfirmation` and `OrderReady` in Gmail (web + iOS) and Outlook web; verify no clipped layout, working refund-policy link, accent colour intact.
5. Block Resend (e.g. invalid API key) and confirm: PATCH/webhook still succeeds, error logged with `orderId`, `emails_sent.{confirmation|ready}` not stamped (so manual retry path works).
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

**Where:** `apps/web/src/app/api/stripe/payment-intent/route.ts`, `tenants` schema in `src/db/schema.ts`

**Status: DONE.** Schema includes `platformApprovalStatus` (pending / approved / rejected), `platformApprovedAt`, `platformApprovedBy`, `platformRejectionReason`. The `POST /api/stripe/payment-intent` route checks `tenant.platformApprovalStatus === "approved"` before creating the PaymentIntent and returns a 403 with a clear message if not. Super-admin approval queue remains tracked in §2.2.

**Note:** The migration adds the columns but does not backfill existing seeded tenants. In dev, manually run `UPDATE tenants SET platform_approval_status = 'approved' WHERE id IN ('nsbh', 'rgsh');` after migration, or add the backfill to the migration script before production deploy.

---

## 2. 🟠 High (resolved)

### 2.3 Stripe webhook handler ✅

**Where:** `apps/web/src/app/api/stripe/webhook/route.ts`

**Status: DONE.** Signature verification with raw-body parsing. Idempotent handling for:
- `payment_intent.succeeded` — atomically flips `pending_payment → new`, sends confirmation email, stamps `emails_sent`.
- `account.updated` — syncs `stripePayoutsEnabled` / `stripeChargesEnabled` to `tenants`.
- `charge.refunded` — records out-of-band refunds, inserts `orderRefunds` row, recalculates total refunded, updates order status to `partially_refunded` or `refunded`.

### 2.4 Order placement is not idempotent / not atomic with payment ✅

**Where:** `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`

**Status: DONE.** The DB schema has a unique index on `orders.stripePaymentIntentId`. `POST /api/orders` uses the PaymentIntent ID as an idempotency key; a duplicate request returns the existing order with a 200 (no-op). The webhook handler atomically transitions `pending_payment → new` and stamps `emailsSent` so retries are idempotent.

### 2.5 Cart is `localStorage`-only and seeded with `SAMPLE_CART` ✅

**Where:** `apps/web/src/lib/cart-store.ts`

**Status: DONE.** Cart initializes empty; `SAMPLE_CART` remains as a fixture only (not seeded at runtime).

### 2.6 Production environment configuration ✅

**Where:** `apps/web/vercel.json`

**Status: DONE (code).** Production security headers configured:
- `Strict-Transport-Security` (max-age 63072000, includeSubDomains, preload)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` allowing Stripe, PostHog, and Resend domains

**Remaining (ops):** Switch to live Stripe keys, pin production DB URL, configure Vercel environment groups, assign production domain + TLS.

### 2.7 Error handling, logging, observability ✅

**Status: DONE (code).**
- `posthog-js` + `posthog-node` installed.
- Client analytics: `lib/analytics/client.ts` + `<PostHogProvider>` wired into root layout — captures `$pageview`, `identifyUser`, `resetUser`.
- Server analytics: `lib/analytics/server.ts` — lazy `PostHog` client, `serverCaptureException`.
- `error.tsx` forwards unhandled errors to PostHog alongside `console.error`.
- API routes (`/api/orders`, `/api/orders/[orderId]`, `/api/orders/[orderId]/refund`, `/api/stripe/webhook`) send exceptions to PostHog with contextual metadata (step, orderId, etc.).

**Remaining:** Verify PostHog project key in production Vercel env vars.
