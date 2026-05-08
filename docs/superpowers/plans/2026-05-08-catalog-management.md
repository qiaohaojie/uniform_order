# Catalog Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seed-script catalog approach with a self-service per-tenant editor that lets school operators add/edit/delete items (with description and image), gated by the existing platform-approval flag, with the parent shop reading live DB rows so new items appear without a redeploy.

**Architecture:** Migration 0008 adds only `image_url` (description already exists). Catalog mutation routes (`POST/PATCH/DELETE /api/catalog`) gain Zod validation, approval-gate check, and image cleanup. UploadThing is used for image storage via its typed App-Router router at `/api/uploadthing` with auth + approval enforced in middleware. Admin UI swaps the existing AddProductModal for an HeroUI Sheet drawer. Parent shop pages migrate from static `CATALOG` to `getCatalogByTenant` / `getCatalogItemById`. The orders route gains a stale-cart revalidation guard so deactivated/deleted items can't slip through checkout.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM (Postgres on Neon), pnpm workspaces, Zod, UploadThing (`uploadthing` + `@uploadthing/react`), HeroUI v3, Tailwind v4. No test suite — `pnpm check-types:web` is the correctness gate; smoke tests are manual.

**Spec:** `docs/superpowers/specs/2026-05-08-catalog-management-design.md`

---

## File Structure

### New files

```
apps/web/drizzle/0008_catalog_image_url.sql           # generated migration
apps/web/drizzle/meta/0008_snapshot.json              # generated snapshot
apps/web/src/lib/auth/require-tenant-approved.ts      # discriminated-union helper
apps/web/src/lib/schemas/catalog.ts                   # Zod schemas
apps/web/src/lib/uploadthing.ts                       # FileRouter
apps/web/src/app/api/uploadthing/route.ts             # createRouteHandler mount
apps/web/src/components/uploadthing.ts                # typed React generators
apps/web/src/app/admin/[tenant]/catalog/pending-approval-empty-state.tsx
apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx
apps/web/src/components/garment-defaults.tsx          # six category-default SVGs
```

### Files modified

```
apps/web/src/db/schema.ts                             # add imageUrl col
apps/web/src/db/queries.ts                            # addCatalogItem (imageUrl), updateCatalogItem (full), mapDbItem helper, getCatalogByTenantActive
apps/web/src/lib/data.ts                              # desc → description; CatalogItem.imageUrl
apps/web/src/components/garment.tsx                   # category-primary, id-secondary
apps/web/src/app/api/catalog/route.ts                 # POST: imageUrl, Zod, approval gate
apps/web/src/app/api/catalog/[itemId]/route.ts        # PATCH: full update; DELETE: approval gate, no 409
apps/web/src/app/api/orders/route.ts                  # stale-cart guard before line insert
apps/web/src/app/admin/[tenant]/catalog/page.tsx      # approval gate, Add button → drawer
apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx  # image col, row-click → drawer, remove inline name-edit/AddProductModal
apps/web/src/app/[tenant]/page.tsx                    # CATALOG → getCatalogByTenant
apps/web/src/app/[tenant]/item/[itemId]/page.tsx      # CATALOG → getCatalogItemById; drop generateStaticParams; notFound on inactive
apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx  # GarmentVector category prop
apps/web/src/app/[tenant]/cart/cart-screen.tsx        # 409 cart_items_unavailable surface
apps/web/next.config.ts                               # CSP utfs.io + uploadthing.com; images.remotePatterns utfs.io
apps/web/.env.example                                 # UPLOADTHING_TOKEN
```

### Files removed

```
apps/web/src/app/admin/[tenant]/catalog/add-product-modal.tsx    # superseded by item-drawer.tsx (verify exact filename when removing)
```

---

## Task 1: Migration 0008 — add `image_url` to `catalog_items`

**Files:**
- Modify: `apps/web/src/db/schema.ts` (catalog_items pgTable)
- Generate: `apps/web/drizzle/0008_catalog_image_url.sql`
- Generate: `apps/web/drizzle/meta/0008_snapshot.json`
- Modify: `apps/web/drizzle/meta/_journal.json`

- [ ] **Step 1: Add `imageUrl` column to Drizzle schema**

Edit `apps/web/src/db/schema.ts` — find the `catalogItems` pgTable definition and add `imageUrl` directly under `description`:

```ts
export const catalogItems = pgTable("catalog_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),                          // ← NEW
  sizeGuide: jsonb("size_guide"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

- [ ] **Step 2: Generate migration with drizzle-kit**

Run from repo root:

```bash
pnpm --filter web drizzle:generate -- --name=catalog_image_url
```

Or, if no such script exists, use the underlying CLI:

```bash
cd apps/web && pnpm drizzle-kit generate --name=catalog_image_url
```

Expected output: a new file `apps/web/drizzle/0008_catalog_image_url.sql` containing exactly:

```sql
ALTER TABLE "catalog_items" ADD COLUMN "image_url" text;
```

If extra statements (e.g., touching `neon_auth.*`) appear, the drizzle-kit `tablesFilter` from PR #8 is broken — stop and fix that first.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 4: Apply migration to local Neon dev branch**

```bash
cd apps/web && pnpm drizzle-kit migrate
```

Expected: "Reading config file…" then "1 migration applied".

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/db/schema.ts apps/web/drizzle/0008_catalog_image_url.sql apps/web/drizzle/meta/0008_snapshot.json apps/web/drizzle/meta/_journal.json
git commit -m "feat(catalog): add image_url column (mig 0008)"
```

---

## Task 2: `requireTenantApproved` helper

**Files:**
- Create: `apps/web/src/lib/auth/require-tenant-approved.ts`

- [ ] **Step 1: Create the helper**

Write `apps/web/src/lib/auth/require-tenant-approved.ts`:

```ts
import { NextResponse } from "next/server";
import { getTenant } from "@/db/queries";

export type LoadedTenant = NonNullable<Awaited<ReturnType<typeof getTenant>>>;

/** For API routes — returns a 404/403 NextResponse on failure. */
export async function requireTenantApproved(
  tenantId: string
): Promise<{ tenant: LoadedTenant } | { response: NextResponse }> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return {
      response: NextResponse.json({ code: "tenant_not_found" }, { status: 404 }),
    };
  }
  if (tenant.platformApprovalStatus !== "approved") {
    return {
      response: NextResponse.json({ code: "tenant_not_approved" }, { status: 403 }),
    };
  }
  return { tenant };
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/auth/require-tenant-approved.ts
git commit -m "feat(auth): add requireTenantApproved helper"
```

---

## Task 3: Zod schemas for catalog input

**Files:**
- Create: `apps/web/src/lib/schemas/catalog.ts`

- [ ] **Step 1: Create the schema file**

Write `apps/web/src/lib/schemas/catalog.ts`:

```ts
import { z } from "zod";

export const ITEM_CATEGORIES = [
  "Summer",
  "Winter",
  "Sports",
  "Formal",
  "Bags",
  "Stationery",
] as const;

export const catalogVariantInputSchema = z.object({
  label: z.string().trim().min(1).max(40),
  price: z.number().positive().max(10000),
  active: z.boolean().optional(),
});

export const catalogItemInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  category: z.enum(ITEM_CATEGORIES),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  variants: z.array(catalogVariantInputSchema).min(1),
});

export const catalogItemPatchSchema = catalogItemInputSchema
  .omit({ tenantId: true })
  .partial()
  .extend({
    variants: z.array(catalogVariantInputSchema).min(1).optional(),
  });

export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>;
export type CatalogItemPatch = z.infer<typeof catalogItemPatchSchema>;
export type CatalogVariantInput = z.infer<typeof catalogVariantInputSchema>;
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/schemas/catalog.ts
git commit -m "feat(catalog): zod schemas for item create/patch"
```

---

## Task 4: Update `addCatalogItem` and add `updateCatalogItem` query helpers

**Files:**
- Modify: `apps/web/src/db/queries.ts` (lines 555–593 region)

- [ ] **Step 1: Replace the catalog mutation helpers**

In `apps/web/src/db/queries.ts`, replace the existing `addCatalogItem`, `updateCatalogItemName`, and `deleteCatalogItem` block with:

```ts
export async function addCatalogItem(data: {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  active?: boolean;
  sortOrder?: number;
  variants: { label: string; price: number; active?: boolean }[];
}) {
  await db.transaction(async (tx) => {
    await tx.insert(catalogItems).values({
      id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      category: data.category,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      active: data.active ?? true,
      sortOrder: data.sortOrder ?? 0,
    });

    for (const v of data.variants) {
      await tx.insert(catalogVariants).values({
        itemId: data.id,
        label: v.label,
        price: String(v.price),
        active: v.active ?? true,
      });
    }
  });
}

/**
 * Partial item update with optional full-replace of variants.
 * If `variants` is provided, ALL existing variants are hard-deleted and the
 * supplied list is inserted. Order history is unaffected (order_lines holds
 * its own snapshots — no FK to catalog_variants).
 */
export async function updateCatalogItem(
  itemId: string,
  fields: {
    name?: string;
    category?: string;
    description?: string | null;
    imageUrl?: string | null;
    active?: boolean;
    sortOrder?: number;
  },
  variants?: { label: string; price: number; active?: boolean }[]
) {
  await db.transaction(async (tx) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (fields.name !== undefined) updates.name = fields.name;
    if (fields.category !== undefined) updates.category = fields.category;
    if (fields.description !== undefined) updates.description = fields.description;
    if (fields.imageUrl !== undefined) updates.imageUrl = fields.imageUrl;
    if (fields.active !== undefined) updates.active = fields.active;
    if (fields.sortOrder !== undefined) updates.sortOrder = fields.sortOrder;

    await tx.update(catalogItems).set(updates).where(eq(catalogItems.id, itemId));

    if (variants !== undefined) {
      await tx.delete(catalogVariants).where(eq(catalogVariants.itemId, itemId));
      for (const v of variants) {
        await tx.insert(catalogVariants).values({
          itemId,
          label: v.label,
          price: String(v.price),
          active: v.active ?? true,
        });
      }
    }
  });
}

export async function deleteCatalogItem(itemId: string) {
  return db
    .delete(catalogItems)
    .where(eq(catalogItems.id, itemId))
    .returning({ id: catalogItems.id, imageUrl: catalogItems.imageUrl });
}
```

Remove the old `updateCatalogItemName` export. Any caller of it will be updated in later tasks.

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: errors at the call sites of `updateCatalogItemName` (currently `apps/web/src/app/api/catalog/[itemId]/route.ts`). Leave those errors — Task 6 fixes them.

- [ ] **Step 3: Commit (do not commit yet — wait for Task 6 fixes)**

Skip the commit for this task. The query change and the route change land together in Task 6's commit.

---

## Task 5: Rewrite `POST /api/catalog`

**Files:**
- Modify: `apps/web/src/app/api/catalog/route.ts` (replace POST handler entirely)

- [ ] **Step 1: Rewrite the POST handler**

Replace the existing `POST` function in `apps/web/src/app/api/catalog/route.ts` with:

```ts
// POST /api/catalog — create a new item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = catalogItemInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const approval = await requireTenantApproved(input.tenantId);
    if ("response" in approval) return approval.response;
    const { tenant } = approval;

    const accessDenied = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (accessDenied) return accessDenied;

    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const id = `${input.tenantId}-${slug}-${Date.now().toString(36)}`;

    await addCatalogItem({
      id,
      tenantId: input.tenantId,
      name: input.name,
      category: input.category,
      description: input.description,
      imageUrl: input.imageUrl,
      active: input.active,
      sortOrder: input.sortOrder,
      variants: input.variants.map((v) => ({
        label: v.label,
        price: v.price,
        active: v.active,
      })),
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/catalog error:", err);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}
```

Update the imports at the top of the file to include the new dependencies:

```ts
import { NextRequest, NextResponse } from "next/server";
import { addCatalogItem, getCatalogByTenant } from "@/db/queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";
import { requireTenantApproved } from "@/lib/auth/require-tenant-approved";
import { catalogItemInputSchema } from "@/lib/schemas/catalog";
```

(The previous `getTenant` import is no longer needed in this file — `requireTenantApproved` loads it.)

The existing `GET` handler stays unchanged.

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors in this file. Errors may still be present in `[itemId]/route.ts` from Task 4 — those are fixed in Task 6.

- [ ] **Step 3: Commit (do not commit yet — wait for Task 6 to land)**

---

## Task 6: Rewrite `PATCH` and `DELETE` `/api/catalog/[itemId]`

**Files:**
- Modify: `apps/web/src/app/api/catalog/[itemId]/route.ts` (replace entirely)

- [ ] **Step 1: Replace the file contents**

Overwrite `apps/web/src/app/api/catalog/[itemId]/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  deleteCatalogItem,
  getCatalogItemById,
  updateCatalogItem,
} from "@/db/queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";
import { requireTenantApproved } from "@/lib/auth/require-tenant-approved";
import { catalogItemPatchSchema } from "@/lib/schemas/catalog";

// PATCH /api/catalog/:itemId — partial update; if `variants` provided, replace.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    const body = await req.json();
    const parsed = catalogItemPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const item = await getCatalogItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const approval = await requireTenantApproved(item.tenantId);
    if ("response" in approval) return approval.response;
    const { tenant } = approval;

    const accessDenied = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (accessDenied) return accessDenied;

    const { variants, ...fields } = input;
    await updateCatalogItem(itemId, fields, variants);

    return NextResponse.json({ id: itemId, ok: true }, { status: 200 });
  } catch (err) {
    console.error(`PATCH /api/catalog/${itemId} error:`, err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

// DELETE /api/catalog/:itemId — hard delete; cascade variants. No 409 path:
// order_lines does not FK catalog_items.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const item = await getCatalogItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const approval = await requireTenantApproved(item.tenantId);
    if ("response" in approval) return approval.response;
    const { tenant } = approval;

    const accessDenied = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (accessDenied) return accessDenied;

    const [deleted] = await deleteCatalogItem(itemId);

    // Best-effort UploadThing file delete — see Task 9 for the helper.
    if (deleted?.imageUrl) {
      try {
        const { deleteUploadthingFileByUrl } = await import("@/lib/uploadthing-cleanup");
        await deleteUploadthingFileByUrl(deleted.imageUrl);
      } catch (cleanupErr) {
        console.warn(`UploadThing cleanup failed for ${deleted.imageUrl}:`, cleanupErr);
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error(`DELETE /api/catalog/${itemId} error:`, err);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: a "Cannot find module `@/lib/uploadthing-cleanup`" error — that's intentional; it's added in Task 9. Until Task 9 lands the dynamic import is a soft dependency that fails at runtime, not at type-check (because of the `await import(...)` form). If your TS strict settings flag the dynamic import, comment out the `if (deleted?.imageUrl)` block until Task 9 lands and uncomment then. Otherwise zero errors.

- [ ] **Step 3: Commit (combined with Tasks 4 + 5)**

```bash
git add apps/web/src/db/queries.ts apps/web/src/app/api/catalog/route.ts apps/web/src/app/api/catalog/[itemId]/route.ts
git commit -m "feat(catalog): rewrite POST/PATCH/DELETE /api/catalog with image_url, approval gate, zod validation"
```

---

## Task 7: Install UploadThing dependencies

**Files:**
- Modify: `apps/web/package.json` (deps added by pnpm)
- Modify: `apps/web/.env.example` (document required env var)

- [ ] **Step 1: Install packages**

```bash
pnpm --filter web add uploadthing @uploadthing/react
```

Expected: lockfile updated; `uploadthing` and `@uploadthing/react` appear in `apps/web/package.json` dependencies. Both should be at the same major version (currently v7+).

- [ ] **Step 2: Document `UPLOADTHING_TOKEN` in `.env.example`**

Add a line to `apps/web/.env.example`:

```env
# UploadThing — image uploads for catalog items
# Get from https://uploadthing.com/dashboard → API Keys
UPLOADTHING_TOKEN=
```

- [ ] **Step 3: Add `UPLOADTHING_TOKEN` to local `.env.local`**

In `apps/web/.env.local` (gitignored), set the token from the UploadThing dashboard:

```env
UPLOADTHING_TOKEN=sk_live_...
```

Do not commit this file. If the dashboard isn't yet provisioned for this project, create the project at uploadthing.com first; this is a real external dependency.

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors. (The deps are now resolvable.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/.env.example pnpm-lock.yaml
git commit -m "chore(deps): add uploadthing + @uploadthing/react"
```

---

## Task 8: UploadThing FileRouter, route handler, typed React generators

**Files:**
- Create: `apps/web/src/lib/uploadthing.ts`
- Create: `apps/web/src/app/api/uploadthing/route.ts`
- Create: `apps/web/src/components/uploadthing.ts`
- Create: `apps/web/src/lib/uploadthing-cleanup.ts`

- [ ] **Step 1: Create the FileRouter**

Write `apps/web/src/lib/uploadthing.ts`:

```ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";
import { getTenant } from "@/db/queries";

const f = createUploadthing();

export const uploadRouter = {
  catalogImage: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .input(z.object({ tenantId: z.string().min(1) }))
    .middleware(async ({ input }) => {
      const tenant = await getTenant(input.tenantId);
      if (!tenant) throw new UploadThingError("tenant_not_found");

      const auth = await requireSessionUser();
      if ("response" in auth) {
        throw new UploadThingError("Authentication required");
      }
      const { user } = auth;

      const denied = ensureTenantAccess(user, tenant.shopEmail);
      if (denied) throw new UploadThingError("Forbidden");

      if (tenant.platformApprovalStatus !== "approved") {
        throw new UploadThingError("tenant_not_approved");
      }

      return { tenantId: input.tenantId, userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // The drawer captures `file.url` via onClientUploadComplete and
      // sends it in the catalog POST/PATCH body. UploadThing keeps the
      // file regardless of whether the catalog save succeeds; orphaned
      // files are GC'd by a future cleanup job.
      return { url: file.url, tenantId: metadata.tenantId };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
```

- [ ] **Step 2: Mount the route handler**

Write `apps/web/src/app/api/uploadthing/route.ts`:

```ts
import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "@/lib/uploadthing";

export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
});
```

- [ ] **Step 3: Generate typed React components**

Write `apps/web/src/components/uploadthing.ts`:

```ts
import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";
import type { UploadRouter } from "@/lib/uploadthing";

export const UploadButton = generateUploadButton<UploadRouter>();
export const UploadDropzone = generateUploadDropzone<UploadRouter>();
```

- [ ] **Step 4: Add the cleanup helper for DELETE**

Write `apps/web/src/lib/uploadthing-cleanup.ts`:

```ts
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

/**
 * Best-effort delete of an UploadThing file by its public URL.
 * Throws on failure; callers should catch + log + continue.
 */
export async function deleteUploadthingFileByUrl(url: string): Promise<void> {
  // UploadThing public URLs look like https://utfs.io/f/<fileKey>
  const match = /https?:\/\/[^/]+\/f\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`Unrecognized UploadThing URL: ${url}`);
  const fileKey = match[1];
  await utapi.deleteFiles(fileKey);
}
```

- [ ] **Step 5: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/uploadthing.ts apps/web/src/app/api/uploadthing/route.ts apps/web/src/components/uploadthing.ts apps/web/src/lib/uploadthing-cleanup.ts
git commit -m "feat(uploadthing): file router, route handler, typed React, cleanup helper"
```

---

## Task 9: CSP and `next/image` allowlist for UploadThing

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Add UploadThing domains to CSP and `images.remotePatterns`**

Open `apps/web/next.config.ts`. Find the `Content-Security-Policy` value (string or template literal in the `headers` function) and add `https://utfs.io https://uploadthing.com` to **both**:

- `connect-src` (so the UploadThing SDK can post upload requests)
- `img-src` (so `<Image>` can render uploaded files)

Find the `images` config block (or add one if missing) and append a remote pattern for `utfs.io`:

```ts
images: {
  remotePatterns: [
    // ...existing patterns
    { protocol: "https", hostname: "utfs.io" },
  ],
},
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 3: Smoke test — boot dev server**

```bash
pnpm dev:web
```

Open `http://localhost:3000/admin/nsbh/catalog` — page should still render. Check the browser network tab; no CSP violations in console.

Stop the dev server (Ctrl-C) before continuing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "chore(csp): allow utfs.io + uploadthing.com; allow next/image utfs.io"
```

---

## Task 10: `<PendingApprovalEmptyState>` component

**Files:**
- Create: `apps/web/src/app/admin/[tenant]/catalog/pending-approval-empty-state.tsx`

- [ ] **Step 1: Write the component**

Write `apps/web/src/app/admin/[tenant]/catalog/pending-approval-empty-state.tsx`:

```tsx
import type { Tenant } from "@/lib/data";

export function PendingApprovalEmptyState({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ background: "var(--color-parchment)", color: tenant.accent }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 13 16 15" />
        </svg>
      </div>
      <h2 className="font-serif text-[22px] font-medium leading-[1.2] mb-2">
        Awaiting platform approval
      </h2>
      <p className="text-[13.5px] leading-[1.5] max-w-md" style={{ color: "var(--color-ink-dim)" }}>
        {tenant.short} hasn’t been approved on the platform yet. Once approved,
        operators can add and edit catalog items here.
      </p>
      <p className="text-[12.5px] mt-3" style={{ color: "var(--color-ink-dim)" }}>
        Need help? Email{" "}
        <a
          href="mailto:support@uniformorder.online"
          className="underline"
          style={{ color: tenant.accent }}
        >
          support@uniformorder.online
        </a>
        .
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/catalog/pending-approval-empty-state.tsx
git commit -m "feat(admin/catalog): pending-approval empty state"
```

---

## Task 11: `<ItemDrawer>` component

**Files:**
- Create: `apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx`

This is the largest single component. Build it in one task with focused steps.

- [ ] **Step 1: Verify HeroUI Sheet availability**

Run:

```bash
node -e "console.log(Object.keys(require('@heroui/react')).filter(k => k.startsWith('Sheet')))"
```

Expected: `['Sheet', 'SheetTrigger', 'SheetContent', ...]` (or similar). If `Sheet` is missing, fall back to `Modal` from `@heroui/react` for the container — note this in the file as a TODO so a future polish task can swap to `Sheet` when it lands. Do not block the task.

- [ ] **Step 2: Write the component**

Write `apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Sheet, SheetContent } from "@heroui/react";  // see Step 1 fallback note
import { UploadDropzone } from "@/components/uploadthing";
import { GarmentVector } from "@/components/garment";
import type { Tenant } from "@/lib/data";
import { ITEM_CATEGORIES, type CatalogItemInput } from "@/lib/schemas/catalog";

type Variant = { label: string; price: string; active?: boolean };

type Mode = { kind: "create" } | { kind: "edit"; itemId: string };

export type ItemDrawerInitial = {
  name?: string;
  category?: typeof ITEM_CATEGORIES[number];
  description?: string;
  imageUrl?: string;
  active?: boolean;
  sortOrder?: number;
  variants?: Variant[];
};

export function ItemDrawer({
  tenant,
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  open: boolean;
  mode: Mode;
  initial?: ItemDrawerInitial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<typeof ITEM_CATEGORIES[number]>("Summer");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(true);
  const [variants, setVariants] = useState<Variant[]>([{ label: "", price: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state with `initial` when drawer opens
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCategory(initial?.category ?? "Summer");
    setDescription(initial?.description ?? "");
    setImageUrl(initial?.imageUrl);
    setActive(initial?.active ?? true);
    setVariants(
      initial?.variants?.length
        ? initial.variants.map((v) => ({ label: v.label, price: v.price, active: v.active }))
        : [{ label: "", price: "" }]
    );
    setError(null);
  }, [open, initial]);

  const setVariant = (i: number, patch: Partial<Variant>) =>
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const addVariant = () => setVariants((prev) => [...prev, { label: "", price: "" }]);
  const removeVariant = (i: number) =>
    setVariants((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const isValid =
    name.trim().length > 0 &&
    name.length <= 80 &&
    description.length <= 500 &&
    variants.length >= 1 &&
    variants.every((v) => v.label.trim().length > 0 && Number(v.price) > 0);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: CatalogItemInput | (Omit<CatalogItemInput, "tenantId"> & { tenantId?: string }) = {
        tenantId: tenant.id,
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        imageUrl,
        active,
        sortOrder: initial?.sortOrder ?? 0,
        variants: variants.map((v) => ({
          label: v.label.trim(),
          price: Number(v.price),
          active: v.active,
        })),
      };

      const url =
        mode.kind === "create" ? `/api/catalog` : `/api/catalog/${mode.itemId}`;
      const method = mode.kind === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode.kind === "create" ? payload : { ...payload, tenantId: undefined }
        ),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 403 && body?.code === "tenant_not_approved") {
          setError("This school is not yet approved on the platform.");
        } else {
          setError(body?.error ?? `HTTP ${res.status}`);
        }
        return;
      }

      onSaved();
      router.refresh();
      onClose();
    } catch (err) {
      console.error("Catalog save failed:", err);
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[440px] max-w-full">
        <div className="flex flex-col h-full">
          <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--color-rule)" }}>
            <div
              className="text-[10.5px] font-bold uppercase tracking-[0.5px]"
              style={{ color: tenant.accent }}
            >
              {mode.kind === "create" ? "Add item" : "Edit item"}
            </div>
            <h2 className="font-serif text-[20px] font-medium mt-1">
              {mode.kind === "create" ? "New catalog item" : initial?.name ?? "Edit"}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Image */}
            <section>
              <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-2">
                Image
              </label>
              {imageUrl ? (
                <div className="flex items-start gap-3">
                  <Image
                    src={imageUrl}
                    alt="Item preview"
                    width={96}
                    height={96}
                    className="rounded-md border"
                    style={{ borderColor: "var(--color-rule)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    className="text-[12px] underline"
                    style={{ color: tenant.accent }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadDropzone
                    endpoint="catalogImage"
                    input={{ tenantId: tenant.id }}
                    onClientUploadComplete={(res) => {
                      const url = res?.[0]?.serverData?.url;
                      if (url) setImageUrl(url);
                    }}
                    onUploadError={(err) => {
                      const msg = err.message;
                      if (msg.includes("tenant_not_approved")) {
                        setError("This school is not yet approved on the platform.");
                      } else {
                        setError(msg);
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                    <span>No image? Parents will see this fallback:</span>
                    <GarmentVector category={category} accent={tenant.accent} size={32} />
                  </div>
                </div>
              )}
            </section>

            {/* Name */}
            <section>
              <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="w-full h-9 px-3 text-[13px] rounded-md border"
                style={{ borderColor: "var(--color-rule)" }}
              />
              <div className="text-[10.5px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
                {name.length} / 80
              </div>
            </section>

            {/* Category */}
            <section>
              <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof ITEM_CATEGORIES[number])}
                className="w-full h-9 px-3 text-[13px] rounded-md border"
                style={{ borderColor: "var(--color-rule)" }}
              >
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </section>

            {/* Description */}
            <section>
              <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Short description shown on the item page"
                className="w-full px-3 py-2 text-[13px] rounded-md border"
                style={{ borderColor: "var(--color-rule)" }}
              />
              <div className="text-[10.5px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
                {description.length} / 500
              </div>
            </section>

            {/* Variants */}
            <section>
              <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-2">
                Variants (size + price)
              </label>
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_28px] gap-2">
                    <input
                      type="text"
                      placeholder="Label e.g. Size 10"
                      value={v.label}
                      maxLength={40}
                      onChange={(e) => setVariant(i, { label: e.target.value })}
                      className="h-8 px-2 text-[12.5px] rounded-md border"
                      style={{ borderColor: "var(--color-rule)" }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Price (AUD)"
                      value={v.price}
                      onChange={(e) => setVariant(i, { price: e.target.value })}
                      className="h-8 px-2 text-[12.5px] rounded-md border tnum"
                      style={{ borderColor: "var(--color-rule)" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      disabled={variants.length === 1}
                      className="h-8 text-[16px] disabled:opacity-30"
                      aria-label={`Remove variant ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addVariant}
                className="text-[12px] underline mt-2"
                style={{ color: tenant.accent }}
              >
                + Add variant
              </button>
            </section>

            {/* Active toggle */}
            <section className="flex items-center gap-2">
              <input
                id="item-active"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <label htmlFor="item-active" className="text-[13px]">
                Active (visible to parents)
              </label>
            </section>

            {error && (
              <div className="text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                {error}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--color-rule)" }}>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-[12.5px] font-semibold rounded-md border"
              style={{ borderColor: "var(--color-rule)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className="h-9 px-4 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-50"
              style={{ background: tenant.accent }}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors. If `Sheet`/`SheetContent` aren't exported from `@heroui/react`, swap them for `Modal`/`ModalContent` and adjust the side prop accordingly — keep the rest of the component identical.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx
git commit -m "feat(admin/catalog): item drawer with image upload, variants, validation"
```

---

## Task 12: Update `CatalogTable` — image col, row-click → drawer, drop AddProductModal

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx`
- Delete: `apps/web/src/app/admin/[tenant]/catalog/add-product-modal.tsx` (or whichever filename hosts the existing modal — verify with `grep -l AddProductModal`)

- [ ] **Step 1: Locate the existing AddProductModal**

```bash
grep -rln "AddProductModal" apps/web/src/app/admin/[tenant]/catalog/
```

Note the filename returned — that file is being removed in Step 5.

- [ ] **Step 2: Rewrite `catalog-table.tsx`**

Open `apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx`. Replace the file contents with the version below. Note: the type `DbItem` and the `tenant` prop shape come from the existing implementation — preserve any field names you observe in the existing file when adapting; only the structural changes shown here are mandatory.

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { GarmentVector } from "@/components/garment";
import { ItemDrawer, type ItemDrawerInitial } from "./item-drawer";
import type { Tenant, ItemCategory } from "@/lib/data";

type DbVariant = { id: string; itemId: string; label: string; price: string; active: boolean };
type DbItem = {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  variants: DbVariant[];
};

export function CatalogTable({
  tenantId,
  initialItems,
  tenant,
}: {
  tenantId: string;
  initialItems: DbItem[];
  tenant: Tenant;
}) {
  const [items, setItems] = useState<DbItem[]>(initialItems);
  const [tableError, setTableError] = useState("");
  const [drawer, setDrawer] = useState<
    | { open: false }
    | { open: true; mode: "create" }
    | { open: true; mode: "edit"; item: DbItem }
  >({ open: false });

  const refresh = async () => {
    try {
      const res = await fetch(`/api/catalog?tenantId=${tenantId}`);
      if (res.ok) setItems(await res.json());
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove “${name}” from the catalog?`)) return;
    const previous = items;
    setTableError("");
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      const res = await fetch(`/api/catalog/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete item.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      setItems(previous);
      setTableError(err instanceof Error ? err.message : "Failed to delete item.");
    }
  };

  const initialFromItem = (it: DbItem): ItemDrawerInitial => ({
    name: it.name,
    category: it.category as ItemCategory,
    description: it.description ?? undefined,
    imageUrl: it.imageUrl ?? undefined,
    active: it.active,
    sortOrder: it.sortOrder,
    variants: it.variants.map((v) => ({ label: v.label, price: v.price, active: v.active })),
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {tableError && (
        <div className="mb-3 text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          {tableError}
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-md border" style={{ borderColor: "var(--color-rule)" }}>
        <table className="w-full text-[13px]">
          <thead className="bg-white sticky top-0">
            <tr className="text-left" style={{ color: "var(--color-ink-dim)" }}>
              <th className="px-3 py-2 w-[60px]">Image</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 w-[110px]">Category</th>
              <th className="px-3 py-2 w-[100px]">Variants</th>
              <th className="px-3 py-2 w-[80px]">Active</th>
              <th className="px-3 py-2 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.id}
                className="border-t cursor-pointer hover:bg-[var(--color-parchment)]"
                style={{ borderColor: "var(--color-rule)" }}
                onClick={() => setDrawer({ open: true, mode: "edit", item: it })}
              >
                <td className="px-3 py-2">
                  {it.imageUrl ? (
                    <Image
                      src={it.imageUrl}
                      alt={it.name}
                      width={40}
                      height={40}
                      className="rounded-sm object-cover"
                    />
                  ) : (
                    <GarmentVector itemId={it.id} accent={tenant.accent} size={40} />
                  )}
                </td>
                <td className="px-3 py-2 font-medium">{it.name}</td>
                <td className="px-3 py-2">{it.category}</td>
                <td className="px-3 py-2 tnum">{it.variants.length}</td>
                <td className="px-3 py-2">
                  {it.active ? (
                    <span className="text-emerald-700">●</span>
                  ) : (
                    <span style={{ color: "var(--color-ink-dim)" }}>○</span>
                  )}
                </td>
                <td
                  className="px-3 py-2 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="text-[12px] underline"
                    onClick={() => handleDelete(it.id, it.name)}
                    style={{ color: tenant.accent }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--color-ink-dim)" }}>
                  No items yet. Click “Add item” to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawer.open && (
        <ItemDrawer
          tenant={tenant}
          open={drawer.open}
          mode={
            drawer.mode === "create"
              ? { kind: "create" }
              : { kind: "edit", itemId: drawer.item.id }
          }
          initial={drawer.mode === "edit" ? initialFromItem(drawer.item) : undefined}
          onClose={() => setDrawer({ open: false })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

// Exported so the parent page can open the drawer in create mode.
export function useCatalogTableTrigger() {
  // intentionally minimal — see Task 13 for the page-level hook-up
  return null;
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors. If `getCatalogByTenant` doesn't yet return `imageUrl`, that's fine — Drizzle's `select()` returns all columns by default.

- [ ] **Step 4: Smoke test**

Run `pnpm dev:web`, open `http://localhost:3000/admin/nsbh/catalog` in a browser. The table should render with an image column showing fallback `GarmentVector` icons; clicking a row opens the drawer in edit mode. Drawer "Cancel" closes; drawer "Save" works for an unchanged item (200 OK in network tab).

Stop the dev server.

- [ ] **Step 5: Delete the obsolete AddProductModal file**

Use the filename from Step 1:

```bash
git rm apps/web/src/app/admin/[tenant]/catalog/<filename-from-step-1>.tsx
```

If your filesystem layout uses a different name (e.g. `add-product.tsx`), substitute accordingly.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx
git commit -m "feat(admin/catalog): table with image column, row-click → drawer, drop legacy modal"
```

---

## Task 13: Wire the Add-item button + approval gate on the catalog page

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/catalog/page.tsx`
- Create: `apps/web/src/app/admin/[tenant]/catalog/page-client.tsx`

The current page is a server component, but the Add-item button needs to open the drawer (client). The cleanest split: server page does data + approval check, then renders a thin client wrapper that owns the "Add" button + drawer state shared with the table.

- [ ] **Step 1: Create the client wrapper**

Write `apps/web/src/app/admin/[tenant]/catalog/page-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CatalogTable } from "./catalog-table";
import { ItemDrawer } from "./item-drawer";
import type { Tenant } from "@/lib/data";

type DbVariant = { id: string; itemId: string; label: string; price: string; active: boolean };
type DbItem = {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  variants: DbVariant[];
};

export function CatalogPageClient({
  tenantId,
  tenant,
  initialItems,
}: {
  tenantId: string;
  tenant: Tenant;
  initialItems: DbItem[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-end gap-2 px-6 pt-4">
        <Link
          href={`/admin/${tenantId}/upload`}
          className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
        >
          Bulk upload CSV
        </Link>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white"
          style={{ background: tenant.accent }}
        >
          + Add item
        </button>
      </div>
      <CatalogTable tenantId={tenantId} tenant={tenant} initialItems={initialItems} />
      <ItemDrawer
        tenant={tenant}
        open={addOpen}
        mode={{ kind: "create" }}
        onClose={() => setAddOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
```

- [ ] **Step 2: Rewrite the server page**

Replace `apps/web/src/app/admin/[tenant]/catalog/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { getCatalogByTenant, getTenant } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { CatalogPageClient } from "./page-client";
import { PendingApprovalEmptyState } from "./pending-approval-empty-state";

export default async function AdminCatalogPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const staticTenant = TENANTS[tid as TenantId];

  const dbTenant = await getTenant(tid);
  if (!dbTenant) notFound();

  return (
    <>
      <AdminTopbar kicker={`${staticTenant.short} · Operator`} title="Catalog" />
      {dbTenant.platformApprovalStatus !== "approved" ? (
        <PendingApprovalEmptyState tenant={staticTenant} />
      ) : (
        <CatalogPageClient
          tenantId={tid}
          tenant={staticTenant}
          initialItems={await getCatalogByTenant(tid)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 4: Smoke test (approved tenant — happy path)**

Run `pnpm dev:web`. Visit `http://localhost:3000/admin/nsbh/catalog`. Verify:
- "Add item" button visible top-right.
- Clicking it opens the drawer in create mode.
- Filling in name, category, one variant, and saving creates a row.
- The table refreshes to show the new row.

- [ ] **Step 5: Smoke test (pending tenant — empty state)**

In a Neon SQL shell (or via `psql`):

```sql
UPDATE tenants SET platform_approval_status = 'pending' WHERE id = 'nsbh';
```

Reload `/admin/nsbh/catalog` — page renders the `PendingApprovalEmptyState` instead of the table.

Restore:

```sql
UPDATE tenants SET platform_approval_status = 'approved' WHERE id = 'nsbh';
```

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/catalog/page.tsx apps/web/src/app/admin/[tenant]/catalog/page-client.tsx
git commit -m "feat(admin/catalog): approval gate + add-item button"
```

---

## Task 14: `desc` → `description` rename across static seed and renderer

**Files:**
- Modify: `apps/web/src/lib/data.ts` (CatalogItem type + 8 seed entries at lines 74, 93, 100, 110, 128, 139, 169, 203)
- Modify: `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` (line 34 area)

- [ ] **Step 1: Update the type and seed entries**

In `apps/web/src/lib/data.ts`, change the `CatalogItem` interface field `desc?: string` to `description?: string` and add `imageUrl?: string`:

```ts
export interface CatalogItem {
  id: string;
  cat: ItemCategory;
  name: string;
  description?: string;
  imageUrl?: string;
  variants: ItemVariant[];
  sizeGuide?: SizeGuide;
}
```

Then perform a global rename in this file: every occurrence of `desc:` (object-literal key) becomes `description:`. There are 8 occurrences (lines ~74, 93, 100, 110, 128, 139, 169, 203). Verify with:

```bash
grep -n "desc:" apps/web/src/lib/data.ts
```

Expected after edit: zero matches.

- [ ] **Step 2: Update the renderer**

In `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`, find `item.desc &&` and `{item.desc}` (around line 34). Rename both to `description`:

```tsx
{item.description && (
  <p className="text-[13px] leading-[1.5] m-0 mb-3.5" style={{ color: "var(--color-ink-dim)" }}>
    {item.description}
  </p>
)}
```

- [ ] **Step 3: Grep for any remaining `desc` references**

```bash
grep -rn "\.desc\b\|desc?:" apps/web/src/
```

Expected: zero matches (the field rename is complete). If matches appear, edit those files to use `description`.

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data.ts apps/web/src/app/[tenant]/item/[itemId]/page.tsx
git commit -m "refactor(catalog): rename desc → description across static seed and renderer"
```

---

## Task 15: DB→UI mapper helper for catalog rows

**Files:**
- Modify: `apps/web/src/db/queries.ts` (add helper near `getCatalogByTenant` definition)

- [ ] **Step 1: Add the mapper export**

At the bottom of `apps/web/src/db/queries.ts`, add:

```ts
import type { CatalogItem, ItemCategory, ItemVariant, SizeGuide } from "@/lib/data";

const VALID_CATEGORIES: readonly ItemCategory[] = [
  "Summer",
  "Winter",
  "Sports",
  "Formal",
  "Bags",
  "Stationery",
];

function isItemCategory(value: string): value is ItemCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Translate the raw DB row shape (returned by getCatalogByTenant /
 * getCatalogItemById) into the UI `CatalogItem` shape used by parent-shop
 * components. Drops inactive variants. Returns null if the category column
 * holds an unrecognised value (data corruption — log + skip in callers).
 */
export function mapDbItem(
  row: Awaited<ReturnType<typeof getCatalogItemById>>
): CatalogItem | null {
  if (!row) return null;
  if (!isItemCategory(row.category)) {
    console.warn(`Catalog item ${row.id} has unknown category: ${row.category}`);
    return null;
  }
  return {
    id: row.id,
    cat: row.category,
    name: row.name,
    description: row.description ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    variants: row.variants
      .filter((v) => v.active)
      .map<ItemVariant>((v) => ({
        label: v.label,
        price: Number(v.price),
        sizes: [v.label],
      })),
    sizeGuide: (row.sizeGuide as SizeGuide | null) ?? undefined,
  };
}

export function mapDbItems(
  rows: Awaited<ReturnType<typeof getCatalogByTenant>>
): CatalogItem[] {
  return rows
    .map((r) => mapDbItem(r))
    .filter((i): i is CatalogItem => i !== null);
}
```

Note on `ItemVariant`: the existing UI type has `{ label, price, sizes: string[] }`. Each DB variant becomes one UI variant with a single-element `sizes` array — the parent shop currently uses `variants` as a flat list of options, so this preserves rendering. If the existing UI groups variants differently, adapt the mapper to match — read `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` first.

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors. If the import path for `CatalogItem` types creates a cycle (data.ts ↔ queries.ts), inline the types in queries.ts instead.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/db/queries.ts
git commit -m "feat(catalog): mapDbItem/mapDbItems helpers for DB → UI shape"
```

---

## Task 16: GarmentVector — category-keyed primary

**Files:**
- Create: `apps/web/src/components/garment-defaults.tsx`
- Modify: `apps/web/src/components/garment.tsx`

- [ ] **Step 1: Create the six category default SVGs**

Write `apps/web/src/components/garment-defaults.tsx`. Use simple geometric shapes; the existing `GarmentVector` styles are the visual reference. Each component takes `{ accent, stroke, size }`:

```tsx
import { shade } from "@/lib/ui";

type Props = { accent: string; stroke: string; size: number };

const wrap = (props: Props, body: React.ReactNode) => (
  <svg width={props.size} height={props.size} viewBox="0 0 120 120" aria-hidden="true">
    <rect x="0" y="0" width="120" height="120" fill="#F1ECE0" />
    {body}
  </svg>
);

export function SummerDefault(p: Props) {
  return wrap(p,
    <g>
      <path d="M30 26 L48 18 L60 24 L72 18 L90 26 L96 40 L86 46 L86 96 L34 96 L34 46 L24 40 Z" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
    </g>
  );
}

export function WinterDefault(p: Props) {
  return wrap(p,
    <g>
      <path d="M28 24 L48 16 Q60 30 72 16 L92 24 L100 44 L86 50 L86 102 L34 102 L34 50 L20 44 Z" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
    </g>
  );
}

export function SportsDefault(p: Props) {
  return wrap(p,
    <g>
      <circle cx="60" cy="60" r="34" fill={p.accent} stroke={p.stroke} strokeWidth="1.6" />
      <path d="M26 60 H94 M60 26 V94 M40 36 Q60 60 80 36 M40 84 Q60 60 80 84" fill="none" stroke={p.stroke} strokeWidth="1.4" />
    </g>
  );
}

export function FormalDefault(p: Props) {
  return wrap(p,
    <g>
      <path d="M24 22 L48 16 L60 28 L72 16 L96 22 L92 102 L68 102 L60 90 L52 102 L28 102 Z" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
      <path d="M48 16 L60 60 L72 16" stroke={p.stroke} strokeWidth="1" fill="none" />
    </g>
  );
}

export function BagsDefault(p: Props) {
  return wrap(p,
    <g>
      <path d="M30 36 H90 V100 H30 Z" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
      <path d="M44 36 V24 Q60 14 76 24 V36" fill="none" stroke={p.stroke} strokeWidth="1.4" />
    </g>
  );
}

export function StationeryDefault(p: Props) {
  return wrap(p,
    <g>
      <rect x="34" y="22" width="52" height="76" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
      <path d="M44 38 H76 M44 50 H76 M44 62 H76 M44 74 H66" stroke={p.stroke} strokeWidth="1.2" fill="none" />
    </g>
  );
}
```

- [ ] **Step 2: Refactor `GarmentVector` to accept `category`**

Edit `apps/web/src/components/garment.tsx`. Replace its top with:

```tsx
import { shade } from "@/lib/ui";
import {
  SummerDefault,
  WinterDefault,
  SportsDefault,
  FormalDefault,
  BagsDefault,
  StationeryDefault,
} from "./garment-defaults";
import type { ItemCategory } from "@/lib/data";

const ITEM_TO_SHAPE: Record<string, string> = {
  "shirt-ss": "shirt", "shirt-ls": "shirt", polo: "shirt",
  jumper: "jumper", hoodie: "jumper", jacket: "jumper",
  trousers: "pants", "shorts-sport": "pants", tracks: "pants",
  cap: "cap",
  "sock-white": "sock", "sock-sport": "sock",
  backpack: "bag", sportsbag: "bag",
  blazer: "blazer", tie: "tie", belt: "belt",
  calc: "misc", mathset: "misc",
};

const CATEGORY_DEFAULT: Record<ItemCategory, React.FC<{ accent: string; stroke: string; size: number }>> = {
  Summer: SummerDefault,
  Winter: WinterDefault,
  Sports: SportsDefault,
  Formal: FormalDefault,
  Bags: BagsDefault,
  Stationery: StationeryDefault,
};

export function GarmentVector({
  itemId,
  category,
  accent = "#1B3A5F",
  size = 120,
  className,
}: {
  itemId?: string;
  category?: ItemCategory;
  accent?: string;
  size?: number;
  className?: string;
}) {
  const stroke = shade(accent, -18);

  // Specific id-keyed illustration takes priority for the 16 seeded items.
  const shape = itemId ? ITEM_TO_SHAPE[itemId] : undefined;

  if (!shape && category) {
    const Default = CATEGORY_DEFAULT[category];
    return (
      <span className={className} aria-hidden>
        <Default accent={accent} stroke={stroke} size={size} />
      </span>
    );
  }

  // Existing per-shape SVG paths follow — keep them unchanged below this line.
```

Below the `if (!shape && category)` block, leave the existing `<svg>` rendering and per-shape `{shape === "shirt" && (...)}` blocks **unchanged**. They still render when `itemId` matches an entry in `ITEM_TO_SHAPE`. When neither matches, the existing `shape ?? "misc"` default keeps the legacy fallback.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 4: Smoke test**

Run `pnpm dev:web`, visit `/admin/nsbh/catalog`. The image-fallback column should still render the existing per-id silhouettes for seeded items. Then add a new item (e.g., `name: "Test Shorts", category: "Sports"`, no image) — refresh; the new row's fallback should be the `SportsDefault` glyph.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/garment.tsx apps/web/src/components/garment-defaults.tsx
git commit -m "feat(garment): category-keyed default fallback in GarmentVector"
```

---

## Task 17: Parent grid migration — `[tenant]/page.tsx` reads from DB

**Files:**
- Modify: `apps/web/src/app/[tenant]/page.tsx`

- [ ] **Step 1: Replace static `CATALOG` with DB read**

Edit `apps/web/src/app/[tenant]/page.tsx`. Replace the line `import { CATALOG, CATEGORIES, TENANTS, type TenantId } from "@/lib/data";` with:

```ts
import { CATEGORIES, TENANTS, type TenantId } from "@/lib/data";
import { getCatalogByTenant, mapDbItems } from "@/db/queries";
```

Then find the line `const items = CATALOG.filter((i) => i.cat === activeCat);` and replace the surrounding logic to fetch + map + filter:

```ts
const dbItems = await getCatalogByTenant(tenant.id);
const allUiItems = mapDbItems(dbItems);
const items = allUiItems.filter(
  (i) =>
    i.cat === activeCat &&
    // Drop inactive items from the parent grid. mapDbItems already drops
    // inactive variants but we must check item-level active here.
    dbItems.find((d) => d.id === i.id)?.active !== false
);
```

If you find the page already had `await` somewhere for the active-child fetch, just sequence the new fetch alongside it.

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 3: Smoke test**

Run `pnpm dev:web`. Visit `/nsbh`. The category grid should still render with all the seeded items. Switch categories — counts should match what's in the DB. Verify with the browser DevTools network tab that the page is server-rendered (no client fetch for catalog).

If items don't render: re-check `getCatalogByTenant` returns include `active` and `variants` (look at `apps/web/src/db/queries.ts:515-537`).

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[tenant]/page.tsx
git commit -m "feat(parent-shop): tenant home grid reads from DB via getCatalogByTenant"
```

---

## Task 18: Parent item detail migration — `[tenant]/item/[itemId]/page.tsx`

**Files:**
- Modify: `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`
- Modify: `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` (GarmentVector category prop)

- [ ] **Step 1: Replace static lookup with DB lookup; drop generateStaticParams; enforce inactive notFound**

Replace `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` with:

```tsx
import Image from "next/image";
import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { getCatalogItemById, mapDbItem } from "@/db/queries";
import { GarmentVector } from "@/components/garment";
import { Chip } from "@/components/chip";
import { MobileShell } from "@/components/mobile-shell";
import { ItemDetailInteractive } from "./interactive";

// Removed `generateStaticParams` — items are dynamic now.

export default async function ItemDetailPage({
  params,
}: PageProps<"/[tenant]/item/[itemId]">) {
  const { tenant: tid, itemId } = await params;
  if (!(tid in TENANTS)) notFound();

  const dbRow = await getCatalogItemById(itemId);
  if (
    !dbRow ||
    dbRow.tenantId !== tid ||
    dbRow.active === false
  ) {
    notFound();
  }

  const item = mapDbItem(dbRow);
  if (!item) notFound();

  const tenant = TENANTS[tid as TenantId];

  return (
    <MobileShell bg="var(--color-paper)">
      <ItemDetailInteractive
        tenant={tenant}
        item={item}
        garment={
          <div className="flex justify-center py-1 pb-2.5" style={{ background: "var(--color-parchment)" }}>
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.name}
                width={210}
                height={210}
                className="rounded-md"
              />
            ) : (
              <GarmentVector
                itemId={item.id}
                category={item.cat}
                accent={tenant.accent}
                size={210}
              />
            )}
          </div>
        }
      >
        <div className="px-5 pt-4 pb-2.5">
          <Chip tone="info">{item.cat} Uniform</Chip>
          <h2 className="font-serif text-[22px] font-medium mt-2.5 mb-1.5 leading-[1.2]">{item.name}</h2>
          {item.description && (
            <p className="text-[13px] leading-[1.5] m-0 mb-3.5" style={{ color: "var(--color-ink-dim)" }}>
              {item.description}
            </p>
          )}
        </div>
      </ItemDetailInteractive>
    </MobileShell>
  );
}
```

- [ ] **Step 2: Update `interactive.tsx` if it forwards GarmentVector**

Open `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`. If it constructs a `<GarmentVector itemId={...} />` internally, also pass `category={item.cat}` so the new fallback works for items without a per-id silhouette. If `interactive.tsx` only renders the `garment` prop (which is already passed in from the page), no edit is needed here.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 4: Smoke test (happy path)**

Run `pnpm dev:web`. Visit `/nsbh/item/blazer-m`. Page renders with description and the legacy blazer silhouette. Visit any newly-added test item created in Task 13. It should also render correctly.

- [ ] **Step 5: Smoke test (inactive item)**

In a Neon SQL shell, deactivate a real item:

```sql
UPDATE catalog_items SET active = false WHERE id = 'blazer-m';
```

Visit `/nsbh/item/blazer-m` directly — expect the standard 404 page. Visit `/admin/nsbh/catalog` — the item is still listed (operator-side behavior preserved). Restore:

```sql
UPDATE catalog_items SET active = true WHERE id = 'blazer-m';
```

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[tenant]/item/[itemId]/page.tsx apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx
git commit -m "feat(parent-shop): item detail reads from DB; notFound on inactive; drop generateStaticParams"
```

---

## Task 19: Stale-cart guard at `POST /api/orders`

**Files:**
- Modify: `apps/web/src/app/api/orders/route.ts` (insert validation block before line-insert loop near line 200)
- Modify: `apps/web/src/db/queries.ts` (add `validateCartLines` helper)

- [ ] **Step 1: Add the validation helper**

Append to `apps/web/src/db/queries.ts`:

```ts
export type CartLineCheck = {
  itemId: string;
  variantLabel: string;
};

export type CartLineInvalidReason =
  | "item_not_found"
  | "item_inactive"
  | "item_wrong_tenant"
  | "variant_not_found"
  | "variant_inactive";

export type CartLineInvalidLine = CartLineCheck & { reason: CartLineInvalidReason };

/**
 * Validates that every cart line refers to a live, active item + variant in
 * the given tenant. Returns the list of invalid lines (empty when all valid).
 */
export async function validateCartLines(
  tenantId: string,
  lines: CartLineCheck[]
): Promise<CartLineInvalidLine[]> {
  if (lines.length === 0) return [];

  const itemIds = Array.from(new Set(lines.map((l) => l.itemId)));
  const dbItems = await db
    .select({
      id: catalogItems.id,
      tenantId: catalogItems.tenantId,
      active: catalogItems.active,
    })
    .from(catalogItems)
    .where(inArray(catalogItems.id, itemIds));

  const dbVariants = await db
    .select({
      itemId: catalogVariants.itemId,
      label: catalogVariants.label,
      active: catalogVariants.active,
    })
    .from(catalogVariants)
    .where(inArray(catalogVariants.itemId, itemIds));

  const itemMap = new Map(dbItems.map((i) => [i.id, i]));
  const variantSet = new Set(
    dbVariants.filter((v) => v.active).map((v) => `${v.itemId}::${v.label}`)
  );
  const variantExistsSet = new Set(
    dbVariants.map((v) => `${v.itemId}::${v.label}`)
  );

  const invalid: CartLineInvalidLine[] = [];
  for (const line of lines) {
    const item = itemMap.get(line.itemId);
    if (!item) {
      invalid.push({ ...line, reason: "item_not_found" });
      continue;
    }
    if (item.tenantId !== tenantId) {
      invalid.push({ ...line, reason: "item_wrong_tenant" });
      continue;
    }
    if (!item.active) {
      invalid.push({ ...line, reason: "item_inactive" });
      continue;
    }
    const key = `${line.itemId}::${line.variantLabel}`;
    if (!variantExistsSet.has(key)) {
      invalid.push({ ...line, reason: "variant_not_found" });
      continue;
    }
    if (!variantSet.has(key)) {
      invalid.push({ ...line, reason: "variant_inactive" });
    }
  }
  return invalid;
}
```

- [ ] **Step 2: Wire the guard into the orders route**

Open `apps/web/src/app/api/orders/route.ts`. Find the spot in the `POST` handler where `lines` (the array from the request body) is destructured but **before** the `insertOrder` / `await db.transaction` block. Add the validation call:

```ts
import { validateCartLines } from "@/db/queries";

// ...inside POST, after `lines` is extracted from the body and after auth checks:

const invalidLines = await validateCartLines(
  tenantId,
  lines.map((l: { itemId: string; variantLabel: string }) => ({
    itemId: l.itemId,
    variantLabel: l.variantLabel,
  }))
);
if (invalidLines.length > 0) {
  return NextResponse.json(
    {
      code: "cart_items_unavailable",
      items: invalidLines,
    },
    { status: 409 }
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors. If `lines` lacks an explicit shape from the existing code, the inline `(l: { itemId: string; variantLabel: string }) =>` cast above is sufficient.

- [ ] **Step 4: Smoke test**

Run `pnpm dev:web`.

Open a private browser window. Visit `/nsbh`, add an item to the cart, proceed to checkout but do **not** click Pay yet.

In a SQL shell, deactivate the cart item:

```sql
UPDATE catalog_items SET active = false WHERE id = '<the-item-id>';
```

Now click Pay. Expect a 409 response with `cart_items_unavailable` in the network tab. The order is **not** created (verify with `SELECT * FROM orders ORDER BY created_at DESC LIMIT 5`).

Restore:

```sql
UPDATE catalog_items SET active = true WHERE id = '<the-item-id>';
```

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/db/queries.ts apps/web/src/app/api/orders/route.ts
git commit -m "feat(orders): stale-cart guard — revalidate item/variant active before insert"
```

---

## Task 20: Cart UI surface for `cart_items_unavailable`

**Files:**
- Modify: `apps/web/src/app/[tenant]/cart/cart-screen.tsx` (add 409 handling on the place-order fetch)
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` (same — wherever the order POST is called)

- [ ] **Step 1: Locate the order POST**

```bash
grep -rn "fetch.*\/api\/orders\b" apps/web/src/app/\[tenant\]/
```

Note all matches. Each one needs the 409 handler added.

- [ ] **Step 2: Add 409 handling at each call site**

For each `await fetch("/api/orders", ...)` call, replace any plain `if (!res.ok) throw new Error(...)` block with:

```ts
if (!res.ok) {
  const body = await res.json().catch(() => null);
  if (res.status === 409 && body?.code === "cart_items_unavailable") {
    setOrderError(
      "Some items in your cart are no longer available. Please review your cart and try again."
    );
    setUnavailableLines(body.items ?? []);
    return;
  }
  throw new Error(body?.error ?? "Order placement failed");
}
```

Add the `unavailableLines` state to the component:

```ts
const [unavailableLines, setUnavailableLines] = useState<{
  itemId: string;
  variantLabel: string;
  reason: string;
}[]>([]);
```

And render an inline notice above the cart line list when non-empty:

```tsx
{unavailableLines.length > 0 && (
  <div
    className="mb-3 px-3 py-2 rounded text-[12.5px]"
    style={{ background: "#FEF2F2", color: "#B91C1C" }}
  >
    These items are no longer available:
    <ul className="list-disc pl-5 mt-1">
      {unavailableLines.map((u, i) => (
        <li key={i}>
          {u.itemId} ({u.variantLabel}) — {u.reason.replace(/_/g, " ")}
        </li>
      ))}
    </ul>
    <div className="mt-1">Remove these items to continue.</div>
  </div>
)}
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 4: Smoke test**

Repeat Task 19's stale-cart smoke test — instead of just seeing 409 in the network tab, verify the cart UI now shows the warning banner with the offending item listed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[tenant]/cart/cart-screen.tsx apps/web/src/app/[tenant]/checkout/checkout-screen.tsx
git commit -m "feat(cart): surface cart_items_unavailable 409 with per-line detail"
```

---

## Task 21: Final verification — type-check + spec smoke matrix

**Files:** none modified — verification only.

- [ ] **Step 1: Full type-check**

```bash
pnpm check-types:web
```

Expected: zero errors across the entire repo.

- [ ] **Step 2: Lint-style sanity grep**

```bash
grep -rn "\.desc\b\|desc?:" apps/web/src/ || echo "OK: no leftover desc references"
grep -rn "POST /api/upload/catalog-image\|/api/upload/catalog-image" apps/web/ || echo "OK: no leftover custom upload proxy"
grep -rn "generateStaticParams" apps/web/src/app/\[tenant\]/ || echo "OK: no leftover generateStaticParams in parent shop"
```

Expected: all three `OK:` messages, or zero matches.

- [ ] **Step 3: Run the smoke matrix from spec §13**

In dev (`pnpm dev:web`) with a fresh dev branch + approved tenant:

| # | Test | Expected |
|---|------|----------|
| 1 | Approved end-to-end: `/admin/nsbh/catalog` → Add → fill → upload → Save → `/nsbh` shows new item | Pass |
| 2 | Pending tenant: `UPDATE tenants SET platform_approval_status = 'pending' WHERE id = 'nsbh'` → `/admin/nsbh/catalog` shows empty state; direct `POST /api/catalog` returns 403; `/api/uploadthing` POST returns the UploadThing-error envelope; restore approval | Pass |
| 3 | Image fallback: create item without image → parent shop shows category-keyed glyph | Pass |
| 4 | Image replace: edit, upload new image, save → catalog table refreshes; old URL gone from DB | Pass |
| 5 | Variant replace: edit, remove one, add one, save → DB shows new rows; existing orders still render | Pass |
| 6 | Item delete: delete an item with order history → 200 OK; `SELECT id FROM catalog_items WHERE id=...` empty; existing order detail still renders the snapshot | Pass |
| 7 | Validation: empty name → field error; no variants → "Add at least one variant"; negative price → field error | Pass |
| 8 | Image too big: try 3MB upload → drawer shows UploadThing error | Pass |
| 9 | Parent grid + detail render correctly with seed-only data | Pass |
| 10 | Inactive item: `UPDATE catalog_items SET active = false WHERE id = '...'` → parent direct URL → 404; admin still loads drawer | Pass |
| 11 | Stale-cart guard: add to cart → deactivate → Pay → 409 + UI banner; order **not** created | Pass |

If any test fails, the failing task must be re-opened and patched.

- [ ] **Step 4: Final commit (if anything was patched in Step 3)**

If Step 3 surfaced bugs that required follow-up edits, commit those under a `fix(catalog-mgmt): smoke-test corrections` message. If everything passed clean, no extra commit needed.

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat(catalog): self-service catalog management (§3.1)" --body "$(cat <<'EOF'
## Summary

- Migration 0008 adds `image_url` to `catalog_items`
- New side-drawer create/edit form on `/admin/[tenant]/catalog` with image upload (UploadThing) and approval-gate enforcement
- Parent shop migrated from static `CATALOG` to live DB reads (`getCatalogByTenant`, `getCatalogItemById`)
- `desc` → `description` rename across static seed and renderer
- `GarmentVector` refactored to fall back by category when no item-id-specific illustration exists
- Stale-cart guard at `POST /api/orders` returns 409 if any cart line references an inactive/missing item or variant

## Test plan

- [x] Type-check passes
- [x] Smoke tests 1-11 from spec §13 pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out-of-scope (carry forward to follow-up specs)

Per spec §14 — confirmed deferred from this plan:

- Super-admin tenant approval UI (`§2.2` in `remaining_work.md`)
- School self-signup
- Per-variant images / colour swatches
- CSV bulk-upload extension to include image URLs
- Catalog audit log
- Drag-to-reorder
- Price-drift revalidation at order create (§6.5 covers active/exists; price mismatch is deferred)
- UploadThing orphaned-file GC job
