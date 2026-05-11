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

---

## 3. 🟡 Medium — required by PDP/prototype, tolerable for soft launch

### 3.2 Refund-policy *page* (the actual content)

Already counted in §1.5 as a blocker for the consent step. Listed again here because the content itself (copy, signed off by each school's bursar) is a content task, not a code task.

### 3.6 GST / BAS report — auditor sign-off

The reports page produces monthly GST totals client-side. Before go-live, have an Australian accountant confirm the formula (1/11 of GST-inclusive total), the rounding rules, and the Stripe-fee deduction model.

### 3.7 Print stylesheet QA — manual A4 verification only

Code half shipped via PR #21 (squash `11667af`); see `completed.md` §4.23. Remaining: real A4 paper QA in Chrome and Safari on macOS — single slip prints clean, batch prints one slip per page with no trailing blank, parent-note banner appears on slips that have a note, barcode renders, Kanban never appears in print output.

### 3.8 Accessibility audit — ✅ shipped

Parent flow audited against WCAG 2.1 A+AA (PR #23 Phase A) and fixed (PR #24 Phase B, squash `69430c5`). 1 P0 (FieldLabel/select-name) + 2 P1 (Stripe wrapper, gold-text contrast) axe findings resolved or documented-excluded; Playwright-assisted keyboard walkthrough clean (no traps, 5/6 screens automated + manual follow-up enumerated). Original spec called out burgundy `#7A1F2B` as the likely contrast risk — Phase A debunked this (9.46–10.20:1 across backgrounds); the real risk was gold `#B08A3E` at small bold sizes, fixed via the `--color-gold-text` token. See `completed.md` §4.25.

### 3.9 Mobile shell viewport edge cases ✅

Done 2026-05-11. Three rule-#2 small-tap-target P1s identified by Phase A audit and fixed in Phase B (cart qty steppers → 28×28, catalog header cart link → 36×36, item header cart link → 36×36). Rule #1 (horizontal scrollbar) and rules #3-#4 had zero findings at any of the three viewports. See `completed.md` §4.24.

### 3.10 Platform `/terms` page — deferred indefinitely

The two §3.10 follow-ups (school-authored refund-policy capture, per-tenant policy link in email) shipped via PR #19; see `completed.md` §4.22.

Platform-level `/terms` page is **deferred indefinitely** — not needed until we have multiple tenants whose policies diverge or a parent dispute escalates beyond a school's ability to resolve directly. Re-evaluate at tenant #3 or first major dispute.

**Reference:** `my_doc/Legal/Refund_Policy/2026-05-07-refund-policy-ownership.md` for the full reasoning across Stripe Connect, marketplace practice, business, operational, and AU legal lenses, plus the v1 vs. v2 split.

---

## 4. 🟢 Low — post-launch acceptable

| # | Item | Source |
|---|---|---|
| 4.3 | Bulk operator "Email parents" with real send (currently `mailto:`) | Orders board |
| 4.4 | i18n scaffolding for future non-NSW expansion (PDP §7 Phase 3) | PDP roadmap |
| 4.7 | Catalog sortable / drag-to-reorder | Prototype only |

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
| "Riley wore size X last year" hint (hardcoded) | ✅ Done — `completed.md` §4.8 |
| Dashboard "New product" button not wired | ✅ Resolved 2026-05-11 — links to `/admin/[tenant]/catalog` |
| Dashboard "Export" button not wired | ✅ Resolved 2026-05-11 — deleted as redundant with Reports CSV export |
| Refund / exchange action on order detail | ✅ Done (see `completed.md` §4.1); E2E test pending → §5 checklist item 3 |
| Super-admin / platform portal — tenants list, provision wizard, billing overview, branding editor | ✅ Done — `completed.md` §4.16–§4.20 (PRs #14, #15, #16, #17, #18) |
| Missing NSBH catalog items (Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie) | §3.1 |
