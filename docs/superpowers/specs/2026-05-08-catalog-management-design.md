# Catalog management — design spec

**Author:** George Qiao
**Date:** 2026-05-08
**Status:** Draft for review
**Tracks:** `docs/remaining_work.md` §3.1 ("Missing catalog items from the paper form") — but reframed as the lifecycle replacement of the seed-script approach with self-service, per-tenant catalog management.

---

## 1. Problem

The catalog is currently seeded once per tenant via SQL/server-side seed and never edited again. NSBH's seed is incomplete (missing eight paper-form items: Navy Shorts (Summer), Grey Socks (Winter), School Scarf, Swimming Briefs, Soccer Jersey, Exercise Books, Ring Binders, Prefect Tie). RGSH was seeded with placeholder items that the school has never reviewed.

Every new tenant after NSBH/RGSH would require running another SQL script. That's not viable for a multi-tenant platform whose value proposition is "your school can run its own uniform shop online".

Additionally, the current data shape has no product image, and `description` (which has existed on the DB schema since migration 0007) is not consistently populated or surfaced through any operator-facing editor. Items render as a hardcoded `GarmentVector` SVG keyed by item ID — fine for the 16 seeded items, useless for any item a school adds itself.

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
| Schema | Add `image_url text` to `catalog_items` (migration 0008). `description` already exists on the schema since 0007 — no migration needed. |
| Admin UI | "Add item" button + side-drawer create/edit form on `/admin/[tenant]/catalog` |
| API | New `POST /api/catalog`, new `PATCH /api/catalog/[itemId]`. Existing `DELETE` extended for image cleanup. Image uploads handled through UploadThing's typed App Router handler at `/api/uploadthing` — no custom upload proxy. |
| Storage | Image uploads via UploadThing (Next.js SDK) |
| Approval gate | Block mutations and the catalog editor page when `platform_approval_status ≠ 'approved'` |
| Fallback rendering | Refactor `GarmentVector` so its primary key is `category`, not `id` |
| Parent shop | Migrate `[tenant]/page.tsx`, `[tenant]/item/[itemId]/page.tsx`, and any other consumer of static `CATALOG` to read live from `getCatalogByTenant` / `getCatalogItemById`. Render `<Image>` from `image_url` when present; otherwise category-keyed `GarmentVector`. |
| Type rename | Full rename `desc` → `description` across the static `CatalogItem` type, the 8 static seed entries, and the item-detail renderer — kept aligned with the DB column name. |
| Validation | Zod schemas on all mutating routes |

## 5. Data model

### 5.1 Schema delta — migration `0008_catalog_image_url`

```sql
ALTER TABLE catalog_items
  ADD COLUMN image_url text;
```

`description` is **already** defined on `catalog_items` in `apps/web/src/db/schema.ts:60` and present in `drizzle/meta/0007_snapshot.json` — no migration needed for it. Migration 0008 adds only `image_url`.

`image_url` is nullable. No data backfill. Existing seeded rows keep null and fall through to `GarmentVector`.

### 5.2 Drizzle schema update — `apps/web/src/db/schema.ts`

```ts
export const catalogItems = pgTable("catalog_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),     // already exists since 0007
  imageUrl: text("image_url"),          // NEW in 0008
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

### 5.4 TypeScript types — `apps/web/src/lib/data.ts` (full `desc` → `description` rename)

```ts
export interface CatalogItem {
  id: string;
  cat: ItemCategory;
  name: string;
  description?: string;     // renamed from desc, matches DB column
  imageUrl?: string;        // NEW, matches DB column
  variants: ItemVariant[];
  sizeGuide?: SizeGuide;
}
```

Earlier review noted `desc` is populated by 8 static seed entries (`apps/web/src/lib/data.ts:74,93,100,110,128,139,169,203`) and rendered by `apps/web/src/app/[tenant]/item/[itemId]/page.tsx:34`. Rename is therefore not no-op; it is bounded and mechanical.

Required edits:

1. `apps/web/src/lib/data.ts` — rename interface field `desc` → `description`; rename `desc:` → `description:` in all 8 seed entries.
2. `apps/web/src/app/[tenant]/item/[itemId]/page.tsx:34` — rename both `item.desc &&` and `{item.desc}` to `description`.
3. Any other reader of `item.desc` — grep before merging; expected to be the renderer above only.

The static `CATALOG` keeps the same shape so it can serve as the dev-fallback type for the DB rows (see §5.5).

### 5.5 Parent shop live-DB read migration

The parent shop currently reads from the static `CATALOG` array. Per the goal in §2 ("schools manage their own catalog"), parent routes must move to live DB reads.

Files to update:

| File | Current | After |
|---|---|---|
| `apps/web/src/app/[tenant]/page.tsx` | `import { CATALOG } from "@/lib/data"` then `CATALOG.filter(i => i.cat === activeCat)` | `await getCatalogByTenant(tid)` then filter by `cat === activeCat` and `active === true` in memory. Inactive items never appear on the parent grid. |
| `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` | `getItem(itemId)` (static) + `generateStaticParams` over `CATALOG` | `await getCatalogItemById(itemId)`. **Drop `generateStaticParams`** — pages render on-demand. **Inactive item rule:** if the row is missing **or** `active === false` **or** the row's `tenantId` doesn't match the route's tenant slug, call `notFound()` to render the standard 404. Admin routes remain unaffected — operators still see and can edit inactive items. |
| `apps/web/src/app/[tenant]/cart/...`, `apps/web/src/app/[tenant]/checkout/...`, parent receipt | Wherever cart/checkout/order rendering needs the item image, prefer the line snapshot already on the order; otherwise look up via `getCatalogItemById`. | Same |

Helpers `getCatalogByTenant` and `getCatalogItemById` already exist in `apps/web/src/db/queries.ts:515,539`.

The DB row shape returned from these helpers must be mapped to the UI `CatalogItem` shape used by existing components. A small adapter colocated with the queries (`mapDbItem(dbItem) → CatalogItem`) handles:

- DB `description: string | null` → UI `description?: string`
- DB `imageUrl: string | null` → UI `imageUrl?: string`
- DB `category: string` → UI `cat: ItemCategory` (cast after enum-validate)
- DB variant rows → UI `variants: ItemVariant[]`

The static `CATALOG` is retained for tests and for local dev when the DB seed is bare. Production renders never touch it.

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

**Variants strategy: replace (hard).** If `variants` is included in the request, the entire variant array for the item is hard-deleted and re-inserted in one transaction. No soft-delete logic is needed.

Why this is safe: `order_lines` does not FK to `catalog_variants` (or to `catalog_items`). Verified at `apps/web/src/db/schema.ts:120-160` — `order_lines` carries snapshots of `itemId` (text, no FK), `itemName`, `variantLabel`, `unitPrice`, `qty`, `lineTotal`. Order history is fully self-contained against catalog mutations. Confirmed at the order-creation site `apps/web/src/app/api/orders/route.ts:202` — line inserts copy strings/prices, never variant ids.

If a future spec adds a real FK from `order_lines` to `catalog_variants`, that spec must reintroduce a referential-integrity strategy here.

### 6.3 `DELETE /api/catalog/[itemId]` (extended)

Existing endpoint. Extended to also delete the associated UploadThing file (best-effort, log + continue if delete fails). Item delete is hard delete; cascade deletes variants. No 409 path — `order_lines` does not FK to `catalog_items`, so item deletion never breaks past order history.

### 6.4 `GET /api/catalog?tenantId=…` (unchanged behavior)

Reads stay ungated. No change.

### 6.5 Stale-cart guard at order create — `POST /api/orders` (cross-cutting)

Once schools can deactivate or delete catalog items, a parent's existing cart can drift out of sync with current catalog state between add-to-cart and checkout. Today, `apps/web/src/app/api/orders/route.ts:202` inserts whatever line snapshots the client posts, with no catalog validation — fine when the catalog was static, unsafe now.

**Rule:** Before inserting `order_lines`, the orders route must revalidate every line against the live catalog within the same transaction. The check is per-line:

1. The `catalog_items` row matching `line.itemId` exists, belongs to the order's `tenantId`, and has `active = true`.
2. The `catalog_variants` row whose `(item_id, label)` matches `(line.itemId, line.variantLabel)` exists and has `active = true`.

If any line fails, abort the transaction and return:

```http
409 Conflict
{
  "code": "cart_items_unavailable",
  "items": [
    { "itemId": "blazer-m", "variantLabel": "Size 12", "reason": "item_inactive" }
  ]
}
```

Reasons: `item_not_found`, `item_inactive`, `item_wrong_tenant`, `variant_not_found`, `variant_inactive`.

The cart UI must surface this as: "Some items in your cart are no longer available. Please review your cart." with the offending lines highlighted. Implementation of the cart-side surface lives with the parent-shop work (§5.5) so cart and order-create land together.

**Price drift is explicitly out of scope for MVP.** If a line's snapshot price differs from the current variant price, the order still proceeds at the snapshot price. A future spec may add price-revalidation; doing it now compounds the surface area without strong evidence of need (catalog edits are low-frequency).

## 7. Approval-gate enforcement

Tenant must have `platform_approval_status = 'approved'` to perform any of the following. Otherwise, return 403 `{ code: "tenant_not_approved", message: "This school is not yet approved on the platform." }`.

**Server-side checks:**

| Path | Method | Gated? |
|---|---|---|
| `/admin/[tenant]/catalog` | page render | ✅ Render `<PendingApprovalEmptyState />` instead of the catalog table |
| `POST /api/catalog` | mutation | ✅ |
| `PATCH /api/catalog/[itemId]` | mutation | ✅ |
| `DELETE /api/catalog/[itemId]` | mutation | ✅ |
| UploadThing file router (`catalogImage`) at `/api/uploadthing` | mutation | ✅ — enforced inside the router's `middleware()` (see §8.2) |
| `GET /api/catalog` | read | ❌ |
| `/[tenant]/...` (parent shop) | reads | ❌ |

The check matches the existing `authorization.ts` style — helpers return discriminated unions, never throw. Two surfaces, one shared loader:

```ts
// apps/web/src/lib/auth/require-tenant-approved.ts
import { NextResponse } from "next/server";
import { getTenantById } from "@/db/queries";

export type LoadedTenant = NonNullable<Awaited<ReturnType<typeof getTenantById>>>;

/** For API routes — returns 404/403 NextResponse on failure. */
export async function requireTenantApproved(
  tenantId: string
): Promise<{ tenant: LoadedTenant } | { response: NextResponse }> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return { response: NextResponse.json({ code: "tenant_not_found" }, { status: 404 }) };
  }
  if (tenant.platformApprovalStatus !== "approved") {
    return { response: NextResponse.json({ code: "tenant_not_approved" }, { status: 403 }) };
  }
  return { tenant };
}
```

**Route usage:**

```ts
const approval = await requireTenantApproved(tenantId);
if ("response" in approval) return approval.response;
const { tenant } = approval;
// proceed
```

**Page usage** (`/admin/[tenant]/catalog/page.tsx`): the page uses `getTenantById` directly and branches on the status string — no NextResponse involved:

```ts
const tenant = await getTenantById(tid);
if (!tenant) notFound();
if (tenant.platformApprovalStatus !== "approved") {
  return <PendingApprovalEmptyState tenant={tenant} />;
}
```

The UploadThing middleware (§8.2) does its own check inline because it must `throw new UploadThingError(...)` to reject; it can't return a NextResponse.

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

### 8.2 Integration — single typed-router path (no custom proxy)

Per UploadThing's App Router pattern (`https://docs.uploadthing.com/getting-started/appdir`), upload requests go directly client → typed `<UploadDropzone>` → `createRouteHandler` mounted at `/api/uploadthing`. Auth + approval-gate enforcement lives inside the router's `middleware()`. No separate `POST /api/upload/...` proxy.

The middleware must reconcile UploadThing's "throw to reject" contract with the existing helpers in `apps/web/src/lib/auth/authorization.ts`, which return `{ user } | { response }` and `NextResponse | null` rather than throwing. The pattern below loads the tenant, unwraps each helper, and translates rejections into `UploadThingError`.

1. `pnpm add uploadthing @uploadthing/react`
2. Add `UPLOADTHING_TOKEN` to env (Hostinger production env group + `.env.local`).
3. Create `apps/web/src/lib/uploadthing.ts` defining a `FileRouter` with one route, `catalogImage`:

   ```ts
   import { createUploadthing, type FileRouter } from "uploadthing/next";
   import { UploadThingError } from "uploadthing/server";
   import { z } from "zod";
   import { requireSessionUser, ensureTenantAccess } from "@/lib/auth/authorization";
   import { getTenantById } from "@/db/queries";

   const f = createUploadthing();

   export const uploadRouter = {
     catalogImage: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
       .input(z.object({ tenantId: z.string().min(1) }))
       .middleware(async ({ input }) => {
         // 1. Tenant must exist
         const tenant = await getTenantById(input.tenantId);
         if (!tenant) throw new UploadThingError("tenant_not_found");

         // 2. Auth — requireSessionUser returns { user } | { response }
         const auth = await requireSessionUser();
         if ("response" in auth) {
           throw new UploadThingError("Authentication required");
         }
         const { user } = auth;

         // 3. Tenant access — ensureTenantAccess takes the operator's email
         //    (not the tenantId) and returns NextResponse | null
         const denied = ensureTenantAccess(user, tenant.shopEmail);
         if (denied) throw new UploadThingError("Forbidden");

         // 4. Approval gate
         if (tenant.platformApprovalStatus !== "approved") {
           throw new UploadThingError("tenant_not_approved");
         }

         return { tenantId: input.tenantId, userId: user.id };
       })
       .onUploadComplete(async ({ metadata, file }) => {
         // Persist nothing here — the drawer captures `file.url` via
         // onClientUploadComplete and includes it in the catalog
         // POST/PATCH body. UploadThing keeps the file regardless of
         // whether the catalog save succeeds; orphaned files are GC'd
         // by a future cleanup job (out of scope for this spec).
         return { url: file.url };
       }),
   } satisfies FileRouter;

   export type UploadRouter = typeof uploadRouter;
   ```

   Implementation note: `getTenantById` is the shared helper used by `requireTenantApproved` in the API routes (§7). If it does not yet exist, add it to `apps/web/src/db/queries.ts` as part of this work — it is also the cleanest replacement for the existing inline `db.select().from(tenants)…` calls in the catalog mutation routes.

4. Mount the route handler at `apps/web/src/app/api/uploadthing/route.ts`:

   ```ts
   import { createRouteHandler } from "uploadthing/next";
   import { uploadRouter } from "@/lib/uploadthing";

   export const { GET, POST } = createRouteHandler({ router: uploadRouter });
   ```

5. Generate typed React components in `apps/web/src/components/uploadthing.ts`:

   ```ts
   import { generateUploadDropzone, generateUploadButton } from "@uploadthing/react";
   import type { UploadRouter } from "@/lib/uploadthing";

   export const UploadDropzone = generateUploadDropzone<UploadRouter>();
   export const UploadButton    = generateUploadButton<UploadRouter>();
   ```

6. Drawer uses `<UploadDropzone endpoint="catalogImage" input={{ tenantId }} onClientUploadComplete={…} />`. The returned `file.url` is held in form state and submitted with the catalog POST/PATCH body.

**Failure modes from middleware** propagate to the drawer's `onUploadError` callback. The drawer shows a toast: "This school is not yet approved on the platform" for `tenant_not_approved`, generic message otherwise.

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

1. **Migration `0008_catalog_image_url`** — adds only the `image_url text` column to `catalog_items`. `description` already exists (since 0007); no migration needed for it. Drizzle generates the SQL; review before applying.
2. **No data backfill** — `image_url` is nullable; existing rows get `null`.
3. **Drizzle snapshot** updates as part of the migration.
4. **`seed.ts`** — leave NSBH/RGSH inserts as-is. Adding the eight missing NSBH paper-form items can happen via the new admin UI after deploy, OR the seed can be extended with stub rows now and operators upload images post-deploy.
5. **Parent-shop DB read migration is code-only** — no DB migration. Lands in the same PR (or a PR-2 split) as part of touching the parent routes.

## 13. Test plan

Type-checking is the only existing gate (`pnpm check-types:web`). Smoke tests done manually:

1. **Approved tenant end-to-end (admin → parent):** `nsbh` → `/admin/nsbh/catalog` → "Add item" → fill form → upload image → save → row appears in admin table → navigate to `/nsbh` → new item appears in the appropriate category → tap into item detail → description and image render correctly.
2. **Non-approved tenant blocked:** flip `nsbh.platform_approval_status = 'pending'` via SQL → `/admin/nsbh/catalog` shows pending-approval empty state. Direct POST to `/api/catalog` returns 403. Direct upload via `<UploadDropzone>` shows `tenant_not_approved` error. Parent shop at `/nsbh` keeps rendering existing items normally (reads ungated). Restore `'approved'` after.
3. **Image fallback:** create an item without uploading an image → parent shop shows category-keyed `GarmentVector` glyph.
4. **Image replace:** edit an existing item, upload a new image → form state updates → save → catalog table shows new thumbnail. (UploadThing GC of old files is out of scope; verify only the new URL persists in DB.)
5. **Variant replace:** edit an item, remove one variant, add a new one, save → DB shows new variant rows; old variant rows hard-deleted; existing orders that referenced the old variant label still render correctly because order line items hold their own snapshot.
6. **Item delete keeps order history intact:** delete a catalog item that has past order lines → DELETE succeeds (no 409) → past orders keep rendering with their snapshot data; admin order detail still shows the item name and price as historically captured.
7. **Validation:** submit form with name `""` → field error. Submit with no variants → "Add at least one variant" error. Submit with negative price → field error.
8. **Image too big:** try to upload 3MB image → UploadThing rejects via maxFileSize; drawer shows the error.
9. **Parent-shop DB-read migration:** seed-only data (no admin edits) still renders correctly on `/nsbh` and `/nsbh/item/[itemId]`. Item-detail pages no longer pre-render statically (no `generateStaticParams`). Cold-load latency on item detail acceptable (single-row query).
10. **Inactive item parent route:** create item, deactivate it, navigate to `/nsbh/item/[id]` directly → renders 404. Visit the same id from `/admin/nsbh/catalog` → drawer opens normally for editing.
11. **Stale-cart guard:** parent A adds item X to cart on `/nsbh`; operator deactivates (or deletes) X; parent A taps "Pay" → `POST /api/orders` returns 409 with `cart_items_unavailable` and the offending line; cart UI shows the warning; no order row written; no Stripe charge. Parent A removes the line, retries, order succeeds.

## 14. Out-of-scope follow-ups (future work)

- §2.2 super-admin tenant-approval UI — flip approval through a UI rather than SQL.
- School self-signup — public form to request a new tenant.
- Per-variant images / colour swatches.
- CSV bulk-upload extension to include image URLs.
- Catalog audit log (§4.6 in `remaining_work.md`).
- Drag-to-reorder catalog rows (§4.7 in `remaining_work.md`).
- Price-drift revalidation at order create (§6.5 covers active/exists; price mismatch is deferred).
- UploadThing orphaned-file GC job (uploads that complete but whose catalog save fails are left in storage).

## 15. Open questions

None blocking. Two minor decisions that can be locked at implementation time:

- **Six category default SVGs** — design taste/illustration of the Summer/Winter/Sports/Formal/Bags/Stationery default glyphs. Implementation can stub with simple shapes; can be polished later.
- **Support email in pending-approval empty state** — `support@uniformorder.online` placeholder; confirm with platform before deploy.
