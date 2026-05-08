# Catalog management — design spec

**Author:** George Qiao
**Date:** 2026-05-08
**Status:** Draft for review
**Tracks:** `docs/remaining_work.md` §3.1 ("Missing catalog items from the paper form") — but reframed as the lifecycle replacement of the seed-script approach with self-service, per-tenant catalog management.

---

## 1. Problem

The catalog is currently seeded once per tenant via SQL/server-side seed and never edited again. NSBH's seed is incomplete (missing eight paper-form items: Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie). RGSH was seeded with placeholder items that the school has never reviewed.

Every new tenant after NSBH/RGSH would require running another SQL script. That's not viable for a multi-tenant platform whose value proposition is "your school can run its own uniform shop online".

Additionally, the current data shape has no product description and no product image. Items render as a hardcoded `GarmentVector` SVG keyed by item ID — fine for the 16 seeded items, useless for any item a school adds itself.

## 2. Goals

1. School operators can add, edit, and delete catalog items themselves through the existing `/admin/[tenant]/catalog` UI.
2. Each item can carry a description and a custom thumbnail image; missing image falls back to a category-keyed icon.
3. Mutations are blocked until the tenant has been approved on the platform (`platform_approval_status = 'approved'`), reusing the existing gate.
4. Reads remain ungated — the parent shop keeps working for any approved-or-not tenant whose data already exists, including the seeded NSBH/RGSH.
5. No new tables. No new variant complexity. The existing `catalog_items` + `catalog_variants` shape stays.

## 3. Non-goals (deferred)

- **Super-admin / platform portal (§2.2)** — listing tenants, approving them through a UI, provisioning wizard. Approval still flips via SQL until §2.2 ships.
- **School self-service signup** — the public "request your school" form is a separate scope (would be Option C in scope brainstorming).
- **Per-variant images, colour swatches, multi-image galleries** — MVP is one image per item, period.
- **CSV bulk image upload** — existing CSV bulk-upload stays text-only. Images attached one-by-one via the drawer.
- **Image transformations beyond resize-to-fit** — no cropping, no background removal.
- **Audit trail for catalog edits** — existing `updated_at` is the only signal; full audit log is §4.6 in `remaining_work.md`.

## 4. Scope summary

| Area | In scope |
|---|---|
| Schema | Add `description text` and `image_url text` to `catalog_items` (migration 0008) |
| Admin UI | "Add item" button + side-drawer create/edit form on `/admin/[tenant]/catalog` |
| API | New `POST /api/catalog`, new `PATCH /api/catalog/[itemId]`, new `POST /api/upload/catalog-image`. Existing `GET` and `DELETE` extended for image cleanup. |
| Storage | Image uploads via UploadThing (Next.js SDK) |
| Approval gate | Block mutations and the catalog editor page when `platform_approval_status ≠ 'approved'` |
| Fallback rendering | Refactor `GarmentVector` so its primary key is `category`, not `id` |
| Parent shop | Render `<Image>` from `image_url` when present; otherwise existing `GarmentVector` (now category-keyed) |
| Validation | Zod schemas on all mutating routes |

## 5. Data model

### 5.1 Schema delta — migration `0008_catalog_descriptions_and_images`

```sql
ALTER TABLE catalog_items
  ADD COLUMN description text,
  ADD COLUMN image_url text;
```

Both columns are nullable. No data backfill. Existing 16 seeded items keep null `image_url` and fall through to `GarmentVector`. NSBH/RGSH seed inserts in `seed.ts` keep working unchanged.

### 5.2 Drizzle schema update — `apps/web/src/db/schema.ts`

```ts
export const catalogItems = pgTable("catalog_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),     // NEW
  imageUrl: text("image_url"),          // NEW
  sizeGuide: jsonb("size_guide"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

`catalog_variants` is unchanged.

### 5.3 Item ID generation

Existing IDs (`blazer-m`, `shorts-sport`) are kept as-is. New items generate IDs server-side as:

```
${tenantId}-${slugify(name)}
```

On collision (existing item with same id within the same tenant), append `-2`, `-3`, … until unique. The `id` column is the primary key (text), so global uniqueness is required across all tenants — but `tenantId-` prefix makes collisions across tenants effectively impossible.

`slugify(name)`: lowercase, ASCII-only, non-alphanumerics → `-`, collapse repeated `-`, trim leading/trailing `-`, max 40 chars.

### 5.4 TypeScript types — `apps/web/src/lib/data.ts`

```ts
export interface CatalogItem {
  id: string;
  cat: ItemCategory;
  name: string;
  description?: string;     // RENAMED from desc, now matches DB column
  imageUrl?: string;        // NEW
  variants: ItemVariant[];
  sizeGuide?: SizeGuide;
}
```

The existing `desc` field on the type is renamed to `description`. The frontend already only reads it for display; rename is mechanical. (No schema migration of consumers needed since `desc` is currently never populated.)

## 6. API surface

All new endpoints live under `/api/catalog/*`. All require an authenticated operator session (existing `requireSessionUser` + `ensureTenantAccess` helpers).

### 6.1 `POST /api/catalog`

Create a new catalog item with at least one variant, in a single transaction.

**Request:**
```json
{
  "tenantId": "nsbh",
  "name": "Navy Shorts (Summer)",
  "category": "Summer",
  "description": "Navy cotton shorts for summer term. Machine washable.",
  "imageUrl": "https://utfs.io/f/abc123…",
  "active": true,
  "sortOrder": 12,
  "variants": [
    { "label": "Size 8",  "price": 28.00 },
    { "label": "Size 10", "price": 28.00 },
    { "label": "Size 12", "price": 30.00 }
  ]
}
```

**Response 201:** the created item with variants. Auto-assigned `id`.

**Response 403:** `{ "code": "tenant_not_approved" }` when the tenant is not approved.

### 6.2 `PATCH /api/catalog/[itemId]`

Partial update. Fields may include any subset of `name`, `category`, `description`, `imageUrl`, `active`, `sortOrder`, `sizeGuide`, and `variants`.

**Variants strategy: replace.** If `variants` is included in the request, the entire variant array for the item is replaced. Simpler than diffing; safe because catalog editing is a low-frequency, single-operator action.

Replacement logic, in one transaction:

1. Load the item's current variants.
2. For each existing variant: if it is referenced by any `order_lines` row, mark `active = false` and **keep it** (do not delete). Otherwise, hard-delete it.
3. Insert the new variants from the request body. New variants whose `label` matches a soft-deleted older variant from step 2 do not collide because variants use UUID PKs — the soft-deleted row stays as historical reference; the new row is a fresh UUID.

This preserves referential integrity for past orders while letting operators evolve the catalog. The implementation must confirm the FK column on `order_lines` (likely `order_lines.variant_id`) and add an `ON DELETE RESTRICT` if missing.

### 6.3 `POST /api/upload/catalog-image`

Multipart form upload. Validates type and size, forwards to UploadThing, returns the resulting URL.

**Request:** `multipart/form-data` with `file` field. Max 2MB. Allowed MIME: `image/jpeg`, `image/png`, `image/webp`.

**Response 200:** `{ "url": "https://utfs.io/f/abc123…" }`

**Response 403:** `{ "code": "tenant_not_approved" }` when the tenant is not approved.

The endpoint is tenant-scoped: it reads `tenantId` from the session/route context and stores the file under `${tenantId}/${uuid}.${ext}` in UploadThing.

### 6.4 `DELETE /api/catalog/[itemId]` (extended)

Existing endpoint. Extended to also delete the associated UploadThing file (best-effort, log + continue if delete fails). Item delete is hard delete; cascade deletes variants.

If any variant is referenced by an existing order line, return 409 with `{ "code": "item_in_use" }`. Operator must soft-delete via `active = false` instead.

### 6.5 `GET /api/catalog?tenantId=…` (unchanged behavior)

Reads stay ungated. No change.

## 7. Approval-gate enforcement

Tenant must have `platform_approval_status = 'approved'` to perform any of the following. Otherwise, return 403 `{ code: "tenant_not_approved", message: "This school is not yet approved on the platform." }`.

**Server-side checks:**

| Path | Method | Gated? |
|---|---|---|
| `/admin/[tenant]/catalog` | page render | ✅ Render `<PendingApprovalEmptyState />` instead of the catalog table |
| `POST /api/catalog` | mutation | ✅ |
| `PATCH /api/catalog/[itemId]` | mutation | ✅ |
| `DELETE /api/catalog/[itemId]` | mutation | ✅ |
| `POST /api/upload/catalog-image` | mutation | ✅ |
| `GET /api/catalog` | read | ❌ |
| `/[tenant]/...` (parent shop) | reads | ❌ |

The check is a single helper:

```ts
// apps/web/src/lib/auth/require-tenant-approved.ts
export async function requireTenantApproved(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new HttpError(404, "tenant_not_found");
  if (tenant.platformApprovalStatus !== "approved") {
    throw new HttpError(403, "tenant_not_approved");
  }
  return tenant;
}
```

Used in both the page (try/catch → render empty state) and API routes (try/catch → return 403 JSON).

**Why reads are not gated:** existing seeded NSBH/RGSH should keep functioning even if their `platform_approval_status` were ever flipped back. And public-shop reads should not depend on platform-admin state — that's a contract between platform and school, not platform and parents.

## 8. Image storage — UploadThing

### 8.1 Why UploadThing

| Option | Pros | Cons | Decision |
|---|---|---|---|
| UploadThing | Drop-in Next.js SDK, free 2GB tier, signed URLs, image variants, CDN | Vendor lock-in; $10/mo at scale | ✅ Pick for MVP |
| Cloudflare R2 | Cheapest at scale, S3 compatible | Manual signing, CORS, presigned URL flow | Deferred to v2 |
| Hostinger filesystem | Trivial | Ephemeral on Hostinger Node.js apps | ❌ Reject |
| Postgres bytea | One backend | Slow, blows up DB, no CDN | ❌ Reject |

UploadThing's free tier (2GB) is more than enough for MVP — at 1MB average per image and 100 items per tenant, that's 100MB per tenant; tier covers ~20 tenants before paying.

### 8.2 Integration

1. `pnpm add uploadthing @uploadthing/react`
2. Add `UPLOADTHING_TOKEN` to env (Hostinger production env group + `.env.local`).
3. Create `apps/web/src/lib/uploadthing.ts` with one router: `catalogImage` (max 1 file, max 2MB, image/*, callbacked to write the URL).
4. Mount the route handler at `app/api/uploadthing/route.ts`.
5. Use `UploadButton` (or `UploadDropzone`) from `@uploadthing/react` inside the catalog form drawer.

### 8.3 Constraints

- Max 2MB
- Allowed: `image/jpeg`, `image/png`, `image/webp`
- One image per item (replacing an existing image deletes the old file from UploadThing)
- File path within UploadThing: `${tenantId}/${itemId}/${uuid}.${ext}` — keeps tenant data separable

### 8.4 CSP

`apps/web/next.config.ts` `Content-Security-Policy` already lists Stripe, PostHog, Resend. Add UploadThing domains: `utfs.io` (file URLs) and `uploadthing.com` (API). Add to both `img-src` and `connect-src`.

## 9. Fallback rendering — `GarmentVector` refactor

Today `GarmentVector` switches on hardcoded item IDs (`blazer-m`, `shorts-sport`, etc.) and has no graceful default for unknown IDs.

**New strategy:** primary key is `category`, secondary key is `id`. Each of the six categories (Summer, Winter, Sports, Formal, Bags, Stationery) gets a default glyph. Existing per-id illustrations remain as overrides.

```ts
// apps/web/src/components/garment.tsx

type GarmentVectorProps = {
  category: ItemCategory;
  id?: string;          // optional refinement, falls through if no match
  size?: number;
  className?: string;
};

const idVectors: Record<string, FC<…>> = {
  "blazer-m": BlazerM,
  "shorts-sport": ShortsSport,
  // … existing 14 more
};

const categoryVectors: Record<ItemCategory, FC<…>> = {
  Summer: SummerDefault,
  Winter: WinterDefault,
  Sports: SportsDefault,
  Formal: FormalDefault,
  Bags:   BagsDefault,
  Stationery: StationeryDefault,
};

export function GarmentVector({ category, id, ...rest }: GarmentVectorProps) {
  const Specific = id ? idVectors[id] : undefined;
  const Default = categoryVectors[category];
  const Component = Specific ?? Default;
  return <Component {...rest} />;
}
```

Six new SVG components are needed (one per category). Style: same flat-vector lineart as existing `BlazerM`, neutral grey/parchment palette. Inline SVG, no images.

**Render flow on parent item page:**

```tsx
{item.imageUrl
  ? <Image src={item.imageUrl} alt={item.name} width={240} height={240} />
  : <GarmentVector category={item.cat} id={item.id} size={240} />}
```

Use `next/image` so it's CDN-cached and optimised. Add `utfs.io` to `next.config.ts` `images.remotePatterns`.

## 10. Admin UI — side drawer

### 10.1 Catalog list page changes

`/admin/[tenant]/catalog/page.tsx`:

- Add `<PendingApprovalEmptyState />` branch when tenant is not approved.
- Add **"Add item"** button in the topbar next to the existing "Bulk upload CSV" button.
- The existing `CatalogTable` component currently supports inline name-edit and per-row delete. Replace inline name-edit with row-click → opens the drawer in edit mode (with all fields, not just name). Per-row delete stays. The "image" column is added (renders the thumbnail or `GarmentVector` fallback at 40×40px).

### 10.2 Drawer component

New: `apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx` (`"use client"`).

Built with HeroUI `Sheet` (right-side, ~440px wide on desktop). Two modes:

- **Create mode** — opens via "Add item" button; submits to `POST /api/catalog`.
- **Edit mode** — opens via row click in `CatalogTable`; submits to `PATCH /api/catalog/[itemId]`.

### 10.3 Form fields (top to bottom)

1. **Image** — `UploadDropzone` from `@uploadthing/react`. Shows uploaded preview thumbnail; "Remove" button reverts to `null`. When `null`, shows a small inline `<GarmentVector category={category} />` preview so the operator sees what parents will see.
2. **Name** — single-line text input. Required, 1–80 chars.
3. **Category** — select dropdown. Required. Options: Summer / Winter / Sports / Formal / Bags / Stationery.
4. **Description** — textarea. Optional, 0–500 chars. Placeholder: "Short description shown on the item page (max 500 characters)".
5. **Variants** — repeating list. Each row: `Label` text input + `Price (AUD)` number input (step 0.01) + delete-row button. "Add variant" link below. At least one variant required to save.
6. **Active toggle** — switch. Default `true`. When `false`, item hidden from parent shop.

### 10.4 Footer

- **Cancel** — closes the drawer; if dirty, confirm dialog.
- **Save** — disabled until all required fields valid; shows "Saving…" then "✓ Saved" on success; closes the drawer and `router.refresh()`s the catalog list.

### 10.5 Validation (client-mirror of server Zod)

- Name: 1–80 chars, required, trim
- Category: required, enum
- Description: ≤ 500 chars
- ImageUrl: optional, must be `https://` URL
- Variants: ≥ 1; each label 1–40 chars, price > 0
- Submit disabled until valid; field-level error messages on blur

### 10.6 Empty state on the page (when tenant pending)

`<PendingApprovalEmptyState>`:

> "Your school is awaiting platform approval. Once approved, you'll be able to add and edit catalog items here. Need help? Contact platform support at <support@uniformorder.online>."

(Support email is a placeholder — update once decided.)

## 11. Validation summary (Zod schemas)

Single shared file `apps/web/src/lib/schemas/catalog.ts`:

```ts
export const catalogVariantInputSchema = z.object({
  label: z.string().trim().min(1).max(40),
  price: z.number().positive().max(10000),
  active: z.boolean().optional(),
});

export const catalogItemInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  category: z.enum(["Summer", "Winter", "Sports", "Formal", "Bags", "Stationery"]),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  variants: z.array(catalogVariantInputSchema).min(1),
});

export const catalogItemPatchSchema = catalogItemInputSchema.partial().extend({
  variants: z.array(catalogVariantInputSchema).min(1).optional(),
});
```

Used by both the API routes (server) and the drawer form (client) so messages match.

## 12. Migration strategy

1. **Migration `0008_catalog_descriptions_and_images`** — adds `description` and `image_url` columns. Drizzle generates the SQL; review before applying.
2. **No data backfill** — both columns nullable; existing rows have `null`.
3. **Drizzle snapshot** updates as part of the migration.
4. **`seed.ts`** — leave NSBH/RGSH inserts as-is (no description/image yet). Adding the eight missing NSBH paper-form items can happen via the new admin UI after deploy, OR the seed can be extended with stub rows now and operators upload images post-deploy.

## 13. Test plan

Type-checking is the only existing gate (`pnpm check-types:web`). Smoke tests done manually:

1. **Approved tenant can edit:** `nsbh` → `/admin/nsbh/catalog` → "Add item" → fill form → upload image → save → row appears → parent shop shows new item with image.
2. **Non-approved tenant blocked:** flip `nsbh.platform_approval_status = 'pending'` via SQL → `/admin/nsbh/catalog` shows pending-approval empty state. Direct POST to `/api/catalog` returns 403. Restore `'approved'` after.
3. **Image fallback:** create an item without uploading an image → parent shop shows category-keyed icon.
4. **Image replace:** edit an existing item, upload a new image → old UploadThing file deleted, new URL persisted.
5. **Variant replace:** edit an item, remove one variant, add a new one, save → DB shows variant rows replaced.
6. **Variant FK protection:** try to delete an item that has an order line → 409 with `item_in_use`. Mark `active = false` instead → item disappears from parent shop, persists in admin.
7. **Validation:** submit form with name `""` → field error. Submit with no variants → "Add at least one variant" error.
8. **Image too big:** try to upload 3MB image → UploadThing rejects with size error; form shows error.

## 14. Out-of-scope follow-ups (future work)

- §2.2 super-admin tenant-approval UI — flip approval through a UI rather than SQL.
- School self-signup — public form to request a new tenant.
- Per-variant images / colour swatches.
- CSV bulk-upload extension to include image URLs.
- Catalog audit log (§4.6 in `remaining_work.md`).
- Drag-to-reorder catalog rows (§4.7 in `remaining_work.md`).

## 15. Open questions

None blocking. Two minor decisions that can be locked at implementation time:

- **Six category default SVGs** — design taste/illustration of the Summer/Winter/Sports/Formal/Bags/Stationery default glyphs. Implementation can stub with simple shapes; can be polished later.
- **Support email in pending-approval empty state** — `support@uniformorder.online` placeholder; confirm with platform before deploy.
