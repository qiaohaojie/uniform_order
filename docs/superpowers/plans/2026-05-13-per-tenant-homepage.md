# Per-Tenant First-Visit Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a cookie-gated welcome screen on first visit to `/<tenant>` — crest, motto, shop hours, popular items — then go straight to the catalogue on return visits.

**Architecture:** The existing RSC at `app/[tenant]/page.tsx` reads a `uo:visited:{slug}` cookie server-side and branches: landing path fetches popular items and renders `<LandingScreen>`; catalogue path is unchanged. No new routes. `LandingScreen` is a `"use client"` component that sets the cookie + navigates on any CTA tap.

**Tech Stack:** Next.js 15 App Router (RSC + Server Actions), Drizzle ORM + neon-http (`db.execute(sql\`...\`)`), `next/headers` cookies, `next/navigation` useRouter, Tailwind CSS v4.

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

- [ ] **Step 2: Add `getPopularItems` function at the end of queries.ts (before the final closing)**

```ts
export async function getPopularItems(
  tenantSlug: string,
  limit = 3,
  days = 90,
): Promise<PopularItem[]> {
  try {
    const result = await db.execute<{
      itemId: string;
      name: string | null;
      imageUrl: string | null;
      minPrice: string | null;   // postgres numeric → string over neon-http
      totalQty: number;
    }>(sql`
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
        r.item_id            AS "itemId",
        ci.name,
        ci.image_url         AS "imageUrl",
        (SELECT MIN(price)::text FROM catalog_variants cv
         WHERE cv.item_id = r.item_id AND cv.active = true) AS "minPrice",
        r.total_qty          AS "totalQty"
      FROM ranked r
      LEFT JOIN catalog_items ci ON ci.id = r.item_id
    `);
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

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: no errors. If `db.execute` type signature complains about the generic, change to:
```ts
const result = await db.execute(sql`...`) as { rows: { itemId: string; ... }[] };
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/db/queries.ts
git commit -m "feat(§5.17): getPopularItems query — top-3 by qty last 90 days"
```

---

## Task 3: `<LandingScreen>` component

**Files:**
- Create: `apps/web/src/app/[tenant]/landing-screen.tsx`

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

  function visit(path: string) {
    setVisitedCookie(tenant.id);
    router.push(path);
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
                  onClick={() => visit(`/${tenant.id}/${item.itemId}`)}
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

        {/* CTA */}
        <button
          onClick={() => visit(`/${tenant.id}`)}
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

Expected: no errors. Common issue to watch for: `GarmentVector` may not accept a `className` prop — check `components/garment.tsx`. If it doesn't, wrap it in a `<div className="...">` instead.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[tenant]/landing-screen.tsx
git commit -m "feat(§5.17): LandingScreen component — crest/motto/hours/popular-items/CTA"
```

---

## Task 4: Wire `page.tsx` — cookie branch

**Files:**
- Modify: `apps/web/src/app/[tenant]/page.tsx`

Three surgical edits to the existing file. The catalogue JSX (`return (...)`) is untouched.

- [ ] **Step 1: Add three new imports**

At the top of `page.tsx`, add:

```ts
import { cookies } from "next/headers";                    // after "next/navigation"
import { getPopularItems } from "@/db/queries";            // merge into existing @/db/queries line
import { LandingScreen } from "./landing-screen";          // after CatalogGrid import
```

The `@/db/queries` import line should become:

```ts
import { getTenant, getActiveCatalog, toTenantBrand, getPopularItems } from "@/db/queries";
```

- [ ] **Step 2: Replace the initial `Promise.all` + split fetch**

Find this block near the top of `CatalogPage` (lines 1-4 of the function body):

```ts
const [tenantRecord, catalog] = await Promise.all([
  getTenant(slug),
  getActiveCatalog(slug),
]);
if (!tenantRecord) notFound();
```

Replace with:

```ts
const tenantRecord = await getTenant(slug);
if (!tenantRecord) notFound();
```

Then find the line `const tenant = toTenantBrand(tenantRecord);` and insert the landing branch
**immediately after it**:

```ts
const tenant = toTenantBrand(tenantRecord);

// ── Landing branch — first-visit only ──────────────────────────────────────
const cookieStore = await cookies();
const hasVisited = !!cookieStore.get(`uo:visited:${slug}`)?.value;

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

// ── Catalogue branch — returning visitors (everything below is unchanged) ───
const catalog = await getActiveCatalog(slug);
```

- [ ] **Step 3: Remove the now-stale `catalog` variable reference if needed**

Because `getActiveCatalog` was moved out of the original `Promise.all`, find any remaining
destructured `catalog` reference from the old `Promise.all` (if the editor left one). The variable
`catalog` should now only come from the `const catalog = await getActiveCatalog(slug);` line added
in Step 2. The rest of the function body (`sp`, `activeCat`, `getActiveChild`, the `return (...)`)
stays exactly as it was.

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

```bash
pnpm dev:web
```

1. Open `http://localhost:3000/nsbh` in a private/incognito window (no cookie) → should see the landing screen: large crest, school name, motto, shop hours card, and popular items row (or no row if the DB has no orders in the last 90 days).
2. Click "Browse Catalogue →" → navigates back to `/nsbh` and the catalogue grid appears (cookie is now set).
3. Reload `http://localhost:3000/nsbh` in the same window → catalogue directly, no landing.
4. Open `http://localhost:3000/rgsh` in a new private window → landing appears with RGSH accent colour and data.
5. Confirm the visibility gate still works: a tenant with `isPubliclyListed = false` should return 404 for a non-admin visitor on both the landing and catalogue branches.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[tenant]/page.tsx
git commit -m "feat(§5.17): wire cookie branch in page.tsx — first-visit landing"
```
