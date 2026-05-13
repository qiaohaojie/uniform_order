# §5.17 — Per-tenant first-visit landing page

**Date:** 2026-05-13
**Status:** Approved (rev 2 — post-review fixes applied)

## Problem

`/<tenant>` currently drops parents straight into the catalogue grid. A first-visit landing gives
parents context — shop hours, pickup instructions, and a sense of which items are popular — before
they start browsing.

---

## Behaviour

- **First visit** (no cookie): `/<tenant>` renders `<LandingScreen>` instead of the catalogue.
- **Subsequent visits** (cookie present): `/<tenant>` renders the catalogue directly, identical to the current experience.
- The cookie is **written client-side** the moment the parent taps "Browse Catalogue" or any
  popular-item tile. The page then navigates to `/<tenant>`, which now shows the catalogue.
- Cookie name: `uo:visited:{tenantSlug}` (e.g. `uo:visited:nsbh`)
- Cookie TTL: **30 days**. `Path=/{slug}; SameSite=Lax`.
  - Slugs are always lowercase ASCII (e.g. `nsbh`, `rgsh`) — no URL-encoding is applied to the Path
    value. A future slug containing uppercase or non-ASCII characters would require encoding here.

---

## Architecture

### Routing — no new routes

The decision is made entirely inside the existing RSC at `app/[tenant]/page.tsx`. The
public-visibility gate (blocking hidden/pending tenants for non-admins) runs **before** the cookie
branch — both paths inherit it:

```ts
// 1. Validate slug (already in layout.tsx)
// 2. Public-visibility gate — same logic as today, applied before both branches
const sessionUser = await getSessionUser();
if (!tenantRecord.isPubliclyListed && !isPlatformAdminEmail(sessionUser?.email)) {
  notFound();
}

// 3. Cookie branch
const cookieStore = await cookies();
const hasVisited = !!cookieStore.get(`uo:visited:${slug}`)?.value;

if (!hasVisited) {
  // fetch popular items, render LandingScreen
} else {
  // existing catalogue path
}
```

No redirects. No separate `/<tenant>/welcome` route. No client-side layout shift.

### Data fetching in page.tsx

- **Cookie present** (returning visitor): same `Promise.all([getTenant, getActiveCatalog])` as today.
- **Cookie absent** (first visit): `Promise.all([getTenant, getPopularItems(slug, 3, 90)])`.
  `getActiveCatalog` is skipped — the landing does not render the catalogue grid.

---

## New component — `<LandingScreen>`

**File:** `apps/web/src/app/[tenant]/landing-screen.tsx`
**Type:** `"use client"`

### Props

```ts
type PopularItem = {
  itemId: string;
  name: string;
  imageUrl: string | null;
  minPrice: number;
  totalQty: number;
};

type LandingScreenProps = {
  tenant: TenantRow;
  popularItems: PopularItem[];  // may be empty []
  accent: string;
};
```

### Layout (top → bottom inside `MobileShell`)

| # | Section | Notes |
|---|---------|-------|
| 1 | **Header strip** | Accent background. `Crest` (28px) + `tenant.name` only. **No** active-child line. **No** cart badge. These ornaments are irrelevant before the parent has browsed. |
| 2 | **Hero** | Large `Crest` (80px) centred, `tenant.name` in `font-serif` below it, `tenant.motto` in italic gold below that. Motto line omitted when `tenant.motto` is null. |
| 3 | **Divider** | 1px `--color-rule` line. |
| 4 | **Shop hours card** | Paper background, rule border, `--color-gold` uppercase label "Uniform Shop". `tenant.shopHours` in bold. `tenant.collectionInstructions` as a second line — omitted when null. Entire card omitted when `tenant.shopHours` is also null. |
| 5 | **"Popular this term" row** | Gold uppercase label. Three item tiles: `imageUrl` if non-null, otherwise `<GarmentVector itemId>` as fallback (same pattern as catalogue grid). Item name + `minPrice` formatted as currency. Each tile: `onClick` calls `setVisitedCookie(slug)` then `router.push('/<slug>/<itemId>')`. **Entire row omitted when `popularItems` is empty.** |
| 6 | **"Browse Catalogue →" button** | Full-width, accent background, `font-sans font-semibold`. `onClick`: `setVisitedCookie(slug)` then `router.push('/<slug>')`. Using `onClick` + `router.push` (not a plain `<Link>`) ensures the cookie is written synchronously before the navigation request fires. |
| 7 | **Footer note** | `"This welcome screen won't show again for 30 days"` — tiny, muted, centred. |
| 8 | **`<TenantFooter>`** | Kept — carries address, shop email, and legal links distinct from the hero content. |
| 9 | **`<BottomNav active="shop">`** | Kept — consistent shell; parents may want to navigate from the landing. |

### Cookie interaction

`LandingScreen` imports `setVisitedCookie` from `lib/landing-visit.client.ts`. Both the CTA button
and individual popular-item tile `onClick` handlers call it before navigating. `document.cookie`
writes are synchronous — the cookie is present in the browser's outgoing Cookie header on the
immediately following navigation request.

---

## New query — `getPopularItems`

**File:** `apps/web/src/db/queries.ts`

```ts
export async function getPopularItems(
  tenantSlug: string,
  limit: number = 3,
  days: number = 90,
): Promise<PopularItem[]>
```

### SQL shape (Drizzle `sql` template)

Aggregation is done in a CTE first to avoid row inflation from joining `catalog_variants`:

```sql
WITH ranked AS (
  SELECT ol.item_id, SUM(ol.qty)::int AS total_qty
  FROM order_lines ol
  JOIN orders o ON o.id = ol.order_id
  WHERE o.tenant_id = $1
    AND o.created_at >= NOW() - make_interval(days => $2)
    AND o.status NOT IN ('pending_payment', 'refunded')
  GROUP BY ol.item_id
  ORDER BY total_qty DESC
  LIMIT $3
)
SELECT
  r.item_id,
  ci.name,
  ci.image_url,
  (SELECT MIN(price) FROM catalog_variants cv
   WHERE cv.item_id = r.item_id AND cv.active = true) AS min_price,
  r.total_qty
FROM ranked r
LEFT JOIN catalog_items ci ON ci.id = r.item_id
```

**Why CTE:** The lateral subquery for `min_price` is applied per-row after the ranked set is
computed, avoiding the fan-out that a direct JOIN would introduce before aggregation.

**Status filter:** Deny-list `NOT IN ('pending_payment', 'refunded')`. Full enum is
`pending_payment | new | packing | ready | collected | partially_refunded | refunded`.
The deny-list excludes: orders that never completed payment (`pending_payment`) and orders fully
reversed (`refunded`). All other statuses represent real demand. `partially_refunded` counts
(items were delivered). A deny-list is preferred over an allow-list here — any future status added
to the enum is almost certainly a legitimate fulfillment state.

**`make_interval`** is used instead of `INTERVAL '... days'` string interpolation because Drizzle's
parameterizer cannot bind values inside an interval literal.

Returns `[]` on error — not a page-breaking query; the landing renders without the popular-items
row in that case.

---

## New helper — `lib/landing-visit.client.ts`

Same shape as `lib/active-child.client.ts`.

```ts
const COOKIE_NAME = (slug: string) => `uo:visited:${slug}`;
const TTL = 60 * 60 * 24 * 30; // 30 days

export function setVisitedCookie(slug: string): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  // slug is lowercase ASCII — no URL-encoding needed for Path
  document.cookie = `${COOKIE_NAME(slug)}=1; Path=/${slug}; Max-Age=${TTL}; SameSite=Lax${secure}`;
}
```

---

## Graceful degradation

| Scenario | Behaviour |
|----------|-----------|
| `tenant.motto` is null | Motto italic line omitted |
| `tenant.collectionInstructions` is null | Instructions line in hours card omitted |
| `tenant.shopHours` is null | Entire shop hours card omitted |
| No order history (new tenant) | "Popular this term" row omitted |
| `getPopularItems` throws | Caught, returns `[]`; landing renders without the row |
| `imageUrl` is null on a popular item | `<GarmentVector itemId>` renders instead |

---

## Files touched

| File | Change |
|------|--------|
| `apps/web/src/app/[tenant]/page.tsx` | Read cookie; preserve visibility gate on both branches; branch to `LandingScreen` or catalogue |
| `apps/web/src/app/[tenant]/landing-screen.tsx` | **New** — client component |
| `apps/web/src/lib/landing-visit.client.ts` | **New** — `setVisitedCookie` helper |
| `apps/web/src/db/queries.ts` | Add `getPopularItems` |

No schema migrations required — all data fields (`shopHours`, `collectionInstructions`, `motto`)
already exist on the `tenants` table.

---

## Out of scope

- Admin UI to configure the landing (shows for all tenants; cannot be toggled off per-tenant).
- Term date configuration (rolling 90-day window is sufficient).
- Analytics events for landing impressions (can be added later with `serverCapture`).
