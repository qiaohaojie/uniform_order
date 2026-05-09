# Platform Portal — Design Spec

**Project:** Uniform Online Order System
**Author:** George Qiao (with Claude)
**Date:** 2026-05-09
**Source requirement:** [`docs/remaining_work.md` §2.2](../../remaining_work.md)
**Status:** Draft v2 — pending spec review before plan

---

## 1. Goal

Build a third portal at `/platform`, gated to a hardcoded platform-admin email allowlist (already wired via `PLATFORM_ADMIN_EMAILS` env var + `isPlatformAdminEmail()` helper at `apps/web/src/lib/auth/authorization.ts`), that lets the platform operator (currently George) onboard new schools, edit their branding, watch cross-tenant Stripe payouts, and disable schools — all via UI rather than SQL seed scripts.

**Problem today:** Adding RGSH (or any tenant beyond the launch one) requires editing `apps/web/scripts/seed.mjs` and running it manually against prod Neon. There is no UI anywhere that shows two schools side-by-side. Just as importantly, the parent and admin routes still hardcode the tenant whitelist in `lib/data.ts` `TENANTS`, so a DB-created tenant has nowhere to render until the route layer is DB-backed (§4 below).

**Why now:** §2.2 is the last 🟠 High blocker for taking the platform beyond a single tenant. NSBH can launch without it; tenant #3 cannot.

---

## 2. Audience separation — three portals

| Portal | Path | Audience | Authority |
|---|---|---|---|
| Parent shop | `/[tenant]` | Parents | Buy uniforms for their school |
| School admin | `/admin/[tenant]` | School staff (NSBH, RGSH ops) | Manage their school's orders & catalog |
| **Platform console** *(new)* | `/platform` | Platform operator | Cross-tenant — onboard, edit branding, view payouts |

The platform console itself is additive. **However**, enabling DB-created tenants requires touching the existing `/[tenant]` and `/admin/[tenant]` route layers — see §4.

---

## 3. Out of scope (explicit)

- "Support" and "System" nav tabs from `my_doc/UI_prototypes/project/superadmin.jsx` — not in §2.2 requirements.
- A `platform_admins` DB table or role system. With one operator, env-var allowlist is the right level of investment. Promote later if a second platform operator is added (~30 min change).
- Subdomain routing (`{slug}.uniformorder.online`). Path-based `/{slug}` continues; the wizard mocks subdomain in copy only.
- A separate "operator" field/migration distinct from `shopEmail`. The existing admin layout already treats `tenants.shopEmail` as the operator login email via `isTenantOperatorEmail()`. We make that dual-purpose explicit in §7 Step 4 instead of duplicating it.
- Application-fee revenue tracker. Fee model isn't decided.
- Refunds & disputes dashboards. Add post-launch when volume justifies.
- CSV-of-tenants bulk import. Two schools today, no demand.
- "Plan" / "Trial" / billing-plan model. No such concept exists in the schema.
- "Export CSV" of tenant list. Useless at <10 tenants.
- Per-tenant Stripe payout schedule editor. Stripe defaults work; revisit if requested.
- i18n. AU-only platform.
- Audit log table for platform-admin actions. Acceptable v1 limitation: only approval/rejection is timestamped (`platformApprovedAt`, `platformApprovedBy`); branding edits and disable/re-enable actions are *not* audited. With one platform admin, blame attribution isn't a real concern. Add a `platform_audit_log` table when a second operator joins.
- Pending-draft expiry cron. Drafts live forever until finalized or deleted.
- Migration *off* `lib/data.ts` `TENANTS` / `CATALOG` constants in their entirety. We DB-back the read paths the platform portal touches (§4); seed scripts and a few helper-only references can keep using the constants for now.

---

## 4. Prerequisite — DB-back the tenant route layer

This section is the **load-bearing change** that makes the rest of the spec work. Without it, the wizard creates rows that nothing else in the app can render.

### 4.1 Current state

**17 files** import `TENANTS` and/or `CATALOG` from `@/lib/data` and depend on those constants for runtime behaviour. Verified via `grep -rln '@/lib/data' apps/web/src | xargs grep -l 'TENANTS\|CATALOG'`. Without DB-backing all of them, a TEST tenant created via the wizard will 404, crash, or render with the wrong accent/name on every page after the home screen.

#### 4.1.a Parent shop path (6 files)

| File | Current lookup | Replacement |
|---|---|---|
| `app/[tenant]/layout.tsx` | `if (!(tenant in TENANTS)) notFound()` | `getTenant(slug)` + visibility rule §4.2 |
| `app/[tenant]/page.tsx` | `TENANTS[tenant]`, `CATALOG[tenant]` | `getTenant` + `getActiveCatalog` |
| `app/[tenant]/item/[itemId]/page.tsx` | `CATALOG[tenant]` | `getCatalogItem(tenantId, itemId)` |
| `app/[tenant]/cart/page.tsx` | `TENANTS[tenant]` for accent/name | `getTenant` |
| `app/[tenant]/checkout/page.tsx` | `TENANTS[tenant]` for accent/name | `getTenant` |
| `app/[tenant]/order/placed/page.tsx` | `TENANTS[tenant]` for accent/name | `getTenant` |

#### 4.1.b Admin path (8 files)

| File | Current lookup | Replacement |
|---|---|---|
| `app/admin/[tenant]/layout.tsx` | `if (!(tenant in TENANTS)) notFound()` (then loads `getTenant` for shopEmail) | drop static check; rely on `getTenant` already there + visibility rule §4.2 |
| `app/admin/[tenant]/catalog/page.tsx` | `CATALOG[tenant]` | `getActiveCatalog` |
| `app/admin/[tenant]/dashboard/page.tsx` | `TENANTS[tenant]` | `getTenant` |
| `app/admin/[tenant]/orders/page.tsx` | `TENANTS[tenant]` | `getTenant` |
| `app/admin/[tenant]/orders/[orderId]/page.tsx` | `if (!(tid in TENANTS)) notFound()` + `TENANTS[tid]` | `getTenant` |
| `app/admin/[tenant]/reports/page.tsx` | `TENANTS[tenant]` | `getTenant` |
| `app/admin/[tenant]/settings/page.tsx` | `TENANTS[tenant]` | `getTenant` |
| `app/admin/[tenant]/upload/page.tsx` | `TENANTS[tenant]` | `getTenant` |

#### 4.1.c Cross-cutting (3 files)

| File | Current lookup | Replacement |
|---|---|---|
| `components/admin-shell.tsx` | `TENANTS[tenantId]` for sidebar tenant header | accept `tenant` prop from layout (already loads it via `getTenant`); drop the import |
| `app/orders/[orderId]/page.tsx` | `TENANTS[order.tenantId]` for crest accent | `getTenant(order.tenantId)` |
| `app/orders/orders-list-client.tsx` | `Object.keys(TENANTS)` to enumerate tenants + per-row `TENANTS[o.tenantId]` for accent | **order-driven, not directory-driven** — single cross-tenant query `listOrdersForParent({ userId, email })` returns orders joined with tenant data (`tenant.id`, `name`, `accent`, `short`). Match clause: `orders.user_id = $userId OR lower(orders.parent_email) = lower($email)`. The list page (RSC) loads it server-side; the client component receives orders+tenant pre-joined. Eliminates the per-tenant fan-out entirely and keeps history visible for (a) tenants that are later hidden or disabled, **and (b) historical orders where `user_id IS NULL`** (pre-auth orders, guest checkouts, or rows orphaned by `neon_auth_users` deletion via `onDelete: 'set null'`). |

### 4.2 Target visibility rules

| Route | Visibility rule | Edit / write rule |
|---|---|---|
| `/[tenant]/*` (parent shop) | render iff `tenant.isPubliclyListed === true` AND `platformApprovalStatus = 'approved'`; otherwise `notFound()`. Platform admins additionally allowed to preview unlisted/pending tenants — pass `?preview=1` and check `isPlatformAdminEmail(session.user.email)`. | n/a (read-only) |
| `/admin/[tenant]/*` | render iff tenant exists AND `platformApprovalStatus !== 'rejected'`. Pending tenants are **view-only**: operators can browse the layout to familiarise themselves pre-go-live. | All write APIs continue to enforce the existing `requireTenantApproved()` gate (see §7.3 Step 5). Pending operators see the catalog admin UI but every save returns 403 — by design, not a bug. The wizard's Step 5 clone-from-existing path bypasses this gate because it writes directly to DB, not through the API. |

### 4.3 Implementation notes

- **Tenant lookup:** wrap `getTenant(slug)` in React `cache()` (Next.js's request-scoped dedup). Each request hits Postgres at most once per tenant.
- **Catalog lookup:** add `getActiveCatalog(tenantId)` to `apps/web/src/db/queries.ts`, returning items + variants joined and sorted by `sort_order`. Already exists in form for `/admin/[tenant]/catalog` via `GET /api/catalog?tenantId=...`; reuse the underlying query, don't re-implement.
- **Parent order history is order-driven, not directory-driven:** add `listOrdersForParent({ userId, email })` query joining `orders` with `tenants` to return each order plus its tenant's display data (`id`, `name`, `accent`, `short`). Match clause is dual-keyed: `orders.user_id = $userId OR lower(orders.parent_email) = lower($email)`. The `/orders` list page (RSC) calls this server-side (sourcing both fields from the Neon Auth session) and passes the joined records into `orders-list-client.tsx` as a prop. Replaces both `Object.keys(TENANTS)` enumeration and the per-row `TENANTS[o.tenantId]` accent lookup, and the existing `getOrdersByParentEmail` call from `apps/web/src/app/orders/page.tsx`. The dual-key match is required because `orders.user_id` is nullable (pre-auth orders, guest checkouts, and rows orphaned via `neonAuthUsers` `onDelete: 'set null'`) while `orders.parent_email` is `notNull`. Strictly better than today: when `user_id` is present, we trust it as the primary identity; when absent, we fall back to the historical email-keyed contract. Historical orders for hidden or disabled tenants also stay visible because the join surfaces tenant data regardless of `isPubliclyListed` / `platformApprovalStatus` — those flags gate *new browsing*, not *old receipts*.
- **`admin-shell.tsx` refactor:** stop importing `TENANTS`. Accept a `tenant` prop (already-loaded `Tenant` row) from `app/admin/[tenant]/layout.tsx`. The layout already calls `getTenant()` so this is a one-line wiring change, not a new query.
- **`lib/data.ts` `TENANTS` and `CATALOG`:** keep as-is for `seed.mjs` and any internal helper that still depends on them. Mark with a comment that route-level reads no longer use them. Do not delete in this PR.
- **Cache invalidation:** on tenant or catalog edit (from platform portal or admin portal), call `revalidatePath('/[tenant]', 'layout')` and `revalidatePath('/admin/[tenant]', 'layout')`.

### 4.4 Acceptance for §4

After this section ships:
- `INSERT INTO tenants ('test', ...); UPDATE tenants SET is_publicly_listed = true, platform_approval_status = 'approved', stripe_charges_enabled = true WHERE id = 'test'` → a parent can browse `/test`, add to cart, proceed to checkout, and see the order-placed page render correctly. (Stripe call still requires a real connected acct_id; smoke test verifies the route layer renders, not Stripe success.)
- A pending TEST tenant → admin operator can sign in to `/admin/test/*` and see all screens, but every catalog save returns 403 until approval.
- Unapproved or hidden tenant → `/{slug}` returns 404 to parents, but a platform admin with `?preview=1` sees it.
- `lib/data.ts` `TENANTS` map can be missing the new tenant entirely; all 17 files still work.

---

## 5. Routes & auth

```
app/platform/
  layout.tsx                       PlatformShell, auth gate (in-layout, not middleware)
  page.tsx                         redirect → /platform/tenants
  tenants/
    page.tsx                       list + KPI cards (RSC)
    new/
      page.tsx                     wizard (client component, ?id&step in URL)
      actions.ts                   server actions (createTenantDraft, …)
    [id]/
      page.tsx                     detail / edit (cards + drawers)
      actions.ts                   server actions for edits
  billing/
    page.tsx                       Stripe overview (cached 5 min)
```

### 5.1 Auth gate

Gated **inside `app/platform/layout.tsx`**, mirroring the existing `app/admin/[tenant]/layout.tsx` pattern (`apps/web/src/app/admin/[tenant]/layout.tsx:22-32`). No new `middleware.ts` file.

```ts
// app/platform/layout.tsx (sketch)
const user = await getSessionUser();
if (!user) {
  redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/platform")}`);
}
if (!isPlatformAdminEmail(user.email)) {
  notFound(); // do not redirect — avoid leaking that /platform exists
}
```

`isPlatformAdminEmail()` and `PLATFORM_ADMIN_EMAILS` env var **already exist** in `apps/web/src/lib/auth/authorization.ts:11,21`. We use them as-is. The query param is `callbackURL`, matching the rest of the auth flow in this codebase.

### 5.2 Shell

New `PlatformShell` component (separate from `AdminShell`). Matches the prototype's navy `#0A1726` sidebar with "Platform Console" kicker. Two nav items only for v1: **Tenants**, **Billing**. (Prototype's Support/System are dropped.)

---

## 6. Section A — Tenant list (`/platform/tenants`)

### 6.1 Layout

- 4 KPI tiles: **Tenants** (total, with active/setup breakdown), **Parents** (count distinct across all tenants), **Orders · 30d** (count, with MoM delta), **Revenue · 30d** (gross, sourced from `orders.total` − refunds).
- Filter chips: **All / Active / Setup / Hidden**.
- Search box: client-side filter across `name + id`.
- Table columns: **School** (crest+name+`{slug}.uniformorder.online`), **Parents**, **Orders · 30d**, **Revenue · 30d**, **Since** (`createdAt`), **Status**, **Open →**.
- Header right: **[Provision new tenant +]** primary button.

### 6.2 Status derivation (computed, not stored)

| Condition | Label | Tone |
|---|---|---|
| `platformApprovalStatus = 'pending'` OR `!stripeChargesEnabled` | **Setup** | warn |
| approved + `stripeChargesEnabled` + `isPubliclyListed` | **Active** | success |
| approved + `stripeChargesEnabled` + `!isPubliclyListed` | **Hidden** | info |
| `platformApprovalStatus = 'rejected'` | **Disabled** | danger |

### 6.3 Data sources

Two server-side queries, both run in parallel from the page RSC:

```ts
// apps/web/src/lib/platform/queries.ts
listTenantsWithStats(): Promise<TenantRow[]>
  // LEFT JOIN aggregations, single SQL:
  //   parents     = COUNT(DISTINCT user_id) FROM orders GROUP BY tenant_id
  //                 (fall back to COUNT DISTINCT parent_email when user_id IS NULL)
  //   orders30d   = COUNT(*) FROM orders WHERE status != 'pending_payment'
  //                 AND created_at > now() - interval '30 days'
  //   revenue30d  = SUM(total) - SUM(order_refunds.amount) over same window

getPlatformKpis(): Promise<{
  tenants: { total, active, setup },
  parents: number,
  orders30d: { count, deltaMom },
  revenue30d: string,
}>
```

No new API routes. RSC `await Promise.all([listTenantsWithStats(), getPlatformKpis()])`.

Filter chips and search are client-side (a small `"use client"` table wrapper). At 2 rows today and unlikely to exceed 50 within 12 months, no server pagination.

### 6.4 Renamed from prototype

- "Stripe payouts · 30d" KPI → "**Revenue · 30d**" (orders-table proxy, not a Stripe API call). True net-of-fees payouts live on `/platform/billing`.
- Dropped "Plan" column (no plan model).
- Dropped "Trial" filter chip (no trial concept).
- Dropped "Export CSV" button.

---

## 7. Section B — Provision wizard (`/platform/tenants/new`)

### 7.1 URL & state

Single route `/platform/tenants/new`. State held in URL params: `?id={tenantId}&step={1-6}`.

After Step 1, the tenant row exists in DB with `platformApprovalStatus = 'pending'`. Subsequent steps PATCH that row. "Save draft & exit" routes to `/platform/tenants/[id]` (which shows a "Resume onboarding" CTA jumping back to the first incomplete step).

Abandoned drafts are visible under the "Setup" tab of the tenant list — not lost.

### 7.2 The 6 steps

| # | Step | Fields | Action on Continue |
|---|---|---|---|
| 1 | **Identity** | `name`, `short` (auto from initials), `id`/slug (auto from short, editable, unique-validated), `motto?`, `address?` | INSERT tenant row |
| 2 | **Branding** | `logoUrl` (UploadThing — see §7.3), `accent` (preset palette + hex input) | PATCH tenant |
| 3 | **Billing & Stripe** | Click → `stripe.accounts.create({ type: 'standard' })`, store `stripeAccountId`, generate `stripe.accountLinks.create({ type: 'account_onboarding' })` URL, copy to clipboard | PATCH tenant; existing `account.updated` webhook (`completed.md` §4.7) flips `stripeChargesEnabled` async |
| 4 | **Operator & shop contact** | `shopEmail` *(operator login email — see §7.3)*, `shopHours`, `collectionInstructions` | PATCH tenant |
| 5 | **Catalog** | "Clone from {tenant}" dropdown (required choice from existing tenants, or "Skip — start empty") | Server action copies `catalog_items` + `catalog_variants` from source tenant with new IDs prefixed by destination slug. **No "Open catalog admin →" link pre-go-live** — see §7.3 Step 5. |
| 6 | **Go live** | Pre-flight checklist (read-only), all from current DB state | If all required gates green: PATCH `platformApprovalStatus='approved'`, `isPubliclyListed = (catalogItemCount > 0)`, `platformApprovedBy=session.email`, `platformApprovedAt=now()`. Empty catalog → tenant is "Hidden" until operator adds items and toggles public listing on. See §7.3 step 5. |

### 7.3 Per-step decisions

**Step 1 — slug uniqueness.** Validate `^[a-z][a-z0-9-]{2,15}$` client-side; unique-check server-side via Zod refinement. Slug is the URL path segment and email link prefix — collisions break things.

**Step 2 — schema migration required.** `tenants.logo_url text` (nullable). Crest fallback (initials + accent) renders when `logo_url IS NULL`.

**Step 2 — UploadThing route addition.** Existing `catalogImage` route in `apps/web/src/lib/uploadthing.ts` enforces `tenant.platformApprovalStatus === "approved"` (line 24) and operator-email match — both fail during provisioning when the tenant is still pending. Add a sibling route `tenantLogo` that:
  - takes `{ tenantId: string }` input,
  - requires `requireSessionUser()` AND `isPlatformAdminEmail(user.email)` (no operator fallback),
  - skips the approval-status gate so pending tenants can receive logos,
  - returns `{ url, tenantId }` like `catalogImage`.

The existing approval-status gate on `catalogImage` stays untouched; we're adding a parallel route, not weakening protection on the catalog uploader.

**Step 2 — live preview.** Right rail embeds the actual `MobileShell` with a stub catalog rendering the in-progress `accent` and `logoUrl` from form state. Client-side; no DB roundtrip.

**Step 3 — Stripe Connect via API, not manual paste.** We have the SDK and the `account.updated` webhook (`completed.md` §4.7) is wired. **Match the existing `apps/web/src/app/api/stripe/connect/route.ts` model: `type: "standard"` accounts, not Express.** Mixing Connect models breaks the existing NSBH flow and the `account.updated` sync work in `completed.md` §4.7. Auto-creating the Standard account and showing a copyable onboarding URL is the same code-volume as a "paste your account ID" form, with one fewer typo class. The school's bursar receives the URL out-of-band and completes onboarding; webhook flips charges-enabled when ready.

**Step 4 — `shopEmail` is the operator login email.** This is a hard contract with the existing admin gate (`apps/web/src/app/admin/[tenant]/layout.tsx:28`): access to `/admin/[slug]` is granted iff `isTenantOperatorEmail(user.email, tenantRecord.shopEmail)`. The wizard must collect a real, accessible mailbox the school operator can authenticate against via Neon Auth (magic-link or Google). Surface this in the field hint: *"This email is also the school's login. The operator will sign in with this address — make sure it's an inbox they can access."*. A typo here locks the operator out entirely until a platform admin edits the row.

**Step 5 — clone-only pre-approval; admin catalog UI unlocks at go-live.** The existing catalog write APIs (`POST /api/catalog`, `PATCH/DELETE /api/catalog/[itemId]`) enforce `requireTenantApproved()` (`apps/web/src/lib/auth/require-tenant-approved.ts:7`) — pending tenants get 403 on every save. We **do not weaken this gate**; it exists to prevent unapproved tenants from polluting the public catalog and CDN.

Workflow consequence:
1. **In the wizard (pending tenant):** clone from an existing tenant via the server action below. This writes directly to DB, bypassing the API gate by design.
2. **Post-go-live (approved tenant):** the operator visits `/admin/{slug}/catalog` and refines the cloned items via the existing admin UI.

If the operator chooses "Skip — start empty" at Step 5, the tenant goes live with zero catalog items and the operator must add items via the admin UI immediately after Step 6 sets `platformApprovalStatus='approved'`. Pre-flight at Step 6 does **not** block approval on catalog being empty — Stripe charges-enabled is the actual go-live gate. **However**, public listing IS gated on catalog being non-empty: an empty-catalog go-live yields `platformApprovalStatus='approved'` + `isPubliclyListed=false` (status = "Hidden" per §6.2). This prevents parents from landing on a public shop with zero products. The operator adds catalog items via the now-unlocked admin UI, then one-click toggles public listing on from the tenant detail page (§8.1 card 1).

Two-pass clone copy inside a single `db.batch`:
  1. Read source `catalog_items` for `tenant_id = $source`. Build a `Map<oldItemId, newItemId>` where `newItemId = {dstSlug}-{originalIdSuffix}` (e.g. `nsbh-blazer-m` → `mbgs-blazer-m`).
  2. Bulk-insert items with new IDs and `tenant_id = $dst`.
  3. Read source `catalog_variants` joined on the source item IDs; bulk-insert variants with `item_id` rewritten via the map. `catalog_variants.id` is `uuid().defaultRandom()` so no ID-rewrite needed there.

NSBH's catalog becomes the gold seed for cloning.

**Step 6 — pre-flight is computed every render.** No drift between "approval state" and "actual capability." If a school's Stripe webhook later fails, tenant detail flips to "Setup" status until charges re-enable.

### 7.4 Server actions

```
// apps/web/src/app/platform/tenants/new/actions.ts
createTenantDraft(input)              → INSERT tenant row, return { id }
updateTenantStep(id, step, input)     → PATCH tenant, validates per-step Zod schema
createStripeStandardForTenant(id)     → calls Stripe API (type:'standard'), persists acct_id + URL
cloneCatalogFromTenant(srcId, dstId)  → bulk-insert catalogItems + catalogVariants
finalizeTenantGoLive(id)              → re-checks pre-flight server-side, sets approval flags
```

All gated by the same `isPlatformAdminEmail()` check as the layout.

---

## 8. Section C — Tenant detail / edit (`/platform/tenants/[id]`)

Single page, no separate `/edit` route. Card-based layout, per-card drawer edits (reuses the catalog-management drawer pattern from PR #9).

### 8.1 Layout

Header: crest + name + status badge + `slug.uniformorder.online` + "Open ↗" (parent shop) + summary stats (since, parents).

Body cards (each with its own [Edit] → drawer):

1. **Branding** — logo preview, accent swatch, motto, public-listing toggle (one-click flip, no drawer, no confirm — common operation, low blast radius).
2. **Operator & shop contact** — `shopEmail` (operator login email; edit prompt warns "Changing this revokes the previous operator's access"), hours, collection instructions, address.
3. **Stripe Connect** — account ID, charges/payouts badges, "Resend onboarding link" button, "Resync from Stripe" button (manually re-fetches the connected account state and writes the boolean flags — needed if an `account.updated` webhook is missed), "Open Stripe ↗" deep link.
4. **Danger zone** — "Disable tenant" → soft delete (sets `platformApprovalStatus='rejected'` + `isPubliclyListed=false`). Existing orders untouched. School's own admin still works for in-flight fulfillment. Reversible via the same card.

### 8.2 Setup-state shortcut

If `status = Setup`, replace the card body with a single "Resume onboarding" card that deep-links into the wizard at the first incomplete step.

---

## 9. Section D — Billing tab (`/platform/billing`)

Read-only. Every cell is a Stripe API value, not a DB value.

### 9.1 Layout

- 4 KPI tiles: **Connected accounts** (`X / Y` enabled), **Total balance** (across tenants), **Payouts · 30d** (net), **Gross · 30d** (pre-fee).
- Per-tenant table: **School**, **Acct**, **Charges**, **Payouts**, **Balance**, **30d gross**, **Last payout** (date + amount), **Open ↗** (deep link to `https://dashboard.stripe.com/connect/accounts/{acct_id}`).

### 9.2 Stripe calls per tenant per refresh

- `stripe.balance.retrieve({ stripeAccount })`
- `stripe.payouts.list({ stripeAccount, limit: 1 })`
- `stripe.balanceTransactions.list({ stripeAccount, created: { gte: 30d } })`

### 9.3 Caching

`unstable_cache` with **300s TTL** keyed by `tenantId`, tag `platform-billing`.

**Webhook-driven invalidation is new work in this PR.** The existing `account.updated` handler at `apps/web/src/app/api/stripe/webhook/route.ts:87-130` updates DB flags and emits PostHog events but does not call any cache-revalidation API. Add `revalidateTag('platform-billing')` after the DB write so connect-state changes appear within the next render rather than waiting 5 min.

At 2 tenants → 6 calls per cold load. At 50 tenants → 150. Stripe rate limit (~100 req/sec) is far above either; cache makes it trivial.

### 9.4 Failure mode

If a single tenant's Stripe call errors, render that row with `—` placeholders and an inline "Stripe unreachable — retry" link. Do not fail the whole page.

---

## 10. Data model & code-touch summary

### 10.1 Migration

One column added to `tenants`:

```sql
ALTER TABLE tenants ADD COLUMN logo_url text;
```

Nullable. Crest component renders from `short` initials + `accent` when `logo_url IS NULL`.

### 10.2 Drizzle schema update

`apps/web/src/db/schema.ts` — add `logoUrl: text("logo_url")` to the `tenants` definition.

### 10.3 Existing files modified (no migrations)

**Route layer DB-backing (17 files — see §4.1 for the full table):**

Parent shop (6):
- `apps/web/src/app/[tenant]/layout.tsx`
- `apps/web/src/app/[tenant]/page.tsx`
- `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`
- `apps/web/src/app/[tenant]/cart/page.tsx`
- `apps/web/src/app/[tenant]/checkout/page.tsx`
- `apps/web/src/app/[tenant]/order/placed/page.tsx`

Admin (8):
- `apps/web/src/app/admin/[tenant]/layout.tsx`
- `apps/web/src/app/admin/[tenant]/catalog/page.tsx`
- `apps/web/src/app/admin/[tenant]/dashboard/page.tsx`
- `apps/web/src/app/admin/[tenant]/orders/page.tsx`
- `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx`
- `apps/web/src/app/admin/[tenant]/reports/page.tsx`
- `apps/web/src/app/admin/[tenant]/settings/page.tsx`
- `apps/web/src/app/admin/[tenant]/upload/page.tsx`

Cross-cutting (3):
- `apps/web/src/components/admin-shell.tsx` — accept `tenant` prop instead of importing `TENANTS`
- `apps/web/src/app/orders/[orderId]/page.tsx`
- `apps/web/src/app/orders/orders-list-client.tsx` — replace `Object.keys(TENANTS)` with server-fed prop

**New / modified queries:**
- `apps/web/src/db/queries.ts` — add `getActiveCatalog(tenantId)`, `getCatalogItem(tenantId, itemId)`, `listOrdersForParent({ userId, email })` (joined with tenant data; dual-key match clause matches both `user_id` and lowercased `parent_email` to preserve pre-auth and guest history — see §4.3). The existing `getOrdersByParentEmail` becomes unused at the route layer; keep it in `queries.ts` for now in case other code paths depend on it, but mark with a comment that route-layer reads have moved to `listOrdersForParent`.

**Other surface changes:**
- `apps/web/src/lib/uploadthing.ts` — add `tenantLogo` route (§7.3 Step 2).
- `apps/web/src/app/api/stripe/webhook/route.ts` — add `revalidateTag('platform-billing')` to `account.updated` branch (§9.3).

**Explicitly NOT modified:**
- `apps/web/src/lib/auth/require-tenant-approved.ts` — the existing catalog-write approval gate stays untouched. Pending tenants continue to receive 403 on `POST/PATCH/DELETE /api/catalog/*`. Pre-approval catalog setup happens via the wizard's clone-only path (§7.3 Step 5).
- `apps/web/src/lib/data.ts` — `TENANTS` and `CATALOG` constants stay (still used by `seed.mjs` and any internal helpers); only the route-layer reads switch off them.

### 10.4 No other migrations required

`tenants` already has every other column needed: `name`, `short`, `accent`, `motto`, `address`, `shopHours`, `shopEmail`, `collectionInstructions`, `isPubliclyListed`, `stripeAccountId`, `stripePayoutsEnabled`, `stripeChargesEnabled`, `platformApprovalStatus`, `platformApprovedAt`, `platformApprovedBy`, `platformRejectionReason`, `createdAt`, `updatedAt`.

---

## 11. Risks & mitigations

1. **DB-backing the tenant routes (§4) is the load-bearing change.** If we ship the wizard but skip §4, we create rows that nothing renders. Mitigation: §4 is the first section of the implementation plan; merge gate on the smoke test in §4.4.
2. **Mid-wizard abandonment leaves `pending` rows.** Mitigation: tenant list "Setup" filter surfaces them; a "Delete draft" action lives on the tenant detail page for genuinely abandoned ones.
3. **Stripe API on `/platform/billing` could rate-limit at scale.** Mitigation: 5-min `unstable_cache` + webhook-driven invalidation. Re-evaluate at tenant #20.
4. **Subdomain mockup in wizard copy is aspirational.** Mitigation: copy renders `{slug}.uniformorder.online` as informational text; actual routing remains path-based. Future ADR if true subdomains are needed.
5. **Single platform admin == single point of failure.** If George's email is unreachable, no one can onboard. Mitigation: `PLATFORM_ADMIN_EMAILS` is comma-separated; add a backup email at deploy time. Document the env var format clearly.
6. **`account.updated` webhook missed → status drift.** Step 6 pre-flight re-reads DB on render, so a missed webhook surfaces as "Setup" until the next webhook fires or the operator clicks "Resync from Stripe" on the detail page.
7. **`shopEmail` typo at Step 4 locks the operator out.** Mitigation: surface a warning hint in the field; add a "verify mailbox" link on the tenant detail Operator card that sends a test magic-link.

---

## 12. Open questions

None blocking. The following are explicit future-work pointers, not v1 questions:

- When does the platform start charging an application fee per order? (Drives the "Application-fee revenue" view on Billing.)
- When does subdomain routing land? (Drives a real `{slug}.uniformorder.online` mapping vs. the current `/{slug}` paths.)
- When do we promote `PLATFORM_ADMIN_EMAILS` to a `platform_admins` DB table? (Trigger: second platform operator joins.)
- When can `lib/data.ts` `TENANTS` / `CATALOG` be deleted entirely? (Trigger: `seed.mjs` and any remaining helpers stop reading them.)

---

## 13. Deploy checklist

Once the implementation is merged:

1. Apply the new `tenants.logo_url` migration to Neon prod (filename will be `<next-seq>_tenants_logo_url.sql` once `pnpm drizzle-kit generate` assigns the next sequential number).
1b. After PR B (DB-backing) merges, run the extended `seed.mjs` against Neon prod so RGSH catalog rows exist with `rgsh-`-prefixed ids — without this, `/rgsh` renders empty when the route layer flips off the static `CATALOG`. Idempotent.
2. Verify `PLATFORM_ADMIN_EMAILS` is set on Hostinger (`hPanel → Advanced → Node.js → Environment Variables`); if missing, add `PLATFORM_ADMIN_EMAILS=george.qiao@pimspace.com` and restart the Node.js app. The env var and helper already exist in code, but production may not have it set yet — verify before testing.
3. Verify `/platform` returns `notFound` for non-allowlisted users (sign in as a parent test account, hit the URL).
4. Verify `/platform/tenants` lists NSBH and RGSH with correct stats.
5. End-to-end smoke (depends on all 17 route files in §4 being DB-backed). Run in this order:
   1. Provision a "TEST" tenant via the wizard, completing **Steps 1–5 only** (do not run Step 6 yet). Tenant is now `pending`.
   2. Sign in to `/admin/test` as `tenants.shopEmail` for TEST. Verify all 8 admin pages render. Attempt a catalog save (e.g. POST a new item) and confirm it returns **403** — this proves the existing `requireTenantApproved` gate still protects the catalog at the pending stage.
   3. Run Step 6 (Go live). Status flips to `approved`.
   4. Retry the same catalog save and confirm it now returns **200** — proves the gate releases on approval and the admin UI is functional post-go-live.
   5. As a parent, browse the full path on `/test`: home → item detail → cart → checkout → order-placed. All render with the test tenant's accent and name.
   6. Place a real order at TEST (Stripe test mode) so the parent's order history references TEST.
   7. Disable the test tenant via the platform-portal danger-zone card. Verify `/test` now 404s for parents.
   8. As the parent who placed the order in step 6, visit `/orders`. Confirm the historical TEST order is **still visible** with the correct tenant accent/name — this proves order history is order-driven, not directory-driven (§4.3).
   9. Regression check for the dual-key match: directly in Neon prod, take an existing NSBH order row and `UPDATE orders SET user_id = NULL WHERE id = '<some_existing_order>'` (or pick one whose `user_id` is already null from pre-auth history). Sign in as the parent whose `parent_email` matches that row's `parent_email`. Visit `/orders` and confirm the row is **still listed** despite `user_id IS NULL`. Restore `user_id` after the test if you nulled it artificially.
6. Verify the `account.updated` webhook revalidation: trigger an account update in Stripe test mode, confirm `/platform/billing` reflects the change without waiting 5 min.

---

## 14. References

- `docs/remaining_work.md` §2.2 — source requirement
- `docs/completed.md` §4.7 — Stripe Connect `account.updated` webhook (already wired)
- `docs/completed.md` §3.5 — PR #9 catalog management line item (UploadThing, drawer pattern, approval gate)
- `apps/web/src/db/schema.ts` — `tenants` table definition
- `apps/web/src/lib/auth/authorization.ts` — `isPlatformAdminEmail()`, `isTenantOperatorEmail()`, `PLATFORM_ADMIN_EMAILS` env var (already implemented)
- `apps/web/src/lib/uploadthing.ts` — `catalogImage` route (template for new `tenantLogo` route)
- `apps/web/src/app/api/stripe/connect/route.ts` — existing `type: "standard"` Stripe Connect flow
- `apps/web/src/app/api/stripe/webhook/route.ts` — `account.updated` handler (target for new `revalidateTag` call)
- `apps/web/src/app/admin/[tenant]/layout.tsx` — auth-gate pattern (template for `app/platform/layout.tsx`)
- `my_doc/UI_prototypes/project/superadmin.jsx` — visual reference (note: subdomain copy uses stale `.com.au` — substitute `.online`)
- `apps/web/src/components/admin-shell.tsx` — pattern reference for `PlatformShell`
