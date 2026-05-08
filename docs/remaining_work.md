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

> §2.1 (refund/exchange UI), §2.3 (Stripe webhook handler), §2.6 (production env config — code), and §2.7 (error handling / observability — code) are now complete and have been moved to `docs/completed.md` §4. Their leftover ops/verification follow-ups are tracked below in §2.8.

### 2.2 Super-admin / platform portal — none of 4 screens exist

**Where:** No `/platform` or `/superadmin` routes. Prototype lives at `my_doc/UI_prototypes/project/superadmin.jsx`.

Without this, onboarding a second school requires running a SQL seed script. For multi-tenant go-live this is a blocker for tenant #2 (RGSH already exists from seed but cannot be edited via UI).

**Required:**
- `/platform` (or `/superadmin`) section gated to platform-admin role.
- Tenants list with KPIs and status badges.
- "Provision new tenant" 6-step wizard (identity, branding, billing/Stripe, operator, catalog import, go-live).
- Platform-level Stripe payouts overview.
- Branding editor (logo upload, accent colour picker, live parent preview).

### 2.8 Ops / verification follow-ups (carried over from completed code work)

The code for §2.1, §2.3, §2.6, and §2.7 is done; the following ops/verification items still need to happen before go-live:

- **Refund E2E (from §2.1):** Once NSBH's Stripe Express account is onboarded, run smoke-test Test 3 — place order → partial refund → full refund → 409 on third attempt → idempotency replay. (See §5 checklist item 8.)
- **Production env (from §2.6):** Switch from Stripe test keys to live keys; pin production `DATABASE_URL`; configure Hostinger Node.js app env groups (preview vs production); assign production domain + TLS.
- **Observability (from §2.7):** Verify PostHog project key is set in production Hostinger env vars (and confirm events are arriving from production after first deploy).
- **Stripe webhook events (from §3.5):** Verify the production Stripe webhook endpoint subscribes to `account.updated` in addition to `payment_intent.succeeded` and `charge.refunded`.

---

## 3. 🟡 Medium — required by PDP/prototype, tolerable for soft launch

### 3.1 Missing catalog items from the paper form

**Where:** `apps/web/src/db/queries.ts` seed data; audit §4.

NSBH paper form items missing from the seed: Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie. PDP §4 lists these explicitly.

**Required:** Update seed + run a one-off insert against production for both NSBH and RGSH (RGSH catalog needs review with the school).

### 3.2 Refund-policy *page* (the actual content)

Already counted in §1.5 as a blocker for the consent step. Listed again here because the content itself (copy, signed off by each school's bursar) is a content task, not a code task.

### 3.3 "Add another child" flow on school picker ✅ (code complete)

**Spec:** `docs/superpowers/specs/2026-05-08-parent-account-children-design.md`
**Plan:** `docs/superpowers/plans/2026-05-08-parent-account-children.md`
**Status:** Code complete on `feat-parent-account`. Ops verifications remaining before merge:

- [ ] Verify both **magic-link email** and **Google** providers are enabled in the Neon Auth project dashboard for the production environment.
- [ ] Verify Neon Auth dedupes by primary email when the same email signs in via both magic-link and Google. If not, surface the setting and flip it.
- [ ] Confirm the Neon Auth account-management path linked from `/privacy` (per Task 18 Step 1) renders correctly on production-mirroring staging. If a self-service deletion path is unavailable, replace the link with the support-email fallback in `app/privacy/page.tsx` before merge.
- [ ] Run a real end-to-end smoke test on staging: sign in via magic-link, add a child, place an order with a note, confirm the operator detail callout, confirm the printed pick slip includes the note, confirm the parent receipt echoes the note.
- [ ] Run the same E2E with Google sign-in.
- [ ] After deploy, manually run `UPDATE tenants SET is_publicly_listed = true WHERE id IN ('nsbh','rgsh');` against production if the migration's seed UPDATE didn't apply (verify by checking the row).

### 3.4 Order tracking page for parents

PDP §3.1 mentions "order tracking" beyond an emailed receipt. Today the parent orders list shows status text but no per-order timeline (placed → packing → ready → collected). Add a parent-facing detail page at `/[tenant]/order/[orderId]` keyed by parent email + order ID.

### 3.5 Stripe Connect onboarding completion polling / webhook ✅

**Status:** Code complete (2026-05-07). Both push (webhook) and pull (live API fetch) paths keep `stripePayoutsEnabled` / `stripeChargesEnabled` in sync.

- `account.updated` webhook handler in `apps/web/src/app/api/stripe/webhook/route.ts` updates the tenants row keyed by `stripeAccountId`, captures PostHog events (success, unmatched-account, exception), and re-throws on DB error so Stripe retries.
- `GET /api/stripe/connect` live-fetches the account from Stripe on every call and persists fresh status, so any settings-page load reconciles state regardless of webhook delivery.
- Settings UI renders three correct states: not connected, connected/onboarding incomplete, connected/ready.

**Smoke test (no real Express account required):** with the dev server + Stripe CLI listener running, run `stripe trigger account.updated` and confirm the PostHog `stripe_account_updated` (or `stripe_account_updated_unmatched`) event fires and the DB row reflects the payload.

**Remaining (ops):** verify the production Stripe webhook endpoint subscribes to `account.updated` (alongside `payment_intent.succeeded` and `charge.refunded`). Tracked under §2.8.

### 3.6 GST / BAS report — auditor sign-off

The reports page produces monthly GST totals client-side. Before go-live, have an Australian accountant confirm the formula (1/11 of GST-inclusive total), the rounding rules, and the Stripe-fee deduction model.

### 3.7 Print stylesheet QA

`window.print()` works for pick slips, but needs verification on real A4 in Chrome and Safari (page breaks for multi-page picks, single-slip-per-page mode for batch printing).

### 3.8 Accessibility audit

No automated a11y tests run today. At minimum: keyboard nav through the parent flow, `aria-label`s on icon buttons (cart, add-to-cart, status pills), colour-contrast on the burgundy `#7A1F2B` accent.

### 3.9 Mobile shell viewport edge cases

`MobileShell` caps at 430px. Verify behaviour on iPhone SE (375px), Android landscape, and iPad split-view.

### 3.10 Refund policy — capture during school onboarding (v1 ships with inline contact only)

**v1 status (shipped):** Order confirmation email no longer links to a policy page. Footer now reads "For refund or exchange questions, contact {tenantName} at {shopEmail}." No platform-authored refund text under uniformorder.online's name. No `/terms` page. (Commit on `worktree-parent-order-detail`.)

**Follow-ups (not v1 blockers):**

1. **Delete the orphaned `/[tenant]/refund-policy` route.** No longer referenced from email after the v1 email change. Either remove the route entirely or leave it as a stub. Low priority — dead route, no harm if it sits.

2. **School onboarding form must capture refund-policy data** (when §2.2 super-admin portal is built):
   - Refund policy text *or* external URL (textarea or link field)
   - Digital declaration: "We confirm this refund policy complies with Australian Consumer Law and we accept responsibility for honoring it for purchases via uniformorder.online" — name, role, date
   - Seller-of-record acknowledgement checkbox (school confirms they understand they are seller of record under Stripe Connect)
   - Store on `tenants` row (new columns) or a `tenant_legal` join table; version on update

3. **Re-introduce per-tenant policy link in email (v2)** once schools have authored their own content via the onboarding form above. Footer becomes "Refund policy" link to school-authored `/[tenant]/refund-policy`.

4. **Platform `/terms` page — deferred indefinitely.** Not needed until we have multiple tenants whose policies diverge or a parent dispute escalates beyond a school's ability to resolve directly. Re-evaluate at tenant #3 or first major dispute.

**Reference:** `my_doc/Legal/Refund_Policy/2026-05-07-refund-policy-ownership.md` for the full reasoning across Stripe Connect, marketplace practice, business, operational, and AU legal lenses, plus the v1 vs. v2 split.

---

## 4. 🟢 Low — post-launch acceptable

| # | Item | Source |
|---|---|---|
| 4.1 | ~~"Riley wore size X last year" hint driven from live order history~~ **✅ Done** — see §4.9 note | Audit item 17 |
| 4.2 | "New product" and "Export" buttons on Dashboard wired up | Audit §2 / Dashboard |
| 4.3 | Bulk operator "Email parents" with real send (currently `mailto:`) | Orders board |
| 4.4 | i18n scaffolding for future non-NSW expansion (PDP §7 Phase 3) | PDP roadmap |
| 4.5 | Inventory stock counts (the schema has none — quantities are unbounded) | PDP §3.2 hints at "Update stock levels" |
| 4.6 | Operator audit log (who marked the order ready, who refunded) | Inferred from refund work |
| 4.7 | Catalog sortable / drag-to-reorder | Prototype only |
| 4.8 | Drizzle migrations checked into the repo (currently schema is push-only) | Ops |
| 4.9 | Implementation detail for §4.1 — replace hardcoded size hint (see below) | known_issues #1 |
| 4.10 | Note: transactional-email webhook commit was not split as planned (`3ce98b1` collapsed Task 6 Steps 3 & 4). Functionality correct; history/bisect deviation only — not worth rewriting. | known_issues #3 |
| 4.11 | ✅ Drizzle-kit `neon_auth.*` exclusion — DONE via schema-file split, not config | UUID drift cleanup (2026-05-08) |

### 4.9 ✅ Replace hardcoded "Riley wore size X last year" hint — DONE (smoke test pending Stripe Connect)

**Implemented in:** merged to `main` (commits `6700615`–`0d61038`)

**Status:** Code complete, type-check passing, smoke tests T2/T3/T4/T5/T6/T7 verified via DB-injected test data. Checkout-path smoke test (T3/T4 via real Stripe payment) could not be run because the NSBH tenant's Stripe Express account is not yet onboarded — same gap as §2.8 / §5 checklist item 4. **Re-run the checkout smoke test once the Stripe Connect account is active.**

**Original problem (resolved):** The size hint shown beneath the size selector on the item detail page was a static string `"Riley wore size 14 last year"`. It did not reflect the actual parent's order history or their child's name.

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

### 4.11 ✅ Lock drizzle-kit out of `neon_auth.*` — DONE

**Resolution:** schema-file split, not a `drizzle.config.ts` flag.

**Investigation finding:** both `tablesFilter` and `schemaFilter` only filter DB introspection during `pull`/`push`. Neither prevents `generate` from diffing a tracked table in the snapshot. Confirmed by probe: with `schemaFilter: ["public"]` set, adding a column to `neonAuthUsers` in `schema.ts` still emitted `ALTER TABLE "neon_auth"."user" ADD COLUMN ...`. Same with `tablesFilter: ["!neon_auth.*"]`.

**Working approach:**

1. Move `neonAuthUsers` + `neonAuthSchema` to `apps/web/src/db/external-schema.ts`.
2. In `schema.ts`, import `neonAuthUsers` (do **not** re-export). The `references(() => neonAuthUsers.id, …)` callbacks still resolve at runtime.
3. Hand-edit the latest snapshot (`apps/web/drizzle/meta/0007_snapshot.json`) to remove the `neon_auth.user` table entry and empty the `schemas` object.
4. `drizzle.config.ts` stays unchanged — the filter flags don't help.

**Why this works:** drizzle-kit enumerates exports of the file at `drizzle.config.ts:schema` (only `./src/db/schema.ts`). It does not traverse imports to discover `pgTable`/`pgSchema` symbols, so a table imported-but-not-re-exported is invisible to its diffing. FK SQL emission (`REFERENCES "neon_auth"."user"("id")`) still works because the `references()` callback returns the column object regardless of registration.

**Verified:** clean-tree `drizzle-kit generate` produces "No schema changes." Probe of `neonAuthUsers` column add in `external-schema.ts` produces no migration. Sanity probe (column add in a public table) still emits the expected ALTER.

**Reference:** spec for the original drift fix at `docs/superpowers/specs/2026-05-08-uuid-drift-fix-design.md`.

---

## 5. Suggested go-live checklist (one page)

> Items 1–4 of the original checklist are complete and have been moved to `docs/completed.md` §4.5.

1. [ ] Catalog seeded with full NSBH paper-form items (§3.1)
2. [ ] Accountant sign-off on GST report (§3.6)
3. [ ] Manual end-to-end test: parent orders → Stripe charge → operator marks ready → parent receives email → operator refunds one line → Stripe refund visible
4. [ ] Stripe Express account onboarded for NSBH (test mode first, then live): complete onboarding at Stripe Dashboard → Connect → Accounts, verify `account.updated` webhook syncs `stripe_charges_enabled = true` to tenants table, then re-run Test 3 smoke test (place order → partial refund → full refund → 409 on third attempt)
5. [ ] Ops follow-ups in §2.8 (live Stripe keys, prod DB URL, Hostinger env, prod domain + TLS, PostHog key verified)

The super-admin portal (§2.2) is required for onboarding tenant #3 and beyond, but the launch tenant (NSBH) can ship without it provided RGSH stays on seed data.

---

## 6. Cross-reference — items merged in from `docs/FEATURE_AUDIT.md`

The former `docs/FEATURE_AUDIT.md` has been retired. Its outstanding items are tracked here as follows:

| Audit item | Tracked in |
|---|---|
| "Add another child" button on school picker | §3.3 |
| "Riley wore size X last year" hint (hardcoded) | §4.1 + §4.9 (implementation detail) |
| Dashboard "New product" button not wired | §4.2 |
| Dashboard "Export" button not wired | §4.2 |
| Refund / exchange action on order detail | ✅ Done (see `completed.md` §4.1); E2E test pending → §5 checklist item 4 |
| Super-admin / platform portal — all 4 screens (tenants list, provision wizard, billing overview, branding editor) | §2.2 |
| Missing NSBH catalog items (Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie) | §3.1 |
