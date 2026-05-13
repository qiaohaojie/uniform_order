# Per-Tenant First-Visit Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a cookie-gated welcome screen on first visit to `/<tenant>` — crest, motto, shop hours, popular items — then go straight to the catalogue on return visits.

**Architecture:** The existing RSC at `app/[tenant]/page.tsx` reads a `uo:visited:{slug}` cookie before the DB fetch, then branches: landing path skips `getActiveCatalog` and fetches popular items instead; catalogue path is unchanged. No new routes. `LandingScreen` is a `"use client"` component that sets the cookie + triggers RSC refresh (CTA) or navigates to an item page (tiles).

**Tech Stack:** Next.js 15 App Router (RSC + client companion), Drizzle ORM + neon-http, `next/headers` cookies, `next/navigation` useRouter, Tailwind CSS v4.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| **Create** | `apps/web/src/lib/landing-visit.client.ts` | `setVisitedCookie(slug)` — 30-day cookie writer |
| **Modify** | `apps/web/src/db/queries.ts` | Add `PopularItem` export type + `getPopularItems` query |
| **Create** | `apps/web/src/app/[tenant]/landing-screen.tsx` | `<LandingScreen>` client component — all landing UI |
| **Modify** | `apps/web/src/app/[tenant]/page.tsx` | Cookie branch: landing vs catalogue path |

---

## Task 1: Cookie helper

**Files:**
- Create: `apps/web/src/lib/landing-visit.client.ts`

- [ ] **Step 1: Create the cookie helper**

```ts
// apps/web/src/lib/landing-visit.client.ts
const COOKIE_NAME = (slug: string) => `uo:visited:${slug}`;
const TTL = 60 * 60 * 24 * 30; // 30 days

// slug is always lowercase ASCII — no URL-encoding needed for Path value
export function setVisitedCookie(slug: string): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME(slug)}=1; Path=/${slug}; Max-Age=${TTL}; SameSite=Lax${secure}`;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/landing-visit.client.ts
git commit -m "feat(§5.17): landing-visit cookie helper"
```

---

## Task 2: `getPopularItems` query

**Files:**
- Modify: `apps/web/src/db/queries.ts`

- [ ] **Step 1: Add `PopularItem` type after the existing exported types near the top of queries.ts (after `LiveTopItem`)**

```ts
export type PopularItem = {
  itemId: string;
  name: string;
  imageUrl: string | null;
  minPrice: number;
  totalQty: number;
};
```

- [ ] **Step 2: Add `getPopularItems` function at the end of queries.ts**

`db.execute` with a generic parameter may not exist on the NeonHttpDatabase type used here. Use
an explicit row-type cast instead of the generic form:

```ts
export async function getPopularItems(
  tenantSlug: string,
  limit = 3,
  days = 90,
): Promise<PopularItem[]> {
  try {
    type Row = {
      itemId: string;
      name: string | null;
      imageUrl: string | null;
      minPrice: string | null; // postgres numeric → string over neon-http
      totalQty: number;
    };
    const result = (await db.execute(sql`
      WITH ranked AS (
        SELECT ol.item_id, SUM(ol.qty)::int AS total_qty
        FROM order_lines ol
        JOIN orders o ON o.id = ol.order_id
        WHERE o.tenant_id = ${tenantSlug}
          AND o.created_at >= NOW() - make_interval(days => ${days})
          AND o.status NOT IN ('pending_payment', 'refunded')
        GROUP BY ol.item_id
        ORDER BY total_qty DESC
        LIMIT ${limit}
      )
      SELECT
        r.item_id          AS "itemId",
        ci.name,
        ci.image_url       AS "imageUrl",
        (SELECT MIN(price)::text FROM catalog_variants cv
         WHERE cv.item_id = r.item_id AND cv.active = true) AS "minPrice",
        r.total_qty        AS "totalQty"
      FROM ranked r
      LEFT JOIN catalog_items ci ON ci.id = r.item_id
      ORDER BY r.total_qty DESC
    `)) as { rows: Row[] };
    return result.rows.map((r) => ({
      itemId: r.itemId,
      name: r.name ?? r.itemId,
      imageUrl: r.imageUrl,
      minPrice: r.minPrice != null ? parseFloat(r.minPrice) : 0,
      totalQty: r.totalQty,
    }));
  } catch {
    return [];
  }
}
```

**Why CTE + outer `ORDER BY`:** aggregation happens in `ranked` first (no fan-out from the
variants join), then `min_price` is a per-row lateral subquery. The outer `ORDER BY r.total_qty DESC`
is required because PostgreSQL does not guarantee CTE row order is preserved through a join.

**Status filter** excludes `pending_payment` (never paid) and `refunded` (fully reversed).
All other statuses (`new`, `packing`, `ready`, `collected`, `partially_refunded`) represent
real demand. Deny-list is intentional — a future new status is almost certainly a legitimate
fulfillment state.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/db/queries.ts
git commit -m "feat(§5.17): getPopularItems query — top-3 by qty last 90 days"
```

---

## Task 3: `<LandingScreen>` component

**Files:**
- Create: `apps/web/src/app/[tenant]/landing-screen.tsx`

**Prop note:** `LandingScreen` receives `tenant: TenantRow` (the raw DB row, nullables intact), not
the `toTenantBrand(...)` projection (which coerces null fields to `""`). The `shopHours`,
`collectionInstructions`, and `motto` null checks below depend on this.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/app/[tenant]/landing-screen.tsx
"use client";

import { useRouter } from "next/navigation";
import { Crest } from "@/components/crest";
import { GarmentVector } from "@/components/garment";
import { TenantFooter } from "@/components/tenant-footer";
import { BottomNav } from "@/components/bottom-nav";
import { setVisitedCookie } from "@/lib/landing-visit.client";
import { type TenantRow } from "@/db/schema";
import { type PopularItem } from "@/db/queries";

export function LandingScreen({
  tenant,
  popularItems,
  accent,
}: {
  tenant: TenantRow;
  popularItems: PopularItem[];
  accent: string;
}) {
  const router = useRouter();

  // CTA: already at /<slug>, so refresh the RSC to re-read the cookie
  function visitCatalogue() {
    setVisitedCookie(tenant.id);
    router.refresh();
  }

  // Item tiles: navigate to a different URL, so push works fine
  function visitItem(itemId: string) {
    setVisitedCookie(tenant.id);
    router.push(`/${tenant.id}/${itemId}`);
  }

  return (
    <>
      {/* Header strip — crest + name only, no child/cart ornaments */}
      <div
        className="text-white px-4 pt-1 pb-3.5 flex-shrink-0 flex items-center gap-2.5 py-1.5"
        style={{ background: accent }}
      >
        <Crest tenant={tenant} size={28} ring={false} />
        <span className="text-sm font-medium leading-tight opacity-90">
          {tenant.name}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 flex flex-col gap-5">

        {/* Hero: large crest + name + motto */}
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <Crest tenant={tenant} size={80} ring />
          <div>
            <p
              className="font-serif text-lg font-bold leading-snug"
              style={{ color: "var(--color-navy-deep)" }}
            >
              {tenant.name}
            </p>
            {tenant.motto && (
              <p
                className="font-serif italic text-xs mt-1 tracking-wide"
                style={{ color: "var(--color-gold)" }}
              >
                {tenant.motto}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ background: "var(--color-rule)" }} />

        {/* Shop hours card */}
        {tenant.shopHours && (
          <div
            className="rounded-[10px] border px-4 py-3 flex flex-col gap-1.5"
            style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
          >
            <p
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "var(--color-gold)" }}
            >
              Uniform Shop
            </p>
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--color-navy-deep)" }}
            >
              {tenant.shopHours}
            </p>
            {tenant.collectionInstructions && (
              <p className="text-xs leading-relaxed" style={{ color: "#4a5060" }}>
                {tenant.collectionInstructions}
              </p>
            )}
          </div>
        )}

        {/* Popular this term */}
        {popularItems.length > 0 && (
          <div>
            <p
              className="text-[10px] font-bold tracking-widest uppercase mb-3"
              style={{ color: "var(--color-gold)" }}
            >
              Popular this term
            </p>
            <div className="grid grid-cols-3 gap-2">
              {popularItems.map((item) => (
                <button
                  key={item.itemId}
                  onClick={() => visitItem(item.itemId)}
                  className="flex flex-col items-center rounded-[8px] border p-2.5 text-center cursor-pointer hover:border-current transition-colors"
                  style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
                >
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center mb-1.5 overflow-hidden"
                    style={{ background: "var(--color-parchment)" }}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <GarmentVector
                        itemId={item.itemId}
                        accent={accent}
                        size={32}
                        className="block"
                      />
                    )}
                  </div>
                  <span
                    className="text-[10.5px] font-semibold leading-tight"
                    style={{ color: "var(--color-navy-deep)" }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="text-[10.5px] font-medium mt-0.5 tnum"
                    style={{ color: "var(--color-gold)" }}
                  >
                    ${item.minPrice % 1 === 0
                      ? item.minPrice.toFixed(0)
                      : item.minPrice.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CTA — uses router.refresh() not router.push() because we're already at /<slug> */}
        <button
          onClick={visitCatalogue}
          className="w-full rounded-[9px] py-3.5 text-sm font-semibold text-white tracking-wide"
          style={{ background: accent }}
        >
          Browse Catalogue →
        </button>

        {/* Footer note */}
        <p className="text-center text-[10px] opacity-50">
          This welcome screen won&apos;t show again for 30 days
        </p>

      </div>

      <TenantFooter tenant={tenant} />
      <div className="pb-16" />
      <BottomNav active="shop" shopHref={`/${tenant.id}`} accent={accent} />
    </>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: no errors. Common issue: `GarmentVector` may not accept a `className` prop — check
`components/garment.tsx`. If it doesn't, wrap it: `<div className="block"><GarmentVector .../></div>`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[tenant]/landing-screen.tsx
git commit -m "feat(§5.17): LandingScreen component — crest/motto/hours/popular-items/CTA"
```

---

## Task 4: Wire `page.tsx` — cookie branch

**Files:**
- Modify: `apps/web/src/app/[tenant]/page.tsx`

Two surgical edits. The catalogue JSX (`return (...)`) and the visibility gate are untouched.

- [ ] **Step 1: Add three new imports**

At the top of `page.tsx`, add `cookies` from `next/headers`, merge `getPopularItems` into the
`@/db/queries` line, and add `LandingScreen`. The full import block becomes:

```ts
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { CATEGORIES } from "@/lib/data";
import { getTenant, getActiveCatalog, toTenantBrand, getPopularItems } from "@/db/queries";
import { getActiveChild } from "@/lib/active-child.server";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { Crest } from "@/components/crest";
import { CartIcon } from "@/components/icons";
import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";
import { TenantFooter } from "@/components/tenant-footer";
import { CatalogGrid } from "./catalog-grid";
import { LandingScreen } from "./landing-screen";
```

- [ ] **Step 2: Replace the initial `Promise.all` block with the cookie-aware parallel fetch**

Find this block at the top of `CatalogPage` (immediately after `const { tenant: slug } = await params;`):

```ts
const [tenantRecord, catalog] = await Promise.all([
  getTenant(slug),
  getActiveCatalog(slug),
]);
if (!tenantRecord) notFound();
```

Replace with:

```ts
// Read cookie before DB queries — header lookup, no I/O
const cookieStore = await cookies();
const hasVisited = !!cookieStore.get(`uo:visited:${slug}`)?.value;

// Parallel fetch — returning visitors get getTenant + getActiveCatalog in parallel.
// First-time visitors skip getActiveCatalog (not needed for landing) and get an
// empty placeholder instead; getPopularItems runs after the visibility gate below.
const [tenantRecord, catalog] = await Promise.all([
  getTenant(slug),
  hasVisited
    ? getActiveCatalog(slug)
    : Promise.resolve([] as Awaited<ReturnType<typeof getActiveCatalog>>),
]);
if (!tenantRecord) notFound();
```

Then find `const tenant = toTenantBrand(tenantRecord);` and insert the landing branch
**immediately after it** — this is after the existing visibility gate, so hidden tenants
still 404 on first visit:

```ts
const tenant = toTenantBrand(tenantRecord);

// ── Landing branch — AFTER visibility gate so hidden tenants still 404 ───────
if (!hasVisited) {
  const popularItems = await getPopularItems(slug);
  return (
    <MobileShell bg="var(--color-paper)" logoUrl={tenantRecord.logoUrl ?? undefined}>
      <LandingScreen
        tenant={tenantRecord}
        popularItems={popularItems}
        accent={tenant.accent}
      />
    </MobileShell>
  );
}

// ── Catalogue branch — catalog already fetched above ──────────────────────────
```

Everything below (the `const sp = await searchParams;` block, `getActiveChild`, and the full
`return (...)`) remains exactly as it is. The `catalog` variable from the `Promise.all` is
consumed unchanged by `<CatalogGrid items={catalog} .../>`.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
pnpm dev:web
```

1. Open `http://localhost:3000/nsbh` in a **private/incognito** window → should see the landing screen: large crest, school name, italic motto, shop hours card, popular items row (or no row if the DB has no orders in the last 90 days).
2. Click "Browse Catalogue →" → RSC re-runs, cookie is now present, catalogue grid appears.
3. Reload `http://localhost:3000/nsbh` in the same window → catalogue directly, no landing.
4. Open `http://localhost:3000/rgsh` in a new private window → landing with RGHS green accent and data.
5. Confirm the **visibility gate** still works: a tenant with `isPubliclyListed = false` should return 404 for a non-admin visitor on both landing and catalogue branches.
6. Confirm **admin bypass**: sign in as a platform-admin email and open a hidden/pending tenant → should see the landing (gate falls through for admins).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[tenant]/page.tsx
git commit -m "feat(§5.17): wire cookie branch in page.tsx — first-visit landing"
```
