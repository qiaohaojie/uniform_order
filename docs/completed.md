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

### 4.6 Parent order detail page (`/orders/[orderId]`) ✅

**Source:** former `remaining_work.md` §3.4 — completed in commit `32bcf80` (reached `main` via the PR #6 merge ancestry).

A parent-facing order detail page at `/orders/[orderId]` shows the fulfillment timeline (4-step stepper Placed → Packing → Ready → Collected), line items, payment summary with refunds, and a tenant-aware support CTA. Auth via `getSessionUser` (redirect to sign-in with `callbackURL`) + `ensureParentEmailAccess` (wrong-owner / missing → `notFound`).

Status block branches on `order.status`:
- `pending_payment` → amber "Payment processing" banner (no stepper).
- `new` / `packing` / `ready` / `collected` → 4-step stepper.
- `partially_refunded` / `refunded` → amber refund banner with total returned (no stepper, since `orders.status` is single-valued).

Wire-ups (same commit):
- `apps/web/src/app/orders/orders-list-client.tsx` — active card and past-row details wrapped in `<Link href="/orders/{id}">`; "Re-order" remains a separate sibling Link.
- `apps/web/src/app/[tenant]/order/placed/page.tsx` — "View order details" deep-links to `/orders/{orderId}`.
- `apps/web/src/lib/email/templates/OrderConfirmation.tsx` and `OrderReady.tsx` — added `orderUrl` prop and a "View order status" button rendered with tenant accent.
- `apps/web/src/lib/email/index.ts` — threads `orderUrl = ${requireAppUrl()}/orders/${order.id}` into both templates.

Smoke-tested against real DB: 8/8 spec scenarios pass; both transactional emails delivered via Emailit. Spec: `docs/superpowers/specs/2026-05-07-parent-order-detail-design.md`. Plan: `docs/superpowers/plans/2026-05-07-parent-order-detail.md`.

### 4.7 Stripe Connect onboarding completion sync ✅

**Source:** former `remaining_work.md` §3.5 — completed 2026-05-07. Folds into the `account.updated` line of §2.3 above; preserved here for the operational detail.

Both push (webhook) and pull (live API fetch) paths keep `stripePayoutsEnabled` / `stripeChargesEnabled` in sync:

- `account.updated` webhook handler in `apps/web/src/app/api/stripe/webhook/route.ts` updates the tenants row keyed by `stripeAccountId`, captures PostHog events (success, unmatched-account, exception), and re-throws on DB error so Stripe retries.
- `GET /api/stripe/connect` live-fetches the account from Stripe on every call and persists fresh status, so any settings-page load reconciles state regardless of webhook delivery.
- Settings UI renders three correct states: not connected, connected/onboarding incomplete, connected/ready.

**Smoke test (no real Express account required):** with the dev server + Stripe CLI listener running, run `stripe trigger account.updated` and confirm the PostHog `stripe_account_updated` (or `stripe_account_updated_unmatched`) event fires and the DB row reflects the payload.

**Remaining (ops):** verify the production Stripe webhook endpoint subscribes to `account.updated`. Tracked in `remaining_work.md` §2.8.

### 4.8 "Riley wore size X last year" hint — live order history ✅

**Source:** former `remaining_work.md` §4.1 + §4.9 — merged to `main` in commits `6700615`–`0d61038`.

Replaces the static `"Riley wore size 14 last year"` placeholder with a real previous-size hint driven by the parent's order history.

- `getPreviousSizeHint(tenantId, email, itemId)` in `apps/web/src/db/queries.ts` — joins `orders` × `order_lines`, returns the most recent matching `{studentName, variantLabel, createdAt}` or `null`.
- `GET /api/orders/size-hint?tenantId=...&email=...&itemId=...` returns `{studentName, variantLabel}` or `null`. Auth-gated.
- `interactive.tsx` reads parent email from `uo:student:v1` localStorage (already persisted at checkout via `writeStudentDetails()`), fetches the hint, and renders `"{studentName} wore {variantLabel} last year"` only when a real match exists. No hardcoded fallback.

Code complete; type-check passing. Smoke tests T2/T3/T4/T5/T6/T7 verified via DB-injected test data. Checkout-path smoke test (T3/T4 via real Stripe payment) is blocked on NSBH's Stripe Express account onboarding — same gap as `remaining_work.md` §2.8 / §5 checklist item 4. Re-run once the Stripe Connect account is active.

### 4.9 Drizzle-kit `neon_auth.*` exclusion ✅

**Source:** former `remaining_work.md` §4.11 — completed 2026-05-08 in PR #8 (`chore/drizzle-tablesfilter`, commit `6d2602b`).

**Resolution:** schema-file split, not a `drizzle.config.ts` flag.

**Investigation finding:** both `tablesFilter` and `schemaFilter` only filter DB introspection during `pull` / `push`. Neither prevents `generate` from diffing a tracked table in the snapshot. Confirmed by probe: with `schemaFilter: ["public"]` set, adding a column to `neonAuthUsers` in `schema.ts` still emitted `ALTER TABLE "neon_auth"."user" ADD COLUMN ...`. Same with `tablesFilter: ["!neon_auth.*"]`.

**Working approach:**

1. Move `neonAuthUsers` + `neonAuthSchema` to `apps/web/src/db/external-schema.ts`.
2. In `schema.ts`, import `neonAuthUsers` (do **not** re-export). The `references(() => neonAuthUsers.id, …)` callbacks still resolve at runtime.
3. Hand-edit the latest snapshot (`apps/web/drizzle/meta/0007_snapshot.json`) to remove the `neon_auth.user` table entry and empty the `schemas` object.
4. `drizzle.config.ts` stays unchanged — the filter flags don't help.

**Why this works:** drizzle-kit enumerates exports of the file at `drizzle.config.ts:schema` (only `./src/db/schema.ts`). It does not traverse imports to discover `pgTable` / `pgSchema` symbols, so a table imported-but-not-re-exported is invisible to its diffing. FK SQL emission (`REFERENCES "neon_auth"."user"("id")`) still works because the `references()` callback returns the column object regardless of registration.

**Verified:** clean-tree `drizzle-kit generate` produces "No schema changes." Probe of `neonAuthUsers` column add in `external-schema.ts` produces no migration. Sanity probe (column add in a public table) still emits the expected ALTER.

### 4.10 Transactional-email webhook commit split — decision noted ✅

**Source:** former `remaining_work.md` §4.10. The transactional-email plan called for splitting Task 6 Steps 3 and 4 into separate commits; commit `3ce98b1` collapsed them. Functionality is correct — only `git bisect` / history granularity is affected. Not worth rewriting history. Recorded here so the deviation is explainable from the doc trail rather than archaeology.

### 4.11 `db.transaction()` → `db.batch()` in `/api/orders` POST ✅

**Source:** former `remaining_work.md` §2.10 — fixed 2026-05-09 in PR #10.

**Bug:** `apps/web/src/app/api/orders/route.ts:180` called `db.transaction(async tx => …)`. The DB client is `drizzle-orm/neon-http`, which throws `Error: No transactions support in neon-http driver` on any interactive transaction. Every real parent checkout would have 500'd with the Stripe charge already captured but no `orders` row written. Latent because no parent had checked out since the bug was introduced (commit `1a6fa21`, 2026-05-05).

**Fix:** replaced `db.transaction` with `db.batch([orderInsert, ...lineInserts])`, mirroring the pattern in `addCatalogItem` (`db/queries.ts:573`). Atomic over a single HTTP round-trip. The 5-attempt collision-retry loop wrapping `insertOrder` continues to work — it retries on `orders_pkey` collisions, which now surface as standard `23505` errors from the batch instead of from inside a tx.

**Verified:** `pnpm check-types:web` clean. End-to-end smoke test (real Stripe checkout → orders row + order_lines rows written) deferred until NSBH's Stripe Express account is onboarded — same gate as §5 checklist item 3.

### 4.12 "Add another child" flow on school picker ✅

**Source:** former `remaining_work.md` §3.3 — shipped via PR #6 (squash-merge `2f6803e`, 2026-05-08).

**Spec:** `docs/superpowers/specs/2026-05-08-parent-account-children-design.md`
**Plan:** `docs/superpowers/plans/2026-05-08-parent-account-children.md`

20-task plan executed end-to-end: school picker now lets a signed-in parent add another child (name, year, roll), the child list persists per parent, and the home redirect honours multi-child state (no auto-redirect when more than one child exists). Includes parent-note plumbing through checkout → operator order detail → printed pick slip → parent confirmation receipt. PR #6 went through three rounds of code-review fixes (15 findings) before merge; post-merge follow-ups (snapshot chain repair, `HomeClient` cookie clearing) committed before squash.

**Production ops verifications still owed:** tracked in `remaining_work.md` §2.11 (Neon Auth provider config, magic-link/Google dedupe, account-management link, staging E2E for both providers, `tenants.is_publicly_listed` backfill check).

---

### 4.14 NSBH catalog seed — 8 missing paper-form items (9 SKUs) ✅

**Source:** former `remaining_work.md` §3.1 — shipped via PR #12 (squash-merge `e4ef0c7`, 2026-05-09).

The 8 PDP-listed missing items now exist as 9 SKUs (Exercise Books split into A4 + Math because the paper form lists them as two distinct rows):

| ID | Category | Variants | Price |
|---|---|---|---|
| `shorts-navy` | Summer | Boys 10–16 / Mens 4–8 | \$43 / \$45 |
| `sock-grey` | Winter | 3–9 / 7–11 | \$5 |
| `scarf` | Winter | One size | \$20 |
| `prefect-tie` | Winter | 147cm | \$22 |
| `soccer-jersey` | Sports | 12–22 | \$40 |
| `swimming-briefs` | Sports | XS–XXL | \$45 |
| `exercise-book-a4` | Stationery | N/A | \$2 |
| `exercise-book-math` | Stationery | N/A | \$2 |
| `ring-binder` | Stationery | N/A | \$5 |

Variants and prices come from `my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf`. Both `apps/web/scripts/seed.mjs` (DB) and `apps/web/src/lib/data.ts` (`CATALOG` — the parent shop's source today) were updated; `GarmentVector` shape map (`apps/web/src/components/garment.tsx`) gained entries for the new IDs so each renders the closest silhouette instead of the generic "misc" fallback. Gemini review caught one copy-paste bug (Navy Shorts described as "Mid-grey poly/viscose" — copied from the trousers entry); fixed in `2cda22a` before merge.

Smoke-tested on `pnpm dev:web`: all 9 items appear in the correct category on `/nsbh` (Summer 4, Winter 9, Sports 7, Stationery 5) and item detail pages render with correct names + prices.

**Production ops + remaining gaps still owed:** tracked in `remaining_work.md` §2.12 (run prod seed once deployed, RGSH catalog needs school sign-off).

### 4.15 Catalog variant misalignments — shirt-ss / shirt-ls / trousers / tie ✅

**Source:** former `remaining_work.md` §2.12 third bullet — shipped via PR #13 (squash-merge `e7bccf0`, 2026-05-09).

The original §2.12 bullet ("Pre-existing shirt variant gaps") had misdiagnosed the issue: the rows it flagged as "missing shirt variants" (`men 4–8 → $45` and `10,12,…,18 → $57`) are actually rows for **other products** on the paper form. Investigation against `my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf` revealed a chain of mis-attributions in the seed/CATALOG predating PR #12 — variant rows had been copy-pasted from neighbouring rows when the original seed was authored.

Untangled to match the paper form:

| Item | Before | After (paper form) |
|---|---|---|
| `shirt-ss` | `Boys 10–26 \$32`, `Mens 4–8 \$43` | `10–26 \$32` only |
| `shirt-ls` | `Boys 10–24 \$28`, `Mens 5–8 \$59` | `10–24 \$28` only |
| `trousers` | 4 × `Year X–Y short/long` (\$17/\$18) | `10–18 \$57`, `Mens 5–8 \$59` |
| `tie` | `One size \$20` | 4 × `Year 7–10 / 11–12 × short/long` (\$17/\$18) |

Mock orders that referenced the now-removed variants were re-pointed to equivalent-priced real variants so order totals stay stable: previous `trousers / Year X–Y long / \$18` lines became `tie / Year X–Y long / \$18`; previous `tie / One size / \$20` lines became `scarf / One size / \$20`. Mock CSV preview rows in the bulk-upload admin page (`upload-client.tsx`) updated to use surviving variants.

Files: `apps/web/scripts/seed.mjs`, `apps/web/src/lib/data.ts`, `apps/web/src/lib/admin-data.ts`, `apps/web/src/app/admin/[tenant]/upload/upload-client.tsx`, `docs/remaining_work.md`. Type-check clean; no schema, RGSH catalog, or Stripe code touched. Gemini's bot flagged the odd sizes `13/15/17` in trousers as inconsistent — verified false positive: paper form lists those literally as `10, 12, 13, 14, 15, 16, 17 & 18` for the \$57 row.

### 4.13 Orphan `/[tenant]/refund-policy` route removed ✅

**Source:** former `remaining_work.md` §3.10 item 1 — shipped via PR #11 (squash-merge `3e7a95c`, 2026-05-09).

The `/[tenant]/refund-policy` route had been declared dead in earlier docs but was still referenced from the checkout consent label. Rewrote the consent text to inline the v1 email pattern (`I agree to the terms and privacy policy. For refund or exchange questions, contact {tenantName} at {shopEmail}.`) and deleted `apps/web/src/app/[tenant]/refund-policy/page.tsx`. Will be re-introduced under §3.10 follow-up #2 once schools author their own content via the §2.2 super-admin onboarding form.

### 4.16 Platform portal — DB-back tenant routes + RGSH catalog seed (Phase 1) ✅

**Source:** `remaining_work.md` §2.2 prerequisite work — shipped via PR #14 (squash-merge `46fcb6e`, 2026-05-09).

Migrated the `[tenant]` and `admin/[tenant]` routes from the static `TENANTS`/`CATALOG` constants in `lib/data.ts` to DB-backed lookups via `getTenant(slug)` and tenant visibility rules. Seeded RGSH catalog so the second tenant has real data instead of inheriting NSBH-only entries. Foundation for the platform-portal trio (PRs #15–#17) — without DB-backed reads, the portal's tenant list / detail / wizard would have nothing real to show.

### 4.17 Platform portal — scaffold + tenant list + tenant detail (Phases 2/3/5) ✅

**Source:** `remaining_work.md` §2.2 — shipped via PR #15 (squash-merge `dd688dc`, 2026-05-09).

`/platform/*` shell with auth gate using `isPlatformAdminEmail` (driven by `PLATFORM_ADMIN_EMAILS` env var). Tenants list with KPIs (active orders, total revenue, payouts-enabled flag) plus search + status filter. Tenant detail page with read-only cards (identity, branding, billing, operator, catalog summary). Spec: `docs/superpowers/specs/2026-05-09-platform-portal-design.md` v5.

### 4.18 Platform portal — provision wizard (Phase 4) ✅

**Source:** `remaining_work.md` §2.2 (provision wizard screen) — shipped via PR #16 (squash-merge `0c11acc`, 2026-05-09).

4-step wizard for onboarding a new tenant: identity → branding → operator → review. Uses `safeParse` for per-step validation, dirty-flag gating between steps, reactive branding preview (live parent-shop colour swatch), TOCTOU-safe slug uniqueness check on submit, slug regex enforcement, PostHog instrumentation per step. Replaces the prior process of running a SQL seed script for new schools.

### 4.19 Platform portal — billing tab (Phase 6) ✅

**Source:** `remaining_work.md` §2.2 (billing overview screen) — shipped via PR #17 (squash-merge `ca85cbc`, 2026-05-10).

`/platform/billing` shows connected-account state, balances, and 30-day gross/net per tenant. Cached `getTenantBilling` (`lib/platform/stripe-billing.ts`) wraps `accounts.retrieve` + `balance.retrieve` + `payouts.list` + auto-paginated `balanceTransactions.list` with React `cache()` (in-request dedup) + `unstable_cache` (5-min TTL). Per-tenant tags so `account.updated` webhook revalidates only the matched tenant. Net 30d sums only `charge`/`refund` balanceTransactions (not `payout`/`transfer`, which would understate revenue). 5-way concurrency cap on cold-cache fan-out. KPI tiles + table use `Intl.NumberFormat("en-AU")` for thousands separators. AUD-only by design via `PLATFORM_CURRENCY` constant.

Files: `lib/platform/stripe-billing.ts`, `app/platform/billing/page.tsx`, `app/platform/billing/billing-table.tsx`, `app/api/stripe/webhook/route.ts` (+2 lines: import + `revalidateTag` in `account.updated` branch). Iterated through 5 rounds of Gemini review feedback before merge.

### 4.20 Platform portal — branding editor drawer (final §2.2 screen) ✅

**Source:** `remaining_work.md` §2.2 (branding editor) — shipped via PR #18 (squash-merge `1ea6055`, 2026-05-11). Closes the super-admin portal scope (all 6 screens now live).

Right-side overlay drawer launched from the Edit link on the tenant detail BrandingCard. Form on the left (logo upload + remove via UploadThing, accent picker, motto), live `BrandingPreview` on the right (MobileShell-style stub with accent header, logo / Crest fallback, motto, two stub catalog rows). Save is disabled while UploadThing is uploading so a stale URL can't be persisted. The public-listing toggle stays inline on the card — common operation, low blast radius, not worth a drawer round-trip.

**Server action (`editTenantBranding`):** sibling to the wizard's `updateTenantBranding`. Covers logoUrl + accent + motto (motto sits in `step1Schema` for the wizard, so `step2Schema` stays unchanged). Computes `changedFields` server-side (rejects client-supplied diff — observability ground truth shouldn't be falsifiable by an admin or a buggy diff), short-circuits no-op saves, emits one PostHog event with the diff, and revalidates the tenant detail page plus the parent-shop layout when the tenant is approved.

**Refactors bundled in same PR:**
- `lib/platform/action-helpers.ts` — extracts `requirePlatformAdmin` / `parseInput` so wizard and edit drawer share the same admin gate + zod parser.
- `components/platform/accent-picker.tsx` — shared between wizard step-2 and the drawer (single swatches + hex input).
- `components/platform/branding-preview.tsx` — new stub component the drawer uses; wizard step-2 can adopt it later for the right-rail preview promised in the spec.
- `BrandingCard` now imports `TenantRow` from `db/schema` instead of redefining `typeof tenants.$inferSelect` so the two layers don't drift on the row shape.

**A11y:** `aria-modal`, Esc-to-close (stabilised via `onCloseRef` so an inline `onClose` prop on every parent render doesn't churn the keydown listener), body-scroll-lock, isMounted guard on post-await state updates, and Cancel / close-X / scrim are all disabled while pending so the user can't dismiss mid-save and miss a server error. Full focus trap deferred.

Files: `app/platform/tenants/[id]/actions.ts`, `app/platform/tenants/[id]/cards/branding-card.tsx`, `app/platform/tenants/[id]/cards/branding-edit-drawer.tsx`, `app/platform/tenants/new/actions.ts`, `app/platform/tenants/new/steps/step-2-branding.tsx`, `components/platform/accent-picker.tsx`, `components/platform/branding-preview.tsx`, `lib/platform/action-helpers.ts`, `lib/platform/schema.ts` (+449 / -88).

---

## Outstanding items (tracked in `docs/remaining_work.md`)

The following audit items are **not** complete and are tracked in `docs/remaining_work.md`:

- Missing NSBH catalog items (Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie) — `remaining_work.md` §3.1.
- Parent-account ("add another child") production ops verifications — `remaining_work.md` §2.11.
- Dashboard "New product" and "Export" buttons not wired — `remaining_work.md` §4.2.
