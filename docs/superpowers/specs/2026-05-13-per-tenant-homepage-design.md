# §5.17 — Per-tenant first-visit landing page

**Date:** 2026-05-13
**Status:** Approved

## Problem

`/<tenant>` currently drops parents straight into the catalogue grid. A first-visit landing gives
returning parents context — shop hours, pickup instructions, and a sense of which items are
popular — before they start browsing.

---

## Behaviour

- **First visit** (no cookie): `/<tenant>` renders `<LandingScreen>` instead of the catalogue.
- **Subsequent visits** (cookie present): `/<tenant>` renders the catalogue directly, identical to the current experience.
- The cookie is **written client-side** the moment the parent taps "Browse Catalogue" or any
  popular-item tile. The page then navigates to `/<tenant>`, which now shows the catalogue.
- Cookie name: `uo:visited:{tenantSlug}` (e.g. `uo:visited:nsbh`)
- Cookie TTL: **30 days**. `Path=/{slug}; SameSite=Lax`.

---

## Architecture

### Routing — no new routes

The decision is made entirely inside the existing RSC at `app/[tenant]/page.tsx`:

```ts
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
  `getActiveCatalog` is skipped — the landing screen does not render the catalogue grid.

---

## New component — `<LandingScreen>`

**File:** `apps/web/src/app/[tenant]/landing-screen.tsx`
**Type:** `"use client"`

### Props

```ts
type PopularItem = { itemId: string; name: string; imageUrl: string | null; minPrice: number; totalQty: number };

type LandingScreenProps = {
  tenant: TenantRow;
  popularItems: PopularItem[];  // may be empty []
  accent: string;
};
```

### Layout (top → bottom inside `MobileShell`)

| # | Section | Notes |
|---|---------|-------|
| 1 | **Header strip** | Accent background, `Crest` (28px) + `tenant.name`. Identical to the catalogue header strip. |
| 2 | **Hero** | Large `Crest` (80px) centred, `tenant.name` in `font-serif` below it, `tenant.motto` in italic gold below that. Motto line omitted when `tenant.motto` is null. |
| 3 | **Divider** | 1px `--color-rule` line. |
| 4 | **Shop hours card** | Paper background, rule border, `--color-gold` uppercase label "Uniform Shop". `tenant.shopHours` in bold. `tenant.collectionInstructions` as a second line — omitted when null. |
| 5 | **"Popular this term" row** | Gold uppercase label. Three item tiles (garment placeholder or `imageUrl`, item name, lowest variant price). Each tile is a link → sets cookie + navigates to `/<slug>/<itemId>`. **Entire row omitted when `popularItems` is empty.** |
| 6 | **"Browse Catalogue →" button** | Full-width, accent background, `font-sans font-semibold`. On press: `setVisitedCookie(slug)` then `router.push('/<slug>')`. |
| 7 | **Footer note** | `"This welcome screen won't show again for 30 days"` — tiny, muted, centred. |

### Cookie interaction

`LandingScreen` imports `setVisitedCookie` from `lib/landing-visit.client.ts` and calls it before
navigating. Both the CTA button and individual popular-item tiles call this.

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

Implementation:

```sql
SELECT
  ol.item_id,
  ci.name,
  ci.image_url,
  MIN(cv.price)::numeric   AS min_price,
  SUM(ol.qty)::int         AS total_qty
FROM order_lines ol
JOIN orders o        ON o.id   = ol.order_id
LEFT JOIN catalog_items ci ON ci.id  = ol.item_id
LEFT JOIN catalog_variants cv ON cv.item_id = ol.item_id AND cv.active = true
WHERE o.tenant_id = :tenantSlug
  AND o.created_at >= NOW() - INTERVAL ':days days'
  AND o.status NOT IN ('pending_payment', 'refunded')
GROUP BY ol.item_id, ci.name, ci.image_url
ORDER BY total_qty DESC
LIMIT :limit
```

Returns `[]` on error or when no data — not a page-breaking query; the landing renders without the
popular-items row in that case.

Orders with `pending_payment` and `refunded` status are excluded so only fulfilled demand counts.

---

## New helper — `lib/landing-visit.client.ts`

Same shape as `lib/active-child.client.ts`.

```ts
const COOKIE_NAME = (slug: string) => `uo:visited:${slug}`;
const TTL = 60 * 60 * 24 * 30; // 30 days

export function setVisitedCookie(slug: string): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
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

---

## Files touched

| File | Change |
|------|--------|
| `apps/web/src/app/[tenant]/page.tsx` | Read cookie; branch to `LandingScreen` or catalogue |
| `apps/web/src/app/[tenant]/landing-screen.tsx` | **New** — client component |
| `apps/web/src/lib/landing-visit.client.ts` | **New** — cookie helpers |
| `apps/web/src/db/queries.ts` | Add `getPopularItems` |

No schema migrations required — all data fields (`shopHours`, `collectionInstructions`, `motto`)
already exist on the `tenants` table.

---

## Out of scope

- Admin UI to configure the landing (tenant operators cannot toggle it off — it shows for all tenants).
- Term date configuration (rolling 90-day window is sufficient).
- Analytics events for landing impressions (can be added later with `serverCapture`).
