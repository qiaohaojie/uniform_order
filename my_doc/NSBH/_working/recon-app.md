# Uniform Order — Feature Inventory & Competitive Gap Analysis

**Generated:** 2026-05-12  
**Codebase:** Next.js 16 (App Router, RSC), Postgres/Neon/Drizzle, Stripe Connect  
**Two main portals:** Parent shop (mobile-first), School admin (desktop sidebar), Platform console (operator)

---

## A. Parent Shop Journey — `app/[tenant]/`

### Key Pages & Flow

| Page | File | Capabilities |
|------|------|--------------|
| **Home / Tenant picker** | `app/page.tsx` | Lists all public, approved tenants from DB with branding (crest, accent color). Server-side filtering for visibility. |
| **Catalog browse** | `app/[tenant]/page.tsx` | Mobile grid of items, 5 category filters (Summer/Winter/Sports/Stationery), shows price range, tenant branding header, active-child context ("Shopping for Riley, Year 10"), bottom nav. Browsing gated by `isPubliclyListed && platformApprovalStatus === "approved"`. |
| **Item detail** | `app/[tenant]/item/[itemId]/page.tsx` | Garment vector SVG (on-brand accent color), product name, description, pricing, variant selector (size/fit), quantity picker. Previous-size hint from order history (`"Riley wore size 14 last year"`). "Add to cart" triggers `item_added_to_cart` PostHog event. Cart persists to localStorage. |
| **Cart** | `app/[tenant]/cart/page.tsx` | localStorage-driven, shows item lines with variant labels, qty, unit price, line total. Subtotal, GST (10%), delivery-method toggle (Pickup / Ship), final total. "Proceed to checkout" button. Cart survives tenant visibility changes (deliberate). |
| **Checkout** | `app/[tenant]/checkout/page.tsx` + `checkout-screen.tsx` | Requires auth (redirects to `/auth/sign-in` if missing, pre-fills student name/year/roll if active child selected). Parent name, mobile, student name, year, roll, refund-policy checkbox. Stripe PaymentIntent creation (POST `/api/stripe/payment-intent`), destination charge to school's Stripe Connect account. Delivery method locked (pickup/ship). Parent note textarea. Events: `payment_attempted`, `payment_failed`, `delivery_method_selected`. |
| **Order placed (receipt)** | `app/[tenant]/order/placed/page.tsx` | Success screen: checkmark, order ID, email confirmation, total, delivery method, school hours (pickup) or shipping address. Accessible via query params (order placement stores `?orderId=…&delivery=…&total=…`). Survives if tenant later hidden. |
| **My Orders (parent)** | `app/orders/page.tsx` | Auth-required. Lists all orders for logged-in parent (via email match). Shows order ID, date, total, status badge, delivery method. Leads to order detail. |
| **Order detail (parent)** | `app/orders/[orderId]/page.tsx` | Full receipt view: student details, items + variant labels, pricing, delivery method, school contact, refund policy link. Shows status: new/ready/collected/refunded. Email sent notifications. |
| **Refund policy** | `app/[tenant]/refund-policy/page.tsx` | Rendered from `tenant.legalRefundPolicyHtml` (admin-edited, versioned). Includes checkout consent step. |
| **Auth** | `app/auth/[[...path]]/page.tsx` | Neon Auth integration: sign-in, sign-up, email verification, password reset. Session stored in Neon Auth schema (`neon_auth.sessions`). |
| **Legal** | `app/privacy/page.tsx`, `app/terms/page.tsx` | Platform-wide static pages. |

### Cross-Tenant Navigation & Multi-Tenancy

- **Home** lists all public tenants from DB; each has unique slug (id), branding (accent color, crest SVG), name.
- **Active child** (localStorage `uo:student:v1`) is tenant-scoped; switching schools clears it.
- **Browsing gate:** catalog + item pages enforce `isPubliclyListed && platformApprovalStatus === "approved"`. Platform admins bypass via `isPlatformAdminEmail`.
- **Cart/checkout/order pages** skip browsing gate so parents retain access to in-flight carts if school hides.

### Mobile Shell & UX

- **Max width:** 430px (mobile-first, Newsreader serif aesthetic).
- **Bottom nav:** "Shop" (catalog), "Orders" (order list), always visible, tenant-branded accent.
- **Viewport fixes:** §3.9 recently shipped (edge cases like notch handling, form inputs below keyboard, scrollbar clipping).
- **Garment vectors:** custom SVG silhouettes for each item ID, colored with tenant accent.
- **Print stylesheet:** A4 pages, 12mm margins, shipped in §3.7 (pick-slip printing for admin; affects all `window.print()` calls).

---

## B. School Admin Portal — `app/admin/[tenant]/`

### Scope & Authentication

- **Entry point:** `app/admin/[tenant]/` requires Neon Auth session + either `isPlatformAdminEmail()` or `isTenantOperatorEmail()`.
- **Operator email:** single school email stored in `tenants.shopEmail` (no RBAC yet; all admins for a school have full access).
- **Desktop sidebar:** "Dashboard", "Orders", "Catalog", "Upload", "Reports", "Settings" tabs.

### Pages & Capabilities

| Page | File | Capabilities |
|------|------|--------------|
| **Dashboard** | `app/admin/[tenant]/dashboard/page.tsx` | 3 KPI cards: live order count by status (new/packing/ready/collected), daily/weekly/monthly trends (from `orders` table). TBD: full dashboarding; today minimal. |
| **Orders (Kanban)** | `app/admin/[tenant]/orders/page.tsx` | Kanban board: columns `new → packing → ready → collected`. Each card: order ID, student name, date, status badges. Drag-to-move (state persists to DB via PATCH `/api/orders/[orderId]`). Live count badge on topbar. "Print pick slips" button: prints all orders in `new` status as batch A4 pages (each slip includes student details, item lines, barcode, tenant branding, parent note if present). Recently shipped (§4.23). Async picks happen via WebSocket or polling for real-time updates (TBD). |
| **Order detail** | `app/admin/[tenant]/orders/[orderId]/page.tsx` | Full order view: student + parent details, all items (name, variant, qty, price), delivery method, total with refund deductions, GST, net. Actions: status-change buttons (new → packing → ready → collected), "Send ready notification" (triggers transactional email + PostHog event `order_ready_notification_sent`). Refund UI: issue refund button (PATCH `/api/orders/[orderId]/refund`), shows all refunds issued with amounts and dates. "Print pick slip" button (single slip, same visual as batch). Audit trail: per-order activity timeline showing who changed status, issued refunds, sent emails, with relative timestamps. |
| **Catalog** | `app/admin/[tenant]/catalog/page.tsx` | Item grid (sourced from `catalog_items` table, not static `CATALOG` in data.ts). Each item: name, category, variants table (size/fit, qty, price). Edit item name/description. Bulk edit variants (price, qty). Sort by category/name. Seed-driven: NSBH catalog has 12 items, RGSH inherited same set pending school sign-off (§2.12). |
| **Upload** | `app/admin/[tenant]/upload/page.tsx` | Bulk catalog import (not live yet — mostly scaffolding). Planned: CSV → `catalog_items` + `catalog_variants`. UploadThing integration ready. |
| **Reports** | `app/admin/[tenant]/reports/page.tsx` | Summary cards: total revenue (6mo), order count (6mo), avg order value, GST collected. Export to CSV button (all order data for accounting). Drill-down TBD. |
| **Settings** | `app/admin/[tenant]/settings/page.tsx` | Edit tenant name, branding (crest upload, accent color picker). Stripe Connect account status (email, charges enabled, payouts enabled). Legal editor drawer: edit refund policy HTML (save creates new version in `tenant_legal_versions`). Delete tenant action (soft-delete). Super-admin approval status. |

### Operator Features & Fulfillment

- **Status workflow:** pending_payment → new (order placed) → packing → ready → collected → refunded / partially_refunded.
- **Refunds:** issue partial/full refund, tied to Stripe refund API (destination account). Deducted from order total on receipt.
- **Notifications:** "Send ready for pickup" email (transactional, template `OrderReady.tsx`, includes refund-policy link).
- **Audit trail:** all mutations logged to `audit_events` table (actor email, role, action, target type/id, payload). Visible on order detail + tenant activity feed.
- **Print picking:** A4 slip with barcode, student/item details, parent note, branded footer (§3.7 print stylesheet shipped).

---

## C. Platform Console — `app/platform/`

### Scope

- **Operator:** super-admin only (`isPlatformAdminEmail`).
- **Purpose:** tenant onboarding, approval, branding, billing, auditing.
- **Entry:** `/platform` redirects to `/platform/tenants`.

### Pages & Capabilities

| Page | File | Capabilities |
|------|------|--------------|
| **Tenant list** | `app/platform/tenants/page.tsx` | Table: all tenants (DB-sourced), columns: ID, name, school email, Stripe account status (connected/pending/rejected), platform approval status (draft/approved/rejected), KPIs (revenue, order count). Filters: approval status, Stripe status. Actions: detail drill-down, bulk approval. |
| **Tenant detail** | `app/platform/tenants/[tenantId]/page.tsx` | Tabs: General (basic info, legal versions dropdown), Catalog (item list, variant editing), Branding (color picker, crest upload), Billing (Stripe payout history, GST remittance estimates), Activity (audit log filtered by tenant). Provision wizard (if tenant in draft). |
| **Billing tab** | Details: Stripe account KYC status, payout method, balance, transaction history. GST report: remittable GST (last 6mo, refreshed daily). |
| **Approval workflow** | Tenant created in draft → super-admin reviews → approves (sets `platformApprovalStatus = "approved"`, `platformApprovedBy`, `platformApprovedAt`) → catalog browsing + checkout unlock. Rejection also supported (sets rejection reason). |
| **Branding editor** | Drawer: accent color (oklch picker, stored as CSS var), crest image (UploadThing to CDN). Real-time preview in parent-shop mockup. |

### Operator Features

- **Tenant provisioning:** provision wizard (Phases 1–6 complete, per §4.16–§4.20):
  1. Basic info (school name, address, email)
  2. Branding (color, crest)
  3. Legal setup (refund policy HTML)
  4. Stripe Connect auth (OAuth → Stripe account link)
  5. Catalog seeding (clone from template or import)
  6. Launch (set approval status)
- **Audit log:** operator-level mutations recorded per tenant + global. Can view who created/modified tenants, approved them, changed branding.
- **GST & taxation:** GST collected per order (10% AUS), remittable amount calculated, available for export.

---

## D. Data Model

### Core Tables

| Table | Purpose | Key Columns | Tenant-Scoped? |
|-------|---------|-----------|---|
| **tenants** | School/shop metadata | id (slug), name, shopEmail, stripeAccountId, platformApprovalStatus, isPubliclyListed, currentLegalVersionId, accentColor, createdAt, updatedAt | N/A (1 row per school) |
| **tenant_legal_versions** | Versioned legal docs (T&Cs, refund policy) | id (uuid), tenantId, type (text/url), content (HTML), createdAt | Yes (tenant FK) |
| **catalog_items** | Item master | id, tenantId, name, category (Summer/Winter/Sports/Stationery), description, displayOrder, isPubliclyListed, createdAt, updatedAt | Yes (tenant FK) |
| **catalog_variants** | Item variants (size/fit) | id, itemId, size (text), qty (in stock), unitPrice, tenantId (denormalized) | Yes (via itemId FK) |
| **orders** | Order records | id, tenantId, parentEmail, parentName, parentMobile, studentName, studentYear, studentRoll, parentNote, delivery (pickup/ship), status, subtotal, gst, total, stripePaymentIntentId (unique, nullable), stripeRef, refundPolicyAcceptedAt, createdAt, updatedAt | Yes (tenant FK) |
| **order_lines** | Order line items | id, orderId, itemId, itemName (snapshot), variantLabel (snapshot), qty, unitPrice, lineTotal | Yes (via orderId FK) |
| **order_refunds** | Partial/full refunds | id, orderId, amount, reason, operatorUserId (Neon Auth FK), stripeRefundId (unique), createdAt | Yes (via orderId FK) |
| **parent_children** | Saved student profiles | id, parentId (Neon Auth FK), tenantId, name, year (7–12), rollClass, lastConfirmedAt, createdAt | Yes (tenant FK) |
| **audit_events** | Mutation log (all portals) | id, createdAt, tenantId (nullable), actorEmail, actorRole (parent/operator/admin), action (text), targetType (order/item/tenant), targetId, payload (jsonb) | Partially (tenantId optional) |

### Neon Auth Tables (External)

- **neon_auth.user** — session user profile (email, name, created_at).
- **neon_auth.sessions** — active auth sessions.
- Referenced from schema but excluded from Drizzle kit introspection via `external-schema.ts` (see §4.9 completed work).

### Key Relationships & Constraints

- **Tenant → Orders:** ON DELETE CASCADE (order deleted if school removed).
- **Tenant → Catalog items:** ON DELETE CASCADE.
- **Order → Order lines:** ON DELETE CASCADE.
- **Neon Auth user → Orders/refunds:** ON DELETE SET NULL (historical audit OK if user deleted).

### Indexing Strategy

- **Orders:** `(tenantId, parentEmail)` for parent lookup; `stripePaymentIntentId` unique for idempotency.
- **Audit events:** `(tenantId, createdAt DESC)` (tenant activity), `(targetType, targetId, createdAt)` (order timeline), `(actorEmail, createdAt)` (operator audit).
- **Parent children:** `(parentId)` for session child list.
- **Order lines:** `(orderId, itemId)` for batch picking queries.

---

## E. Cross-Cutting Capabilities

### Authentication & Authorization

**Neon Auth (Better Auth):**
- Sign-in/sign-up, email verification, password reset, session management.
- Session stored in Neon Auth schema; Uniform Order reads via `getAuth().getSession()`.
- Public sign-up enabled (no pre-approval; all signups allowed).

**Authorization helpers** (`lib/auth/authorization.ts`):
- `isPlatformAdminEmail(email)` — whitelist from env var `PLATFORM_ADMIN_EMAILS`.
- `isTenantOperatorEmail(userEmail, tenantEmail)` — single operator per school (email match).
- `ensureTenantAccess(user, tenantEmail)` — platform admin OR school operator; returns 403 if neither.
- `ensureParentEmailAccess(user, parentEmail)` — platform admin OR parent email match; returns 403 if neither.

**Scope:**
- Parent routes: no auth required for browsing/checkout (via Neon Auth session).
- Admin routes: auth + operator/admin authorization required; all routes check in layout.
- API routes: `requireSessionUser()` + per-route authorization (ensureTenantAccess / ensureParentEmailAccess / rate limiting).

### Payments

**Stripe Connect (Standard):**
- School Stripe account linked via OAuth in platform console (provision wizard Phase 4).
- PaymentIntent created with `on_behalf_of: school_stripe_account_id` (destination charge).
- Webhook handler (`/api/stripe/webhook`) listens for `payment_intent.succeeded`, `charge.refunded`, records Stripe ref in `orders.stripeRef`.
- Refund flow: operator issues refund via UI (PATCH `/api/orders/[orderId]/refund`) → Stripe refund created (destination account) → record in `order_refunds` table.
- Idempotency: PaymentIntent ID stored in `orders.stripePaymentIntentId` (unique index); order creation atomic with payment (via `db.batch()` — §4.11 completed).

**Smart defaults:**
- GST (10% AUS) calculated server-side from order subtotal.
- Delivery method locked at checkout (pickup/ship); affects total + fulfillment.
- Platform approval gate on PaymentIntent creation (403 if `platformApprovalStatus !== "approved"`).

### File Uploads

**UploadThing integration:**
- Crest images (school logo, uploaded in settings).
- Bulk catalog CSV (scaffolded in upload page; not yet live).
- Stored on CDN; URLs in DB.

### Analytics & Observability

**PostHog events captured:**

*Parent shop:*
- `item_added_to_cart` (itemId, tenantId, variantLabel, qty)
- `checkout_started` (tenantId, total, itemCount)
- `payment_attempted` (tenantId, amount, method)
- `payment_failed` (tenantId, reason)
- `delivery_method_selected` (method: pickup|ship, tenantId)

*Admin portal:*
- `order_status_advanced` (orderId, newStatus, tenantId)
- `order_ready_notification_sent` (orderId, tenantId)

*Platform console:*
- `tenant.draft_created` (tenantId, email)
- `tenant.stripe_account_linked` (tenantId)
- `tenant.catalog_cloned` (tenantId, fromTemplate)
- `tenant.went_live` (tenantId)

*Errors:*
- `serverCaptureException(label, error, context)` for API failures (order detail GET/PATCH, refund POST, size-hint GET, etc.).

**Audit logging:**
- All operator/admin mutations logged to `audit_events` table (§4.21 shipped).
- Visible on order detail (timeline) + tenant activity feed (operator log).
- Includes actor email, role (parent/operator/admin), action name, target type/id, payload (jsonb).

### Email (Transactional)

**Scope:** order confirmation, "ready for pickup" notification.

**Templates:**
- `OrderConfirmation.tsx` — sent on order placement, includes receipt details, refund-policy link.
- `OrderReady.tsx` — sent when operator marks order status "ready", includes pickup/ship details, refund-policy link.

**Delivery:** TBD (email service integration pending; code complete per §1.4).

### Search

- **No search UI implemented.** Catalog browse uses static category filtering (5 categories).
- **Size hint search:** `getPreviousSizeHint(tenantId, email, itemId)` joins order history, returns previous variant for student (GET `/api/orders/size-hint`).

### SEO & Metadata

- **Metadata API:** `app/layout.tsx` exports platform-wide metadata (title, description).
- **Tenant pages:** no per-tenant metadata yet (generate at runtime if needed).
- **Sitemap/robots.txt:** not implemented.
- **Canonical URLs:** item detail page has 308 permanent redirect for legacy ID format (prefixed canonicalization).

### Accessibility (A11y)

- **Audit shipped (§3.8):** form labels, color contrast, ARIA landmarks, keyboard navigation, screen reader hints.
- **Components:** HeroUI v3 + HeroUI Pro (React Aria based, composable, a11y-first).

### Print

- **Pick-slip stylesheet (§3.7):** global `@media print { @page { size: A4; margin: 12mm } }` in `index.css`.
- **Single-slip print:** order detail page, print button triggers `window.print()`.
- **Batch-slip print (§4.23):** orders page, prints all `new` status orders as multi-page A4 PDF.

---

## F. Self-Identified Gaps (from `docs/remaining_work.md`)

### 🔴 Blockers (All Resolved)

- ✅ Stripe Connect payments routing — destination charge to school account (§1.1)
- ✅ Admin auth guard — operator email check on routes (§1.2)
- ✅ Parent API auth — email-based access control (§1.3)
- ✅ Transactional email — order confirmation + ready notification (§1.4, code complete)
- ✅ Refund policy UI — checkout consent + policy page (§1.5)
- ✅ Legal pages — Terms, Privacy (§1.6)
- ✅ Platform approval gate — prevents checkout if not approved (§1.7)

### 🟠 High Priority (v1-required)

**Outstanding:**

- [ ] **Prod NSBH seed:** Run `node scripts/seed.mjs` against production DB (idempotent, ON CONFLICT ready).
- [ ] **RGSH catalog:** Needs school sign-off on 12-item catalog (currently inherits NSBH). Capture in onboarding workflow.
- [ ] **Stripe Connect onboarding sync:** Verify school's Stripe account KYC completion before marking `platformApprovalStatus = "approved"`. Polling/webhook TBD.
- [ ] **Catalog management:** Live bulk import (CSV upload to `catalog_items` + variants) — scaffolded, not integrated.
- [ ] **Multi-operator RBAC:** Support multiple admins per school with role-based perms (today: single operator email).

### 🟡 Medium Priority (soft-launch OK)

- [ ] **Refund-policy page content:** Template exists; schools need to provide their own HTML (not auto-generated).
- [ ] **GST/BAS report:** Auditor sign-off on GST calculation + remittance workflow.
- [ ] **Print QA:** Manual A4 print testing in Chrome + Safari (pick-slip layout, barcode rendering, no Kanban bleed).
- [ ] **Platform /terms page:** Deferred indefinitely (no current usage).

### 🟢 Low Priority (post-launch)

- [ ] Real-time order updates (Kanban, per-order detail) — today polling-based.
- [ ] Advanced catalog search (product search, filters by size, price range).
- [ ] Parent account linking ("add another child" workflow — scaffold exists in routes but not fully UX'd).
- [ ] Bulk upload CSV preview & validation.
- [ ] Invoice generation for parents (PDF receipt export).

---

## G. Completed Work Milestones (Last 14 Days)

1. **§4.14 NSBH catalog seed** — 9 SKUs (8 items) added to DB + data.ts (shorts, socks, scarf, prefect tie, soccer jersey, swimming briefs, 2x exercise books, ring binder). Paper form reconciliation complete.
2. **§4.15 Catalog variant alignment** — untangled shirt/trousers/tie rows (paper form mismatch in original seed). Variants now match school's actual offering.
3. **§4.8 "Riley wore size X last year" hint** — order history lookup (DB query + API endpoint) integrated into item detail. Shows previous size if exists, else no fallback.
4. **§4.21 Operator audit log** — durable `audit_events` table + 4 event-type templates. Visible on order detail (timeline) + tenant activity feed (operator console). PostHog event names migrated to dotted form.
5. **§4.23 Batch pick-slip print** — "Print pick slips" button on orders Kanban, prints all `new` orders as A4 pages. Shared `<PickSlip>` component, print stylesheet shipped.
6. **§3.8 A11y audit** — form labels, contrast, ARIA, keyboard nav fixed.
7. **§3.9 Mobile viewport edge cases** — notch handling, scrollbar clipping, form input visibility below keyboard.
8. **§3.7 Print stylesheet** — global A4 + 12mm margin rule in index.css.

---

## H. Strengths (What Uniform Order Does Well)

1. **Multi-tenant isolation:** tenant slug in route, `tenantId` FK constraint, browsing gate, order scoping all prevent data leakage. Super-admin visibility for ops.
2. **Stripe Connect integration:** destination charges route payouts directly to school account; idempotent payment flow with PaymentIntent storage; webhook reconciliation for refunds.
3. **Operator audit trail:** every mutation (order status, refund, branding edit, approval) logged with actor, timestamp, payload. Visible to school + platform ops.
4. **School branding:** per-tenant accent color (oklch CSS var), crest SVG, refund policy HTML. Parent shop reflects school's identity end-to-end.
5. **Print-first fulfillment:** pick-slip UX optimized for batch printing (A4 pages, barcodes, parent notes). Warehouse-friendly.
6. **Accessibility-focused:** HeroUI v3 (React Aria base), a11y audit shipped, form labels, color contrast, keyboard nav.
7. **Operational awareness:** platform console provides super-admin dashboard (tenant KPIs, approval queue, Stripe status, activity log). Schema designed for auditing (tenantId FK, soft-deletes, createdAt/updatedAt).
8. **GST-aware:** order total includes 10% GST; remittable amount tracked per tenant. Ready for AU tax compliance.

---

## I. Most Notable Gaps

1. **Live updates:** Kanban order board refreshes via polling (not WebSocket/SSE). Order detail refunds do not auto-refresh.
2. **Catalog bulk import:** CSV upload scaffolded but not hooked to DB. Admin editing single items possible; bulk workflows not yet live.
3. **Multi-operator RBAC:** single operator email per school; no roles, no fine-grained permissions.
4. **Transactional email:** code ready; email service (SendGrid, Resend, etc.) not yet wired.
5. **Search:** no catalog search; category filters only. No product search, size/price filtering.
6. **Parent account linking:** "add another child" workflow exists but not fully integrated into checkout/onboarding UX.

---

## J. Suggested Chunking Axes for Deep-Dives

**By feature area:**
1. **Payment & Stripe:** PaymentIntent creation, destination routing, refund reconciliation, webhook handler, idempotency, compliance gate.
2. **Multi-tenant data access:** route slug validation, FK constraints, browsing gate, super-admin bypass, audit log isolation.
3. **Fulfillment workflow:** Kanban board state machine (new→packing→ready→collected), batch pick-slip printing, refund UI, audit timeline.
4. **Admin portal catalog:** item/variant CRUD, bulk upload scaffolding, image management (UploadThing), variant inventory.
5. **Platform operator console:** tenant provisioning wizard, approval workflow, branding editor, billing/GST tracking, activity log.
6. **Parent experience:** checkout flow, delivery method toggle, refund policy acceptance, order history, size-hint context.
7. **Auth & authorization:** Neon Auth session, role-based guards (isPlatformAdminEmail, isTenantOperatorEmail), per-endpoint rate limiting.
8. **Analytics & observability:** PostHog event taxonomy, exception logging, audit event schema, operator timeline rendering.

---

## K. Tech Stack Summary

- **Framework:** Next.js 16 (App Router, RSC, server actions).
- **Database:** Postgres (Neon), Drizzle ORM (migrations, type-safe queries).
- **Auth:** Neon Auth (Better Auth compatible), Neon Auth schema, session in DB.
- **Payments:** Stripe Connect (Standard), PaymentIntent API, destination charges, refund API.
- **File uploads:** UploadThing (images to CDN).
- **Analytics:** PostHog (event capture, exception logging).
- **UI:** HeroUI v3 + HeroUI Pro (React Aria base), Tailwind CSS v4, oklch color system.
- **Email:** TBD (scaffolded; code ready, integration pending).
- **Deployment:** Vercel (standard Next.js hosting).

