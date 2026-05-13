# PDP Photo Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface `catalog_items.image_url` in the parent-facing catalog grid and PDP, falling back to `GarmentVector` when no photo is set.

**Architecture:** Two query functions in `db/queries.ts` are missing `imageUrl` from their SELECT — add it and map it into the `CatalogItem` shape. Two render sites (`catalog-grid.tsx` and `item/[itemId]/page.tsx`) then swap `GarmentVector` for a `next/image` conditional. No migration, no type changes, no new files.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (neon-http), `next/image`, UploadThing (already integrated at upload side)

---

## File map

| File | Change |
|---|---|
| `apps/web/src/db/queries.ts` | Add `imageUrl` to `getActiveCatalog` SELECT + map; add `imageUrl` to `getCatalogItemForPDP` SELECT + item literal |
| `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` | Swap `garment` prop from pure `GarmentVector` to `imageUrl ? <Image> : <GarmentVector>` |
| `apps/web/src/app/[tenant]/catalog-grid.tsx` | Add `Image` import; swap `GarmentVector` in card for `imageUrl ? <Image> : <GarmentVector>` |

---

### Task 1: Add `imageUrl` to `getActiveCatalog`

**Files:**
- Modify: `apps/web/src/db/queries.ts`

- [ ] **Step 1: Add `imageUrl` to the SELECT**

In `getActiveCatalog`, the `.select({})` call ends at `varSizes: catalogVariants.sizes`. Add one field:

```ts
// BEFORE (last two lines of .select({}) block):
      varPrice: catalogVariants.price,
      varSizes: catalogVariants.sizes,
    })

// AFTER:
      varPrice: catalogVariants.price,
      varSizes: catalogVariants.sizes,
      imageUrl: catalogItems.imageUrl,
    })
```

- [ ] **Step 2: Map `imageUrl` into the `CatalogItem` object**

In the same function, the `map.set(r.itemId, { ... })` call builds the item object. Add `imageUrl` after `sizeGuide`:

```ts
// BEFORE:
      map.set(r.itemId, {
        id: r.itemId,
        name: r.name,
        cat: r.category as CatalogItem["cat"],
        description: r.description ?? "",
        sizeGuide: (r.sizeGuide as CatalogItem["sizeGuide"]) ?? undefined,
        variants: [],
      } as unknown as CatalogItem);

// AFTER:
      map.set(r.itemId, {
        id: r.itemId,
        name: r.name,
        cat: r.category as CatalogItem["cat"],
        description: r.description ?? "",
        sizeGuide: (r.sizeGuide as CatalogItem["sizeGuide"]) ?? undefined,
        imageUrl: r.imageUrl ?? undefined,
        variants: [],
      } as unknown as CatalogItem);
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm check-types
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/db/queries.ts
git commit -m "feat(catalog): getActiveCatalog returns imageUrl"
```

---

### Task 2: Add `imageUrl` to `getCatalogItemForPDP`

**Files:**
- Modify: `apps/web/src/db/queries.ts`

- [ ] **Step 1: Add `imageUrl` to the SELECT**

In `getCatalogItemForPDP`, the `.select({})` call ends at `varActive: catalogVariants.active`. Add one field:

```ts
// BEFORE (last two lines of .select({}) block):
      varSizes: catalogVariants.sizes,
      varActive: catalogVariants.active,
    })

// AFTER:
      varSizes: catalogVariants.sizes,
      varActive: catalogVariants.active,
      imageUrl: catalogItems.imageUrl,
    })
```

- [ ] **Step 2: Map `imageUrl` into the item literal**

In the same function, the `const item: CatalogItem = { ... }` literal is built from `r0`. Add `imageUrl` after `sizeGuide`:

```ts
// BEFORE:
  const item: CatalogItem = {
    id: r0.itemId,
    name: r0.name,
    cat: r0.category as CatalogItem["cat"],
    description: r0.description ?? "",
    sizeGuide: (r0.sizeGuide as CatalogItem["sizeGuide"]) ?? undefined,
    variants: [],
  } as unknown as CatalogItem;

// AFTER:
  const item: CatalogItem = {
    id: r0.itemId,
    name: r0.name,
    cat: r0.category as CatalogItem["cat"],
    description: r0.description ?? "",
    sizeGuide: (r0.sizeGuide as CatalogItem["sizeGuide"]) ?? undefined,
    imageUrl: r0.imageUrl ?? undefined,
    variants: [],
  } as unknown as CatalogItem;
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm check-types
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/db/queries.ts
git commit -m "feat(catalog): getCatalogItemForPDP returns imageUrl"
```

---

### Task 3: PDP page — conditional image render

**Files:**
- Modify: `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`

- [ ] **Step 1: Add `Image` import**

At the top of the file, alongside the other imports, add:

```ts
import Image from "next/image";
```

- [ ] **Step 2: Replace `garment` prop**

Find the `garment={...}` JSX prop (it wraps a single `<GarmentVector>` in a parchment div). Replace it entirely:

```tsx
// BEFORE:
        garment={
          <div className="flex justify-center py-1 pb-2.5" style={{ background: "var(--color-parchment)" }}>
            <GarmentVector itemId={resolvedItem.id} accent={tenant.accent} size={210} />
          </div>
        }

// AFTER:
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

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm check-types
```

Expected: no errors. `resolvedItem.imageUrl` is `string | undefined` (from `CatalogItem`), so the conditional is valid.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[tenant\]/item/\[itemId\]/page.tsx
git commit -m "feat(pdp): render product photo when imageUrl set, fallback to GarmentVector"
```

---

### Task 4: Catalog grid — conditional image render

**Files:**
- Modify: `apps/web/src/app/[tenant]/catalog-grid.tsx`

- [ ] **Step 1: Add `Image` import**

At the top of the file, alongside the existing imports:

```ts
import Image from "next/image";
```

- [ ] **Step 2: Replace `GarmentVector` in the card**

Find this line inside the `.map((it) => ...)` card render:

```tsx
<GarmentVector itemId={it.id} accent={accent} size={120} className="w-full h-auto block" />
```

Replace it with a conditional that uses a full-width square container (matching the vector's `w-full` aspect-ratio-1:1 footprint):

```tsx
{it.imageUrl ? (
  <div className="relative w-full aspect-square" style={{ background: "var(--color-parchment)" }}>
    <Image
      src={it.imageUrl}
      alt={it.name}
      fill
      style={{ objectFit: "contain" }}
      sizes="(max-width: 430px) 50vw, 200px"
    />
  </div>
) : (
  <GarmentVector itemId={it.id} accent={accent} size={120} className="w-full h-auto block" />
)}
```

`aspect-square` is a Tailwind utility (available in both v3 and v4). The `background` on the wrapper ensures transparent-background PNGs show cleanly with the parchment fill, just like the PDP.

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm check-types
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[tenant\]/catalog-grid.tsx
git commit -m "feat(catalog): render product photo in grid card when imageUrl set"
```

---

### Task 5: Smoke test and mark done

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
pnpm dev:web
```

- [ ] **Step 2: Verify fallback (no photo)**

Open `http://localhost:3000/<tenant>` in the browser. All catalog cards should show `GarmentVector` silhouettes as before (no photos uploaded yet). Open any item PDP — `GarmentVector` renders in the parchment area. Nothing should look broken.

- [ ] **Step 3: Upload a test photo and verify render**

1. Log in as a tenant admin → `/admin/<tenant>/catalog`
2. Edit any item → upload a photo via the image field
3. Navigate to `/<tenant>` — the item's card should now show the photo (centered, contained, parchment background on any transparent edges)
4. Click through to the item PDP — the parchment area shows the 150×150 contained photo instead of `GarmentVector`
5. Return to admin, click "Remove" on the photo, save — both surfaces revert to `GarmentVector`

- [ ] **Step 4: Mark §3.12 item done in `docs/remaining_work.md`**

In `docs/remaining_work.md`, under `### 3.12 NSBH gap-analysis should-haves`, update the PDP photo line:

```markdown
// BEFORE:
- [ ] **PDP photo support — read `item.imageUrl` + UploadThing in admin drawer (gap-analysis §5.13).**

// AFTER:
- [x] **PDP photo support — read `item.imageUrl` + UploadThing in admin drawer (gap-analysis §5.13).** ✅ shipped.
```

- [ ] **Step 5: Commit docs update**

```bash
git add docs/remaining_work.md
git commit -m "docs(remaining-work): mark PDP photo support shipped"
```
