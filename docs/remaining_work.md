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
>
> §3.4 (parent order detail page), §3.5 (Stripe Connect onboarding sync), §4.1 + §4.9 (size hint), §4.10 (commit-split decision), and §4.11 (drizzle-kit `neon_auth.*` exclusion) are also complete — moved to `docs/completed.md` §4.6–§4.10.
>
> §2.10 (`db.transaction` → `db.batch` fix, PR #10) and §3.3 ("add another child", PR #6) are complete — moved to `docs/completed.md` §4.11 and §4.12. §3.3 production ops verifications carried over to §2.11 below.
>
> §3.10 follow-up #1 (delete orphan `/[tenant]/refund-policy` route, PR #11) is complete — moved to `docs/completed.md` §4.13. Remaining §3.10 follow-ups (school-onboarding capture, v2 per-tenant policy link, deferred platform `/terms`) stay below.
>
> §3.1 NSBH catalog seed (PR #12, `e4ef0c7`) is complete — moved to `docs/completed.md` §4.14. RGSH catalog, production NSBH seed run, and pre-existing shirt-ss/shirt-ls variant gaps are tracked in §2.12 below.
>
> §2.2 (super-admin / platform portal — all 6 screens) is now complete and has been moved to `docs/completed.md` §4.16–§4.20. PR #18 (`1ea6055`) shipped the final branding editor drawer.

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
- [x] **Migration 0008 (`catalog_image_url`)** — already applied to Neon prod (verified 2026-05-08; `__drizzle_migrations` row id=10 matches journal entry for `0008_catalog_image_url`). Nothing to do.
- [ ] **(Optional) UploadThing free-tier monitoring** — current plan covers 2 GB storage / 100 GB bandwidth. With ~16 product photos × 2 schools × <2 MB each, usage is negligible. Re-evaluate at tenant #5 or any image-heavy redesign (e.g. high-res hero shots, multi-angle product photos).

### 2.12 Catalog seed (NSBH paper form) — production + RGSH follow-ups

§3.1 NSBH code shipped via PR #12 (squash-merge `e4ef0c7`). Outstanding:

- [ ] **Run prod NSBH seed.** `apps/web/scripts/seed.mjs` is idempotent (`ON CONFLICT DO UPDATE` for items, `DELETE + INSERT` for variants). Run against production Neon once these changes deploy: `cd apps/web && node scripts/seed.mjs` with the prod `DATABASE_URL`. Today the parent shop renders from `CATALOG` in `lib/data.ts`, so the prod seed only affects the admin catalog table — it becomes load-bearing once parent-shop DB-reads land.
- [ ] **RGSH catalog (separate task).** Needs school sign-off on the catalog list — RGSH currently inherits NSBH-only seed entries. Capture as a school-onboarding sub-task; super-admin portal now exists (`completed.md` §4.16–§4.20) so onboarding workflow can drive this.
- [x] **Pre-existing variant misalignments** ✅ — shipped via PR #13 (`e7bccf0`, 2026-05-09); see `completed.md` §4.15.

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

### 3.1 Missing catalog items from the paper form ✅

Done (NSBH). See `docs/completed.md` §4.14. RGSH catalog, production NSBH seed run, and pre-existing shirt variant gaps carried over to §2.12 below.

### 3.2 Refund-policy *page* (the actual content)

Already counted in §1.5 as a blocker for the consent step. Listed again here because the content itself (copy, signed off by each school's bursar) is a content task, not a code task.

### 3.3 "Add another child" flow on school picker ✅

Done. See `docs/completed.md` §4.12. Production ops verifications carried over to §2.11 above.

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

1. **School onboarding form must capture refund-policy data** (extension to the now-shipped provision wizard, `completed.md` §4.18):
   - Refund policy text *or* external URL (textarea or link field)
   - Digital declaration: "We confirm this refund policy complies with Australian Consumer Law and we accept responsibility for honoring it for purchases via uniformorder.online" — name, role, date
   - Seller-of-record acknowledgement checkbox (school confirms they understand they are seller of record under Stripe Connect)
   - Store on `tenants` row (new columns) or a `tenant_legal` join table; version on update

2. **Re-introduce per-tenant policy link in email (v2)** once schools have authored their own content via the onboarding form above. Footer becomes "Refund policy" link to school-authored `/[tenant]/refund-policy`.

3. **Platform `/terms` page — deferred indefinitely.** Not needed until we have multiple tenants whose policies diverge or a parent dispute escalates beyond a school's ability to resolve directly. Re-evaluate at tenant #3 or first major dispute.

**Reference:** `my_doc/Legal/Refund_Policy/2026-05-07-refund-policy-ownership.md` for the full reasoning across Stripe Connect, marketplace practice, business, operational, and AU legal lenses, plus the v1 vs. v2 split.

---

## 4. 🟢 Low — post-launch acceptable

| # | Item | Source |
|---|---|---|
| 4.3 | Bulk operator "Email parents" with real send (currently `mailto:`) | Orders board |
| 4.4 | i18n scaffolding for future non-NSW expansion (PDP §7 Phase 3) | PDP roadmap |
| 4.6 | Operator audit log (who marked the order ready, who refunded) | Inferred from refund work |
| 4.7 | Catalog sortable / drag-to-reorder | Prototype only |
| 4.8 | Drizzle migrations checked into the repo (currently schema is push-only) | Ops |

> §4.1 (size hint), §4.9 (size-hint implementation), §4.10 (commit-split note), §4.11 (drizzle-kit `neon_auth.*` exclusion) are complete — moved to `docs/completed.md` §4.6–§4.10. IDs preserved for cross-reference; no renumbering.
>
> §4.5 (inventory stock counts) **dropped 2026-05-11** — not a product fit. School uniform shops fulfil from a storeroom; oversells are absorbed operationally (e.g., "two-week wait") and stale stock numbers create a known operator burden. Out-of-stock handling stays operator-mediated, not system-tracked. PDP §3.2 softened to match. ID preserved; do not re-raise without an explicit school request.
>
> §4.2 (Dashboard "New product" + "Export" buttons) **resolved 2026-05-11** — "New product" now links to `/admin/[tenant]/catalog` (where the add-item drawer lives). "Export" deleted as redundant with the real CSV exporter on the Reports page. ID preserved.

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
