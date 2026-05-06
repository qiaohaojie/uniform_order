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

**Where:** `apps/web/next.config.ts`

**Status: DONE (code).** Production security headers configured:
- `Strict-Transport-Security` (max-age 63072000, includeSubDomains, preload)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` allowing Stripe, PostHog, and Resend domains

**Remaining (ops):** Switch to live Stripe keys, pin production DB URL, configure Hostinger env groups, assign production domain + TLS.

### 2.7 Error handling, logging, observability ✅

**Status: DONE (code).**
- `posthog-js` + `posthog-node` installed.
- Client analytics: `lib/analytics/client.ts` + `<PostHogProvider>` wired into root layout — captures `$pageview`, `identifyUser`, `resetUser`.
- Server analytics: `lib/analytics/server.ts` — lazy `PostHog` client, `serverCaptureException`.
- `error.tsx` forwards unhandled errors to PostHog alongside `console.error`.
- API routes (`/api/orders`, `/api/orders/[orderId]`, `/api/orders/[orderId]/refund`, `/api/stripe/webhook`) send exceptions to PostHog with contextual metadata (step, orderId, etc.).

**Remaining:** Verify PostHog project key in production Hostinger env vars.

---

## 3. Feature Audit — completed items (merged from FEATURE_AUDIT.md)

The following 11 high- and medium-priority items from the original feature audit are complete. Source: `docs/FEATURE_AUDIT.md` changelog entries 1 May 2026 and 2 May 2026, plus the live-data completion entry on 2 May 2026.

### 3.1 High-priority items (1–5) — completed 1 May 2026

1. ✅ **Add product modal** — full form (name, category, description, up to 5 variants); `POST /api/catalog` persists to Neon; catalog table refreshes on success.
2. ✅ **Orders search wiring** — live search filters Kanban columns by order ID, parent name, or student name.
3. ✅ **Orders history connected to live DB** — parent orders page fetches from Neon via `GET /api/orders?email=...`; newly placed orders appear immediately.
4. ✅ **Order detail reads from live DB** — `GET /api/orders/[orderId]` fetches from Neon; newly placed orders are visible immediately.
5. ✅ **Stripe Connect onboarding** — `GET /api/stripe/connect` returns connection status; "Connect bank account" creates a real Stripe Account Link and redirects to Stripe-hosted onboarding; returns to settings with success/refresh banner; "Manage in Stripe →" links to the Stripe dashboard once connected.

### 3.2 Medium-priority items (6–11) — completed 2 May 2026

6. ✅ **Bulk upload CSV button navigates to upload page** — `<Link href="/admin/[tenant]/upload">` from Catalog.
7. ✅ **Print pick slips** — `window.print()` with print CSS that hides sidebar/topbar and shows only pick-slip content; available on the Orders Board and on Order Detail (`PrintButton` client component).
8. ✅ **Save changes on Settings** — `SettingsClient` calls `PATCH /api/tenant/[tenantId]`; "Saving…" spinner and "✓ Saved" confirmation.
9. ✅ **Export CSV on Reports** — `ExportCsvButton` generates a CSV blob client-side from the GST summary rows and triggers a file download (e.g. `nsbh-gst-report.csv`); no API round-trip.
10. ✅ **Download template on Bulk Upload** — `href="/catalog-template.csv"` with `download` attribute; real 10-row CSV served from `/public`.
11. ✅ **Status advance buttons on Order Detail** — `OrderDetailActions` client component: "Start packing" → "Mark ready" → "Mark collected"; `PATCH /api/orders/[orderId]`; `router.refresh()` updates badge/button label; "Notify parent" `mailto:` shown when status is `ready`; buttons hidden at `collected` (terminal state). Live end-to-end tested.

### 3.3 Checkout & admin live-data completion — 2 May 2026

- ✅ **Live Stripe Card Element checkout** — checkout confirms Stripe Card Element payments before creating orders; the confirmed PaymentIntent ID is stored on the order record.
- ✅ **Dashboard recent orders feed (live)** — reads tenant-scoped Neon orders; reflects parent-portal checkout activity.
- ✅ **Dashboard 30-day KPIs (live)** — revenue, orders, average order, awaiting-pickup KPIs computed from tenant-scoped live Neon orders; sparkline charts retained.
- ✅ **Top-selling items table (live)** — built from tenant-scoped live Neon order-line aggregates with share bars.
- ✅ **Reports — monthly revenue, revenue by category, GST/BAS summary (live)** — all use tenant-scoped live Neon order totals (gross, GST collected, net ex-GST, estimated Stripe fees, net payout).

### 3.4 Backend / data-layer milestones (completed by 2 May 2026)

- ✅ **Neon PostgreSQL backend** — serverless Postgres on `aws-ap-southeast-2` (project `cool-wind-76972110`).
- ✅ **Drizzle ORM schema** — 5 tables: `tenants`, `catalog_items`, `catalog_variants`, `orders`, `order_lines`. Stripe Connect fields (`stripe_account_id`, `stripe_payouts_enabled`, `stripe_charges_enabled`) are columns on `tenants`.
- ✅ **Seed data** — 2 tenants (NSBH, RGHS), 19 catalog items, 30 variants, 3 sample orders.
- ✅ **Neon Auth integration** — `@neondatabase/auth` configured; `GET/POST /api/auth/[...path]` route handler.
- ✅ **Stripe SDK** — `stripe` v17 installed; test-mode keys configured in `.env.local`.
- ✅ **Orders API** — `GET /api/orders`, `POST /api/orders`, `GET /api/orders/[id]`, `PATCH /api/orders/[id]`.
- ✅ **Catalog API** — `GET /api/catalog`, `POST /api/catalog`, `DELETE /api/catalog/[id]`.
- ✅ **Stripe payment intent API** — `POST /api/stripe/payment-intent`.
- ✅ **Stripe Connect API** — `GET /api/stripe/connect`, `POST /api/stripe/connect`.
- ✅ **Tenant settings API** — `PATCH /api/tenant/[tenantId]`.
- ✅ **Checkout persists to DB** — checkout flow writes orders to Neon (replacing the prior localStorage-only path).

### 3.5 Other parent / admin features previously confirmed complete

These items were marked ✅ in the audit and are recorded here for completeness:

- ✅ **Parent portal:** school picker (with auto-redirect when one child), catalog by category, item detail with collapsible size guide, add-to-cart / qty stepper (localStorage `cart-store`), cart with GST breakdown (1/11), checkout student-details validation, Pickup / Ship $9.50 toggle, order placed confirmation (dynamic order ID).
- ✅ **Orders Board:** 4-column Kanban (New → Packing → Ready → Collected) backed by Neon, status advance via `PATCH /api/orders/[orderId]`, "Notify parent" `mailto:`, "Email parents" bulk `mailto:`.
- ✅ **Order Detail / Pick Slip:** line items, GST, Stripe ref, barcode, status chip reflecting live status.
- ✅ **Catalog Management:** product table with category filter + search backed by `GET /api/catalog?tenantId=...`, inline name edit, remove product via `DELETE /api/catalog/[itemId]`.
- ✅ **Bulk Upload:** CSV drag-and-drop with inline preview, error row highlighting (missing SKU, invalid price), skip-errored-rows toggle, demo CSV loader.
- ✅ **Settings:** shop details form (name, address, hours, email), fulfilment toggles (pickup / shipping), email notification toggles.

---

## 4. Items moved from `docs/remaining_work.md`

The following items were marked as completed in `docs/remaining_work.md` and have been consolidated here. Any remaining ops / verification follow-ups are now tracked separately in `remaining_work.md`.

### 4.1 Refund / exchange UI on order detail (admin) ✅

**Source:** former `remaining_work.md` §2.1 — completed in PR #4 (`feat/posthog-and-hostinger-deploy`).

- Refund button + partial-amount dialog on admin order detail.
- `POST /api/orders/[orderId]/refund` — Stripe `refunds.create` with idempotency key; supports both partial and full refunds.
- `order_refunds` table (migration `0003_futuristic_snowbird`) records each refund with operator user ID, Stripe refund ID, amount, and reason.
- `order_status` enum extended with `partially_refunded` and `refunded`; status chip updates accordingly.
- `charge.refunded` webhook handler records out-of-band refunds initiated from the Stripe Dashboard.

**Pending verification (not blocking the code completion):** Smoke-test Test 3 (place order → partial refund → full refund → 409 on third attempt → idempotency replay) is blocked until NSBH's Stripe Express account is onboarded. Tracked in `remaining_work.md` §5 checklist item 8.

### 4.2 Stripe webhook handler ✅

**Source:** former `remaining_work.md` §2.3 — see also §2.3 above for the canonical entry. Listed here only as a pointer to confirm cross-doc consolidation.

### 4.3 Production environment configuration (code) ✅

**Source:** former `remaining_work.md` §2.6 — see also §2.6 above for the canonical entry. The "Remaining (ops)" follow-ups (live Stripe keys, prod DB URL, Hostinger env groups, production domain + TLS) remain tracked in `remaining_work.md`.

### 4.4 Error handling, logging, observability (code) ✅

**Source:** former `remaining_work.md` §2.7 — see also §2.7 above for the canonical entry. The "Remaining" follow-up (verify PostHog project key in Hostinger production env vars) remains tracked in `remaining_work.md`.

### 4.5 Go-live checklist items completed

From the former `remaining_work.md` §5 "Suggested go-live checklist":

1. ✅ Refund/exchange action on order detail (§2.1 — done in PR #4; E2E Test 3 still owed once Stripe Express is onboarded)
2. ✅ Stripe webhook endpoint (`payment_intent.succeeded`, `account.updated`, `charge.refunded`)
3. ✅ Production env config — `next.config.ts` security headers, CSP, HSTS (code complete; ops follow-ups still in `remaining_work.md`)
4. ✅ PostHog (error tracking + logs) + branded error/not-found pages

---

## Outstanding items (tracked in `docs/remaining_work.md`)

The following audit items are **not** complete and are tracked in `docs/remaining_work.md`:

- Super-admin / platform portal — all 4 screens (tenants list, provision wizard, billing overview, branding editor) — `remaining_work.md` §2.2.
- "Add another child" flow on school picker — `remaining_work.md` §3.3.
- Missing NSBH catalog items (Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie) — `remaining_work.md` §3.1.
- "Riley wore size X last year" hint driven by live order history (currently hardcoded) — `remaining_work.md` §4.1 + §4.9.
- Dashboard "New product" and "Export" buttons not wired — `remaining_work.md` §4.2.
