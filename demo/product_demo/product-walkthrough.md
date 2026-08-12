# UniformOrder — product walkthrough

This document is the investor/buyer narrative. Read it alongside `demo-playbook.md` before any live demo. Claims are labelled where the distinction between shipped and planned matters.

---

## 1. The problem

Australian schools sell uniforms the same way they did thirty years ago. The baseline is a paper order form handed to parents at orientation, filled in by hand, returned with a cheque or cash, and stacked in a folder until someone finds time to enter it into a spreadsheet. The uniform shop is rarely a dedicated function: it is usually owned by a P&C committee volunteer or a single part-time staffer who also handles excursion money, lost property, and canteen rosters.

The operational pain is predictable. Forms get lost in school bags. Cheques bounce or go uncashed for months. GST tracking is done by hand in Excel, and the totals rarely match the bank statement on the first pass. There is no audit trail — if a parent disputes whether their order was received, there is no record. At the start of each school year, when every family in the school tries to buy at once, the errors compound: wrong sizes, duplicate orders, missed refunds, and a reconciliation exercise that can consume an entire weekend.

The result is that a P&C committee spends upwards of twenty hours per term on uniform administration — time that could go to canteen fundraising, reading support, or simply not burning out the three volunteers willing to do the work.

---

## 2. The platform

UniformOrder is a multi-tenant SaaS platform with one tenant per school. Each tenant is an isolated environment: its own catalog, its own order history, its own branding, and its own Stripe Connect account so the school remains the seller of record for every transaction.

There are two primary interfaces. The parent shop is mobile-first, constrained to a 430 px shell so it feels native on any phone: parents browse the catalog, add items to cart, and check out through a Stripe Payment Element that supports Apple Pay and Google Pay. The entire flow — catalog to confirmation — is designed to complete in under 90 seconds. The school operator interface is a full desktop admin: an orders Kanban, catalog management, reports, and settings. It is optimised for the Monday-morning routine of a part-time uniform shop coordinator who opens the dashboard, works through the pick queue, and closes the laptop.

A third interface, the platform console, is currently in design. It will give the UniformOrder team (us) visibility across all tenants: approval workflows, Stripe Connect status, billing, and oversight. The design spec is at `docs/superpowers/specs/2026-05-09-platform-portal-design.md`. Today's `/platform` route is a functional stub backed by the same data model the full console will use.

---

## 3. Personas

**Platform admin (us):** Approves new schools before they go live, monitors Stripe Connect verification status across all tenants, and manages platform billing. The platform admin is identified by email address via the `PLATFORM_ADMIN_EMAILS` environment variable — no separate user type in the database is required.

**School operator:** The P&C volunteer or uniform shop staffer who runs the shop day-to-day. They fulfil orders on the Kanban, manage the catalog (items, variants, sizes, images), configure the school's refund policy, and pull the monthly CSV for the accountant. Most operators are not technical; the interface is designed to be navigable without training.

**Parent:** Places orders for their child or children, typically at the start of a school year or when a child moves up a year level. Parents return infrequently, so low friction at first use matters more than power features. They authenticate via magic-link email — no password to forget.

---

## 4. End-to-end workflow

A school begins by requesting access through the platform. The platform admin reviews the application, approves the tenant, and the school operator receives their invite. The operator spends fifteen minutes configuring branding (school name, accent colour, motto), setting the refund policy, and adding catalog items with variants and size guides. If they have a Stripe account, Stripe Connect onboarding takes another ten minutes; once Stripe verifies the account, payouts are enabled and the school is live.

Parents navigate to the school's URL — `/[tenant]` — browse the catalog on their phone, and add items to their cart. At checkout they fill in student details, acknowledge the refund policy, and pay through the Stripe Payment Element. Payment is processed directly between the parent and the school via Stripe Connect; UniformOrder takes a platform fee and never holds funds. On payment confirmation, the order is written to the database and appears immediately in the operator's Kanban.

The operator works through the Kanban each session: orders move from `to_prepare` to `ready` (triggering a collection email to the parent) or to `needs_attention` if stock is short (triggering a hold email with the operator's reason). A print-ready pick slip is available on each order detail page. Refunds are processed in-app: the operator selects a line, enters a reason, and the Stripe Connect refund fires immediately. The Stripe webhook reconciles the refund record automatically.

At the end of each month or term, the operator opens the reports page, sets a date range, and exports a CSV. The CSV includes GST-inclusive AUD totals and flags refunded lines. Today the operator's accountant uses this file to complete BAS manually; a native BAS-format export is on the roadmap (see Section 5, BAS export).

---

## 5. Feature deep-dives (with implementation status)

The labels below reflect the state of the codebase as of 2026-05-17. Eight features are fully implemented and live in the demo environment. Three are in progress or in design.

### Invite-based auth — ✓ implemented

Authentication is handled by Neon Auth. Parents sign in via magic-link — they enter their email, receive a one-time link, and land in the parent shop. There is no password, no registration form, and no OAuth dependency on a third party beyond Neon. Operators are identified by email match against `tenants.shopEmail`; platform admins are identified by the `PLATFORM_ADMIN_EMAILS` environment variable. The RBAC helpers (`getSessionUser`, `requireSessionUser`, `isPlatformAdminEmail`, `isTenantOperatorEmail`) live in `apps/web/src/lib/auth/authorization.ts` and are called on every server action and API route that touches protected data.

### Tenant configuration — ✓ implemented

Each school configures its own identity: display name, accent colour, motto, logo, physical address, contact email, shop hours, and a workflow mode toggle (standard vs. split-status fulfilment). Legal and refund policy text is versioned: every edit creates a new `tenantLegalVersions` record, and the version number is stored on each order so there is never ambiguity about which policy a parent acknowledged. Stripe Connect status (connected, verified, payouts enabled) is surfaced in the settings UI and is a prerequisite for live checkout.

### Catalog management — ✓ implemented

The catalog is structured as items with variants and sizes stored as JSONB. Each item has a category, display order (drag-to-reorder in the admin UI), per-item size guide, image URL, active toggle, and price. Image upload is handled by UploadThing and is gated on the tenant's platform approval status: an unapproved tenant cannot upload images, preventing catalog abuse before a school is vetted.

### Parent ordering — ✓ implemented

The parent shell (`MobileShell`) enforces the 430 px width constraint so the experience is consistent across devices. The cart is stored in `localStorage` under the key `uo:cart:v1` — no login required to browse and build a cart. On checkout, the parent must acknowledge the school's current refund policy before payment is accepted; the acknowledgement timestamp (`refund_policy_accepted_at`) is stored on the order along with the `legalVersionId`. Payment is handled by the Stripe Payment Element, which supports card, Apple Pay, and Google Pay.

### Order management — ✓ implemented

The Kanban board is the operator's primary interface. Orders move through defined lifecycle states via the `executeTransition` helper, which enforces authentication, optimistic concurrency (CAS), and appends an audit event in a single atomic batch. From the order detail page, the operator can mark an order ready (sending a collection email), place it on hold with a reason (sending a hold email), print a pick slip, or initiate a refund. Refunds call the Stripe Connect API and write to the `orderRefunds` table; the webhook confirms and reconciles.

### Reports & CSV export — ✓ implemented

The reports page accepts a configurable date range (capped at 60 days in the reports view; the Kanban board view caps the completed tail at 30 days for query performance). The export is a CSV with one row per order, including GST-inclusive AUD totals, refund flags, and student details. The 30-day Kanban cap is a query optimisation and does not affect the export.

### Refund policy versioning — ✓ implemented

The `tenantLegalVersions` table stores a numbered sequence of refund policy texts alongside the seller-of-record declaration and ACL acknowledgement. Every time an operator saves a new policy, a new version is created — existing orders always reference the version that was in effect at the time of purchase. The parent's acknowledgement is timestamped at checkout via `refund_policy_accepted_at` on the order record. This creates a complete, immutable audit trail for any payment dispute.

### Audit events — ✓ implemented

Every operator state-changing action appends a row to the `audit_events` table. The schema captures actor email, actor role, tenant, target entity type and ID, event type, and a freeform JSON payload. The taxonomy covers 12 event types spanning order transitions, refunds, catalog edits, settings changes, and operator sign-in. Rows are indexed by tenant and timestamp for fast lookups and by target entity for order-level audit views. The table is append-only: no update or delete path exists in the application code.

### BAS export — 🚧 planned, not currently implemented

The CSV export today includes GST per order (calculated as `amount / 11` for standard-rated items), which gives the operator's accountant everything needed to complete a Business Activity Statement manually. A dedicated BAS-format export — quarterly summary, ATO field codes, pre-filled period headers — is on the product roadmap. The current workflow is: export CSV, accountant pivots in Excel. The native BAS export is a near-term priority once the pilot school cohort confirms the CSV column mapping meets their accountant's expectations.

### Bulk upload — 🚧 planned, partial route exists

The route shell at `/admin/[tenant]/bulk` exists but the CSV-import flow is not implemented. The feature is planned for v1.1: operators will be able to upload a CSV of catalog items (name, variant, size, price) to populate or update the catalog in bulk, replacing the current one-by-one item creation. This unblocks schools migrating from a spreadsheet-managed catalog.

### Platform portal — 🚧 in design

The full platform console — DB-backed tenant listing, approval workflow, Stripe Connect oversight, billing management — is designed in `docs/superpowers/specs/2026-05-09-platform-portal-design.md`. The data model is already in place (the `tenants` table carries `platformApprovalStatus`, `stripeAccountId`, and related fields), and the RBAC layer recognises the platform admin role. The `/platform` route today is a functional stub. UI build is the next sprint after the current demo milestone.

---

## 6. Compliance & trust

All production data is stored in the Neon Sydney region, satisfying Australian data sovereignty requirements. No student or parent data crosses a jurisdictional boundary to reach the database. Payment card details are never stored in UniformOrder's database or code: Stripe holds all payment instrument data, and UniformOrder stores only the Stripe payment intent ID and outcome. Parent PII is limited to name, email address, and mobile number — no date of birth, no Medicare number, no data that would trigger enhanced privacy obligations under the Australian Privacy Act.

The three-tier RBAC model (platform admin / school operator / parent) is enforced at the server layer on every action and API route via the `authorization.ts` helpers. A parent cannot access another tenant's catalog, another parent's orders, or any operator function. An operator cannot access another tenant's data or the platform console. The enforcement is not middleware-only: each server action re-validates the calling user's identity and role before touching data.

Every operator action that changes state is recorded in the `audit_events` table with actor identity, timestamp, tenant, and payload. The 12-event taxonomy covers the full lifecycle of an order and catalog item. If a P&C committee or school leadership asks who processed a refund, when, and with what reason, the answer is retrievable in seconds. Order records are retained indefinitely to match standard school records-retention expectations. An automated retention policy is planned for v1.2 but not currently implemented.

Refund policy versioning means every order is permanently linked to the exact policy text the parent acknowledged at checkout. This is the first line of defence against payment disputes and provides the school with documentary evidence that the parent was informed of the terms before payment.

---

## 7. Demo narrative arc

**Before.** The uniform shop volunteer arrives on a Monday morning with a folder of paper forms collected over the week. She spends the first hour transcribing names, sizes, and amounts into a spreadsheet, crossing out the ones paid by cheque (already banked, hopefully), flagging the ones paid in cash (needs to be counted against the tin). Two forms are unreadable. One cheque is post-dated. The GST column doesn't sum correctly. This is every term, for every school, across approximately 9,400 schools nationally.

**The product moment.** Open the parent shop on a phone. Browse the catalog. Tap polo shirt, size 10. Tap jumper, size 12. Tap checkout. Student name, year level, roll class. Accept the refund policy. Tap Pay. Under 90 seconds. The order lands in the operator's Kanban before the parent puts their phone down. The operator opens the Kanban, picks the order, taps Mark Ready. The parent receives a collection email. At month-end, the operator exports a CSV. The accountant completes the BAS from that file in one afternoon — and once the native BAS export ships, even that step is a click.

**Business outcome.** A P&C committee running UniformOrder saves approximately 20 hours per term on uniform administration. Error rates drop to near zero because there is no transcription step. Reconciliation moves from an all-weekend exercise to a single afternoon. Parents stop losing forms. Cheques stop bouncing. Volunteers stop burning out.

**Expansion.** The immediate market is Australian independent and state schools with uniform shops. There are approximately 9,400 schools nationally. The model extends naturally to house shirts, sports carnival merchandise, formal event tickets, and other school-managed sales where the current workflow is a paper form and a folder. Every one of those use cases is served by the same multi-tenant platform.

---

## 8. Closing claims (labels mandatory)

Every claim made aloud during the demo must be traceable to one of the labels below. Read this section before presenting; the live narration should stay calibrated to what is shipped versus what is coming. This section should be read alongside `demo-playbook.md`.

| Claim | Label |
|---|---|
| Parent completes checkout in under 90 seconds | ✓ live — tested against seeded demo catalog |
| Operator marks order ready in one click | ✓ live — `executeTransition` helper, Kanban board |
| Ready email sent to parent on status change | ✓ live — email action in order transition |
| Audit log captures who clicked, when, from what actor | ✓ live — `audit_events` table, 12-event taxonomy |
| Refund fires to Stripe Connect from in-app action | ✓ live — Stripe Connect API + webhook reconcile |
| GST broken out in CSV export | ✓ live — reports page, configurable date range |
| All data stored in AU (Neon Sydney region) | ✓ live — production project `super-cell-03401356` |
| No card data stored by UniformOrder | ✓ live — Stripe holds all payment instrument data |
| Refund policy versioned; parent acknowledgement timestamped | ✓ live — `tenantLegalVersions`, `refund_policy_accepted_at` |
| Magic-link login for parents, no password required | ✓ live — Neon Auth magic-link flow |
| School is seller of record (Stripe Connect standard) | ✓ live — Connect type: standard, school's own Stripe account |
| ~20 hours/term P&C admin time saving | 🚧 positioning — derived from pilot feedback and paper-form workflow analysis; to be validated with first three paying schools |
| ~9,400 schools nationally (TAM anchor) | 🚧 positioning — ACARA published school count; not all schools have uniform shops |
| Native BAS-format export (quarterly, ATO field codes) | 🚧 planned — roadmap item; current export is CSV with GST column |
| Bulk catalog CSV upload | 🚧 planned — route shell exists, import flow is v1.1 |
| Platform console (tenant approval UI, billing oversight) | 🚧 in design — data model live, UI spec at `docs/superpowers/specs/2026-05-09-platform-portal-design.md` |
| Automated data retention policy | 🚧 planned — v1.2; no automated purge currently |
| Multi-school operator account (one login, many tenants) | 🚧 planned — RBAC model supports it; UI not yet built |
| Parent order history page accessible post-purchase | ✓ live — `/orders/[orderId]` gated to the authenticated parent |

---

> **Calibration note:** If a prospect asks about a 🚧 planned item, the honest answer is "that's on the roadmap — here's the timeline". If they ask about a 🚧 positioning claim, acknowledge it's a projection and offer to walk them through the methodology. Overstating shipped functionality in front of a technically sophisticated buyer is worse than saying "not yet".
