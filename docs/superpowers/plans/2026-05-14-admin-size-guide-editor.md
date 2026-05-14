# Admin Size-Guide Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator edit `catalog_items.size_guide` via the existing catalog item drawer, so the PDP-rendered size chart is no longer seed-only.

**Architecture:** Extend the existing Zod schema, query helpers, and PATCH-diff logic to carry an additional `sizeGuide` field. Add a collapsible editor section to the item drawer that mirrors the existing variant-row pattern (raw form state in the client, parsed payload on save). No DB migration — column already exists. No PDP changes — read shape already matches.

**Tech Stack:** TypeScript, Next.js 16 App Router (RSC + client components), Drizzle ORM on Neon, Zod for input validation.

**No test suite in this repo.** Per `CLAUDE.md`, the correctness gate is `pnpm check-types:web` plus targeted manual smoke. Every task uses this cadence: write code → `pnpm check-types:web` clean → smoke step (where applicable) → commit.

**Spec:** `docs/superpowers/specs/2026-05-14-admin-size-guide-editor-design.md`.

---

### Task 1: Add `sizeGuideSchema` to the Zod input schemas

**Files:**
- Modify: `apps/web/src/lib/schemas/catalog.ts`

- [ ] **Step 1: Add the size-guide sub-schema and thread it into the create + patch schemas**

Insert immediately after the existing `catalogVariantInputSchema` definition (currently the block ending at the variant `sizes` constraint):

```ts
export const sizeGuideSchema = z
  .object({
    unit: z.string().trim().min(1).max(20),
    cols: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
    rows: z
      .array(z.array(z.string().trim().max(40)).min(1).max(8))
      .min(1)
      .max(50),
  })
  .refine((g) => g.rows.every((r) => r.length === g.cols.length), {
    message: "Every row must have the same number of cells as columns",
  });

export type SizeGuideInput = z.infer<typeof sizeGuideSchema>;
```

Then extend the two item-level schemas. Find:

```ts
export const catalogItemInputSchema = z.object({
  tenantId: z.string().min(1),
  ...
  variants: z.array(catalogVariantInputSchema).min(1),
});
```

Add one line just above `variants:`:

```ts
  sizeGuide: sizeGuideSchema.nullable().optional(),
```

Do the same for `catalogItemPatchSchema`:

```ts
export const catalogItemPatchSchema = catalogItemInputSchema
  .omit({ tenantId: true })
  .partial()
  .extend({
    variants: z.array(catalogVariantInputSchema).min(1).optional(),
    sizeGuide: sizeGuideSchema.nullable().optional(),
  });
```

> The `.optional()` on the patch schema is what distinguishes "key absent → untouched" from "key=null → remove". `.partial()` would also produce optionality, but being explicit here matches the variants entry above and protects against future schema refactors.

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/schemas/catalog.ts
git commit -m "feat(catalog): add sizeGuide to Zod input + patch schemas"
```

---

### Task 2: Thread `sizeGuide` through `addCatalogItem` and `updateCatalogItem`

**Files:**
- Modify: `apps/web/src/db/queries.ts` (function `addCatalogItem` around L528; function `updateCatalogItem` around L575)
- Modify: `apps/web/src/db/schema.ts:105` (stale comment fix, drive-by from spec §10)

- [ ] **Step 1: Extend `addCatalogItem`'s parameter type**

In `addCatalogItem`, locate the parameter type:

```ts
export async function addCatalogItem(data: {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description?: string | null;
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
  variants: { label: string; price: number; active?: boolean; sizes?: string[] }[];
}) {
```

Add one line just before `variants:`:

```ts
  sizeGuide?: { unit: string; cols: string[]; rows: string[][] } | null;
```

In the `db.insert(catalogItems).values({ ... })` block inside the same function, add `sizeGuide: data.sizeGuide ?? null,` next to the other column assignments (alongside `imageUrl`).

- [ ] **Step 2: Extend `updateCatalogItem`'s `fields` parameter type**

In `updateCatalogItem`, locate the `fields` parameter:

```ts
  fields: {
    name?: string;
    category?: string;
    description?: string | null;
    imageUrl?: string | null;
    active?: boolean;
    sortOrder?: number;
  },
```

Add one line at the end of the type:

```ts
    sizeGuide?: { unit: string; cols: string[]; rows: string[][] } | null;
```

In the body, find the block that builds `updates`:

```ts
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.name !== undefined) updates.name = fields.name;
  ...
  if (fields.sortOrder !== undefined) updates.sortOrder = fields.sortOrder;
```

Append one line:

```ts
  if (fields.sizeGuide !== undefined) updates.sizeGuide = fields.sizeGuide;
```

> The `!== undefined` guard is load-bearing: it lets `null` flow through (operator removed the guide → write NULL) while skipping the column entirely when the caller didn't touch the field.

- [ ] **Step 3: Fix the stale schema comment**

In `apps/web/src/db/schema.ts`, find the `sizeGuide` column line:

```ts
  sizeGuide: jsonb("size_guide"), // array of {label, chest, waist, hip}
```

Replace the comment:

```ts
  sizeGuide: jsonb("size_guide"), // { unit: string; cols: string[]; rows: string[][] } | null
```

- [ ] **Step 4: Type-check**

Run: `pnpm check-types:web`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/db/queries.ts apps/web/src/db/schema.ts
git commit -m "feat(catalog): persist sizeGuide via add/updateCatalogItem"
```

---

### Task 3: Thread `sizeGuide` into POST and PATCH route handlers

**Files:**
- Modify: `apps/web/src/app/api/catalog/route.ts` (POST — `addCatalogItem({...})` call site)
- Modify: `apps/web/src/app/api/catalog/[itemId]/route.ts` (PATCH — no-op diff block)

- [ ] **Step 1: Thread `sizeGuide` into the POST call site**

In `apps/web/src/app/api/catalog/route.ts`, find the `addCatalogItem({ ... })` call (the call object currently lists `id`, `tenantId`, `name`, `category`, `description`, `imageUrl`, `active`, `sortOrder`, `variants`). Add one line just above `variants:`:

```ts
      sizeGuide: input.sizeGuide ?? null,
```

> `input.sizeGuide` is `undefined` when omitted (untouched), `null` when explicitly cleared, an object when set. POST treats undefined-or-null as "no guide" — the `?? null` collapses both to `null` for insert. This is correct because new items either have a guide or don't.

- [ ] **Step 2: Add the size-guide diff branch in PATCH**

In `apps/web/src/app/api/catalog/[itemId]/route.ts`, locate the no-op diff block (the `scalarCandidates` loop, then the variant-fingerprint block, then the `if (changedFields.length === 0)` short-circuit).

Insert this between the scalar loop and the variant block:

```ts
    if (fields.sizeGuide !== undefined) {
      const existingJson = JSON.stringify(item.sizeGuide ?? null);
      const incomingJson = JSON.stringify(fields.sizeGuide ?? null);
      if (existingJson !== incomingJson) changedFields.push("sizeGuide");
    }
```

> Do **not** add `"sizeGuide"` to `scalarCandidates`. That loop uses raw `!==`, which on a fresh jsonb-decoded object is always reference-inequal and would always report changed.

- [ ] **Step 3: Type-check**

Run: `pnpm check-types:web`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/catalog/route.ts apps/web/src/app/api/catalog/[itemId]/route.ts
git commit -m "feat(catalog): thread sizeGuide through catalog API routes"
```

---

### Task 4: Add size-guide editor UI to the item drawer

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx`

This is the largest task. It adds: a new form state shape, two pure helpers, the collapsible editor section, and the save-time payload conversion.

- [ ] **Step 1: Extend the initial-props type to receive `sizeGuide`**

Find the `ItemDrawerInitial` type at the top of the file:

```ts
export type ItemDrawerInitial = {
  name?: string;
  category?: typeof ITEM_CATEGORIES[number];
  description?: string;
  imageUrl?: string;
  active?: boolean;
  sortOrder?: number;
  variants?: InitialVariant[];
};
```

Add one optional field:

```ts
  sizeGuide?: { unit: string; cols: string[]; rows: string[][] } | null;
```

- [ ] **Step 2: Add the form-state type and helpers above `ItemDrawer`**

Insert above `export function ItemDrawer(`:

```ts
type SizeGuideForm = {
  unit: string;
  colsRaw: string;
  rows: string[][];
};

function parseCols(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function syncRows(rows: string[][], newColCount: number): string[][] {
  return rows.map((row) => {
    if (row.length === newColCount) return row;
    if (row.length < newColCount) {
      return [...row, ...Array(newColCount - row.length).fill("")];
    }
    return row.slice(0, newColCount);
  });
}

function toSizeGuidePayload(
  form: SizeGuideForm,
): { unit: string; cols: string[]; rows: string[][] } | null {
  const cols = parseCols(form.colsRaw);
  if (cols.length === 0 || form.rows.length === 0) return null;
  const rows = form.rows.map((r) => syncRows([r], cols.length)[0]);
  return { unit: form.unit.trim() || "cm", cols, rows };
}
```

> `unit.trim() || "cm"` trims **before** the OR fallback so a whitespace-only input falls back to `"cm"` rather than being passed through and rejected by `z.string().trim().min(1)` upstream.

- [ ] **Step 3: Add state slots and re-sync them inside the existing `useEffect`**

The drawer uses `useEffect(..., [open, initial])` (around item-drawer.tsx:84-104) to re-sync every field whenever the drawer reopens against a different item. A `useState(() => ...)` lazy initialiser fires only once per mount — using it would carry stale guide state across opens. So:

(a) Alongside the other `useState` calls at the top of `ItemDrawer` (after `const [variants, setVariants] = ...`), add the two slots with plain defaults — **not** lazy initialisers:

```ts
  const [sizeGuide, setSizeGuide] = useState<SizeGuideForm>({
    unit: "cm",
    colsRaw: "",
    rows: [],
  });
  const [sizeGuideOpen, setSizeGuideOpen] = useState<boolean>(false);
```

(b) Inside the existing `useEffect(() => { ... }, [open, initial])` block (alongside `setName`, `setCategory`, …, `setError(null)`), add:

```ts
    const sg = initial?.sizeGuide;
    if (sg) {
      setSizeGuide({
        unit: sg.unit,
        colsRaw: sg.cols.join(", "),
        rows: sg.rows.map((r) => [...r]),
      });
      setSizeGuideOpen(true);
    } else {
      setSizeGuide({ unit: "cm", colsRaw: "", rows: [] });
      setSizeGuideOpen(false);
    }
```

> Reset is mandatory in the `else` branch — without it, closing the drawer for an item with a guide and re-opening for one without would inherit the previous guide's state.

- [ ] **Step 4: Render the collapsible editor section**

Find the variants section inside the drawer body. Add this new `<section>` immediately **after** the closing tag of the variants section and **before** the Save row.

```tsx
          {/* Size guide */}
          <section>
            <button
              type="button"
              onClick={() => setSizeGuideOpen((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.4px]"
            >
              <span>Size guide (optional)</span>
              <span aria-hidden style={{ color: "var(--color-ink-dim)" }}>
                {sizeGuideOpen ? "−" : "+"}
              </span>
            </button>

            {sizeGuideOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-[11px] block mb-1" style={{ color: "var(--color-ink-dim)" }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    value={sizeGuide.unit}
                    onChange={(e) =>
                      setSizeGuide((s) => ({ ...s, unit: e.target.value }))
                    }
                    placeholder="cm"
                    className="w-full border rounded px-2 py-1 text-[13px]"
                    style={{ borderColor: "var(--color-rule)" }}
                  />
                </div>

                <div>
                  <label className="text-[11px] block mb-1" style={{ color: "var(--color-ink-dim)" }}>
                    Columns (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={sizeGuide.colsRaw}
                    onChange={(e) => {
                      const newRaw = e.target.value;
                      setSizeGuide((s) => {
                        const newCount = parseCols(newRaw).length;
                        return {
                          ...s,
                          colsRaw: newRaw,
                          rows: syncRows(s.rows, newCount),
                        };
                      });
                    }}
                    placeholder="Size, Chest, Length"
                    className="w-full border rounded px-2 py-1 text-[13px]"
                    style={{ borderColor: "var(--color-rule)" }}
                  />
                </div>

                {parseCols(sizeGuide.colsRaw).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                      Rows
                    </div>
                    <table className="w-full text-[12px] tnum">
                      <thead>
                        <tr style={{ color: "var(--color-ink-dim)" }}>
                          {parseCols(sizeGuide.colsRaw).map((c, ci) => (
                            <th key={ci} className="text-left font-semibold py-1 pr-2">{c}</th>
                          ))}
                          <th aria-hidden />
                        </tr>
                      </thead>
                      <tbody>
                        {sizeGuide.rows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="py-1 pr-2">
                                <input
                                  type="text"
                                  value={cell}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    setSizeGuide((s) => {
                                      const rows = s.rows.map((r) => [...r]);
                                      rows[ri][ci] = newVal;
                                      return { ...s, rows };
                                    });
                                  }}
                                  className="w-full border rounded px-2 py-1 text-[12px]"
                                  style={{ borderColor: "var(--color-rule)" }}
                                />
                              </td>
                            ))}
                            <td className="py-1 pl-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setSizeGuide((s) => ({
                                    ...s,
                                    rows: s.rows.filter((_, i) => i !== ri),
                                  }))
                                }
                                aria-label={`Remove row ${ri + 1}`}
                                className="text-[14px]"
                                style={{ color: "var(--color-ink-dim)" }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      onClick={() =>
                        setSizeGuide((s) => {
                          const colCount = parseCols(s.colsRaw).length;
                          return {
                            ...s,
                            rows: [...s.rows, Array(colCount).fill("")],
                          };
                        })
                      }
                      className="text-[12px] underline mt-1"
                      style={{ color: tenant.accent }}
                    >
                      + Add row
                    </button>
                  </div>
                )}

                {(sizeGuide.colsRaw.length > 0 || sizeGuide.rows.length > 0) && (
                  <button
                    type="button"
                    onClick={() =>
                      setSizeGuide({ unit: "cm", colsRaw: "", rows: [] })
                    }
                    className="text-[12px] underline"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    Remove size guide
                  </button>
                )}
              </div>
            )}
          </section>
```

> "Remove size guide" only clears local form state. The `null` lands on the server when the operator clicks the drawer's main **Save** button — same flow as variant edits.

- [ ] **Step 5: Include `sizeGuide` in `basePayload`**

Find the `basePayload` object inside `handleSubmit` (around item-drawer.tsx:128-135). It's the single shared payload used for both POST and PATCH — currently has `name, category, description, imageUrl, active, sortOrder, variants`.

Add one line to that object (placement adjacent to `variants:` is fine):

```ts
        sizeGuide: toSizeGuidePayload(sizeGuide),
```

> Do **not** wrap this in any `if (mode.kind === "edit")` branch and do **not** strip `null` before send. The PATCH diff branch in Task 3 needs the key present to detect a removal; for POST, the API route's `?? null` collapses `null` for insert.

- [ ] **Step 6: Type-check**

Run: `pnpm check-types:web`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx
git commit -m "feat(catalog): size-guide editor section in item drawer"
```

---

### Task 5: Extend `initialFromItem` in `catalog-table.tsx` to surface `sizeGuide`

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx` (helper at L71-85)

The edit-mode `<ItemDrawer />` is mounted at catalog-table.tsx:211 with `initial={initialFromItem(drawer.item)}`. The helper at L71-85 maps the loaded `CatalogItemWithVariants` row into the `ItemDrawerInitial` shape. That's the single seam where `sizeGuide` needs to surface.

`page-client.tsx` is the create-mode mount and passes no `initial` — it needs no change.

- [ ] **Step 1: Add `sizeGuide` to the `initialFromItem` mapping**

In `catalog-table.tsx`, find the helper:

```ts
  const initialFromItem = (it: CatalogItemWithVariants): ItemDrawerInitial => ({
    name: it.name,
    category: it.category as ItemCategory,
    description: it.description ?? undefined,
    imageUrl: it.imageUrl ?? undefined,
    active: it.active,
    sortOrder: it.sortOrder,
    variants: it.variants.map((v) => ({ ... })),
  });
```

Add one line just above `variants:`:

```ts
    sizeGuide: (it.sizeGuide as { unit: string; cols: string[]; rows: string[][] } | null) ?? null,
```

> The explicit cast mirrors the `it.variants.sizes` pattern used in the same helper (`Array.isArray(v.sizes) ? (v.sizes as string[]) : []`). Drizzle types `jsonb` columns as `unknown`, so the narrowing is local to the call site rather than a schema-wide change.

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: clean. If `CatalogItemWithVariants` doesn't already include `sizeGuide`, locate the type (`grep -n "CatalogItemWithVariants" apps/web/src/`) and add `sizeGuide: unknown` (or the existing column type) to its definition.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx
git commit -m "feat(catalog): surface sizeGuide via initialFromItem mapping"
```

---

### Task 6: Manual smoke + audit log spot-check

No code changes; verification only. Skip the commit step.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev:web`
Open: `http://localhost:3000/admin/nsbh/catalog`

- [ ] **Step 2: Edit an existing item with a seeded guide**

Open `White Shirt — Short Sleeves` (or any item that has a `sizeGuide` in the seed). Expand the "Size guide (optional)" section. Verify:
- Unit pre-fills with `cm`.
- Columns pre-fill as `Size, Chest, Length`.
- Rows pre-fill matching seed data.

Edit one cell. Click Save. Reload the page. Re-open. Confirm the edited cell persists.

Also open the parent PDP at `http://localhost:3000/nsbh/item/shirt-ss` → tap the "Size guide" toggle → confirm the edit is reflected.

- [ ] **Step 3: Add a column on an existing guide**

Edit a guide's Columns input from `Size, Chest, Length` → `Size, Chest, Length, Sleeve`. Every existing row should silently gain an empty cell. Save → reload → PDP renders the new column with blanks in the existing rows.

- [ ] **Step 4: Remove all rows / use the Remove button**

Click "Remove size guide". Save. PDP: the size-guide collapsible block should no longer appear.

- [ ] **Step 5: Create a brand-new item with a guide**

Click "Add item". Fill name, category, one variant. Expand the size-guide section. Add `Size, Chest`. Click "+ Add row" twice. Fill cells. Save. Open the new item's PDP → guide renders correctly.

- [ ] **Step 6: PATCH no-op short-circuit smoke (regression guard)**

Open the same item twice without editing anything in the size-guide section. Save → save again. Inspect the audit log on the platform tenant detail page (or query `audit_events` directly via Neon MCP). Expected: **no** `catalog_item.updated` row from either save. If a row appears, the JSON.stringify diff is broken (the reference-inequality regression the spec is meant to prevent).

- [ ] **Step 7: Audit log spot-check on a real edit**

Edit one cell of a guide. Save. Query the latest `audit_events` row for that tenant. Expected: `action = 'catalog_item.updated'`, `payload.changedFields` includes `"sizeGuide"`.

- [ ] **Step 8: Whitespace-unit fallback**

Edit a guide. Replace the unit with `"   "` (three spaces). Save. Re-open. Expected: unit field reads `"cm"` (the `trim() || "cm"` fallback ran on save). No 400 from the API.

If any smoke fails, file a follow-up task and revisit before merge.

---

### Task 7: Update doc trail

**Files:**
- Modify: `docs/remaining_work.md` (§3.12 size-guide editor bullet)
- Modify: `docs/completed.md` (new §4.35)

- [ ] **Step 1: Flip the size-guide-editor item in `remaining_work.md` §3.12 to ✅**

Find the line:

```
- [ ] **Admin size-guide editor (gap-analysis §5.12 — drag-to-reorder portion ✅ shipped).**
```

Change `- [ ]` to `- [x]`, and append `✅ shipped (PR #N). See completed.md §4.35.` at the end of the description. Trim the body sentences down to the result, not the plan.

- [ ] **Step 2: Add `§4.35 Admin size-guide editor` to `docs/completed.md`**

Append a new entry to the §4 list, mirroring §4.33's style: one paragraph summarising what shipped (files touched, the JSON-stringify diff, no migration, audit-log reuse), a Spec/Plan pointer line, and a Files line.

- [ ] **Step 3: Commit**

```bash
git add docs/remaining_work.md docs/completed.md
git commit -m "docs: record admin size-guide editor (§4.35)"
```

---

## Self-Review

**Spec coverage:**

- §3 data shape preserved → Tasks 1, 2 (schema, queries).
- §4 UX (collapsible, unit free-text, comma-separated cols, editable grid, Remove button stages-not-saves) → Task 4.
- §4 column/row auto-sync rule → Task 4 (`syncRows`).
- §4 validation (≥1 col + ≥1 row to save, else null) → Task 4 (`toSizeGuidePayload`).
- §5 Zod schema with refine() row-width check → Task 1.
- §5 `addCatalogItem` / `updateCatalogItem` plumbing → Task 2.
- §5 POST route call site → Task 3 Step 1.
- §5 PATCH JSON.stringify diff branch (explicitly **not** in `scalarCandidates`) → Task 3 Step 2.
- §5 null/undefined contract → Task 2 (`!== undefined` guard), Task 3 Step 2 (diff branch fires only when key present).
- §6 client form state + helpers (`parseCols`, `syncRows`, `toSizeGuidePayload`) → Task 4.
- §6 trim-before-OR for unit → Task 4 Step 2.
- §7 audit log reuses `catalog_item.updated` with `changedFields` → Task 3.
- §8 files touched (5 listed): schemas/catalog.ts, db/queries.ts, both API routes, item-drawer.tsx. The plan adds one more file — `catalog-table.tsx` — for the edit-mode `initialFromItem` mapping (Task 5). Called out here so reviewers don't flag the +1 as scope creep; it's a necessary plumbing seam the spec missed when enumerating §8's file list. The spec's read-path claim ("no PDP changes, no new files") still holds.
- §10 verification (5 items) → Task 6 (8 steps, all spec items covered).
- §10 stale schema comment fix → Task 2 Step 3.

**Placeholder scan:** no TBDs, no "implement appropriate X" hand-waves, no "similar to Task N" pointers — every code block is complete.

**Type consistency:** `SizeGuide` is referred to inline as `{ unit: string; cols: string[]; rows: string[][] }` consistently across Tasks 1, 2, 4, 5. `parseCols`, `syncRows`, `toSizeGuidePayload` names are used identically wherever referenced. The `sizeGuide` form-state property name is the same in the type definition (Task 4 Step 2), initialiser (Step 3), render block (Step 4), and payload (Step 5).

Spec coverage clean. No fixes needed.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-admin-size-guide-editor.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session, batch with checkpoints.

Which approach?
