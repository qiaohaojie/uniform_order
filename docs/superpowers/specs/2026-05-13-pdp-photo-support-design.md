# PDP Photo Support — Design Spec

**Date:** 2026-05-13
**Status:** Approved
**Source:** `docs/remaining_work.md` §3.12 (gap-analysis §5.13)

---

## Problem

`catalog_items.image_url` exists in the DB and the admin drawer already uploads photos via UploadThing, but the parent-facing UI ignores the column entirely — both the catalog grid and the PDP render only the `GarmentVector` SVG silhouette. Schools that upload photos see no effect.

---

## Scope

Three files, ~20 lines net. No migration, no schema change, no new UploadThing route.

**In scope:**
- Read `imageUrl` from the DB in `getActiveCatalog` and `getCatalogItemForPDP`
- Render `next/image` on the PDP and catalog grid when `imageUrl` is set
- Fall back to `GarmentVector` when it is not

**Out of scope:**
- Admin upload UI (already complete in `item-drawer.tsx`)
- Image aspect-ratio enforcement at upload time
- Lightbox / zoom on tap
- Alt-text editing (use `item.name` for now)

---

## Image display treatment

**Chosen: Centered contain in the existing slot (Option B)**

Both surfaces use the same visual pattern: a fixed-size square container, `object-fit: contain`, parchment (`#FAF6EE`) background behind the photo so transparent-background PNGs look clean. The photo never crops; parchment fills any letterbox gap. This matches the footprint of the existing GarmentVector slot so no layout shift occurs when a tenant adds or removes a photo.

| Surface | Container | Fallback |
|---|---|---|
| PDP parchment area | 210 × 210 px, centered | `GarmentVector size={210}` |
| Catalog grid card | 120 × 120 px, centered | `GarmentVector size={120}` |

`next/image` is used with `fill` + a sized wrapper div. `sizes` prop set to match container width so the browser requests an appropriately-sized srcset variant.

---

## Affected files

### 1. `apps/web/src/db/queries.ts`

**`getActiveCatalog`** — add `imageUrl` to the `.select({})` object and map it when building `CatalogItem`:

```ts
// In .select({...})
imageUrl: catalogItems.imageUrl,

// In the map.set(...) call
imageUrl: r.imageUrl ?? undefined,
```

**`getCatalogItemForPDP`** — same addition in its own `.select({})` and the `item` object literal:

```ts
// In .select({...})
imageUrl: catalogItems.imageUrl,

// In the item object literal
imageUrl: r0.imageUrl ?? undefined,
```

### 2. `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`

The `garment` prop passed to `<ItemDetailInteractive>` currently hardcodes `<GarmentVector>`. Replace with a conditional inside the same parchment wrapper div:

```tsx
garment={
  <div className="flex justify-center py-1 pb-2.5" style={{ background: "var(--color-parchment)" }}>
    {resolvedItem.imageUrl ? (
      <div style={{ width: 210, height: 210, position: "relative" }}>
        <Image
          src={resolvedItem.imageUrl}
          alt={resolvedItem.name}
          fill
          style={{ objectFit: "contain" }}
          sizes="210px"
        />
      </div>
    ) : (
      <GarmentVector itemId={resolvedItem.id} accent={tenant.accent} size={210} />
    )}
  </div>
}
```

Add `import Image from "next/image"` to the import block — the file does not currently import it.

### 3. `apps/web/src/app/[tenant]/catalog-grid.tsx`

Each catalog card currently renders:

```tsx
<GarmentVector itemId={it.id} accent={accent} size={120} className="w-full h-auto block" />
```

Replace with:

```tsx
{it.imageUrl ? (
  <div style={{ width: 120, height: 120, position: "relative" }}>
    <Image
      src={it.imageUrl}
      alt={it.name}
      fill
      style={{ objectFit: "contain" }}
      sizes="120px"
    />
  </div>
) : (
  <GarmentVector itemId={it.id} accent={accent} size={120} className="w-full h-auto block" />
)}
```

Add `import Image from "next/image"` to the import block.

---

## Invariants

- `catalogImageUrlSchema` in `lib/schemas/catalog.ts` already enforces UploadThing-only URLs (`utfs.io` / `ufs.sh`). Any URL that passes the API validation is safe to pass to `next/image`.
- `next.config.ts` already lists `utfs.io` and `ufs.sh` in `images.remotePatterns` — no config change needed.
- Items with no photo (`imageUrl` is `null` / `undefined`) silently fall back to `GarmentVector`; no UI difference for NSBH until photos are uploaded.

---

## Not needed

| Item | Reason |
|---|---|
| DB migration | `image_url` column exists (`db/schema.ts:104`) |
| `CatalogItem` type change | `imageUrl?: string` already declared (`lib/data.ts:64`) |
| UploadThing route change | `catalogImage` route already gated and complete |
| Admin drawer change | Already has `UploadDropzone` + preview + Remove button |
| `next.config.ts` change | UploadThing hosts already in `remotePatterns` |

---

## Verification

1. `pnpm check-types:web` passes
2. Dev server: upload a photo via admin drawer, navigate to parent PDP — photo renders; remove photo, GarmentVector returns
3. Catalog grid: photo appears in the item card thumbnail; items without photos show GarmentVector
4. TypeScript: no `as unknown as` casts needed — `imageUrl` flows naturally once added to the query select
