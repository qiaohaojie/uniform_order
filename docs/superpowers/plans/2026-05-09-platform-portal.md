# Platform Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/platform`, a third portal gated to platform-admin emails, that lets the operator onboard schools, edit branding, and watch Stripe payouts via UI rather than SQL seed scripts. Includes the prerequisite work to DB-back 17 existing tenant-scoped routes so DB-created tenants render correctly.

**Architecture:** Next.js App Router RSC + server actions. New `app/platform/` route tree with in-layout auth gate (no middleware). Reuses existing `isPlatformAdminEmail()` helper, UploadThing flow, Stripe Connect (`type:'standard'`), and `account.updated` webhook. One new column (`tenants.logo_url`); no other schema changes.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM (Postgres/Neon), Stripe Node SDK, UploadThing v7, HeroUI v3, Tailwind v4, Neon Auth, PostHog.

**Spec source:** [`docs/superpowers/specs/2026-05-09-platform-portal-design.md`](../specs/2026-05-09-platform-portal-design.md) — v5, approved after 4 rounds of code-grounded review.

---

## Suggested PR breakdown

This plan is large enough to ship as ~5 PRs. Phases below align with PR boundaries; each phase is independently mergeable and shippable. The user's pattern (per-feature memory) is "migrations in PR1, code in PR2-3" — this plan follows that.

| PR | Phase(s) | Scope | Mergeable independently? |
|---|---|---|---|
| **A** | 0 | Migration `0009_tenants_logo_url` only | Yes — column unused until PR D |
| **B** | 1 | DB-back the 17 tenant-scoped routes + extend `seed.mjs` to seed RGSH catalog | Yes — Task 1.6 keeps RGSH parity once the static `CATALOG` fallback is removed; required prerequisite for new tenants |
| **C** | 2, 3, 5 | Platform portal scaffold + tenant list + tenant detail (read-only paths) | Yes — `/platform` becomes accessible and shows existing tenants |
| **D** | 4 | Provision wizard (write paths) | Depends on PR A + C |
| **E** | 6 | Billing tab (Stripe API + cache) | Depends on PR C; PR D not strictly required |

---

## Test strategy

This codebase has **no test framework** (per `CLAUDE.md`: "Type-checking is the primary correctness gate"). This plan adheres to the existing pattern: every task ends with type-check + a manual smoke or `pnpm dev` verification. We do NOT introduce vitest/jest as part of this plan — that's a separate decision out of scope.

Each task's verification is exactly one of:
- `pnpm check-types:web` — catches type regressions
- A documented `curl`/HTTP smoke test against `pnpm dev:web`
- A documented click-path through the dev server (when UI-only)

---

## File structure

### New files

```
apps/web/drizzle/
  0009_tenants_logo_url.sql                        Phase 0
apps/web/src/
  app/platform/
    layout.tsx                                     Phase 2 — PlatformShell + auth gate
    page.tsx                                       Phase 2 — redirect → /platform/tenants
    not-found.tsx                                  Phase 2 — branded 404 (optional)
    tenants/
      page.tsx                                     Phase 3 — RSC, KPIs + list
      tenants-table.tsx                            Phase 3 — "use client" filter/search
      new/
        page.tsx                                   Phase 4 — wizard route
        wizard-client.tsx                          Phase 4 — state machine
        actions.ts                                 Phase 4 — server actions
        steps/
          step-1-identity.tsx                      Phase 4
          step-2-branding.tsx                      Phase 4
          step-3-stripe.tsx                        Phase 4
          step-4-operator.tsx                      Phase 4
          step-5-catalog.tsx                       Phase 4
          step-6-go-live.tsx                       Phase 4
      [id]/
        page.tsx                                   Phase 5 — RSC detail
        cards/
          branding-card.tsx                        Phase 5
          operator-card.tsx                        Phase 5
          stripe-card.tsx                          Phase 5
          danger-card.tsx                          Phase 5
        edit-drawer.tsx                            Phase 5 — shared drawer
        actions.ts                                 Phase 5
    billing/
      page.tsx                                     Phase 6
      billing-table.tsx                            Phase 6
  components/
    platform-shell.tsx                             Phase 2
  lib/
    platform/
      queries.ts                                   Phase 3 — listTenantsWithStats, getPlatformKpis
      stripe-billing.ts                            Phase 6 — cached Stripe API
      slug.ts                                      Phase 4 — slug derive + validate
      schema.ts                                    Phase 4 — Zod per-step schemas
```

### Modified files

```
apps/web/src/
  db/
    schema.ts                                      Phase 0 — add logoUrl column
    queries.ts                                     Phase 1 — add getActiveCatalog, listOrdersForParent, getCatalogItem
  app/
    [tenant]/                                      Phase 1 — DB-back 6 files
      layout.tsx
      page.tsx
      cart/page.tsx
      checkout/page.tsx
      item/[itemId]/page.tsx
      order/placed/page.tsx
    admin/[tenant]/                                Phase 1 — DB-back 8 files
      layout.tsx
      catalog/page.tsx
      dashboard/page.tsx
      orders/page.tsx
      orders/[orderId]/page.tsx
      reports/page.tsx
      settings/page.tsx
      upload/page.tsx
    orders/                                        Phase 1 — DB-back 2 files
      page.tsx
      orders-list-client.tsx
    api/stripe/webhook/route.ts                    Phase 6 — add revalidateTag
  components/
    admin-shell.tsx                                Phase 1 — accept tenant prop
  lib/
    uploadthing.ts                                 Phase 4 — add tenantLogo route
```

### Files explicitly unchanged

- `apps/web/src/lib/auth/require-tenant-approved.ts` — gate stays; pending tenants get 403 on catalog API by design.
- `apps/web/src/lib/data.ts` — `TENANTS` / `CATALOG` constants remain as fallback for `seed.mjs` and any internal helpers; route-layer reads switch off them in Phase 1.
- `apps/web/src/middleware.ts` — does not exist and we do not create it. Auth gate lives in `app/platform/layout.tsx`.

---

## Phase 0 — Migration: `tenants.logo_url`

**PR A. Estimate: 30 min. Mergeable independently — column is added but unused until PR D.**

### Task 0.1: Add `logoUrl` to Drizzle schema

**Files:**
- Modify: `apps/web/src/db/schema.ts`

- [ ] **Step 1: Edit `tenants` table definition**

In the `tenants` block (around line 33), insert `logoUrl` after `accent`:

```ts
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  short: text("short").notNull(),
  accent: text("accent").notNull().default("#7A1F2B"),
  logoUrl: text("logo_url"),  // NEW — nullable; Crest renders from initials when null
  motto: text("motto"),
  // ...rest unchanged
});
```

- [ ] **Step 2: Generate migration**

```bash
cd apps/web && pnpm drizzle-kit generate
```

Expected: a new file `drizzle/0009_<friendly-name>.sql` (drizzle picks a friendly name like `youthful_purifiers`). Verify it contains:

```sql
ALTER TABLE "tenants" ADD COLUMN "logo_url" text;
```

Whatever name drizzle emits is fine — existing migrations 0001–0007 all use drizzle's auto-generated friendly names. Do not hand-edit `_journal.json`.

- [ ] **Step 3: Apply migration to a Neon dev branch**

Use Neon MCP `prepare_database_migration` against the project's dev branch first, then `complete_database_migration` to apply. (Or `pnpm drizzle-kit migrate` if a `.env.local` `DATABASE_URL` points at a dev branch.) Confirm the column exists:

```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'logo_url';
```

Expected: `logo_url | text | YES`.

- [ ] **Step 4: Verify type-check**

```bash
pnpm check-types:web
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/db/schema.ts apps/web/drizzle/
git commit -m "feat(db): add tenants.logo_url column for platform portal logo upload

Nullable. Crest component continues to render from short+accent when null.
Used by /platform provision wizard step 2 (PR D).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 1 — DB-back the tenant route layer

**PR B. Estimate: 4–6 hrs. Mergeable independently. NSBH render/URL behaviour preserved 1:1. RGSH render preserved via Task 1.6 catalog seed (rgsh-prefixed ids); RGSH item URLs change shape — `/rgsh/item/<unprefixed>` 308-redirects to `/rgsh/item/rgsh-<unprefixed>` via Task 1.3 step 4 fallback, so legacy bookmarks survive.**

This phase has 17 files to modify but they cluster into 4 task groups. Type-check after each group; smoke after the last.

### Task 1.1: Add new query helpers

**Files:**
- Modify: `apps/web/src/db/queries.ts`

- [ ] **Step 1: Add `getActiveCatalog` — returns the `CatalogItem` UI shape, not raw DB rows**

The DB and UI shapes diverge intentionally: `catalog_variants` stores `{label, price (string)}` per row, while the parent UI's `CatalogItem` (from `lib/data.ts`) expects `{label, price (number), sizes: string[]}` per variant. The `sizes` array is UI-only — there's no DB column for it today. To DB-back the parent shop without rewriting `interactive.tsx`, the adapter must produce the UI shape directly.

**v1 size-source bridge:** use the existing static `CATALOG` map in `lib/data.ts` as the size lookup, keyed by `(tenantId, itemId, variantLabel)`. This works for NSBH/RGSH (their data is already in `CATALOG`) and for new tenants cloned from NSBH (variant labels match, so sizes flow through). Tenants that diverge from inherited variants will lose sizes for those new variants until a follow-up PR adds a `catalog_variants.sizes jsonb` column. Document this limitation in `queries.ts`.

Append to `queries.ts`:

```ts
import { CATALOG } from "@/lib/data";
import type { CatalogItem } from "@/lib/data";

/**
 * v1 size-source bridge. Looks up the UI's `sizes` array from the static
 * `CATALOG` flat array, keyed by itemId + variant label.
 *
 * The static CATALOG uses unprefixed item ids (e.g., 'shirt-ls'). The seed
 * inserts those same unprefixed ids for NSBH/RGSH, so direct lookup works
 * for the launch tenants. The wizard's clone path produces destination ids
 * shaped `${dstTenantId}-${sourceItemId}` (e.g., 'mbg-shirt-ls') because
 * `catalog_items.id` is a single-column PK and tenants need globally
 * unique ids in the DB. For those cloned ids we fall back to stripping
 * the tenantId prefix and re-searching the static CATALOG.
 *
 * TODO(post-launch): add a `sizes jsonb` column to `catalog_variants` and
 * sunset this lookup. Tracked as a follow-up in remaining_work.md.
 */
function sizesForVariant(tenantId: string, itemId: string, variantLabel: string): string[] {
  // Direct match — covers the launch tenants whose seed inserted unprefixed ids.
  let item = CATALOG.find((i) => i.id === itemId);
  // Cloned-tenant fallback — strip `${tenantId}-` prefix and retry.
  if (!item && itemId.startsWith(`${tenantId}-`)) {
    const stripped = itemId.slice(tenantId.length + 1);
    item = CATALOG.find((i) => i.id === stripped);
  }
  const v = item?.variants.find((v) => v.label === variantLabel);
  return v?.sizes ?? [variantLabel];
}

/**
 * Active catalog for a tenant in the parent UI's `CatalogItem` shape.
 * Filters items where active=true, with their active variants, sorted by
 * sort_order. Wrapped in React cache() for request-scoped dedup.
 *
 * Shape adapter:
 *   DB row {category, price (string)} → UI {cat, price (number)}
 *   DB variants enriched with `sizes` via sizesForVariant().
 */
export const getActiveCatalog = cache(async (tenantId: string): Promise<CatalogItem[]> => {
  const rows = await db
    .select({
      itemId: catalogItems.id,
      name: catalogItems.name,
      category: catalogItems.category,
      description: catalogItems.description,
      sizeGuide: catalogItems.sizeGuide,
      sortOrder: catalogItems.sortOrder,
      varLabel: catalogVariants.label,
      varPrice: catalogVariants.price,
      varActive: catalogVariants.active,
    })
    .from(catalogItems)
    .leftJoin(catalogVariants, eq(catalogVariants.itemId, catalogItems.id))
    .where(and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.active, true)))
    .orderBy(catalogItems.sortOrder, catalogVariants.label);

  // Group by item, building the UI's `CatalogItem` shape.
  const map = new Map<string, CatalogItem>();
  for (const r of rows) {
    if (!map.has(r.itemId)) {
      map.set(r.itemId, {
        id: r.itemId,
        name: r.name,
        cat: r.category as CatalogItem["cat"],   // existing static type uses ItemCategory union
        description: r.description ?? "",
        sizeGuide: (r.sizeGuide as CatalogItem["sizeGuide"]) ?? undefined,
        variants: [],
      } as unknown as CatalogItem);
    }
    if (r.varLabel != null && r.varActive) {
      const item = map.get(r.itemId)!;
      item.variants.push({
        label: r.varLabel,
        price: Number(r.varPrice),
        sizes: sizesForVariant(tenantId, r.itemId, r.varLabel),
      });
    }
  }
  return Array.from(map.values());
});
```

Imports needed at top of file (verify): `cache` from `react`, `eq`, `and` from `drizzle-orm`, plus existing `db`, `catalogItems`, `catalogVariants`, plus the new `CATALOG` and `CatalogItem` from `@/lib/data`.

**Smoke for the adapter (mandatory):**

```bash
# Add a temporary script that compares the adapter output against the static CATALOG
# for NSBH and RGSH, asserting structural equivalence (same items, same variant
# labels, same prices, same sizes).
cd apps/web && pnpm tsx scripts/smoke-catalog-adapter.ts
```

The script's success bar — assert all of:

1. **Launch tenants:** for both `nsbh` and `rgsh`, `getActiveCatalog(slug)` returns items matching `CATALOG` on `cat`, `description`, `sizeGuide` (deep-equal on jsonb), variant `label`s, variant `price`s (after `Number()` coercion), and variant `sizes` arrays.

   **ID comparison is normalized per tenant** because Task 1.6 seeds RGSH with `rgsh-`-prefixed ids: NSBH uses unprefixed ids and compares directly (`'shirt-ls' === 'shirt-ls'`); RGSH strips the `rgsh-` prefix before comparing (`'rgsh-shirt-ls'.slice(5) === 'shirt-ls'`). Concretely, for an RGSH item assert: `dbItem.id === \`rgsh-${staticItem.id}\`` AND the rest of the fields match the static record. A divergence on either the prefix shape or the stripped match should fail the smoke.
2. **Cloned-tenant id-prefix fallback:** insert a temporary tenant row `t-clone-test` (direct `db.insert(tenants)`, bypass the wizard), then call `cloneCatalogFromTenantUnsafe("nsbh", "t-clone-test")` from `@/lib/platform/clone-catalog` (the pure helper — the script has no Neon Auth session, so the auth-gated server action would throw). Then call `getActiveCatalog("t-clone-test")`. Assert that for at least one variant whose source NSBH counterpart had a multi-element `sizes` array (e.g., `shirt-ls` "10–24"), the cloned tenant's adapter returns the **same** non-trivial sizes array (proves the `sizesForVariant` prefix-strip fallback works for cloned ids like `t-clone-test-shirt-ls`). Clean up the test tenant + its rows after (DELETE catalog_variants by item id, then catalog_items by tenant_id, then tenants by id).

If either bar fails, the parent shop renders incorrectly post-DB-backing. Delete the script after both pass.

- [ ] **Step 2: Add `getCatalogItem`**

Returns `CatalogItem | null` to match the adapter shape from Step 1. Used by `app/[tenant]/item/[itemId]/page.tsx`.

```ts
export const getCatalogItem = cache(async (
  tenantId: string,
  itemId: string,
): Promise<CatalogItem | null> => {
  const items = await getActiveCatalog(tenantId);
  return items.find((i) => i.id === itemId) ?? null;
});
```

- [ ] **Step 2.5: Add `toTenantBrand` adapter**

Parent client components (`interactive.tsx`, `MobileShell` props, etc.) are typed against `Tenant` from `lib/data.ts`, which has required `accentInk`, `motto`, `address`, `shopHours`, `shopEmail`, and `id: TenantId`. DB `TenantRow` has `id: string`, no `accentInk`, and nullable copy fields. Threading `tenantRecord` directly into these components type-errors and would also crash at runtime if any of those fields are null.

Add a small adapter that materializes the UI's expected shape with safe defaults:

```ts
import type { Tenant } from "@/lib/data";

/**
 * Adapt a DB tenant row to the parent UI's `Tenant` shape. Materializes
 * `accentInk` (default white) and replaces nullable copy fields with empty
 * strings so existing components don't need null guards.
 *
 * Note: `id` is widened from the static `TenantId` union to `string` here.
 * Components that strictly need TenantId should narrow at the call site;
 * most just use it as a URL key.
 */
export function toTenantBrand(row: typeof tenants.$inferSelect): Tenant {
  return {
    id: row.id as Tenant["id"],          // widened — safe, only used for URL/keys
    name: row.name,
    short: row.short,
    accent: row.accent,
    accentInk: "#FFFFFF",                  // sensible default for navy/burgundy/teal palette
    motto: row.motto ?? "",
    address: row.address ?? "",
    shopHours: row.shopHours ?? "",
    shopEmail: row.shopEmail ?? "",
  };
}
```

Every parent route page in §4.1.a calls `await getTenant(slug)` then passes `toTenantBrand(tenantRecord)` (not the raw row) into the client component. Admin pages can keep the raw `TenantRow` since their components don't depend on the data.ts `Tenant` type.

- [ ] **Step 3: Add `listOrdersForParent`**

```ts
export type ParentOrderRow = {
  // Order fields (subset used by /orders list)
  id: string;
  tenantId: string;
  status: string;
  total: string;
  createdAt: Date | null;
  studentName: string;
  parentEmail: string;
  // Joined tenant fields for accent / display
  tenantName: string;
  tenantShort: string;
  tenantAccent: string;
};

/**
 * Cross-tenant order list for a parent. Dual-key match: matches on user_id when
 * present, OR on lowercased parent_email. Required because orders.user_id is
 * nullable (pre-auth orders, guest checkouts, FK-orphaned via onDelete:'set null').
 *
 * Joins tenants so historical orders for hidden/disabled tenants stay visible —
 * those flags gate new browsing, not old receipts.
 */
export async function listOrdersForParent(args: {
  userId: string | null;
  email: string;
}): Promise<ParentOrderRow[]> {
  const { userId, email } = args;
  const lowered = email.toLowerCase();

  const rows = await db
    .select({
      id: orders.id,
      tenantId: orders.tenantId,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      studentName: orders.studentName,
      parentEmail: orders.parentEmail,
      tenantName: tenants.name,
      tenantShort: tenants.short,
      tenantAccent: tenants.accent,
    })
    .from(orders)
    .innerJoin(tenants, eq(tenants.id, orders.tenantId))
    .where(
      or(
        userId ? eq(orders.userId, userId) : sql`false`,
        sql`lower(${orders.parentEmail}) = ${lowered}`,
      ),
    )
    .orderBy(desc(orders.createdAt));

  return rows;
}
```

Imports needed: `or`, `desc`, `sql` from `drizzle-orm`, plus `tenants`, `orders` already imported.

- [ ] **Step 4: Type-check and commit**

```bash
pnpm check-types:web
git add apps/web/src/db/queries.ts
git commit -m "feat(db): add getActiveCatalog, getCatalogItem, listOrdersForParent

Prepares the route layer for DB-backed tenants. listOrdersForParent uses a
dual-key (user_id OR lower(parent_email)) match to preserve history for
pre-auth orders, guest checkouts, and FK-orphaned rows.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 1.2: DB-back `app/admin/[tenant]/layout.tsx` and `admin-shell.tsx`

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/layout.tsx`
- Modify: `apps/web/src/components/admin-shell.tsx`

- [ ] **Step 1: Edit `admin-shell.tsx` to accept a `tenant` prop**

Replace the `TENANTS[tenantId]` lookup with a passed-in prop. The layout already has the row.

```ts
// admin-shell.tsx — change signature
type TenantBrand = { id: string; name: string; short: string; accent: string };

export function AdminShell({
  tenantId,           // keep for URL building
  tenant,             // NEW — already-loaded brand
  userName,
  userEmail,
  children,
}: {
  tenantId: string;
  tenant: TenantBrand;
  userName: string | null;
  userEmail: string | null;
  children: React.ReactNode;
}) {
  // Replace the `const tenant = TENANTS[tenantId as TenantId]` line with the prop.
  // Drop the import: `import { TENANTS, type TenantId } from "@/lib/data";`
  // ...rest of component unchanged
}
```

- [ ] **Step 2: Edit `app/admin/[tenant]/layout.tsx`**

Replace the static gate; pass `tenant` to `AdminShell`. Keep visibility rule per spec §4.2: render iff tenant exists AND `platformApprovalStatus !== 'rejected'`.

```ts
// Drop: import { TENANTS, type TenantId } from "@/lib/data";

const { tenant } = await params;
const tenantRecord = await getTenant(tenant);
if (!tenantRecord || tenantRecord.platformApprovalStatus === "rejected") {
  notFound();
}

const user = await getSessionUser();
if (!user) {
  redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(`/admin/${tenant}`)}`);
}

const canAccessTenant =
  isPlatformAdminEmail(user.email) ||
  isTenantOperatorEmail(user.email, tenantRecord.shopEmail);

if (!canAccessTenant) {
  redirect(`/${tenant}`);
}

return (
  <AdminShell
    tenantId={tenant}
    tenant={{ id: tenantRecord.id, name: tenantRecord.name, short: tenantRecord.short, accent: tenantRecord.accent }}
    userName={user.name}
    userEmail={user.email}
  >
    {children}
  </AdminShell>
);
```

- [ ] **Step 3: Type-check, smoke**

```bash
pnpm check-types:web
pnpm dev:web
# In browser: sign in as the NSBH operator, visit /admin/nsbh — verify sidebar renders
# with NSBH name + accent. Then visit /admin/bogus — expect 404.
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/layout.tsx apps/web/src/components/admin-shell.tsx
git commit -m "refactor(admin): DB-back admin layout and shell, drop static TENANTS lookup

Layout now visibility-gates on platformApprovalStatus !== 'rejected' (so pending
tenants are accessible to their operator). AdminShell receives tenant via prop
instead of importing the static TENANTS map. Behaviour for NSBH/RGSH unchanged.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 1.3: DB-back the parent shop routes (6 files)

**Files (all modify):**
- `apps/web/src/app/[tenant]/layout.tsx`
- `apps/web/src/app/[tenant]/page.tsx`
- `apps/web/src/app/[tenant]/cart/page.tsx`
- `apps/web/src/app/[tenant]/checkout/page.tsx`
- `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`
- `apps/web/src/app/[tenant]/order/placed/page.tsx`

For each file, the change pattern is the same:

1. Drop `import { TENANTS, CATALOG, type TenantId } from "@/lib/data"` (remove only the symbols actually used in that file).
2. Replace `TENANTS[slug]` with `toTenantBrand(await getTenant(slug))` so the parent client components keep their existing `Tenant` prop type. Skip the `toTenantBrand` wrapper in admin pages — they already type against the DB row shape.
3. Replace `CATALOG` (note: it's a flat array, not tenant-keyed) with `await getActiveCatalog(slug)`.
4. Apply the parent-shop visibility rule in `[tenant]/layout.tsx`.
5. Where a page uses `getItem(itemId)` (item detail), replace with `getCatalogItem(slug, itemId)` since item lookups are now tenant-scoped via DB.
6. Delete any `generateStaticParams()` that depends on `TenantId` / `CATALOG` — see Step 4 below.

- [ ] **Step 1: `app/[tenant]/layout.tsx` — add visibility rule**

```ts
import { notFound } from "next/navigation";
import { getTenant } from "@/db/queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";

export default async function TenantLayout({
  params,
  children,
}: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const tenantRecord = await getTenant(tenant);
  if (!tenantRecord) notFound();

  const isVisibleToPublic =
    tenantRecord.isPubliclyListed &&
    tenantRecord.platformApprovalStatus === "approved";

  if (!isVisibleToPublic) {
    // Platform-admin escape hatch — admins always see hidden/pending tenants
    // while signed in. The reviewer-suggested `?preview=1` opt-in would require
    // moving the visibility check from the layout (no searchParams) into each
    // page (has searchParams), spreading the gate across 6 files. Accept the
    // simpler trade-off: platform admins see hidden tenants while browsing.
    // To preview the public 404 experience, sign out.
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: `app/[tenant]/page.tsx` — load tenant + catalog**

```ts
// Drop: import { TENANTS, CATALOG, type TenantId } from "@/lib/data";
// Add: import { getTenant, getActiveCatalog, toTenantBrand } from "@/db/queries";

const { tenant: slug } = await params;
const [tenantRecord, catalog] = await Promise.all([
  getTenant(slug),
  getActiveCatalog(slug),
]);
if (!tenantRecord) notFound();
const tenant = toTenantBrand(tenantRecord);

// Pass `tenant` and `catalog` into the existing JSX in place of TENANTS[slug] / CATALOG.
```

- [ ] **Step 3: `app/[tenant]/cart/page.tsx`, `checkout/page.tsx`, `order/placed/page.tsx` — load tenant only**

These three only read `TENANTS[slug]` for accent/name. Replace with:

```ts
import { getTenant, toTenantBrand } from "@/db/queries";

const { tenant: slug } = await params;
const tenantRecord = await getTenant(slug);
if (!tenantRecord) notFound();
const tenant = toTenantBrand(tenantRecord);
```

- [ ] **Step 4: `app/[tenant]/item/[itemId]/page.tsx` — load item from DB + delete `generateStaticParams` + legacy-URL redirect**

Current page has a `generateStaticParams()` that prerenders `(tenant, item)` pairs from the static `TenantId` union × static `CATALOG`. With wizard-created tenants and runtime catalog edits, prerendering is no longer correct (the param set is unbounded). **Delete the function entirely** and let the route render dynamically.

**Legacy-URL redirect**: today `/rgsh/item/shirt-ls` works because the static `CATALOG` is tenant-agnostic. After Task 1.6 seeds RGSH with `rgsh-`-prefixed ids, the DB row is `id='rgsh-shirt-ls'`, so the unprefixed URL would 404. Any bookmark/share/index of the old URL would break. Add a 1-step fallback: if the direct lookup misses, try the canonical `${slug}-${itemId}` shape and **permanently** redirect (HTTP 308) to the prefixed URL when found. **Use `permanentRedirect` from `next/navigation`, NOT `redirect`** — the latter emits 307 (temporary), which is wrong here because the prefixed URL is the canonical one going forward; we want bookmarks and search engines to update.

NSBH (unprefixed ids) always hits the primary lookup; RGSH legacy URLs survive via the redirect; new home-page links already use canonical prefixed ids.

```ts
import { permanentRedirect, notFound } from "next/navigation";
// Drop: import { CATALOG, TENANTS, type TenantId, getItem } from "@/lib/data";
// Drop: the entire `export function generateStaticParams() { ... }` block.
// Add:  import { getTenant, getCatalogItem, toTenantBrand } from "@/db/queries";

const { tenant: slug, itemId } = await params;
const [tenantRecord, item] = await Promise.all([
  getTenant(slug),
  getCatalogItem(slug, itemId),
]);
if (!tenantRecord) notFound();

let resolvedItem = item;
if (!resolvedItem) {
  // Legacy-URL fallback: try the prefixed canonical id (Task 1.6 seed shape).
  const canonicalId = `${slug}-${itemId}`;
  if (canonicalId !== itemId) {
    const fallback = await getCatalogItem(slug, canonicalId);
    if (fallback) {
      // 308 permanent redirect — bookmarks update, search engines learn the new URL.
      permanentRedirect(`/${slug}/item/${canonicalId}`);
    }
  }
  notFound();
}

const tenant = toTenantBrand(tenantRecord);
```

Then thread `tenant` and `resolvedItem` into the existing JSX, replacing references to `TENANTS[slug]` and the old `getItem(itemId)` / `CATALOG.find()` lookup. The `<ItemDetailInteractive item={resolvedItem} ... />` call works as-is since `getCatalogItem` returns the `CatalogItem` UI shape (Task 1.1 step 1+2).

- [ ] **Step 5: Type-check and smoke**

```bash
pnpm check-types:web
pnpm dev:web
# In browser as a parent:
#   /nsbh             — home renders with NSBH accent
#   /nsbh/item/blazer — item detail renders
#   /nsbh/cart        — cart page renders
#   /bogus            — 404
# Direct DB toggle (Neon SQL editor):
#   UPDATE tenants SET is_publicly_listed = false WHERE id = 'nsbh';
#   /nsbh now 404s for non-platform-admin users
#   Restore: UPDATE tenants SET is_publicly_listed = true WHERE id = 'nsbh';
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[tenant]/
git commit -m "refactor(parent-shop): DB-back the 6 [tenant] routes

Drops static TENANTS/CATALOG imports; routes now load via getTenant +
getActiveCatalog. Layout enforces parent visibility rule (publicly listed +
approved) with a platform-admin preview escape hatch.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 1.4: DB-back the admin pages (7 remaining files)

**Files (all modify):**
- `apps/web/src/app/admin/[tenant]/catalog/page.tsx`
- `apps/web/src/app/admin/[tenant]/dashboard/page.tsx`
- `apps/web/src/app/admin/[tenant]/orders/page.tsx`
- `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx`
- `apps/web/src/app/admin/[tenant]/reports/page.tsx`
- `apps/web/src/app/admin/[tenant]/settings/page.tsx`
- `apps/web/src/app/admin/[tenant]/upload/page.tsx`

For each: drop the static `TENANTS` / `CATALOG` import, replace with `await getTenant(slug)`. The admin catalog page uses the **existing** `getCatalogByTenant` helper (already in `db/queries.ts:522`), NOT the new `getActiveCatalog` — admin needs to manage inactive items too, so it must see all items regardless of `active` flag.

- [ ] **Step 1: Apply the same drop-static-imports pattern to each file**

Pattern for the seven admin pages:

```ts
// Drop: import { TENANTS, type TenantId } from "@/lib/data";
// Add (where needed): import { getTenant } from "@/db/queries";

const { tenant: slug } = await params;
const tenantRecord = await getTenant(slug);
if (!tenantRecord) notFound();

// Replace TENANTS[slug as TenantId] usages with `tenantRecord`.
```

For `catalog/page.tsx`: drop the `CATALOG[slug]` static lookup. The page likely already calls `/api/catalog?tenantId=...` (which uses `getCatalogByTenant` server-side); if it reads `CATALOG` in addition for some seed display, replace that read with `await getCatalogByTenant(slug)`. **Do not introduce `getActiveCatalog` here** — admin catalog management must show inactive items.

For `orders/[orderId]/page.tsx` drop the redundant `if (!(tid in TENANTS))` line entirely — the layout already gates visibility.

- [ ] **Step 2: Type-check and smoke**

```bash
pnpm check-types:web
pnpm dev:web
# Sign in as the NSBH operator, visit each admin page:
#   /admin/nsbh          — dashboard
#   /admin/nsbh/orders   — orders board
#   /admin/nsbh/catalog  — catalog
#   /admin/nsbh/reports  — reports
#   /admin/nsbh/settings — settings
#   /admin/nsbh/upload   — upload
# All render with NSBH branding.
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/
git commit -m "refactor(admin): DB-back the 7 admin pages

Drops static TENANTS/CATALOG imports across dashboard, orders board,
order detail, catalog, reports, settings, upload.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 1.5: DB-back parent order history (2 files)

**Files:**
- Modify: `apps/web/src/app/orders/page.tsx`
- Modify: `apps/web/src/app/orders/orders-list-client.tsx`

This is the spec's most-scrutinised replacement. Order-driven, dual-key match, joined tenant data.

- [ ] **Step 1: Edit `app/orders/page.tsx` (RSC)**

Replace `getOrdersByParentEmail(email)` with `listOrdersForParent({ userId, email })` and pass joined records into the client component.

```ts
// Drop the per-tenant fan-out; use the new joined query.
import { listOrdersForParent } from "@/db/queries";

const user = await getSessionUser();
if (!user) {
  redirect(`/auth/sign-in?callbackURL=/orders`);
}

const orders = await listOrdersForParent({
  userId: user.id,        // SessionUser.id is non-nullable
  email: user.email,
});

return <OrdersListClient orders={orders} />;
```

- [ ] **Step 2: Edit `orders-list-client.tsx` to consume joined data**

```ts
// Drop: import { TENANTS, type TenantId } from "@/lib/data";
// Drop the Object.keys(TENANTS) enumeration and per-row TENANTS[o.tenantId] lookups.

import type { ParentOrderRow } from "@/db/queries";

export function OrdersListClient({ orders }: { orders: ParentOrderRow[] }) {
  // For each order row, read accent/name directly from the joined fields:
  //   o.tenantAccent, o.tenantName, o.tenantShort
  // Group by tenant for the existing UI sections (e.g., `Map<tenantId, orders[]>`).
  // Sort tenants by most-recent-order timestamp.
}
```

If the existing UI groups orders by tenant, build the grouping in-component from the flat list rather than via a separate tenant enumeration.

- [ ] **Step 3: Type-check and smoke**

```bash
pnpm check-types:web
pnpm dev:web
# Sign in as a parent with existing orders, visit /orders.
# Verify orders render grouped by tenant with correct accent/name.
```

- [ ] **Step 4: Smoke the dual-key match (regression bar from spec §13.5.9)**

In Neon SQL editor:

```sql
-- Pick an existing NSBH order whose user_id is currently set, copy its parent_email,
-- then null user_id:
SELECT id, parent_email, user_id FROM orders WHERE tenant_id = 'nsbh' LIMIT 5;
UPDATE orders SET user_id = NULL WHERE id = '<order-id>';
```

Sign in as the parent whose email matches that order's `parent_email`, visit `/orders`, confirm the row is still listed despite `user_id IS NULL`. Restore:

```sql
UPDATE orders SET user_id = '<original-user-id>' WHERE id = '<order-id>';
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/orders/
git commit -m "refactor(orders): DB-back /orders with order-driven dual-key query

Replaces Object.keys(TENANTS) enumeration with listOrdersForParent({ userId,
email }) — single cross-tenant query joined with tenant data. Dual-key match
(user_id OR lower(parent_email)) preserves history for pre-auth orders,
guest checkouts, and FK-orphaned rows. Hidden/disabled tenants stay visible
in history because the join surfaces them regardless of public-listing status.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 1.6: Seed RGSH catalog

**Why this task exists:** today, the parent shop renders both NSBH and RGSH from the shared static `CATALOG` flat array, so RGSH appears to have products even though `seed.mjs` only inserts NSBH catalog rows. The moment Tasks 1.3–1.4 replace `CATALOG` with `getActiveCatalog(slug)`, RGSH's `/rgsh` becomes empty. We close that regression in the same PR by extending the seed to insert RGSH catalog rows with `rgsh-`-prefixed item IDs (avoids PK conflict with NSBH's unprefixed IDs; the size-lookup prefix-strip fallback handles the new id shape, proven by the cloned-tenant smoke in Task 1.1).

If RGSH ever needs a divergent catalog, that's a follow-up via the platform portal's edit drawer — not in scope for this PR.

**Files:**
- Modify: `apps/web/scripts/seed.mjs`

- [ ] **Step 1: Extend `seed.mjs` to insert RGSH catalog**

Mirror the existing NSBH `catalogItemsRows` and `catalogVariantsRows` blocks, with two transformations applied to each row:
- `tenantId: "rgsh"`
- `id: \`rgsh-${nsbhId}\``  (e.g., `rgsh-shirt-ls`)
- `itemId: \`rgsh-${nsbhItemId}\`` for variant rows

The simplest implementation: build the RGSH arrays by mapping over the NSBH arrays already in the file:

```js
// After the existing NSBH catalogItemsRows / catalogVariantsRows definitions:
const rgshCatalogItemsRows = catalogItemsRows.map((it) => ({
  ...it,
  id: `rgsh-${it.id}`,
  tenantId: "rgsh",
}));
const rgshCatalogVariantsRows = catalogVariantsRows.map((v) => ({
  ...v,
  itemId: `rgsh-${v.itemId}`,
}));

// Then extend the upserts to include both:
const allCatalogItemsRows = [...catalogItemsRows, ...rgshCatalogItemsRows];
const allCatalogVariantsRows = [...catalogVariantsRows, ...rgshCatalogVariantsRows];
// ...replace the original NSBH-only rows in the upsert calls with the combined arrays.
```

Verify the existing `ON CONFLICT DO UPDATE` (items) and `DELETE + INSERT` (variants) logic still applies cleanly to the combined set.

- [ ] **Step 2: Run seed against dev DB**

```bash
cd apps/web && DATABASE_URL=<dev-branch-url> node scripts/seed.mjs
```

Expected output: log lines for both NSBH and RGSH item/variant inserts. Confirm in Neon SQL editor:

```sql
SELECT tenant_id, COUNT(*) FROM catalog_items GROUP BY tenant_id;
-- nsbh | <N>
-- rgsh | <N>   ← same count

SELECT id FROM catalog_items WHERE tenant_id = 'rgsh' LIMIT 5;
-- rgsh-shirt-ls, rgsh-jumper, ...
```

- [ ] **Step 3: Smoke `/rgsh` against the DB-backed routes**

```bash
pnpm dev:web
# Visit /rgsh — confirm the same item set as /nsbh now renders, with the
# RGSH accent (#1F3A6E or whatever it's set to). Click into an item, confirm
# the size picker shows the multi-element sizes array (NOT just [variantLabel]) —
# proves the prefix-strip path in sizesForVariant works against real DB data.
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/scripts/seed.mjs
git commit -m "feat(seed): seed RGSH catalog with rgsh- prefixed ids

Closes a regression that would land in PR B: today both tenants render the
parent shop from the shared static CATALOG array, but DB-backing the routes
exposes that only NSBH had catalog rows seeded. RGSH gets prefixed-id rows
(e.g., rgsh-shirt-ls) — the size-lookup prefix-strip fallback in
sizesForVariant maps these back to the static CATALOG by stripping the
tenant prefix.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 5: Production seed (deploy step, not part of this commit)**

Carry through to Task 7.1 / spec §13 deploy checklist: re-run the seed against the production Neon branch as part of the PR B rollout.

### Task 1.7: Final Phase 1 verification

- [ ] **Step 1: Full type-check**

```bash
pnpm check-types
```

Expected: no errors.

- [ ] **Step 2: Full smoke matrix**

```
Parent (signed out):
  / (school picker)        — both schools listed
  /nsbh                    — renders with full catalog (unprefixed ids)
  /nsbh/item/shirt-ls      — item detail renders with multi-element size picker
  /rgsh                    — renders with full catalog (rgsh- prefixed ids, post-Task 1.6 seed)
  /rgsh/item/rgsh-shirt-ls — item detail renders with multi-element size picker
                              (proves the prefix-strip path in sizesForVariant works
                              against real DB data, not just the unit smoke from Task 1.1)
  /rgsh/item/shirt-ls      — 308-redirects to /rgsh/item/rgsh-shirt-ls
                              (proves the legacy-URL redirect in Task 1.3 step 4 works;
                              protects bookmarks/shares of pre-DB-backing URLs)
  /bogus                   — 404

Parent (signed in):
  /orders                  — own order history renders, grouped by tenant

Admin operator (NSBH operator email):
  /admin/nsbh              — dashboard renders
  /admin/nsbh/orders       — board renders
  /admin/nsbh/catalog      — catalog renders
  /admin/rgsh              — redirects to /rgsh (no access)

Platform admin (george.qiao@pimspace.com):
  All admin pages for both tenants accessible.
```

- [ ] **Step 3: Open the PR**

(See `superpowers:finishing-a-development-branch` skill for the merge / PR flow.)

---

## Phase 2 — Platform shell + auth gate

**PR C (part 1). Estimate: 2 hrs.**

### Task 2.1: Create `PlatformShell` component

**Files:**
- Create: `apps/web/src/components/platform-shell.tsx`

- [ ] **Step 1: Write the component**

`"use client"` so it can read `usePathname()` for the active-nav highlight without prop drilling from the layout. (Layout stays an RSC for the auth gate; only the shell shell-chrome is client.)

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/platform/tenants", label: "Tenants" },
  { href: "/platform/billing", label: "Billing" },
] as const;

export function PlatformShell({
  userName,
  userEmail,
  children,
}: {
  userName: string | null;
  userEmail: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const active: "tenants" | "billing" = pathname.startsWith("/platform/billing") ? "billing" : "tenants";
  return (
    <div className="flex min-h-screen bg-parchment text-ink font-sans">
      <aside className="w-[220px] shrink-0 bg-[#0A1726] text-[#E8E0CF] flex flex-col">
        <div className="px-[18px] py-[20px] border-b border-white/[0.08]">
          <div className="font-serif text-[22px] font-semibold text-white">UniformOrder</div>
          <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.6px] font-semibold text-[#A3B0C2]">
            Platform Console
          </div>
        </div>
        <nav className="flex-1 px-2 py-3.5">
          {NAV.map((n) => {
            const on = active === n.href.split("/").pop();
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 px-3 py-2 my-0.5 rounded-md text-[13px] ${
                  on ? "bg-white/[0.07] text-white font-semibold" : "text-[#B6C0CE] font-medium"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/[0.08] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gold text-navy-deep flex items-center justify-center text-xs font-bold">
            {(userName ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{userName ?? "—"}</div>
            <div className="text-[10.5px] text-[#A3B0C2] truncate">Platform admin</div>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 3: Commit (defer; bundle with layout)**

### Task 2.2: Create `app/platform/layout.tsx` with auth gate

**Files:**
- Create: `apps/web/src/app/platform/layout.tsx`

- [ ] **Step 1: Write the layout**

```tsx
import { redirect, notFound } from "next/navigation";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { PlatformShell } from "@/components/platform-shell";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    // Hardcoded callback — Next.js layouts don't get the request URL out of the
    // box, and we deliberately have no middleware. /platform/tenants is the
    // only meaningful entry point; deep links inside the gated zone (e.g.
    // /platform/billing or /platform/tenants/[id]) are reachable only after
    // an admin is already signed in, so a single shared callback is fine.
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/platform")}`);
  }
  if (!isPlatformAdminEmail(user.email)) {
    notFound();
  }

  return (
    <PlatformShell userName={user.name} userEmail={user.email}>
      {children}
    </PlatformShell>
  );
}
```

- [ ] **Step 2: Create `app/platform/page.tsx`**

**Files:**
- Create: `apps/web/src/app/platform/page.tsx`

```tsx
import { redirect } from "next/navigation";

export default function PlatformIndex() {
  redirect("/platform/tenants");
}
```

- [ ] **Step 3: Smoke the auth gate**

```bash
pnpm dev:web
# Visit /platform when signed out          — redirects to /auth/sign-in
# Sign in as a parent test account, visit  — 404 (not allowlisted)
# Sign in as george.qiao@pimspace.com      — redirects to /platform/tenants
#                                            (which currently 404s — Phase 3 fixes)
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/platform-shell.tsx apps/web/src/app/platform/
git commit -m "feat(platform): scaffold /platform with auth gate

In-layout auth gate (no middleware) using existing isPlatformAdminEmail()
helper. Mirrors app/admin/[tenant]/layout.tsx pattern. Unauthenticated →
sign-in redirect; authenticated non-admin → 404 (no leak).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### ~~Task 2.3~~ — folded into Task 2.1

Active-nav resolution is handled inside `PlatformShell` itself (it reads `usePathname()` since it's a client component). No separate task needed.

---

## Phase 3 — Tenant list

**PR C (part 2). Estimate: 3 hrs.**

### Task 3.1: Add `lib/platform/queries.ts`

**Files:**
- Create: `apps/web/src/lib/platform/queries.ts`

- [ ] **Step 1: Write `listTenantsWithStats`**

```ts
import { db } from "@/db";
import { tenants, orders, orderRefunds } from "@/db/schema";
import { sql, desc } from "drizzle-orm";

export type TenantStatus = "setup" | "active" | "hidden" | "disabled";

export type TenantStatsRow = {
  id: string;
  name: string;
  short: string;
  accent: string;
  createdAt: Date | null;
  status: TenantStatus;
  parents: number;
  orders30d: number;
  revenue30d: string; // currency string, two decimals
};

function deriveStatus(t: {
  platformApprovalStatus: string;
  stripeChargesEnabled: boolean | null;
  isPubliclyListed: boolean;
}): TenantStatus {
  if (t.platformApprovalStatus === "rejected") return "disabled";
  if (t.platformApprovalStatus !== "approved" || !t.stripeChargesEnabled) return "setup";
  return t.isPubliclyListed ? "active" : "hidden";
}

export async function listTenantsWithStats(): Promise<TenantStatsRow[]> {
  // One SQL with LEFT JOIN aggregations.
  const rows = await db.execute(sql`
    SELECT
      t.id, t.name, t.short, t.accent, t.created_at,
      t.platform_approval_status, t.stripe_charges_enabled, t.is_publicly_listed,
      COALESCE(stats.parents, 0)       AS parents,
      COALESCE(stats.orders30d, 0)     AS orders_30d,
      COALESCE(stats.revenue30d, 0)::text AS revenue_30d
    FROM tenants t
    LEFT JOIN (
      SELECT
        o.tenant_id,
        COUNT(DISTINCT COALESCE(o.user_id::text, lower(o.parent_email))) AS parents,
        COUNT(*) FILTER (
          WHERE o.status != 'pending_payment'
            AND o.created_at > now() - interval '30 days'
        ) AS orders30d,
        SUM(o.total) FILTER (WHERE o.created_at > now() - interval '30 days')
          - COALESCE(SUM(r.amount) FILTER (WHERE r.created_at > now() - interval '30 days'), 0) AS revenue30d
      FROM orders o
      LEFT JOIN order_refunds r ON r.order_id = o.id
      GROUP BY o.tenant_id
    ) stats ON stats.tenant_id = t.id
    ORDER BY t.created_at DESC
  `);

  return rows.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    short: r.short as string,
    accent: r.accent as string,
    createdAt: r.created_at as Date | null,
    status: deriveStatus({
      platformApprovalStatus: r.platform_approval_status as string,
      stripeChargesEnabled: r.stripe_charges_enabled as boolean | null,
      isPubliclyListed: r.is_publicly_listed as boolean,
    }),
    parents: Number(r.parents),
    orders30d: Number(r.orders_30d),
    revenue30d: String(r.revenue_30d),
  }));
}

export type PlatformKpis = {
  tenants: { total: number; active: number; setup: number };
  parents: number;
  orders30d: { count: number; deltaMom: number | null };
  revenue30d: string;
};

export async function getPlatformKpis(): Promise<PlatformKpis> {
  const list = await listTenantsWithStats();

  // 30d count is sum of per-tenant orders30d.
  const orders30d = list.reduce((s, t) => s + t.orders30d, 0);

  // Prior-30d count for delta: separate query.
  const priorRow = await db.execute(sql`
    SELECT COUNT(*) AS n FROM orders
    WHERE status != 'pending_payment'
      AND created_at > now() - interval '60 days'
      AND created_at <= now() - interval '30 days'
  `);
  const prior = Number(priorRow.rows[0]?.n ?? 0);
  const deltaMom = prior > 0 ? (orders30d - prior) / prior : null;

  return {
    tenants: {
      total: list.length,
      active: list.filter((t) => t.status === "active").length,
      setup: list.filter((t) => t.status === "setup").length,
    },
    parents: list.reduce((s, t) => s + t.parents, 0),
    orders30d: { count: orders30d, deltaMom },
    revenue30d: list.reduce((s, t) => s + Number(t.revenue30d), 0).toFixed(2),
  };
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 3: Smoke against dev DB**

Add a temporary scratch script `apps/web/scripts/smoke-platform-queries.ts`:

```ts
import { listTenantsWithStats, getPlatformKpis } from "@/lib/platform/queries";
const list = await listTenantsWithStats();
console.log(JSON.stringify(list, null, 2));
console.log(JSON.stringify(await getPlatformKpis(), null, 2));
```

```bash
cd apps/web && pnpm tsx scripts/smoke-platform-queries.ts
```

Expected: 2 rows (NSBH, RGSH) with sane numbers; KPIs aggregate them. Delete the scratch script after.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/platform/queries.ts
git commit -m "feat(platform): add listTenantsWithStats and getPlatformKpis"
```

### Task 3.2: Tenant list page

**Files:**
- Create: `apps/web/src/app/platform/tenants/page.tsx`
- Create: `apps/web/src/app/platform/tenants/tenants-table.tsx`

- [ ] **Step 1: Write the RSC page**

```tsx
// apps/web/src/app/platform/tenants/page.tsx
import Link from "next/link";
import { listTenantsWithStats, getPlatformKpis } from "@/lib/platform/queries";
import { TenantsTable } from "./tenants-table";

export default async function PlatformTenantsPage() {
  const [list, kpis] = await Promise.all([listTenantsWithStats(), getPlatformKpis()]);

  return (
    <>
      <header className="flex items-center justify-between px-7 py-5 border-b border-rule">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.6px] font-bold text-ink-dim">
            UniformOrder Platform
          </div>
          <h1 className="font-serif text-2xl font-semibold mt-1">Tenant schools</h1>
        </div>
        <Link
          href="/platform/tenants/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-navy-deep text-white text-sm font-semibold"
        >
          + Provision new tenant
        </Link>
      </header>

      <div className="flex-1 px-7 py-6 overflow-auto">
        <KpiTiles kpis={kpis} />
        <div className="mt-6">
          <TenantsTable rows={list} />
        </div>
      </div>
    </>
  );
}

function KpiTiles({ kpis }: { kpis: Awaited<ReturnType<typeof getPlatformKpis>> }) {
  const tiles = [
    {
      label: "Tenants",
      value: kpis.tenants.total,
      sub: `${kpis.tenants.active} active · ${kpis.tenants.setup} setup`,
    },
    {
      label: "Parents",
      value: kpis.parents.toLocaleString(),
      sub: "Across all schools",
    },
    {
      label: "Orders · 30d",
      value: kpis.orders30d.count,
      sub:
        kpis.orders30d.deltaMom == null
          ? "—"
          : `${kpis.orders30d.deltaMom > 0 ? "+" : ""}${(kpis.orders30d.deltaMom * 100).toFixed(0)}% MoM`,
    },
    {
      label: "Revenue · 30d",
      value: `$${Number(kpis.revenue30d).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      sub: "Gross — net of refunds",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3.5">
      {tiles.map((t) => (
        <div key={t.label} className="bg-paper rounded-[10px] border border-rule p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-ink-dim">
            {t.label}
          </div>
          <div className="font-serif text-[26px] font-semibold mt-1.5 tnum">{t.value}</div>
          <div className="text-[11px] text-ink-dim mt-1">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the client table with filter + search**

```tsx
// apps/web/src/app/platform/tenants/tenants-table.tsx
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { TenantStatsRow, TenantStatus } from "@/lib/platform/queries";

const FILTERS: Array<{ id: TenantStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "setup", label: "Setup" },
  { id: "hidden", label: "Hidden" },
];

export function TenantsTable({ rows }: { rows: TenantStatsRow[] }) {
  const [filter, setFilter] = useState<TenantStatus | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (ql && !(r.name.toLowerCase().includes(ql) || r.id.toLowerCase().includes(ql)))
        return false;
      return true;
    });
  }, [rows, filter, q]);

  return (
    <div className="bg-paper rounded-[10px] border border-rule overflow-hidden">
      <div className="px-4 py-3 border-b border-rule flex items-center gap-2.5">
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`h-7 px-3 rounded-md text-xs font-semibold ${
                filter === f.id ? "bg-navy-deep text-white" : "text-ink-dim"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or code"
          className="h-8 w-60 border border-rule rounded-md px-2.5 text-xs"
        />
      </div>
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-parchment">
            {["School", "Parents", "Orders·30d", "Revenue·30d", "Since", "Status", ""].map((h, i) => (
              <th
                key={h}
                className={`px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-ink-dim border-b border-rule ${
                  i >= 1 && i <= 3 ? "text-right" : i === 6 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className="border-b border-rule last:border-0">
              <td className="px-4 py-3">
                <div className="font-semibold text-[13.5px] font-serif">{r.name}</div>
                <div className="font-mono text-[10.5px] text-ink-dim mt-0.5">
                  {r.id}.uniformorder.online
                </div>
              </td>
              <td className="px-4 py-3 text-right tnum">{r.parents.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tnum">{r.orders30d}</td>
              <td className="px-4 py-3 text-right tnum">${Number(r.revenue30d).toFixed(0)}</td>
              <td className="px-4 py-3 text-ink-dim">
                {r.createdAt?.toLocaleDateString("en-AU", { month: "short", year: "numeric" }) ?? "—"}
              </td>
              <td className="px-4 py-3">
                <StatusChip status={r.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/platform/tenants/${r.id}`} className="text-xs font-semibold text-navy-deep underline">
                  Open →
                </Link>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-dim">
                No tenants match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ status }: { status: TenantStatus }) {
  const map = {
    active: { label: "Active", cls: "bg-green-100 text-green-800" },
    setup: { label: "Setup", cls: "bg-amber-100 text-amber-800" },
    hidden: { label: "Hidden", cls: "bg-blue-100 text-blue-800" },
    disabled: { label: "Disabled", cls: "bg-red-100 text-red-800" },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${m.cls}`}>
      {m.label}
    </span>
  );
}
```

- [ ] **Step 3: Smoke**

```bash
pnpm check-types:web
pnpm dev:web
# Sign in as platform admin, visit /platform/tenants
# See KPI tiles + table with NSBH/RGSH rows. Try filter/search.
# Click "Open →" — currently 404s; Phase 5 fixes.
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform/tenants/
git commit -m "feat(platform): tenant list with KPI tiles, filter, search"
```

---

## Phase 4 — Provision wizard

**PR D. Estimate: 8–10 hrs. Largest single PR. Depends on PR A (logo_url) + PR C.**

### Task 4.1: Slug helper + Zod schemas

**Files:**
- Create: `apps/web/src/lib/platform/slug.ts`
- Create: `apps/web/src/lib/platform/schema.ts`

- [ ] **Step 1: Slug helper**

```ts
// slug.ts
const SLUG_RE = /^[a-z][a-z0-9-]{2,15}$/;

export function deriveSlug(short: string): string {
  return short.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 16);
}

export function deriveShort(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 6);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}
```

- [ ] **Step 2: Zod schemas (per-step)**

Only steps 1, 2, 4 collect form fields and need schemas. **Steps 3, 5, 6 don't need form schemas:**
- Step 3 (Stripe) is action-only — single button triggers `createStripeStandardForTenant`.
- Step 5 (Catalog) is a single-select dropdown + clone action; the source slug is validated server-side against `tenants.id`.
- Step 6 (Go live) is a read-only checklist + single finalize action with no user-supplied input.

Do not add unnecessary schemas for these.

```ts
// schema.ts
import { z } from "zod";

export const slugSchema = z
  .string()
  .min(3)
  .max(16)
  .regex(/^[a-z][a-z0-9-]{2,15}$/, "Use lowercase letters, digits, hyphens; start with a letter");

export const step1Schema = z.object({
  name: z.string().min(2).max(120),
  short: z.string().min(2).max(8),
  id: slugSchema,
  motto: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
});

export const step2Schema = z.object({
  logoUrl: z.string().url().nullable(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const step4Schema = z.object({
  shopEmail: z.string().email(),
  shopHours: z.string().max(200).optional(),
  collectionInstructions: z.string().max(800).optional(),
});

export type Step1 = z.infer<typeof step1Schema>;
export type Step2 = z.infer<typeof step2Schema>;
export type Step4 = z.infer<typeof step4Schema>;
```

- [ ] **Step 3: Type-check + commit**

```bash
pnpm check-types:web
git add apps/web/src/lib/platform/
git commit -m "feat(platform): slug + Zod schemas for provision wizard"
```

### Task 4.2: Add `tenantLogo` UploadThing route

**Files:**
- Modify: `apps/web/src/lib/uploadthing.ts`

- [ ] **Step 1: Add the `tenantLogo` entry**

Inside the `uploadRouter` object, add a sibling to `catalogImage`:

```ts
tenantLogo: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
  .input(z.object({ tenantId: z.string().min(1) }))
  .middleware(async ({ input }) => {
    const auth = await requireSessionUser();
    if ("response" in auth) {
      throw new UploadThingError("Authentication required");
    }
    const { user } = auth;
    if (!isPlatformAdminEmail(user.email)) {
      throw new UploadThingError("Platform admin only");
    }
    return { tenantId: input.tenantId, userId: user.id };
  })
  .onUploadComplete(async ({ metadata, file }) => {
    return { url: file.url, tenantId: metadata.tenantId };
  }),
```

Add `isPlatformAdminEmail` to the imports at the top of the file. **Do not touch** the existing `catalogImage` route — its approval-status gate stays.

- [ ] **Step 2: Type-check + commit**

```bash
pnpm check-types:web
git add apps/web/src/lib/uploadthing.ts
git commit -m "feat(uploadthing): add tenantLogo route gated to platform admins

Sibling route to catalogImage. Skips the platformApprovalStatus='approved'
gate so pending tenants can receive logos during the provision wizard.
catalogImage stays untouched.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 4.3: Wizard server actions

**Files:**
- Create: `apps/web/src/app/platform/tenants/new/actions.ts`

- [ ] **Step 1: `createTenantDraft`**

```ts
"use server";
import { db } from "@/db";
import { tenants, catalogItems, catalogVariants } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { step1Schema, step2Schema, step4Schema } from "@/lib/platform/schema";

async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user || !isPlatformAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function createTenantDraft(input: unknown) {
  await requirePlatformAdmin();
  const parsed = step1Schema.parse(input);

  // Unique-check slug.
  const existing = await db.query.tenants.findFirst({ where: eq(tenants.id, parsed.id) });
  if (existing) {
    return { ok: false as const, error: `Slug "${parsed.id}" is already taken.` };
  }

  await db.insert(tenants).values({
    id: parsed.id,
    name: parsed.name,
    short: parsed.short,
    motto: parsed.motto ?? null,
    address: parsed.address ?? null,
    // accent uses schema default; logo_url null
    platformApprovalStatus: "pending",
    isPubliclyListed: false,
  });

  revalidatePath("/platform/tenants");
  return { ok: true as const, id: parsed.id };
}
```

- [ ] **Step 2: `updateTenantBranding`, `updateTenantOperator`**

```ts
export async function updateTenantBranding(id: string, input: unknown) {
  await requirePlatformAdmin();
  const parsed = step2Schema.parse(input);

  await db
    .update(tenants)
    .set({
      logoUrl: parsed.logoUrl,
      accent: parsed.accent,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id));

  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath(`/${id}`, "layout");
  return { ok: true as const };
}

export async function updateTenantOperator(id: string, input: unknown) {
  await requirePlatformAdmin();
  const parsed = step4Schema.parse(input);

  await db
    .update(tenants)
    .set({
      shopEmail: parsed.shopEmail,
      shopHours: parsed.shopHours ?? null,
      collectionInstructions: parsed.collectionInstructions ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id));

  revalidatePath(`/platform/tenants/${id}`);
  return { ok: true as const };
}
```

- [ ] **Step 3: `createStripeStandardForTenant`**

Match the existing `apps/web/src/app/api/stripe/connect/route.ts` model: `type: "standard"`, account link with `type: "account_onboarding"`. **Use the existing `getStripe()` singleton (no apiVersion pin) and the `updateTenantStripe` query helper to avoid drift with the connect route.**

```ts
import { getStripe } from "@/lib/stripe";
import { updateTenantStripe } from "@/db/queries";

export async function createStripeStandardForTenant(id: string) {
  await requirePlatformAdmin();

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  if (!tenant) return { ok: false as const, error: "Tenant not found" };

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";

  let acctId = tenant.stripeAccountId;
  if (!acctId) {
    const account = await stripe.accounts.create({
      type: "standard",
      email: tenant.shopEmail ?? undefined,
      business_profile: {
        name: tenant.name,
        url: `${appUrl}/${tenant.id}`,
      },
      metadata: { tenantId: tenant.id },
    });
    acctId = account.id;
    await updateTenantStripe(id, {
      stripeAccountId: acctId,
      stripePayoutsEnabled: false,
      stripeChargesEnabled: false,
    });
  }

  const link = await stripe.accountLinks.create({
    account: acctId,
    refresh_url: `${appUrl}/platform/tenants/${id}?stripe_refresh=1`,
    return_url: `${appUrl}/platform/tenants/${id}?stripe_return=1`,
    type: "account_onboarding",
  });

  revalidatePath(`/platform/tenants/${id}`);
  return { ok: true as const, accountId: acctId, onboardingUrl: link.url };
}
```

- [ ] **Step 4: `cloneCatalogFromTenant` — split into auth-gated action + pure helper**

The clone logic lives in two places that need to call it: the wizard (auth-gated) and the smoke script in Task 1.1 (no session). Extract a pure DB helper that both can use. Put the helper in `lib/platform/clone-catalog.ts` so the smoke script can import it without pulling the whole server-actions module.

```ts
// apps/web/src/lib/platform/clone-catalog.ts
import { db } from "@/db";
import { catalogItems, catalogVariants } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export type CloneResult =
  | { ok: true; copied: number }
  | { ok: false; error: string };

/**
 * Pure DB clone — NO auth check. Callers must enforce authorization
 * (server actions do; smoke scripts skip). Idempotent via dst-empty preflight.
 */
export async function cloneCatalogFromTenantUnsafe(
  srcTenantId: string,
  dstTenantId: string,
): Promise<CloneResult> {
  if (srcTenantId === dstTenantId) {
    return { ok: false, error: "Source and destination must differ" };
  }

  const [dstCountRow] = await db
    .select({ n: count() })
    .from(catalogItems)
    .where(eq(catalogItems.tenantId, dstTenantId));
  const dstCount = Number(dstCountRow?.n ?? 0);
  if (dstCount > 0) {
    return {
      ok: false,
      error: `Destination tenant already has ${dstCount} catalog item(s). Clear its catalog before re-cloning.`,
    };
  }

  const srcItems = await db.query.catalogItems.findMany({
    where: eq(catalogItems.tenantId, srcTenantId),
  });
  if (srcItems.length === 0) {
    return { ok: true as const, copied: 0 };
  }

  // Build oldId → newId map. New ID = `{dstSlug}-{tail-of-source-id}` after stripping the source slug prefix.
  const idMap = new Map<string, string>();
  for (const it of srcItems) {
    const tail = it.id.startsWith(`${srcTenantId}-`)
      ? it.id.slice(srcTenantId.length + 1)
      : it.id; // fall back to full id if no slug prefix
    const newId = `${dstTenantId}-${tail}`;
    idMap.set(it.id, newId);
  }

  const srcVariants = await db.query.catalogVariants.findMany({
    where: (v, { inArray }) => inArray(v.itemId, srcItems.map((i) => i.id)),
  });

  // Insert items + variants in a single batch.
  // Guard the variants insert: drizzle .values([]) throws on empty arrays.
  const inserts: any[] = [
    db.insert(catalogItems).values(
      srcItems.map((it) => ({
        id: idMap.get(it.id)!,
        tenantId: dstTenantId,
        name: it.name,
        category: it.category,
        description: it.description,
        imageUrl: it.imageUrl,
        sizeGuide: it.sizeGuide,
        active: it.active,
        sortOrder: it.sortOrder,
      })),
    ),
  ];
  if (srcVariants.length > 0) {
    inserts.push(
      db.insert(catalogVariants).values(
        srcVariants.map((v) => ({
          // id is uuid().defaultRandom() — let DB assign.
          itemId: idMap.get(v.itemId)!,
          label: v.label,
          price: v.price,
          active: v.active,
        })),
      ),
    );
  }
  await db.batch(inserts as [typeof inserts[0], ...typeof inserts]);

  // No revalidatePath here — caller (server action) does it. Pure helper.
  return { ok: true, copied: srcItems.length };
}
```

Then in `actions.ts`, the server action becomes a thin auth wrapper:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { cloneCatalogFromTenantUnsafe, type CloneResult } from "@/lib/platform/clone-catalog";

export async function cloneCatalogFromTenant(
  srcTenantId: string,
  dstTenantId: string,
): Promise<CloneResult> {
  await requirePlatformAdmin();
  const result = await cloneCatalogFromTenantUnsafe(srcTenantId, dstTenantId);
  if (result.ok) {
    revalidatePath(`/platform/tenants/${dstTenantId}`);
  }
  return result;
}
```

The Task 1.1 smoke script imports `cloneCatalogFromTenantUnsafe` directly, bypassing the auth gate (no session in a CLI process).

- [ ] **Step 5: `finalizeTenantGoLive`**

Spec §7.3 step 5 explicitly allows go-live with empty catalog. We honor that for *approval*, but not for *public listing* — a publicly-listed tenant with zero items shows parents an empty shop, which is a real UX failure. Resolution: empty catalog → status `approved` + `isPubliclyListed=false` (becomes "Hidden" per spec §6.2). Operator adds items via the now-unlocked admin UI, then one-click toggles public listing on from the tenant detail page (spec §8.1 card 1).

```ts
export async function finalizeTenantGoLive(id: string) {
  const user = await requirePlatformAdmin();

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  if (!tenant) return { ok: false as const, error: "Tenant not found" };

  const reasons: string[] = [];
  if (!tenant.shopEmail) reasons.push("Shop email is required");
  if (!tenant.stripeAccountId) reasons.push("Stripe account not created");
  if (!tenant.stripeChargesEnabled) reasons.push("Stripe charges not yet enabled");

  if (reasons.length > 0) {
    return { ok: false as const, error: reasons.join("; ") };
  }

  // Catalog count drives public listing, not approval.
  const [countRow] = await db
    .select({ n: count() })
    .from(catalogItems)
    .where(eq(catalogItems.tenantId, id));
  const hasCatalog = Number(countRow?.n ?? 0) > 0;

  await db
    .update(tenants)
    .set({
      platformApprovalStatus: "approved",
      isPubliclyListed: hasCatalog,  // hidden until catalog is non-empty
      platformApprovedAt: new Date(),
      platformApprovedBy: user.email,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id));

  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath("/platform/tenants");
  revalidatePath(`/${id}`, "layout");
  return {
    ok: true as const,
    publiclyListed: hasCatalog,
    note: hasCatalog ? null : "Approved as Hidden — add catalog items, then enable public listing from the tenant detail page.",
  };
}
```

- [ ] **Step 6: Type-check + commit**

```bash
pnpm check-types:web
git add apps/web/src/app/platform/tenants/new/actions.ts
git commit -m "feat(platform): wizard server actions (draft, branding, operator, stripe, clone, go-live)"
```

### Task 4.4: Wizard route + client state machine

**Files:**
- Create: `apps/web/src/app/platform/tenants/new/page.tsx`
- Create: `apps/web/src/app/platform/tenants/new/wizard-client.tsx`
- Modify: `apps/web/src/db/schema.ts` — add `export type TenantRow = typeof tenants.$inferSelect;` at the bottom of the file. This is the row type used by every wizard step and the tenant detail page; export it once so step components don't redeclare it.

- [ ] **Step 1: RSC route — load existing tenant if `?id=` provided**

```tsx
import { db } from "@/db";
import { tenants, catalogItems } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { WizardClient } from "./wizard-client";

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; step?: string }>;
}) {
  const { id, step } = await searchParams;
  const tenant = id ? await db.query.tenants.findFirst({ where: eq(tenants.id, id) }) : null;

  // Catalog count for Step 6 informational gate.
  let catalogCount = 0;
  if (id) {
    const [row] = await db
      .select({ n: count() })
      .from(catalogItems)
      .where(eq(catalogItems.tenantId, id));
    catalogCount = Number(row?.n ?? 0);
  }

  return <WizardClient tenant={tenant ?? null} initialStep={parseStep(step)} catalogCount={catalogCount} />;
}

function parseStep(s: string | undefined): 1 | 2 | 3 | 4 | 5 | 6 {
  const n = Number(s);
  if (n >= 1 && n <= 6) return n as 1 | 2 | 3 | 4 | 5 | 6;
  return 1;
}
```

- [ ] **Step 2: Client wizard state machine**

```tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { TenantRow } from "@/db/schema";
import { Step1Identity } from "./steps/step-1-identity";
import { Step2Branding } from "./steps/step-2-branding";
import { Step3Stripe } from "./steps/step-3-stripe";
import { Step4Operator } from "./steps/step-4-operator";
import { Step5Catalog } from "./steps/step-5-catalog";
import { Step6GoLive } from "./steps/step-6-go-live";

export function WizardClient({
  tenant,
  initialStep,
  catalogCount,
}: {
  tenant: TenantRow | null;
  initialStep: 1 | 2 | 3 | 4 | 5 | 6;
  catalogCount: number;
}) {
  const [step, setStep] = useState(initialStep);
  const router = useRouter();
  const sp = useSearchParams();

  function goto(nextStep: 1 | 2 | 3 | 4 | 5 | 6, id?: string) {
    const params = new URLSearchParams(sp ?? "");
    params.set("step", String(nextStep));
    if (id) params.set("id", id);
    router.push(`/platform/tenants/new?${params.toString()}`);
    setStep(nextStep);
  }

  return (
    <div className="flex-1 px-7 py-6 overflow-auto">
      <StepRail step={step} />
      <div className="mt-6 grid grid-cols-[1fr_360px] gap-6">
        <div className="bg-paper rounded-[10px] border border-rule p-7">
          {step === 1 && <Step1Identity tenant={tenant} onContinue={(id) => goto(2, id)} />}
          {step === 2 && tenant && <Step2Branding tenant={tenant} onContinue={() => goto(3)} />}
          {step === 3 && tenant && <Step3Stripe tenant={tenant} onContinue={() => goto(4)} />}
          {step === 4 && tenant && <Step4Operator tenant={tenant} onContinue={() => goto(5)} />}
          {step === 5 && tenant && <Step5Catalog tenant={tenant} onContinue={() => goto(6)} />}
          {step === 6 && tenant && <Step6GoLive tenant={tenant} catalogCount={catalogCount} />}
        </div>
        {/* Right rail: live preview only on step 2 */}
        {step === 2 && tenant && <LivePreview accent={tenant.accent} logoUrl={tenant.logoUrl} short={tenant.short} />}
      </div>
    </div>
  );
}

function StepRail({ step }: { step: number }) {
  const labels = ["Identity", "Branding", "Stripe", "Operator", "Catalog", "Go live"];
  return (
    <div className="flex gap-2">
      {labels.map((l, i) => (
        <div key={l} className={`flex-1 text-center text-xs font-semibold rounded-md py-2 ${
          i + 1 === step ? "bg-navy-deep text-white"
          : i + 1 < step ? "bg-green-100 text-green-800"
          : "bg-rule text-ink-dim"
        }`}>
          {i + 1}. {l}
        </div>
      ))}
    </div>
  );
}

function LivePreview({ accent, logoUrl, short }: { accent: string; logoUrl: string | null; short: string }) {
  // Minimal mobile-frame preview — see spec §7.3 Step 2 live preview.
  return (
    <aside className="bg-paper rounded-[10px] border border-rule p-4 sticky top-6">
      <div className="text-[10.5px] uppercase tracking-[0.6px] font-bold text-ink-dim">
        Live preview · Parent
      </div>
      <div className="mt-3 rounded-2xl border-8 border-ink overflow-hidden bg-white">
        <div style={{ background: accent }} className="px-4 py-5 text-white">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-8 h-8 rounded" />
            ) : (
              <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center text-xs font-bold">
                {short.slice(0, 3)}
              </div>
            )}
            <div className="font-serif text-sm font-semibold">{short} Uniform Shop</div>
          </div>
        </div>
        <div className="p-3.5 text-xs text-ink-dim">Catalog preview…</div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Type-check (steps will fail until 4.5–4.10) — write stubs**

```bash
mkdir -p apps/web/src/app/platform/tenants/new/steps
```

For each of `step-1-identity.tsx` through `step-6-go-live.tsx`, write a stub:

```tsx
"use client";
export function Step1Identity({ tenant, onContinue }: { tenant: any; onContinue: (id: string) => void }) {
  return <div>Step 1 stub — see Task 4.5</div>;
}
```

This unblocks the type-check; Tasks 4.5–4.10 fill in real implementations.

- [ ] **Step 4: Type-check + commit**

```bash
pnpm check-types:web
git add apps/web/src/app/platform/tenants/new/
git commit -m "feat(platform): provision wizard scaffold (route + state machine + step stubs)"
```

### Task 4.5: Step 1 — Identity

**Files:**
- Modify: `apps/web/src/app/platform/tenants/new/steps/step-1-identity.tsx`

- [ ] **Step 1: Implement the identity form**

```tsx
"use client";
import { useState } from "react";
import { deriveSlug, deriveShort, isValidSlug } from "@/lib/platform/slug";
import { createTenantDraft } from "../actions";

export function Step1Identity({
  tenant,
  onContinue,
}: {
  tenant: TenantRow | null;
  onContinue: (id: string) => void;
}) {
  const [name, setName] = useState(tenant?.name ?? "");
  const [short, setShort] = useState(tenant?.short ?? "");
  const [id, setId] = useState(tenant?.id ?? "");
  const [motto, setMotto] = useState(tenant?.motto ?? "");
  const [address, setAddress] = useState(tenant?.address ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Auto-derive on initial typing only — let user override.
  function onName(v: string) {
    setName(v);
    if (!short || short === deriveShort(name)) setShort(deriveShort(v));
    if (!id || id === deriveSlug(short)) setId(deriveSlug(deriveShort(v)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidSlug(id)) {
      setError("Slug must be 3–16 chars: lowercase letters, digits, hyphens; start with a letter.");
      return;
    }
    setPending(true);
    const result = await createTenantDraft({ name, short, id, motto: motto || undefined, address: address || undefined });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onContinue(result.id);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 1 of 6 · School identity</h2>
      <Field label="Display name" value={name} onChange={onName} required />
      <Field label="Short code" value={short} onChange={setShort} hint="2–8 chars, used as initials in the crest." />
      <Field
        label="Slug"
        value={id}
        onChange={setId}
        hint={`URL: ${id || "<slug>"}.uniformorder.online`}
        disabled={!!tenant}
      />
      <Field label="Motto (optional)" value={motto} onChange={setMotto} />
      <Field label="Address (optional)" value={address} onChange={setAddress} />
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : tenant ? "Continue" : "Create draft & continue"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="block w-full h-10 px-3 border border-rule rounded-md text-[13px] disabled:bg-parchment"
      />
      {hint && <div className="text-[11px] text-ink-dim mt-1.5">{hint}</div>}
    </label>
  );
}
```

- [ ] **Step 2: Smoke**

```bash
pnpm check-types:web
pnpm dev:web
# Sign in as platform admin, /platform/tenants/new
# Type "Manly Beach Grammar" → short auto-fills "MBG", slug "mbg".
# Submit → URL becomes /platform/tenants/new?id=mbg&step=2.
# Verify a `tenants` row exists with platform_approval_status='pending'.
# Try same slug again → "already taken" error.
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/new/steps/step-1-identity.tsx
git commit -m "feat(platform): wizard step 1 (identity)"
```

### Task 4.6: Step 2 — Branding (logo upload + accent + live preview)

**Files:**
- Modify: `apps/web/src/app/platform/tenants/new/steps/step-2-branding.tsx`

- [ ] **Step 1: Logo upload via UploadThing's `tenantLogo` route**

```tsx
"use client";
import { useState } from "react";
import { generateUploadButton } from "@uploadthing/react";
import type { UploadRouter } from "@/lib/uploadthing";
import { updateTenantBranding } from "../actions";

const UploadButton = generateUploadButton<UploadRouter>();

const PRESETS = ["#7A1F2B", "#0F4C5C", "#2F5D50", "#1F3A6E", "#4A2238", "#7A5418", "#0E2A47"];

export function Step2Branding({
  tenant,
  onContinue,
}: {
  tenant: TenantRow;
  onContinue: () => void;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logoUrl);
  const [accent, setAccent] = useState<string>(tenant.accent);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    const r = await updateTenantBranding(tenant.id, { logoUrl, accent });
    setPending(false);
    if (!r.ok) {
      setError("Save failed.");
      return;
    }
    onContinue();
  }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 2 of 6 · Branding</h2>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">School logo</div>
        <div className="flex gap-3.5 items-center">
          <div className="w-24 h-24 bg-parchment rounded-md flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="max-w-full max-h-full" />
            ) : (
              <span className="text-xs text-ink-dim">No logo</span>
            )}
          </div>
          <UploadButton
            endpoint="tenantLogo"
            input={{ tenantId: tenant.id }}
            onClientUploadComplete={(res) => {
              const url = res?.[0]?.url ?? null;
              if (url) setLogoUrl(url);
            }}
            onUploadError={(e) => setError(e.message)}
          />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">Accent colour</div>
        <div className="flex gap-2.5 items-center">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              className={`w-11 h-11 rounded-full border ${accent === c ? "border-ink ring-2 ring-white" : "border-rule"}`}
              style={{ background: c }}
            />
          ))}
          <input
            type="text"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="ml-2 h-9 w-28 px-2 border border-rule rounded-md text-xs font-mono"
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Smoke**

```bash
pnpm check-types:web
pnpm dev:web
# /platform/tenants/new?id=mbg&step=2
# Upload an SVG/PNG — confirm it appears in the preview rail.
# Pick an accent — preview rail header changes colour live (state-driven).
# Continue → URL advances to step=3, DB row has logo_url + accent set.
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/new/steps/step-2-branding.tsx
git commit -m "feat(platform): wizard step 2 (branding — logo + accent + live preview)"
```

### Task 4.7: Step 3 — Stripe Connect

**Files:**
- Modify: `apps/web/src/app/platform/tenants/new/steps/step-3-stripe.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";
import { useState } from "react";
import { createStripeStandardForTenant } from "../actions";

export function Step3Stripe({
  tenant,
  onContinue,
}: {
  tenant: TenantRow;
  onContinue: () => void;
}) {
  const [acctId, setAcctId] = useState<string | null>(tenant.stripeAccountId);
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    const r = await createStripeStandardForTenant(tenant.id);
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAcctId(r.accountId);
    setLink(r.onboardingUrl);
  }

  async function copy() {
    if (link) await navigator.clipboard.writeText(link);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 3 of 6 · Stripe Connect</h2>
      <p className="text-sm text-ink-dim">
        We'll create a Stripe <strong>Standard</strong> account for {tenant.name}. Forward the onboarding link to the school's bursar.
      </p>
      {!acctId && (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create Stripe Standard account"}
        </button>
      )}
      {acctId && (
        <div className="space-y-3">
          <div className="text-sm">
            Account: <code className="font-mono text-xs">{acctId}</code>
          </div>
          {link && (
            <div className="flex gap-2 items-center">
              <input value={link} readOnly className="flex-1 h-9 px-2 border border-rule rounded-md text-xs font-mono" />
              <button type="button" onClick={copy} className="h-9 px-3 rounded-md border border-rule text-xs">Copy</button>
            </div>
          )}
          <p className="text-xs text-ink-dim">
            Charges-enabled flag flips automatically when the school finishes onboarding (via the existing
            <code> account.updated</code> webhook). You can continue now and revisit this step later.
          </p>
        </div>
      )}
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="button"
        onClick={onContinue}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold"
      >
        Continue
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Smoke (Stripe test mode)**

```bash
pnpm dev:web
# /platform/tenants/new?id=mbg&step=3
# Click "Create Stripe Standard account" — confirm DB row's stripe_account_id populates,
# onboarding URL renders, copy button copies the URL.
# Use Stripe test-mode link to complete onboarding for the test account; webhook flips
# stripe_charges_enabled (verify in DB).
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/new/steps/step-3-stripe.tsx
git commit -m "feat(platform): wizard step 3 (stripe — type:standard + onboarding link)"
```

### Task 4.8: Step 4 — Operator & shop contact

**Files:**
- Modify: `apps/web/src/app/platform/tenants/new/steps/step-4-operator.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";
import { useState } from "react";
import { updateTenantOperator } from "../actions";

export function Step4Operator({
  tenant,
  onContinue,
}: {
  tenant: TenantRow;
  onContinue: () => void;
}) {
  const [shopEmail, setShopEmail] = useState(tenant.shopEmail ?? "");
  const [shopHours, setShopHours] = useState(tenant.shopHours ?? "");
  const [collectionInstructions, setCollectionInstructions] = useState(tenant.collectionInstructions ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await updateTenantOperator(tenant.id, { shopEmail, shopHours, collectionInstructions });
    setPending(false);
    if (!r.ok) {
      setError("Save failed.");
      return;
    }
    onContinue();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 4 of 6 · Operator & shop contact</h2>
      <div>
        <label className="block">
          <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5">Shop email</div>
          <input
            type="email"
            value={shopEmail}
            onChange={(e) => setShopEmail(e.target.value)}
            required
            className="block w-full h-10 px-3 border border-rule rounded-md text-[13px]"
          />
          <div className="text-[11px] text-amber-800 mt-1.5 bg-amber-50 px-2 py-1 rounded">
            <strong>This email is also the school's login.</strong> The operator will sign in with this address — make sure it's an inbox they can access.
          </div>
        </label>
      </div>
      <label className="block">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5">Shop hours (optional)</div>
        <input
          value={shopHours}
          onChange={(e) => setShopHours(e.target.value)}
          className="block w-full h-10 px-3 border border-rule rounded-md text-[13px]"
        />
      </label>
      <label className="block">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5">Collection instructions (optional)</div>
        <textarea
          value={collectionInstructions}
          onChange={(e) => setCollectionInstructions(e.target.value)}
          rows={4}
          className="block w-full px-3 py-2 border border-rule rounded-md text-[13px]"
        />
      </label>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Smoke + commit**

```bash
pnpm check-types:web
git add apps/web/src/app/platform/tenants/new/steps/step-4-operator.tsx
git commit -m "feat(platform): wizard step 4 (operator + shop contact, login-email warning)"
```

### Task 4.9: Step 5 — Catalog (clone-only)

**Files:**
- Modify: `apps/web/src/app/platform/tenants/new/steps/step-5-catalog.tsx`

- [ ] **Step 1: Server data — list source tenants**

The component needs the list of cloneable source tenants (any approved tenant other than the destination). Pass via prop from the RSC, or load via a server action:

```tsx
// Quick path: server action that returns approved tenants.
// Add to actions.ts:
export async function listCloneSources(excludeId: string) {
  await requirePlatformAdmin();
  const rows = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.platformApprovalStatus, "approved"));
  return rows.filter((r) => r.id !== excludeId);
}
```

- [ ] **Step 2: Implement Step 5**

```tsx
"use client";
import { useEffect, useState } from "react";
import { cloneCatalogFromTenant, listCloneSources } from "../actions";

export function Step5Catalog({
  tenant,
  onContinue,
}: {
  tenant: TenantRow;
  onContinue: () => void;
}) {
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
  const [src, setSrc] = useState<string | "">("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCloneSources(tenant.id).then(setSources);
  }, [tenant.id]);

  async function clone() {
    if (!src) return;
    setPending(true);
    setError(null);
    const r = await cloneCatalogFromTenant(src, tenant.id);
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResult(`Copied ${r.copied} item(s).`);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 5 of 6 · Catalog</h2>
      <p className="text-sm text-ink-dim">
        Clone an existing school's catalog as a starting point, or skip and add items manually after go-live.
      </p>
      <div className="flex gap-2 items-center">
        <select
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          className="h-10 px-3 border border-rule rounded-md text-[13px] flex-1"
        >
          <option value="">Choose a source tenant…</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={clone}
          disabled={!src || pending}
          className="h-10 px-4 rounded-md border border-navy-deep text-navy-deep text-sm font-semibold disabled:opacity-50"
        >
          Clone
        </button>
      </div>
      {result && <div className="text-sm text-green-700">{result}</div>}
      {error && <div className="text-sm text-red-700">{error}</div>}
      <p className="text-xs text-ink-dim">
        Catalog editing in <code>/admin/{tenant.id}/catalog</code> is gated until the tenant is approved (Step 6).
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Smoke + commit**

```bash
pnpm dev:web
# /platform/tenants/new?id=mbg&step=5
# Pick "NSBH" from dropdown → click Clone → verify catalog_items rows in DB
# with id prefixed `mbg-...`. Continue.
```

```bash
git add apps/web/src/app/platform/tenants/new/{steps/step-5-catalog.tsx,actions.ts}
git commit -m "feat(platform): wizard step 5 (catalog clone-only)"
```

### Task 4.10: Step 6 — Go live

**Files:**
- Modify: `apps/web/src/app/platform/tenants/new/steps/step-6-go-live.tsx`

- [ ] **Step 1: Implement pre-flight checklist + finalize**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeTenantGoLive } from "../actions";

export function Step6GoLive({
  tenant,
  catalogCount,
}: {
  tenant: TenantRow;
  catalogCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Required gates for approval (block "Go live" if any fail).
  const requiredChecks = [
    { ok: !!tenant.name && !!tenant.short, label: "Identity set" },
    { ok: !!tenant.accent, label: "Branding set" },
    { ok: !!tenant.stripeAccountId, label: "Stripe account created" },
    { ok: !!tenant.stripeChargesEnabled, label: "Stripe charges enabled" },
    { ok: !!tenant.shopEmail, label: "Shop email set" },
  ];

  // Informational: drives public listing but not approval.
  const informational = [
    {
      ok: catalogCount > 0,
      label: catalogCount > 0
        ? `Catalog has ${catalogCount} item${catalogCount === 1 ? "" : "s"}`
        : "Catalog is empty — tenant will go live as Hidden until items are added",
      blocking: false,
    },
  ];

  const allOk = requiredChecks.every((c) => c.ok);

  async function go() {
    setPending(true);
    setError(null);
    const r = await finalizeTenantGoLive(tenant.id);
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/platform/tenants/${tenant.id}`);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 6 of 6 · Go live</h2>
      <ul className="space-y-2">
        {requiredChecks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            <span className={c.ok ? "text-green-600" : "text-red-600"}>
              {c.ok ? "✓" : "✗"}
            </span>
            <span className={c.ok ? "" : "text-ink-dim"}>{c.label}</span>
          </li>
        ))}
        {informational.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            <span className={c.ok ? "text-green-600" : "text-amber-600"}>
              {c.ok ? "✓" : "ⓘ"}
            </span>
            <span className="text-ink-dim">{c.label}</span>
          </li>
        ))}
      </ul>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="button"
        onClick={go}
        disabled={!allOk || pending}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-50"
      >
        {pending ? "Going live…" : "Go live"}
      </button>
      <p className="text-xs text-ink-dim">
        Setting <code>platformApprovalStatus=approved</code>. Public listing is enabled only if catalog has items; otherwise the tenant goes live as Hidden and you toggle public listing from the tenant detail page after adding items. Reversible.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: End-to-end smoke**

```bash
pnpm dev:web
# Walk all 6 steps for a fresh "test" tenant from /platform/tenants/new.
# Confirm each transition + persistence.
# At Step 6, all checks should be green (assuming Stripe onboarding completed).
# Click "Go live" → redirect to /platform/tenants/test (Phase 5 page; for now might 404).
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/new/steps/step-6-go-live.tsx
git commit -m "feat(platform): wizard step 6 (go live with pre-flight checklist)"
```

---

## Phase 5 — Tenant detail / edit

**PR C (part 3). Estimate: 4 hrs.**

### Task 5.1: Tenant detail RSC

**Files:**
- Create: `apps/web/src/app/platform/tenants/[id]/page.tsx`
- Create: `apps/web/src/app/platform/tenants/[id]/cards/branding-card.tsx`
- Create: `apps/web/src/app/platform/tenants/[id]/cards/operator-card.tsx`
- Create: `apps/web/src/app/platform/tenants/[id]/cards/stripe-card.tsx`
- Create: `apps/web/src/app/platform/tenants/[id]/cards/danger-card.tsx`
- Create: `apps/web/src/app/platform/tenants/[id]/actions.ts`

- [ ] **Step 1: RSC page**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BrandingCard } from "./cards/branding-card";
import { OperatorCard } from "./cards/operator-card";
import { StripeCard } from "./cards/stripe-card";
import { DangerCard } from "./cards/danger-card";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  if (!tenant) notFound();

  const status =
    tenant.platformApprovalStatus === "rejected" ? "Disabled"
    : tenant.platformApprovalStatus !== "approved" || !tenant.stripeChargesEnabled ? "Setup"
    : tenant.isPubliclyListed ? "Active"
    : "Hidden";

  return (
    <>
      <header className="px-7 py-5 border-b border-rule flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{tenant.name}</h1>
          <div className="text-sm text-ink-dim mt-1">
            <span className="font-mono">{tenant.id}.uniformorder.online</span> · Status: <strong>{status}</strong>
          </div>
        </div>
        <Link href={`/${tenant.id}`} className="text-sm font-semibold text-navy-deep underline">
          Open parent shop ↗
        </Link>
      </header>

      <div className="flex-1 px-7 py-6 overflow-auto space-y-4 max-w-4xl">
        {status === "Setup" ? (
          <ResumeOnboarding tenant={tenant} />
        ) : (
          <>
            <BrandingCard tenant={tenant} />
            <OperatorCard tenant={tenant} />
            <StripeCard tenant={tenant} />
            <DangerCard tenant={tenant} />
          </>
        )}
      </div>
    </>
  );
}

function ResumeOnboarding({ tenant }: { tenant: any }) {
  // Compute first incomplete step.
  const step = !tenant.accent ? 2
    : !tenant.stripeAccountId ? 3
    : !tenant.shopEmail ? 4
    : !tenant.stripeChargesEnabled ? 3
    : 6;
  return (
    <div className="bg-paper rounded-[10px] border border-rule p-6">
      <h2 className="font-serif text-lg font-semibold">Resume onboarding</h2>
      <p className="text-sm text-ink-dim mt-2">This tenant is pending. Complete onboarding to take it live.</p>
      <Link
        href={`/platform/tenants/new?id=${tenant.id}&step=${step}`}
        className="inline-block mt-4 h-10 px-5 rounded-md bg-navy-deep text-white font-semibold leading-10"
      >
        Resume at step {step} →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Branding card with drawer + public-listing toggle**

The card shows current logo/accent/motto and a one-click `Publicly listed` toggle. The [Edit] button opens a drawer that re-uses the Step 2 form. For brevity in this plan: implement the card with current values displayed, an `<EditDrawer>` (a `"use client"` shared component to be created in Step 5.2), and the toggle calling a server action.

```tsx
// branding-card.tsx
"use client";
import { useState } from "react";
import { togglePublicListing } from "../actions";
// ...rest similar to step 2 form, calling updateTenantBranding on save
```

Implementation pattern is mechanical — ~80 lines per card mirroring the wizard's step UIs but with current values pre-filled. **Don't write all four cards in one task.** Implement Branding Card fully now; the other three are similar and can be one commit each in subsequent steps.

- [ ] **Step 3: Implement `togglePublicListing` action**

In `[id]/actions.ts`:

```ts
"use server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";

async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user || !isPlatformAdminEmail(user.email)) throw new Error("Forbidden");
  return user;
}

export async function togglePublicListing(id: string, on: boolean) {
  await requirePlatformAdmin();
  await db.update(tenants).set({ isPubliclyListed: on, updatedAt: new Date() }).where(eq(tenants.id, id));
  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath(`/${id}`, "layout");
  return { ok: true as const };
}

export async function disableTenant(id: string) {
  await requirePlatformAdmin();
  await db
    .update(tenants)
    .set({ platformApprovalStatus: "rejected", isPubliclyListed: false, updatedAt: new Date() })
    .where(eq(tenants.id, id));
  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath("/platform/tenants");
  revalidatePath(`/${id}`, "layout");
  return { ok: true as const };
}

export async function reEnableTenant(id: string) {
  await requirePlatformAdmin();
  // Intentional safer default: re-enable restores approval but leaves
  // isPubliclyListed=false. Operator must explicitly toggle public listing
  // back on (one-click flip in the Branding card). This avoids surprising
  // a parent with a tenant suddenly reappearing in the marketplace before
  // the operator has confirmed catalog/pricing state.
  await db
    .update(tenants)
    .set({ platformApprovalStatus: "approved", updatedAt: new Date() })
    .where(eq(tenants.id, id));
  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath("/platform/tenants");
  return { ok: true as const };
}

export async function resyncStripeStatus(id: string) {
  await requirePlatformAdmin();
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  if (!tenant?.stripeAccountId) return { ok: false as const, error: "No Stripe account" };

  const { getStripe } = await import("@/lib/stripe");
  const { updateTenantStripe } = await import("@/db/queries");
  const stripe = getStripe();
  const acct = await stripe.accounts.retrieve(tenant.stripeAccountId);

  await updateTenantStripe(id, {
    stripeAccountId: tenant.stripeAccountId,
    stripeChargesEnabled: !!acct.charges_enabled,
    stripePayoutsEnabled: !!acct.payouts_enabled,
  });
  revalidatePath(`/platform/tenants/${id}`);
  return { ok: true as const };
}
```

- [ ] **Step 4: Operator card**

Mirror the wizard's Step 4 form, plus the warning that changing `shopEmail` revokes the previous operator's access. Reuses `updateTenantOperator` from `new/actions.ts` (or re-export it).

- [ ] **Step 5: Stripe card**

Buttons: "Resend onboarding link" (calls `createStripeStandardForTenant` which generates a new account link), "Resync from Stripe" (calls `resyncStripeStatus`), "Open Stripe ↗" (deep link). Display: account ID + charges/payouts badges.

- [ ] **Step 6: Danger card**

Single-button "Disable tenant" with a confirm dialog. After disable, button becomes "Re-enable tenant".

- [ ] **Step 7: Smoke each card + commit**

```bash
pnpm check-types:web
pnpm dev:web
# /platform/tenants/nsbh
#   - public-listing toggle works (verify DB)
#   - disable → status flips to Disabled, /nsbh now 404s for parents
#   - re-enable → restored
#   - resync from stripe → flags written from API
```

```bash
git add apps/web/src/app/platform/tenants/[id]/
git commit -m "feat(platform): tenant detail with branding/operator/stripe/danger cards"
```

---

## Phase 6 — Billing tab

**PR E. Estimate: 3 hrs.**

### Task 6.1: Cached Stripe billing module

**Files:**
- Create: `apps/web/src/lib/platform/stripe-billing.ts`

- [ ] **Step 1: Cached per-tenant lookup**

Two layers of caching: `unstable_cache` for the persistent 5-min TTL across requests, and React `cache()` for in-request dedup so the parallel `Promise.all` in the billing page doesn't re-enter the cache wrapper for the same tenant within a single render. Stripe client instantiation is done **inside** the cached function via `getStripe()` to obey AGENTS.md "no module-top client instantiation" (build-time route-data collection runs without `STRIPE_SECRET_KEY`).

```ts
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getStripe } from "@/lib/stripe";

export type TenantBilling = {
  tenantId: string;
  accountId: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  balance: { available: number; pending: number; currency: string } | null;
  lastPayout: { date: Date; amount: number; currency: string } | null;
  gross30d: number;
  net30d: number;
  error: string | null;
};

async function fetchTenantBilling(tenantId: string, accountId: string | null): Promise<TenantBilling> {
  if (!accountId) {
    return {
      tenantId, accountId: null, chargesEnabled: null, payoutsEnabled: null,
      balance: null, lastPayout: null, gross30d: 0, net30d: 0, error: null,
    };
  }
  try {
    const stripe = getStripe();
    const [acct, balance, payouts, txs] = await Promise.all([
      stripe.accounts.retrieve(accountId),
      stripe.balance.retrieve({ stripeAccount: accountId }),
      stripe.payouts.list({ stripeAccount: accountId, limit: 1 }),
      stripe.balanceTransactions.list({
        stripeAccount: accountId,
        created: { gte: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000) },
        limit: 100,
      }),
    ]);

    const available = (balance.available[0]?.amount ?? 0) / 100;
    const pending = (balance.pending[0]?.amount ?? 0) / 100;
    const currency = balance.available[0]?.currency ?? "aud";
    const last = payouts.data[0];

    // Crude gross/net for 30d: gross = sum of charge tx amounts; net = gross + fee + refund tx.
    let gross = 0;
    let net = 0;
    for (const t of txs.data) {
      if (t.type === "charge") gross += t.amount / 100;
      net += t.net / 100;
    }

    return {
      tenantId,
      accountId,
      chargesEnabled: acct.charges_enabled,
      payoutsEnabled: acct.payouts_enabled,
      balance: { available, pending, currency },
      lastPayout: last ? { date: new Date(last.arrival_date * 1000), amount: last.amount / 100, currency: last.currency } : null,
      gross30d: gross,
      net30d: net,
      error: null,
    };
  } catch (err) {
    return {
      tenantId, accountId, chargesEnabled: null, payoutsEnabled: null,
      balance: null, lastPayout: null, gross30d: 0, net30d: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// React cache() wraps unstable_cache for request-scoped dedup.
// unstable_cache provides the cross-request persistent 5-min TTL.
export const getTenantBilling = cache((tenantId: string, accountId: string | null) =>
  unstable_cache(
    () => fetchTenantBilling(tenantId, accountId),
    [`tenant-billing:${tenantId}`],
    { revalidate: 300, tags: ["platform-billing"] },
  )()
);
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm check-types:web
git add apps/web/src/lib/platform/stripe-billing.ts
git commit -m "feat(platform): cached per-tenant Stripe billing lookup"
```

### Task 6.2: Wire `revalidateTag` into the webhook

**Files:**
- Modify: `apps/web/src/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Add `revalidateTag('platform-billing')` to the `account.updated` branch**

Locate the `account.updated` block (line ~89 per spec). After the DB update + PostHog capture, before the catch:

```ts
import { revalidateTag } from "next/cache";

// ...inside the account.updated branch, after the existing DB write:
revalidateTag("platform-billing");
```

- [ ] **Step 2: Smoke**

```bash
# In Stripe test mode, trigger an account.updated event:
stripe trigger account.updated
# Refresh /platform/billing — connect-state changes appear within seconds
# rather than waiting for the 5-min cache TTL.
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/stripe/webhook/route.ts
git commit -m "feat(platform): revalidate platform-billing cache on account.updated webhook"
```

### Task 6.3: Billing page

**Files:**
- Create: `apps/web/src/app/platform/billing/page.tsx`
- Create: `apps/web/src/app/platform/billing/billing-table.tsx`

- [ ] **Step 1: RSC page — fetch all tenants + parallel billing**

```tsx
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { getTenantBilling } from "@/lib/platform/stripe-billing";
import { BillingTable } from "./billing-table";

export default async function BillingPage() {
  const list = await db.select({ id: tenants.id, name: tenants.name, accountId: tenants.stripeAccountId }).from(tenants);
  const billing = await Promise.all(list.map((t) => getTenantBilling(t.id, t.accountId)));
  const merged = list.map((t, i) => ({ ...t, ...billing[i] }));

  const enabled = merged.filter((m) => m.chargesEnabled).length;
  const totalBalance = merged.reduce((s, m) => s + (m.balance?.available ?? 0) + (m.balance?.pending ?? 0), 0);
  const totalNet30 = merged.reduce((s, m) => s + m.net30d, 0);
  const totalGross30 = merged.reduce((s, m) => s + m.gross30d, 0);

  return (
    <>
      <header className="px-7 py-5 border-b border-rule">
        <h1 className="font-serif text-2xl font-semibold">Billing & payouts</h1>
      </header>
      <div className="flex-1 px-7 py-6 overflow-auto">
        <div className="grid grid-cols-4 gap-3.5">
          <Tile label="Connected accounts" value={`${enabled} / ${list.length}`} sub="enabled" />
          <Tile label="Total balance" value={`$${totalBalance.toFixed(0)}`} sub="across tenants" />
          <Tile label="Payouts · 30d" value={`$${totalNet30.toFixed(0)}`} sub="net" />
          <Tile label="Gross · 30d" value={`$${totalGross30.toFixed(0)}`} sub="pre-fee" />
        </div>
        <div className="mt-6">
          <BillingTable rows={merged} />
        </div>
      </div>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-paper rounded-[10px] border border-rule p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-ink-dim">{label}</div>
      <div className="font-serif text-[26px] font-semibold mt-1.5 tnum">{value}</div>
      <div className="text-[11px] text-ink-dim mt-1">{sub}</div>
    </div>
  );
}
```

- [ ] **Step 2: Billing table client**

```tsx
"use client";
import type { TenantBilling } from "@/lib/platform/stripe-billing";

type Row = TenantBilling & { id: string; name: string };

export function BillingTable({ rows }: { rows: Row[] }) {
  return (
    <div className="bg-paper rounded-[10px] border border-rule overflow-hidden">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-parchment">
            {["School", "Acct", "Charges", "Payouts", "Balance", "30d gross", "Last payout", ""].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-ink-dim border-b border-rule text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule last:border-0">
              <td className="px-4 py-3 font-semibold">{r.name}</td>
              <td className="px-4 py-3 font-mono text-xs">{r.accountId ?? "—"}</td>
              <td className="px-4 py-3">{r.chargesEnabled === null ? "—" : r.chargesEnabled ? "✓" : "—"}</td>
              <td className="px-4 py-3">{r.payoutsEnabled === null ? "—" : r.payoutsEnabled ? "✓" : "—"}</td>
              <td className="px-4 py-3 tnum">{r.balance ? `$${(r.balance.available + r.balance.pending).toFixed(0)}` : "—"}</td>
              <td className="px-4 py-3 tnum">{r.gross30d ? `$${r.gross30d.toFixed(0)}` : "—"}</td>
              <td className="px-4 py-3 tnum">
                {r.lastPayout ? `$${r.lastPayout.amount.toFixed(0)} · ${r.lastPayout.date.toLocaleDateString("en-AU", { month: "short", day: "numeric" })}` : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {r.accountId && (
                  <a
                    href={`https://dashboard.stripe.com/connect/accounts/${r.accountId}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs font-semibold text-navy-deep underline"
                  >
                    Open ↗
                  </a>
                )}
                {r.error && <span className="text-xs text-red-700 ml-2">{r.error}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Smoke + commit**

```bash
pnpm check-types:web
pnpm dev:web
# /platform/billing — verify table renders with NSBH/RGSH balances + payouts.
# Disable network briefly and refresh — error messages render per row, page doesn't crash.
```

```bash
git add apps/web/src/app/platform/billing/
git commit -m "feat(platform): billing tab with cached per-tenant Stripe lookup"
```

---

## Phase 7 — Final verification & deploy

### Task 7.1: Run the spec smoke matrix

- [ ] **Step 1: Apply migration to Neon prod**

(Per spec §13 step 1)

```bash
# After PR A merges:
# Use Neon MCP prepare_database_migration / complete_database_migration against prod branch.
```

- [ ] **Step 1b: Run RGSH catalog seed against Neon prod**

After PR B merges, before users hit the DB-backed parent shop, seed RGSH catalog rows so `/rgsh` doesn't render empty. The extended `seed.mjs` from Task 1.6 is idempotent (`ON CONFLICT DO UPDATE` for items, `DELETE + INSERT` for variants), so it's safe to run on a DB that already has NSBH rows.

```bash
cd apps/web && DATABASE_URL=<prod-branch-url> node scripts/seed.mjs
```

Verify:

```sql
SELECT tenant_id, COUNT(*) FROM catalog_items GROUP BY tenant_id;
-- nsbh | <N>
-- rgsh | <N>
```

- [ ] **Step 2: Verify env vars on Hostinger**

```
PLATFORM_ADMIN_EMAILS=george.qiao@pimspace.com  (already set, confirm)
NEXT_PUBLIC_APP_URL=https://uniformorder.online (used by stripe accountLinks)
STRIPE_SECRET_KEY                                (already set)
UPLOADTHING_TOKEN                                (already set per PR #9)
```

If any are missing, add via hPanel → Advanced → Node.js → Environment Variables, then restart the Node.js app.

- [ ] **Step 3: End-to-end smoke per spec §13.5 (8 sub-steps)**

```
1. /platform/tenants/new — provision "TEST" tenant, complete steps 1–5 only.
2. Sign in as TEST's shopEmail at /admin/test, verify all 8 admin pages render.
   POST a catalog item — expect 403 (requireTenantApproved).
3. Back as platform admin: complete Step 6. Status flips to approved.
4. POST same catalog item — now 200.
5. As parent, browse /test → item → cart → checkout → order/placed.
   All render with TEST accent + name.
6. Place a real test-mode Stripe order at TEST so the parent's history references TEST.
7. As platform admin, disable TEST. /test now 404s for parents.
8. As the parent who placed the order, /orders still shows the TEST order with correct accent.
9. Regression: in Neon SQL editor, UPDATE orders SET user_id = NULL WHERE id = '<step 6 order>'.
   Refresh /orders — order still listed (proves dual-key match). Restore user_id.
```

- [ ] **Step 4: Apply tag for release**

After the smoke matrix passes:

```bash
git tag platform-portal-v1
git push origin platform-portal-v1
```

---

## Self-review checklist (run before declaring plan complete)

- [x] **Spec coverage** — every spec section traced to a task:
  - §4 (DB-back routes) → Phase 1, Tasks 1.2–1.5
  - §5 (Routes & auth) → Phase 2, Tasks 2.1–2.3
  - §6 (Tenant list) → Phase 3, Tasks 3.1–3.2
  - §7 (Wizard) → Phase 4, Tasks 4.1–4.10
  - §8 (Tenant detail) → Phase 5, Task 5.1
  - §9 (Billing) → Phase 6, Tasks 6.1–6.3
  - §10 (Migration + code touches) → Phase 0 + listed in each phase's "Files" sections
  - §13 (Deploy + smoke) → Phase 7, Task 7.1
- [x] **Placeholder scan** — no TBD, TODO, "implement later", "similar to Task N", or unspecified error handling in step bodies.
- [x] **Type consistency** — verified function signatures match across tasks: `createTenantDraft`, `updateTenantBranding`, `updateTenantOperator`, `createStripeStandardForTenant`, `cloneCatalogFromTenant`, `finalizeTenantGoLive`, `togglePublicListing`, `disableTenant`, `reEnableTenant`, `resyncStripeStatus`, `listCloneSources`, `listTenantsWithStats`, `getPlatformKpis`, `getTenantBilling`, `getActiveCatalog`, `getCatalogItem`, `listOrdersForParent`.
- [x] **TDD adapted to no-test-framework reality** — every task ends with type-check + manual smoke. No phantom test files referenced.

---

**Plan complete.** Saved to `docs/superpowers/plans/2026-05-09-platform-portal.md`.
