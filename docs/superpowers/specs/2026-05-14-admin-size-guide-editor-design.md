# Admin Size-Guide Editor — Design

**Date:** 2026-05-14
**Tracking:** `docs/remaining_work.md` §3.12 (NSBH gap-analysis §5.12)
**Effort estimate:** ~½ day

---

## 1. Problem

`catalog_items.size_guide jsonb` exists in the DB schema (`db/schema.ts:105`) and is rendered on the PDP via `app/[tenant]/item/[itemId]/interactive.tsx:121-147`. But the column is only ever populated by the static seed in `lib/data.ts` — there is no UI for an operator to create, edit, or remove the guide for an item.

This blocks self-service catalog management: any tenant beyond NSBH/RGSH cannot ship a size guide without a code deploy.

## 2. Scope

**In scope**
- Add a collapsible "Size guide (optional)" editor inside the existing catalog item drawer.
- Persist edits through `POST /api/catalog` and `PATCH /api/catalog/[itemId]`.
- Audit-log diffs as part of the existing `catalog_item.updated` event.

**Out of scope (deferred / YAGNI)**
- Live preview of the rendered table on the PDP.
- "Copy size guide from another item" import helper.
- Bulk migration of `lib/data.ts` seed guides into the DB (will happen on next seed run; not a blocker).
- Per-cell unit conversion or numeric validation.

## 3. Data shape

The existing on-disk shape (already consumed by the PDP) is preserved verbatim:

```ts
type SizeGuide = {
  unit: string;       // free-text, default "cm"
  cols: string[];     // column headers, e.g. ["Size", "Chest", "Length"]
  rows: string[][];   // each inner array has `cols.length` cells
};
```

Stored as `jsonb` on `catalog_items.size_guide`. `null` means "no guide" — column already nullable, no migration needed.

## 4. UX

### Placement
A collapsible `<section>` titled **"Size guide (optional)"** is rendered inside `item-drawer.tsx` immediately after the Variants section, before the Save row. Collapsed by default when empty; expanded by default when the item already has a guide.

### Controls (inside the section)
1. **Unit** — single `<input type="text">`, default value `"cm"`. Free-text per spec answer.
2. **Columns** — single `<input type="text">` (comma-separated), e.g. `Size, Chest, Length`. Parsed on blur to drive the editable grid.
3. **Rows grid** — an HTML `<table>` where each row is one size and each cell is an `<input type="text">`. Header row reflects the parsed columns. One **trash** icon per row. **"+ Add row"** button below the table inserts a new row of empty cells (length = current column count).
4. **Remove size guide** — destructive link/button below the editor that clears all three fields and stages a `null` save.

### Column / row sync rule
When the columns input loses focus (or the user types), the row grid auto-resizes:
- **Adding** a column → every existing row gets an empty cell appended.
- **Removing** a column → every row truncates from the right.
- Operator-facing copy is unchanged; sync is silent.

This matches the chosen spec answer (auto-resize, never block save on jagged rows).

### Validation
- A guide is **saved** (non-null) iff `cols.length ≥ 1` AND `rows.length ≥ 1`.
- Empty cells are allowed (some sizes don't have a chest measurement).
- If the operator collapses the section without filling anything, the guide stays `null` (or stays at its current DB value if editing).

## 5. Server / data layer

### Schema (`lib/schemas/catalog.ts`)
Add a Zod sub-schema and thread it into both the create and patch schemas:

```ts
export const sizeGuideSchema = z
  .object({
    unit: z.string().trim().min(1).max(20),
    cols: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
    rows: z.array(z.array(z.string().trim().max(40)).min(1).max(8)).min(1).max(50),
  })
  .refine((g) => g.rows.every((r) => r.length === g.cols.length), {
    message: "Every row must have the same number of cells as columns",
  })
  .nullable();

// catalogItemInputSchema  → add  `sizeGuide: sizeGuideSchema.optional()`
// catalogItemPatchSchema  → add  `sizeGuide: sizeGuideSchema.optional()`
```

Limits (8 cols, 50 rows) are generous vs. real-world uniform guides (typically 3 cols × 8 rows) but bound the payload.

### Queries (`db/queries.ts`)
- `addCatalogItem(data)` (line 528): the `data` parameter object adds `sizeGuide?: SizeGuide | null`. The `db.insert(catalogItems).values({...})` block adds `sizeGuide: data.sizeGuide ?? null`.
- `updateCatalogItem(itemId, fields, variants?)` (line 575): the `fields` parameter type adds `sizeGuide?: SizeGuide | null`. The conditional update block adds `if (fields.sizeGuide !== undefined) updates.sizeGuide = fields.sizeGuide;`.
- `getCatalogItemById` (line 512) uses `select()` which already returns all columns including `sizeGuide` — no change.
- Existing read paths (`getActiveCatalog`, `getCatalogItemForPDP`) already select `sizeGuide` — no change.

### API routes

**`POST /api/catalog/route.ts`** — the `addCatalogItem({...})` call (line ~78) gains one line: `sizeGuide: input.sizeGuide ?? null,`. The subsequent `catalog_item.created` audit payload is unchanged (variant-summary only).

**`PATCH /api/catalog/[itemId]/route.ts`** — the no-op diff block (route lines 65–101) currently has two parts: a scalar-field loop over `scalarCandidates`, and a variant-fingerprint comparison. Add a third part for size-guide:

```ts
// After the scalar loop, before the variant block:
if (fields.sizeGuide !== undefined) {
  const existingJson = JSON.stringify(item.sizeGuide ?? null);
  const incomingJson = JSON.stringify(fields.sizeGuide ?? null);
  if (existingJson !== incomingJson) changedFields.push("sizeGuide");
}
```

`sizeGuide` is **not** added to `scalarCandidates`. That loop compares with raw `!==`, which on a jsonb object would always trigger reference inequality. The stringify-based branch above is the correct comparator.

The `updateCatalogItem` call (`await updateCatalogItem(itemId, fields, variants)`) already destructures `fields` from `input`, so `fields.sizeGuide` flows through once the schema accepts it — no change to that call site.

The audit-log `payload: { changedFields }` block is unchanged; `sizeGuide` rides through the existing array.

## 6. Client form state

`item-drawer.tsx` currently keeps each variant's `sizes` as a raw comma string and parses on save. Mirror that pattern:

```ts
type SizeGuideForm = {
  unit: string;          // "cm"
  colsRaw: string;       // "Size, Chest, Length"
  rows: string[][];      // parallel to the parsed cols length
};
```

Helpers (local to the drawer, no exports):
- `parseCols(raw: string): string[]` — split on `,`, trim, drop empty entries.
- `syncRows(rows, newColCount)` — pad with `""` or truncate.
- `toPayload(form): SizeGuide | null` — return `null` when `cols.length === 0 || rows.length === 0`; otherwise `{ unit: form.unit || "cm", cols, rows }`.

Initial state from `initial.sizeGuide` (new optional field on `ItemDrawerInitial`): pre-fill `unit`, join `cols` back into `colsRaw`, copy `rows` directly.

## 7. Audit log

The existing `catalog_item.updated` event already includes a `changedFields` array (PATCH route). Adding `"sizeGuide"` to that list is sufficient — no new event type, no payload-shape change. The post-PR audit feed entry will read e.g. *"updated White Shirt — Short Sleeves (sizeGuide)"*.

Setting a guide on a brand-new item is captured by the existing `catalog_item.created` event without additional work.

## 8. Files touched

- `apps/web/src/lib/schemas/catalog.ts` — add `sizeGuideSchema`, extend input + patch schemas.
- `apps/web/src/db/queries.ts` — accept `sizeGuide` in `addCatalogItem` / `updateCatalogItem`.
- `apps/web/src/app/api/catalog/route.ts` — thread into insert.
- `apps/web/src/app/api/catalog/[itemId]/route.ts` — thread into update + diff fingerprint + `changedFields`.
- `apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx` — new collapsible section + form state + helpers.

No new files, no migration, no PDP read-path change.

## 9. Risks & non-risks

- **Read path drift:** zero risk — the storage shape is unchanged and the PDP already consumes it.
- **Drizzle-kit migrations:** none. The column exists; no migration to apply via the Neon-MCP workaround.
- **Backward compatibility:** existing static `lib/data.ts` guides keep rendering until those tenants are re-seeded against the DB — no regression.
- **Audit-log noise:** PATCH-route no-op short-circuit already covers identical resaves; size-guide diff joins that envelope.

## 10. Verification

1. `pnpm check-types:web` clean.
2. Manual smoke (dev server):
   - Open admin catalog → existing item with a guide → expand section → verify pre-fill matches PDP.
   - Edit a cell → Save → reload → PDP shows new value.
   - Add column → existing rows gain empty cell → Save → reload → PDP shows new column with blanks.
   - Remove all rows → Save → PDP no longer renders size-guide block.
   - Create a brand-new item with a guide → Save → PDP renders correctly.
3. Audit-log spot-check: `audit_events` row with `action='catalog_item.updated'` includes `sizeGuide` in `payload.changedFields` after a guide-only edit.
