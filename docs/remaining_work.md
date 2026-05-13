# Remaining Work — Pre-Go-Live Backlog

**Project:** Uniform Online Order System
**Author:** Engineering audit
**Date:** 5 May 2026
**Sources:** [PDP](../my_doc/PDP.md), former `docs/FEATURE_AUDIT.md` (now consolidated into this file and `docs/completed.md`), live codebase scan

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

> §2.1, §2.2, §2.3, §2.6, §2.7, §2.10, §3.1, §3.3, §3.4, §3.5, §3.10 follow-ups #1/#2, §4.1, §4.9, §4.10, §4.11 — **shipped.** See `docs/completed.md` §4. Their ops / verification follow-ups (where they exist) remain below in §2.8, §2.9, §2.11, §2.12.

### 2.8 Ops / verification follow-ups (carried over from completed code work)

The code for §2.1, §2.3, §2.6, and §2.7 is done; the following ops/verification items still need to happen before go-live:

- **Refund E2E (from §2.1):** Once NSBH's Stripe Express account is onboarded, run smoke-test Test 3 — place order → partial refund → full refund → 409 on third attempt → idempotency replay. (See §5 checklist item 4.)
- **Production env (from §2.6):** Switch from Stripe test keys to live keys; pin production `DATABASE_URL`; configure Hostinger Node.js app env groups (preview vs production); assign production domain + TLS.
- **Observability (from §2.7):** Verify PostHog project key is set in production Hostinger env vars (and confirm events are arriving from production after first deploy).
- **Stripe webhook events (from §3.5):** Verify the production Stripe webhook endpoint subscribes to `account.updated` in addition to `payment_intent.succeeded` and `charge.refunded`.
- **Apple Pay domain verification (from §2.13):** Replace `apps/web/public/.well-known/apple-developer-merchantid-domain-association` with the real file from Stripe Dashboard → Settings → Payment methods → Apple Pay → Add new domain (`uniformorder.online`), then redeploy. Until done, Apple Pay does not surface in the PaymentElement wallet tab. Google Pay is unaffected.

### 2.9 Catalog management — production deployment follow-ups

The catalog management feature (self-service add/edit catalog items, image uploads via UploadThing, approval gate) shipped to `main` as `c9237d9` (PR #9, merged 2026-05-08, branch deleted). Before / during the first production deploy that includes it, the following non-code actions need to happen on Hostinger:

- [ ] **`UPLOADTHING_TOKEN` env var** — get the token from `https://uploadthing.com/dashboard → API Keys` (single combined v7 token, no separate key/app id). Add via hPanel → Advanced → Node.js → Environment Variables, then **restart the Node.js app** from the same panel. Without this, image uploads silently fail.
- [ ] **CSP / `next/image` host allowlist** — already wired in `apps/web/next.config.ts` for `utfs.io`, `*.utfs.io`, `*.ufs.sh` (commit `dd35a70`). Just confirm the deployed build serves the same headers (curl `-I` the homepage and check `Content-Security-Policy`).
- [ ] **End-to-end smoke in production** — log in as a platform admin → `/admin/<tenant>/catalog` → add an item with an image upload → confirm a `https://utfs.io/f/...` URL lands in `catalog_items.image_url` and the parent shop renders it. The dev-mode HMR caused some intermediate `UploadDropzone` glitches that don't repeat in production builds (no Fast Refresh) but worth one full-loop verification.
- [ ] **(Optional) UploadThing free-tier monitoring** — current plan covers 2 GB storage / 100 GB bandwidth. With ~16 product photos × 2 schools × <2 MB each, usage is negligible. Re-evaluate at tenant #5 or any image-heavy redesign (e.g. high-res hero shots, multi-angle product photos).

### 2.12 Catalog seed (NSBH paper form) — production + RGSH follow-ups

§3.1 NSBH code shipped via PR #12 (squash-merge `e4ef0c7`). Outstanding:

- [ ] **Run prod NSBH seed.** `apps/web/scripts/seed.mjs` is idempotent (`ON CONFLICT DO UPDATE` for items, `DELETE + INSERT` for variants). Run against production Neon once these changes deploy: `cd apps/web && node scripts/seed.mjs` with the prod `DATABASE_URL`. Today the parent shop renders from `CATALOG` in `lib/data.ts`, so the prod seed only affects the admin catalog table — it becomes load-bearing once parent-shop DB-reads land.
- [ ] **RGSH catalog (separate task).** Needs school sign-off on the catalog list — RGSH currently inherits NSBH-only seed entries. Capture as a school-onboarding sub-task; super-admin portal now exists (`completed.md` §4.16–§4.20) so onboarding workflow can drive this.

### 2.11 Parent-account ("add another child") — production ops follow-ups

The parent-account / "add another child" feature shipped via PR #6 (squash-merge `2f6803e`). Code complete; the following non-code verifications still need to happen on a production-mirroring environment before NSBH go-live:

- [ ] Verify both **magic-link email** and **Google** providers are enabled in the Neon Auth project dashboard for the production environment.
- [ ] Verify Neon Auth dedupes by primary email when the same email signs in via both magic-link and Google. If not, surface the setting and flip it.
- [ ] Confirm the Neon Auth account-management path linked from `/privacy` (per Task 18 Step 1) renders correctly on production-mirroring staging. If a self-service deletion path is unavailable, replace the link with the support-email fallback in `app/privacy/page.tsx`.
- [ ] Run a real end-to-end smoke test on staging: sign in via magic-link, add a child, place an order with a note, confirm the operator detail callout, confirm the printed pick slip includes the note, confirm the parent receipt echoes the note.
- [ ] Run the same E2E with Google sign-in.
- [ ] After deploy, verify `tenants.is_publicly_listed = true` for `nsbh` and `rgsh` (the migration's seed UPDATE should have applied; if not, run `UPDATE tenants SET is_publicly_listed = true WHERE id IN ('nsbh','rgsh');`).

### 2.13 NSBH gap-analysis musts (next sprint)

Sourced from `my_doc/NSBH/gap-analysis.md` §5 (2026-05-12). Email/DNS ops items intentionally excluded — already covered by §2.8 and parked until post-development. Guest checkout (§5.2) excluded — replaced by magic-link + Google sign-in direction (see §2.14).

- [x] **Tenant footer with policy links (gap-analysis §5.5).** ✅ shipped prelaunch-hardening PR. Add `<TenantFooter>` to `apps/web/src/components/mobile-shell.tsx` (rendered above `BottomNav` so it doesn't collide). Links: `/<tenant>/refund-policy`, `/<tenant>/contact` (§2.13 item below), `/privacy`, `/terms`. Display `tenant.shopEmail` + `tenant.shopHours` as text. **Refund-policy fallback already works at the data layer** — `tenant_legal_versions` has `policyMode` discriminator + `policyText`/`policyUrl` columns (`db/schema.ts:48-49`), and `app/[tenant]/refund-policy/page.tsx` redirects to `policyUrl` when `policyMode === "url"`, else renders `policyText`. Footer just needs to surface the existing route. ~3h.

- [x] **Per-tenant Contact page (gap-analysis §5.6).** ✅ shipped prelaunch-hardening PR. New route `apps/web/src/app/[tenant]/contact/page.tsx` rendering `tenant.shopEmail`, `shopHours`, `address`, `collectionInstructions`. **Data is already captured during onboarding** at `app/platform/tenants/new/steps/step-3-operator.tsx` (shopEmail/shopHours/collectionInstructions) and step-1 (address). RSC, use `getTenant(slug)`. Link from `<TenantFooter>`. ~2h.

- [x] **SEO basics — sitemap, robots, `generateMetadata` (gap-analysis §5.4).** ✅ shipped prelaunch-hardening PR. Today `generateMetadata` is used in exactly one file (`app/[tenant]/refund-policy/page.tsx`, only to set noindex). Platform-wide `<title>="UniformOrder"` is set at `app/layout.tsx:28-31`.
  - Add `generateMetadata` to `app/[tenant]/layout.tsx` returning `{ title: '${tenant.name} Uniform Shop', description: tenant.motto ?? '${tenant.name} parent shop', openGraph: { images: [{ url: tenant.logoUrl }] } }` — data exists on `tenants.motto` (`db/schema.ts:73`) and `tenants.logoUrl` (`schema.ts:74`).
  - Add `generateMetadata` to `app/[tenant]/item/[itemId]/page.tsx`: `'${item.name} — ${tenant.name}'`.
  - New `app/sitemap.ts` — enumerate `getPubliclyListedTenants()` × public catalog items per tenant.
  - New `app/robots.ts` — `disallow: ['/admin', '/platform', '/auth', '/api']` (also closes admin/platform noindex leak).
  - ~4h. No DB change.

- [x] **Apple Pay + Google Pay via Stripe `PaymentElement` (gap-analysis §5.1).** ✅ shipped prelaunch-hardening PR. **Ops follow-up:** replace `apps/web/public/.well-known/apple-developer-merchantid-domain-association` with the real file from Stripe Dashboard → Settings → Payment methods → Apple Pay → Add new domain (`uniformorder.online`), then redeploy. Until verified, Apple Pay does not surface in the PaymentElement wallet tab. Google Pay is unaffected. `automatic_payment_methods: { enabled: true }` is already on the PaymentIntent route (`api/stripe/payment-intent/route.ts:75`); wallets just don't render because we mount a card-only element.
  - In `app/[tenant]/checkout/checkout-screen.tsx:90-102`, swap `elements.create("card", { hidePostalCode: true })` → `elements.create("payment", { layout: "tabs" })`.
  - Replace `stripe.confirmCardPayment(...)` → `stripe.confirmPayment({ clientSecret, elements, confirmParams: { return_url } })`.
  - Add `public/.well-known/apple-developer-merchantid-domain-association` (asset from Stripe Dashboard → Settings → Payment methods → Apple Pay → Add new domain).
  - Verify `uniformorder.online` in Stripe Dashboard via Connect platform account.
  - No DB change; destination-charge config unchanged. ~1d.

### 2.14 Bug-class items lifted from NSBH gap-analysis (real defects, not nice-to-haves)

These were classified as "Should" in the gap analysis but are genuine bugs / hardening, not feature work. Treat with the same urgency as anything else in §2.

- [x] **`payment_intent.payment_failed` webhook + audit log on dashboard refunds (gap-analysis §5.11).** ✅ shipped prelaunch-hardening PR. Pivoted to audit-only (Option B): declined cards never produce an order row in this codebase, so audit entries target the PaymentIntent (`targetType: 'payment_intent'`). No order-row state machinery needed.
  - Today `orders.status = 'pending_payment'` rows orphan in DB after card declines because nothing cleans them up. Add a `payment_intent.payment_failed` branch to `api/stripe/webhook/route.ts` that deletes or cancels the matched pending order (lookup by `stripePaymentIntentId`).
  - Acknowledged TODO at `api/orders/[orderId]/refund/route.ts:176-178`: the `charge.refunded` webhook branch currently skips `logAuditEvent`. Add a call with `actorRole: "system"`, `actorEmail: "stripe-webhook"`, `action: "order.refunded.via_dashboard"` so dashboard-initiated refunds appear in the per-order audit log alongside in-app refunds.
  - ~3h.

- [x] **Remove `getPreviousSizeHint` feature entirely (decision 2026-05-12).** ✅ shipped prelaunch-hardening PR.
  - **Decision:** drop the "Riley wore size 14 last year" hint rather than fix it. The original gap-analysis chunk-C follow-up flagged it as a wrong-child defect for multi-child parents (`db/queries.ts:427-467` keys on `parentEmail + itemId`, ignoring active child). Fixing properly would need `orders.childId` migration + write-path change + read-path change. Mitigations (child-count guard, migration) considered and rejected: the feature is not worth the complexity to get right, and parents who want past-size info can check their order history at `/orders/[orderId]` which already lists garment + size purchased.
  - **Removal scope:**
    - Delete `getPreviousSizeHint` from `apps/web/src/db/queries.ts:427-467`.
    - Remove the hint render block from `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx:173-178` (and the prop wiring from the parent `page.tsx` if it threads through).
    - Remove any tests / fixture references.
    - Update `docs/completed.md` §4.8 entry to note the feature was removed on 2026-05-12 — preserves the cross-reference in §6 of this file.
  - **Effort:** ~30min. Pure deletion, no migration, no schema change.
  - **Reversibility:** trivial — feature can be re-added later if multi-child UX work surfaces it as a real need.

- [x] **Server-side total assertion (gap-analysis §5.10).** ✅ shipped prelaunch-hardening PR. Variant-keyed catalog price lookup (`${itemId}::${variantLabel}`) — rejects unknown variants, price tampering (>1¢), and total mismatches. Both `/api/orders` and `/api/stripe/payment-intent` gated.
  - Client supplies `subtotal`, `gst`, `total` to `POST /api/orders` and the values are stored as-sent. Stripe ultimately governs cash flow, but the BAS export (`app/platform/billing/`) reads these DB columns — tampering risk is low but reconciliation risk is real.
  - New helper `apps/web/src/lib/order-totals.ts` exporting `assertTotalsMatch({ lines, deliveryFee, subtotal, gst, total })` that recomputes server-side from line items + `tenant.deliveryFeeCents`, rejects on >1¢ delta. GST is 10% inclusive (1/11 of GST-inclusive total — confirm with §3.6 accountant sign-off rule).
  - Call from `POST /api/orders` (`api/orders/route.ts` before insert) and `POST /api/stripe/payment-intent` (before `paymentIntents.create`). Return 400 with `{ code: 'totals_mismatch', expected, received }` on delta.
  - Do **before** marketing the BAS export as audit-grade. ~2h.

- [x] **`sizes jsonb` column on `catalog_variants` (gap-analysis §5.15).** ✅ shipped (Tasks 1-6, this PR).
  - Today the per-variant `sizes[]` array lives in static `lib/data.ts` (acknowledged TODO at `db/queries.ts:904`). Schools beyond NSBH/RGSH cannot define their own size grids without a code change — blocks self-service onboarding past tenant #2.
  - Migration: add `sizes jsonb not null default '[]'::jsonb` to `catalog_variants` (use Neon MCP `run_sql_transaction` per the drizzle-kit websocket blocker memory). Migrate existing rows from `lib/data.ts` shape: `{ variantId → string[] }` map.
  - Update `db/queries.ts:904` read path to read from the column instead of the static map.
  - Surface in `app/admin/[tenant]/catalog/item-drawer.tsx` as a comma-separated input next to `label` (parse on save to `string[]`).
  - PDP read path in `app/[tenant]/item/[itemId]/interactive.tsx` already consumes the same shape — no client change.
  - **Bump before school #3 onboards.** ~½d.

---

## 3. 🟡 Medium — required by PDP/prototype, tolerable for soft launch

### 3.2 Refund-policy *page* (the actual content)

Already counted in §1.5 as a blocker for the consent step. Listed again here because the content itself (copy, signed off by each school's bursar) is a content task, not a code task.

### 3.6 GST / BAS report — auditor sign-off

The reports page produces monthly GST totals client-side. Before go-live, have an Australian accountant confirm the formula (1/11 of GST-inclusive total), the rounding rules, and the Stripe-fee deduction model.

### 3.7 Print stylesheet QA — ✅ shipped

Code shipped via PR #21 (squash `11667af`); see `completed.md` §4.23. Print verification automated 2026-05-12 via Playwright harness at `apps/web/tests/print/print-qa.mjs` (Chromium PDFs + WebKit screenshots), exercised against two NSBH orders (one with parent note, one without). All assertions pass:

- Single slip: barcode renders, `[data-no-print]` elements hidden, no Kanban column-header row, exactly 1 A4 page per slip, parent-note banner shows note text when present.
- Batch (`/admin/<tenant>/orders` in print emulation): Kanban hidden, `break-after-page` count = slips − 1, PDF page count = slip count — no trailing blank.
- Cross-engine: WebKit print-media screenshots saved alongside Chromium PDFs for Safari visual parity check.

Artifacts (gitignored) under `apps/web/tests/print/output/`. Re-runnable via `pnpm print-qa --tenant=<slug> --orders=<id1>,<id2>` after one-time `--auth` session capture.

### 3.8 Accessibility audit — ✅ shipped

Parent flow audited against WCAG 2.1 A+AA (PR #23 Phase A) and fixed (PR #24 Phase B, squash `69430c5`). 1 P0 (FieldLabel/select-name) + 2 P1 (Stripe wrapper, gold-text contrast) axe findings resolved or documented-excluded; Playwright-assisted keyboard walkthrough clean (no traps, 5/6 screens automated + manual follow-up enumerated). Original spec called out burgundy `#7A1F2B` as the likely contrast risk — Phase A debunked this (9.46–10.20:1 across backgrounds); the real risk was gold `#B08A3E` at small bold sizes, fixed via the `--color-gold-text` token. See `completed.md` §4.25.

### 3.9 Mobile shell viewport edge cases ✅

Done 2026-05-11. Three rule-#2 small-tap-target P1s identified by Phase A audit and fixed in Phase B (cart qty steppers → 28×28, catalog header cart link → 36×36, item header cart link → 36×36). Rule #1 (horizontal scrollbar) and rules #3-#4 had zero findings at any of the three viewports. See `completed.md` §4.24.

### 3.11 Catalog search — ✅ shipped

Parent shop's fake search bar (a static `<div>` at `app/[tenant]/page.tsx:78-86`) converted to a working client-side filter. Shipped via PR #25 (squash `409c1e3`, merged 2026-05-12). Identified by the NSBH gap analysis (`my_doc/NSBH/gap-analysis.md`) as the #1 credibility bug.

New client component `apps/web/src/app/[tenant]/catalog-grid.tsx` owns the search input, chips, result-count line, grid, and empty state. Matches name + category (case-insensitive substring). Cross-category when a query is active; chip-scoped when empty. Empty state with focus-restoring Clear button. `aria-live="polite"` result count debounced 300ms so screen readers don't get mid-word announcements. Six commits squashed (icon, refactor, input, filter+empty-state, live-region, review-fixes for `Math.min/max` empty-array guard + redundant count-line suppression).

**Deferred (filed, not closed):**
- **#27 — chips inert during active search.** The active chip stays highlighted even though the grid shows cross-category results. Spec-acknowledged trade-off; revisit with PostHog data on type-then-click-chip frequency.
- PostHog `catalog_search` event (query, resultCount, tenantId) — defer until we want intent data.
- Synonym map for parent-terminology mismatches (jumper/sweater, trousers/pants) — defer until PostHog signals real misses.

### 3.10 Platform `/terms` page — deferred indefinitely

The two §3.10 follow-ups (school-authored refund-policy capture, per-tenant policy link in email) shipped via PR #19; see `completed.md` §4.22.

Platform-level `/terms` page is **deferred indefinitely** — not needed until we have multiple tenants whose policies diverge or a parent dispute escalates beyond a school's ability to resolve directly. Re-evaluate at tenant #3 or first major dispute.

**Reference:** `my_doc/Legal/Refund_Policy/2026-05-07-refund-policy-ownership.md` for the full reasoning across Stripe Connect, marketplace practice, business, operational, and AU legal lenses, plus the v1 vs. v2 split.

### 3.12 NSBH gap-analysis should-haves (medium urgency)

Sourced from `my_doc/NSBH/gap-analysis.md` §5 — items not bug-class (those live in §2.14) but worth doing in the next quarter. Ordered roughly by leverage.

- [x] **Stock disabled-not-hidden on PDP (gap-analysis §5.8).** ✅ shipped. `getCatalogItemForPDP` leftJoins all variants; inactive ones tagged `disabled: true`. PDP renders them with strike-through + "Unavailable" label, never clickable; size section and qty stepper hidden/disabled when all variants unavailable. Catalog grid unaffected (still innerJoin active-only via `getActiveCatalog`).

- [x] **Shop hours on pickup option pre-purchase (gap-analysis §5.9).** ✅ shipped. Read `tenant.shopHours` in `app/[tenant]/checkout/page.tsx`, thread to `CheckoutScreen`. In `checkout-screen.tsx:415` replace the literal `"Free · Ready in 1–2 school days"` copy on the pickup `DeliveryOption` card with `tenant.shopHours` when set, fall back to existing copy otherwise. ~1h.

- [ ] **Admin drag-to-reorder + size-guide editor (gap-analysis §5.12).** `catalog_items.sortOrder` exists (`db/schema.ts:107`) and `getActiveCatalog` already sorts by it (`db/queries.ts:947`), but no DnD UI on `app/admin/[tenant]/catalog/catalog-table.tsx`. Add `@dnd-kit/sortable` + drag handle column; persist via PATCH `/api/catalog/[itemId]`. Same drawer should gain a size-guide editor: `catalog_items.sizeGuide jsonb` is rendered on PDP but only seeded via `lib/data.ts`. Column headers as comma-list, rows as a tabular grid with add/remove. ~1.5d for both. (Note: also covered loosely by §4.7 "Catalog sortable / drag-to-reorder" — supersede that line when done.)

- [x] **PDP photo support — read `item.imageUrl` + UploadThing in admin drawer (gap-analysis §5.13).** ✅ shipped (PR #31, squash `10a50c0`). See `completed.md` §4.30.

- [ ] **`catalog_collections` table + Year-7 starter curation (gap-analysis §5.14).** Both UO and the competition use a single-axis taxonomy. The single largest order moment of the year (Year-7 enrolment) goes through 8 separate add-to-carts.
  - Phase 1 (this item): add `catalog_collections` (`id, tenantId, slug, name, kind: 'featured'|'year'|'sport'|'custom', sortOrder, isVisible`) + `catalog_item_collections` join table.
  - Keep the existing `category` enum (`Summer/Winter/Sports/Formal/Bags/Stationery`) as the default browse axis for back-compat — don't dilute it.
  - Render an optional "Featured" row above the category chips on `app/[tenant]/page.tsx` when the tenant has visible collections.
  - Seed NSBH + RGSH with a "Year 7 starter" curated collection.
  - Phase 2 (real bundles with single Add-all-to-cart via `catalog_bundles` table) tracked separately — large, defer until phase-1 ships and a school asks.
  - ~2–3d.

- [x] **Per-tenant homepage option (gap-analysis §5.17).** ✅ shipped (4 commits: cookie helper, `getPopularItems` query, `LandingScreen` component, `page.tsx` cookie branch). Cookie-gated landing on `/<tenant>` first visit — crest, motto, shop hours card, popular items grid (last 90 days), Browse Catalogue CTA (`router.refresh()`). 30-day `uo:visited:{slug}` cookie. Returning visitors go straight to catalogue unchanged.

- [x] **Desktop frame for parent shop (gap-analysis §5.18).** ✅ shipped via PR #32. `MobileShell` updated with `logoUrl?: string` prop threaded through 7 pages; desktop canvas styled as parchment-backed frame with school crest watermark, subtle shadow, and "Tip: open on your phone" line. 430px column width unchanged. See `completed.md` §4.31.

- [ ] **OTP / magic-link login option (gap-analysis §5.16).** Aligns with the stated auth direction (magic-link + Google sign-in, replacing the dropped "guest checkout" path). Check whether Neon Auth's `AuthView` (`app/auth/[[...path]]/page-client.tsx`) offers a magic-link or email-OTP path; if so flip the default and keep password as a fallback. Otherwise add "Email me a sign-in link" as a secondary action. Note §2.11 already verifies magic-link + Google are enabled in Neon Auth — this item is about surfacing them in the parent flow. Effort dependent on the Neon Auth SDK surface.

- [ ] **Account deletion + data export — APP-12 compliance (gap-analysis §5.19).** Within 90 days of launch. Add `/account` page with a "Danger zone" card: confirm-typed-email modal calls a Neon Auth deletion endpoint, then anonymises `orders.parentEmail` / `parentName` to `redacted-{hash}@uniformorder.online` (orders must remain for tax + refund traceability). `parent_children` cascades via existing FK. Data export: email a JSON of the parent's `parent_children` + `orders` on request. ~1d.

---

## 4. 🟢 Low — post-launch acceptable

| # | Item | Source |
|---|---|---|
| 4.3 | Bulk operator "Email parents" with real send (currently `mailto:`) | Orders board |
| 4.4 | i18n scaffolding for future non-NSW expansion (PDP §7 Phase 3) | PDP roadmap |
| 4.7 | Catalog sortable / drag-to-reorder | Prototype only |
| 4.12 | Catalog search — chips remain highlighted during active query (visual disconnect) — issue #27 | §3.11 follow-up |
| 4.13 | `getActiveCatalog` fetched twice per checkout (PI route + order route) — fine at ~60 SKUs; consider a small `SELECT itemId, label, price FROM catalog_variants WHERE tenantId = ?` price-only query, or `revalidateTag` caching, when catalog growth or latency makes it measurable | PR #29 review |

> Closed §4 IDs (preserved for cross-reference, no renumbering):
> - §4.1 / §4.9 / §4.10 / §4.11 — shipped, see `completed.md` §4.6–§4.10.
> - §4.6 — operator audit log, shipped 2026-05-11, `completed.md` §4.21.
> - §4.8 — Drizzle migrations were already file-tracked; original audit entry was incorrect.
> - §4.5 — inventory stock counts dropped 2026-05-11 as not a product fit (school shops fulfil from a storeroom; oversells absorbed operationally). PDP §3.2 softened to match. Do not re-raise without an explicit school request.
> - §4.2 — Dashboard "New product" now links to `/admin/[tenant]/catalog`; "Export" deleted as redundant with the Reports CSV exporter.

---

## 5. Suggested go-live checklist (one page)

> Items 1–4 of the original checklist are complete and have been moved to `docs/completed.md` §4.5.

1. [ ] Catalog seeded with full NSBH paper-form items (§3.1)
2. [ ] Accountant sign-off on GST report (§3.6)
3. [ ] Manual end-to-end test: parent orders → Stripe charge → operator marks ready → parent receives email → operator refunds one line → Stripe refund visible
4. [ ] Stripe Express account onboarded for NSBH (test mode first, then live): complete onboarding at Stripe Dashboard → Connect → Accounts, verify `account.updated` webhook syncs `stripe_charges_enabled = true` to tenants table, then re-run Test 3 smoke test (place order → partial refund → full refund → 409 on third attempt)
5. [ ] Ops follow-ups in §2.8 (live Stripe keys, prod DB URL, Hostinger env, prod domain + TLS, PostHog key verified)

The super-admin portal is now complete (see `completed.md` §4.16–§4.20); tenant onboarding from #3 onward can be self-served from `/platform/tenants/new` plus the branding editor on the tenant detail page.

---

## 6. Cross-reference — items merged in from `docs/FEATURE_AUDIT.md`

The former `docs/FEATURE_AUDIT.md` has been retired. Its outstanding items are tracked here as follows:

| Audit item | Tracked in |
|---|---|
| "Add another child" button on school picker | ✅ Done — `completed.md` §4.12; ops verifications → §2.11 |
| "Riley wore size X last year" hint (hardcoded) | ⛔ Dropped 2026-05-12 — wrong-child bug not worth fixing; removal tracked in §2.14. Parents can use order history (`/orders/[orderId]`) for past-size info. |
| Dashboard "New product" button not wired | ✅ Resolved 2026-05-11 — links to `/admin/[tenant]/catalog` |
| Dashboard "Export" button not wired | ✅ Resolved 2026-05-11 — deleted as redundant with Reports CSV export |
| Refund / exchange action on order detail | ✅ Done (see `completed.md` §4.1); E2E test pending → §5 checklist item 3 |
| Super-admin / platform portal — tenants list, provision wizard, billing overview, branding editor | ✅ Done — `completed.md` §4.16–§4.20 (PRs #14, #15, #16, #17, #18) |
| Missing NSBH catalog items (Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie) | §3.1 |
