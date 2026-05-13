# Catalog Drag-to-Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-reorder UI to the admin catalog table and persist the new `sortOrder` via a new bulk endpoint.

**Architecture:** `@dnd-kit/sortable` wraps `<tbody>` in `catalog-table.tsx`; each row has a grip cell that initiates drag. On drop, client optimistically reorders, fires `POST /api/catalog/reorder` with the full `orderedIds[]`, and snaps back on error. Server validates the set is exhaustive for the tenant, dense-renumbers `0..N-1` via `db.batch`, and writes one `logAuditEvent` row.

**Tech Stack:** Next.js 16 App Router (RSC + client islands), Drizzle ORM + neon-http (no transactions, `db.batch` only), `@dnd-kit/core` + `@dnd-kit/sortable`, Zod for body validation, Tailwind v4 tokens.

**Spec:** `docs/superpowers/specs/2026-05-13-catalog-drag-reorder-design.md`

**Testing note:** This repo has no test runner. The correctness gate per CLAUDE.md is `pnpm check-types:web`. Manual verification follows §10 of the spec. Plan reflects this — no `pytest`/`vitest`-style steps, but every task ends with `pnpm check-types:web` + a manual check.

**File map:**

| File | Action | Responsibility |
|---|---|---|
| `apps/web/package.json` | Modify | Add `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` deps |
| `apps/web/src/db/queries.ts` | Modify | New `reorderCatalogItems(tenantId, orderedIds)` helper using `db.batch` |
| `apps/web/src/lib/schemas/catalog.ts` | Modify | New `catalogReorderSchema` Zod schema |
| `apps/web/src/app/api/catalog/reorder/route.ts` | Create | `POST` handler — auth, set-equality validation, batched UPDATE, audit log |
| `apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx` | Modify | Wrap in `DndContext`/`SortableContext`; extract `SortableRow`; add grip column; optimistic POST + rollback |

---

## Task 1: Add `@dnd-kit` dependencies

**Files:**
- Modify: `apps/web/package.json` (dependencies block)

- [ ] **Step 1: Add the two packages**

Run from repo root:
```bash
pnpm --filter web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

`@dnd-kit/utilities` is a regular (non-peer) dependency of `@dnd-kit/sortable`. Under pnpm's strict resolution, transitive deps are not directly importable from the consumer package, so we add it explicitly — Task 6 imports `CSS` from it.

Expected: `package.json` gets three new `dependencies` entries; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify install succeeded**

Run:
```bash
pnpm --filter web ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: all three resolve to a concrete version (≥ 6.x for core, ≥ 8.x for sortable, ≥ 3.x for utilities).

- [ ] **Step 3: Type-check baseline**

Run:
```bash
pnpm check-types:web
```

Expected: passes (no source changes yet, just deps).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(catalog): add @dnd-kit/core+sortable+utilities deps"
```

---

## Task 2: `reorderCatalogItems` query helper

**Files:**
- Modify: `apps/web/src/db/queries.ts` (append a new export near the existing catalog mutations — `updateCatalogItem` lives around line 580; place the new helper right after it for proximity)

- [ ] **Step 1: Read context for placement**

Open `apps/web/src/db/queries.ts` and locate `updateCatalogItem` (search for `export async function updateCatalogItem`). The new helper goes immediately after its closing brace.

Confirm at the top of the file that `db`, `catalogItems`, and `eq`/`and` are imported (they are — `updateCatalogItem` already uses them). Confirm `sql` from `drizzle-orm` is imported (it should be; if not, add it).

- [ ] **Step 2: Add the helper**

Append this function right after `updateCatalogItem`:

```ts
/**
 * Bulk-renumber a tenant's catalog items to dense 0..N-1 order.
 * Uses db.batch (neon-http) — not db.transaction (unsupported on neon-http).
 * Caller must have already validated that `orderedIds` is the exhaustive set
 * of catalog item IDs for this tenant.
 */
export async function reorderCatalogItems(
  tenantId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return;
  const statements = orderedIds.map((id, index) =>
    db
      .update(catalogItems)
      .set({ sortOrder: index })
      .where(and(eq(catalogItems.id, id), eq(catalogItems.tenantId, tenantId))),
  );
  // neon-http: db.batch accepts a tuple of queries; we cast for the variadic shape.
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
}
```

The cast is necessary because Drizzle's `db.batch` types require a non-empty tuple, but the array length is dynamic here. This matches how other dynamic batches are typed elsewhere in this file.

- [ ] **Step 3: Type-check**

Run:
```bash
pnpm check-types:web
```

Expected: passes. If it fails on the `db.batch` cast, grep for an existing dynamic-batch site (`grep -n "db.batch" apps/web/src/db/queries.ts`) and copy its exact cast shape.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/db/queries.ts
git commit -m "feat(catalog): reorderCatalogItems batched query helper"
```

---

## Task 3: Zod schema for the reorder request body

**Files:**
- Modify: `apps/web/src/lib/schemas/catalog.ts` (append a new export)

- [ ] **Step 1: Add the schema**

Open `apps/web/src/lib/schemas/catalog.ts`. Confirm `z` is imported at the top (it is — the existing `catalogItemPatchSchema` uses it). Append:

```ts
export const catalogReorderSchema = z.object({
  tenantSlug: z.string().min(1).max(64),
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
});

export type CatalogReorderInput = z.infer<typeof catalogReorderSchema>;
```

The `max(500)` cap is a soft DoS guard — catalog sizes are <100 in practice; 500 leaves headroom without inviting abuse.

- [ ] **Step 2: Type-check**

Run:
```bash
pnpm check-types:web
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/schemas/catalog.ts
git commit -m "feat(catalog): catalogReorderSchema for bulk reorder body"
```

---

## Task 4: `POST /api/catalog/reorder` route

**Files:**
- Create: `apps/web/src/app/api/catalog/reorder/route.ts`

- [ ] **Step 1: Make the directory**

Run:
```bash
mkdir -p apps/web/src/app/api/catalog/reorder
```

- [ ] **Step 2: Write the route handler**

Create `apps/web/src/app/api/catalog/reorder/route.ts` with this exact content:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  getCatalogByTenant,
  reorderCatalogItems,
} from "@/db/queries";
import {
  ensureTenantAccess,
  isPlatformAdminEmail,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { requireTenantApproved } from "@/lib/auth/require-tenant-approved";
import { catalogReorderSchema } from "@/lib/schemas/catalog";
import { applyRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit/log";

// POST /api/catalog/reorder
// Body: { tenantSlug: string, orderedIds: string[] }
// Atomically renumber a tenant's catalog items to dense 0..N-1 order.
export async function POST(req: NextRequest) {
  try {
    const preAuthRl = applyRateLimit(req, "catalog:reorder:anon", {
      limit: 30,
      windowMs: 60_000,
    });
    if (preAuthRl) return preAuthRl;

    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const userRl = applyRateLimit(
      req,
      `catalog:reorder:${authResult.user.id}`,
      { limit: 20, windowMs: 60_000 },
    );
    if (userRl) return userRl;

    const body = await req.json();
    const parsed = catalogReorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { tenantSlug, orderedIds } = parsed.data;

    // requireTenantApproved resolves the tenant by slug (the slug doubles as
    // the PK in this codebase) AND enforces approval gating in one round-trip.
    const approval = await requireTenantApproved(tenantSlug);
    if ("response" in approval) return approval.response;
    const { tenant } = approval;

    const accessDenied = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (accessDenied) return accessDenied;

    // Exhaustive-set check: orderedIds must equal the full set of catalog item
    // IDs for this tenant. This catches concurrent add/delete by another
    // operator and any client/server drift. Use getCatalogByTenant (not the
    // active-only variant) so inactive items participate in ordering — see
    // spec §4.3.
    const currentItems = await getCatalogByTenant(tenant.id);
    const currentIds = new Set(currentItems.map((it) => it.id));
    const incomingIds = new Set(orderedIds);

    if (incomingIds.size !== orderedIds.length) {
      return NextResponse.json(
        { error: "duplicate_ids" },
        { status: 400 },
      );
    }
    if (orderedIds.length !== currentIds.size) {
      return NextResponse.json(
        { error: "stale_set", message: "Catalog changed — please refresh." },
        { status: 400 },
      );
    }
    for (const id of incomingIds) {
      if (!currentIds.has(id)) {
        return NextResponse.json(
          { error: "stale_set", message: "Catalog changed — please refresh." },
          { status: 400 },
        );
      }
    }

    await reorderCatalogItems(tenant.id, orderedIds);

    await logAuditEvent({
      tenantId: tenant.id,
      actorEmail: authResult.user.email,
      actorRole: isPlatformAdminEmail(authResult.user.email)
        ? "platform_admin"
        : "operator",
      action: "catalog.reordered",
      targetType: "tenant",
      targetId: tenant.id,
      payload: { itemCount: orderedIds.length },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/catalog/reorder failed:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 },
    );
  }
}
```

Field-name confirmations (against the actual codebase, verified during plan review):
- `logAuditEvent` field is `payload` (`lib/audit/types.ts` — `LogAuditEventInput.payload?: Record<string, unknown>`), **not** `metadata`.
- `actorEmail` is `string` (not nullable); pass `authResult.user.email` directly.
- `actorRole` mirrors the conditional at `[itemId]/route.ts:135-137` so platform-admin reorders are correctly attributed.
- Query helper is `getCatalogByTenant(tenantId)` at `queries.ts:488` — returns active + inactive — **not** `getCatalogItems`.
- `requireTenantApproved` returns `{ tenant }` on success; reuse it rather than calling `getTenant(slug)` separately.

- [ ] **Step 3: Type-check**

Run:
```bash
pnpm check-types:web
```

Expected: passes. If a name still doesn't resolve, mirror the import/call shape at `apps/web/src/app/api/catalog/[itemId]/route.ts:1-15, 31-50, 133-142`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/catalog/reorder/route.ts
git commit -m "feat(catalog): POST /api/catalog/reorder bulk endpoint"
```

---

## Task 5: Extract `SortableRow` and add grip column to the catalog table

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx`

This task focuses on the **DOM/structure** changes (grip column + row extraction). The actual drag wiring lands in Task 6.

- [ ] **Step 1: Bump empty-state colSpan and add the grip header**

In `catalog-table.tsx`, find the `<thead>` (currently at lines 71-80) and prepend a new `<th>`:

```tsx
<thead className="bg-white sticky top-0">
  <tr className="text-left" style={{ color: "var(--color-ink-dim)" }}>
    <th className="px-2 py-2 w-[28px]" aria-label="Reorder"></th>
    <th className="px-3 py-2 w-[60px]">Image</th>
    <th className="px-3 py-2">Name</th>
    <th className="px-3 py-2 w-[110px]">Category</th>
    <th className="px-3 py-2 w-[100px]">Variants</th>
    <th className="px-3 py-2 w-[80px]">Active</th>
    <th className="px-3 py-2 w-[60px]"></th>
  </tr>
</thead>
```

Find the empty-state `<tr>` (currently `colSpan={6}` around line 129) and change to `colSpan={7}`.

- [ ] **Step 2: Add the grip `<td>` to every data row, no drag wiring yet**

Inside the `items.map((it) => ...)` block, add a new leading `<td>` before the existing `<td>` that holds the image. Stop click propagation so the cell never opens the drawer:

```tsx
<td
  className="px-2 py-2"
  onClick={(e) => e.stopPropagation()}
>
  <span
    aria-label={`Reorder ${it.name}`}
    className="inline-flex items-center justify-center w-5 h-5 select-none"
    style={{ color: "var(--color-ink-dim)", cursor: "grab" }}
  >
    ⠿
  </span>
</td>
```

The `cursor: "grab"` is cosmetic for now; Task 6 replaces this `<span>` with the `useSortable`-driven handle.

- [ ] **Step 3: Type-check + manual smoke**

Run:
```bash
pnpm check-types:web
```

Expected: passes.

Then run `pnpm dev:web` and visit `/admin/nsbh/catalog` (after logging in as operator). Confirm:
- Header row shows 7 columns.
- Each row shows a `⠿` grip glyph on the left.
- Clicking the grip cell does **not** open the drawer.
- Clicking elsewhere on the row still opens the drawer.

Kill `pnpm dev:web` when done.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx
git commit -m "feat(catalog): add static grip column (no drag wiring yet)"
```

---

## Task 6: Wire `@dnd-kit` for actual drag-to-reorder

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx`

- [ ] **Step 1: Add imports**

At the top of `catalog-table.tsx`, alongside existing imports:

```tsx
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

- [ ] **Step 2: Add a `SortableRow` component below the `CatalogTable` export**

At the bottom of the file (after the closing `}` of `CatalogTable`), add:

```tsx
function SortableRow({
  item,
  tenant,
  onOpenDrawer,
  onDelete,
}: {
  item: CatalogItemWithVariants;
  tenant: Tenant;
  onOpenDrawer: (it: CatalogItemWithVariants) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.12)" : undefined,
    borderColor: "var(--color-rule)",
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-t cursor-pointer hover:bg-[var(--color-parchment)]"
      onClick={() => onOpenDrawer(item)}
    >
      <td
        className="px-2 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`Reorder ${item.name}`}
          className="inline-flex items-center justify-center w-5 h-5 select-none"
          style={{ color: "var(--color-ink-dim)", cursor: "grab", touchAction: "none" }}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      <td className="px-3 py-2">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            width={40}
            height={40}
            className="rounded-sm object-cover"
          />
        ) : (
          <GarmentVector
            itemId={item.id}
            category={item.category as ItemCategory}
            accent={tenant.accent}
            size={40}
          />
        )}
      </td>
      <td className="px-3 py-2 font-medium">{item.name}</td>
      <td className="px-3 py-2">{item.category}</td>
      <td className="px-3 py-2 tnum">{item.variants.length}</td>
      <td className="px-3 py-2">
        {item.active ? (
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
          onClick={() => onDelete(item.id, item.name)}
          style={{ color: tenant.accent }}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
```

This component mirrors the existing row markup exactly — the only behavioural additions are the `useSortable` hook, the ref/transform/listeners on the grip button, and the click handlers being parameterised via props.

- [ ] **Step 3: Replace the inline `<tr>` map with `SortableRow` and wrap in DnD providers**

Inside `CatalogTable`, replace the entire `<tbody>` block (which currently inlines the `items.map` `<tr>` directly) with:

```tsx
<tbody>
  <SortableContext
    items={items.map((it) => it.id)}
    strategy={verticalListSortingStrategy}
  >
    {items.map((it) => (
      <SortableRow
        key={it.id}
        item={it}
        tenant={tenant}
        onOpenDrawer={(item) => setDrawer({ open: true, mode: "edit", item })}
        onDelete={handleDelete}
      />
    ))}
  </SortableContext>
  {items.length === 0 && (
    <tr>
      <td
        colSpan={7}
        className="px-3 py-6 text-center"
        style={{ color: "var(--color-ink-dim)" }}
      >
        No items yet. Click "Add item" to create one.
      </td>
    </tr>
  )}
</tbody>
```

Then wrap the entire `<div className="flex-1 overflow-auto rounded-md border" ...>` block in a `<DndContext>`. Define sensors and the `onDragEnd` handler just before the `return`:

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = items.findIndex((it) => it.id === active.id);
  const newIndex = items.findIndex((it) => it.id === over.id);
  if (oldIndex < 0 || newIndex < 0) return;

  const previous = items;
  const reordered = arrayMove(items, oldIndex, newIndex).map((it, i) => ({
    ...it,
    sortOrder: i,
  }));
  setItems(reordered);
  setTableError("");

  try {
    const res = await fetch("/api/catalog/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSlug: tenant.id,
        orderedIds: reordered.map((it) => it.id),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const isStale = data?.error === "stale_set";
      const err = new Error(
        isStale
          ? "Catalog changed — please refresh."
          : data?.message ?? data?.error ?? "Reorder failed.",
      );
      // Marker so the catch block can branch without re-parsing.
      (err as Error & { isStale?: boolean }).isStale = isStale;
      throw err;
    }
  } catch (err) {
    console.error("Reorder failed:", err);
    const isStale =
      err instanceof Error &&
      (err as Error & { isStale?: boolean }).isStale === true;
    setTableError(
      err instanceof Error ? `Reorder failed: ${err.message}` : "Reorder failed.",
    );
    if (isStale) {
      // Server authoritatively rejected our premise (set membership changed).
      // The `previous` snapshot is also stale — skip the optimistic rollback
      // and let refresh() be the sole source of truth.
      await refresh();
    } else {
      // Transient failure (offline, 500, auth). Roll back the optimistic
      // reorder so the user sees the order they had before the drag.
      setItems(previous);
    }
  }
};
```

Note: `tenant.id` on the `Tenant` type from `lib/data.ts` IS the slug (`"nsbh"` / `"rgsh"`) — `getTenant(slug)` in `db/queries.ts` accepts this same value. Confirm with a quick `grep -n "id:" apps/web/src/lib/data.ts | head -5` if uncertain.

Wrap the table div:

```tsx
return (
  <div className="flex-1 flex flex-col overflow-hidden p-6">
    {tableError && (
      <div className="mb-3 text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
        {tableError}
      </div>
    )}
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-auto rounded-md border" style={{ borderColor: "var(--color-rule)" }}>
        <table className="w-full text-[13px]">
          {/* thead + tbody from previous task / step */}
        </table>
      </div>
    </DndContext>
    {drawer.open && (
      <ItemDrawer
        tenant={tenant}
        open={drawer.open}
        mode={{ kind: "edit", itemId: drawer.item.id }}
        initial={initialFromItem(drawer.item)}
        onClose={() => setDrawer({ open: false })}
        onSaved={refresh}
      />
    )}
  </div>
);
```

- [ ] **Step 4: Type-check**

Run:
```bash
pnpm check-types:web
```

Expected: passes. Common failures:
- `React.CSSProperties` not imported → add `import { ... type CSSProperties } from "react"` or use inline `as React.CSSProperties` (already used).
- `DragEndEvent` import path wrong → it lives in `@dnd-kit/core` (already shown above).

- [ ] **Step 5: Manual verification — happy path**

Run `pnpm dev:web`, visit `/admin/nsbh/catalog` as operator. Then:

1. Drag a row down 3 positions by holding the `⠿` grip. Drop. The row stays in the new position.
2. Open DevTools → Network. Confirm a single `POST /api/catalog/reorder` returned `200 { ok: true }`.
3. Hard refresh the page. Order persists.
4. Visit `/nsbh` (parent shop) in another tab. Catalog renders in the new order.

- [ ] **Step 6: Manual verification — error path**

Still on `/admin/nsbh/catalog`:

1. DevTools → Network → toggle **Offline** *before* dropping.
2. Drag a row, release. The row snaps back. Inline red error banner appears: "Reorder failed: …".
3. Toggle back online; drag again; success.

- [ ] **Step 7: Manual verification — no-op drop**

Pick up a row and drop it in the same slot. Confirm no POST fires (Network tab stays empty for `/api/catalog/reorder`).

- [ ] **Step 8: Manual verification — keyboard**

Tab to a grip handle. Press Space. Arrow Down twice. Press Space. Order changes; POST fires; success.

- [ ] **Step 9: Manual verification — stale-set (concurrent edit)**

In a second browser session (incognito, also signed in as the same operator), delete a catalog item via the existing Delete button. In the first window — without refreshing — drag a row. The POST returns 400 `stale_set`; banner shows "Reorder failed: Catalog changed — please refresh."; the table is repulled by the `await refresh()` and now reflects the deletion.

- [ ] **Step 10: Kill dev server, commit**

```bash
git add apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx
git commit -m "feat(catalog): drag-to-reorder via @dnd-kit + optimistic POST"
```

---

## Task 7: Update `remaining_work.md` and `completed.md`

**Files:**
- Modify: `docs/remaining_work.md`
- Modify: `docs/completed.md`

- [ ] **Step 1: Mark the drag-to-reorder half of §3.12 done**

In `docs/remaining_work.md` §3.12, the entry currently reads:

```
- [ ] **Admin drag-to-reorder + size-guide editor (gap-analysis §5.12).** ...
```

Replace with:

```
- [ ] **Admin size-guide editor (gap-analysis §5.12 — drag-to-reorder portion ✅ shipped).** Drag-to-reorder shipped via `@dnd-kit/sortable` on `catalog-table.tsx` + new `POST /api/catalog/reorder` bulk endpoint; see `completed.md` §4.33. Size-guide editor still outstanding: `catalog_items.sizeGuide jsonb` is rendered on PDP but only seeded via `lib/data.ts`. Same drawer should gain a tabular editor — column headers as comma-list, rows as a grid with add/remove. ~½d.
```

Section-number §4.33 is provisional — pick the next free number under §4 in `completed.md`.

- [ ] **Step 2: Add the §4.33 entry to `completed.md`**

Find the last §4.x entry in `docs/completed.md` (currently §4.32 per the recent commit log). Append:

```markdown
### §4.33 — Admin catalog drag-to-reorder

Shipped 2026-05-14.

`@dnd-kit/sortable` wired into `app/admin/[tenant]/catalog/catalog-table.tsx`. Each row gains a leading `⠿` grip column; rest of the row continues to open the edit drawer on click. On drop, the table renumbers items optimistically and POSTs the new `orderedIds[]` to a new bulk endpoint at `app/api/catalog/reorder/route.ts`. Server validates the set is exhaustive for the tenant (catches concurrent add/delete), then runs a single `db.batch` of `UPDATE catalog_items SET sort_order = $i` per item, plus one `logAuditEvent` row with `action: "catalog.reordered"`. On failure (offline, stale set, auth), client snaps back to previous order and surfaces an inline banner; stale-set additionally pulls fresh state via the existing `refresh()` prop.

Dense renumber `0..N-1` on every drop — sparse spacing rejected as YAGNI at ≤100 SKUs/tenant. Keyboard-accessible via dnd-kit's `KeyboardSensor`. No DB migration (column already existed). Size-guide editor (the other half of remaining_work.md §3.12) deferred to a separate spec.

Spec: `docs/superpowers/specs/2026-05-13-catalog-drag-reorder-design.md`.
Plan: `docs/superpowers/plans/2026-05-14-catalog-drag-reorder.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/remaining_work.md docs/completed.md
git commit -m "docs: mark §3.12 drag-to-reorder half complete; add §4.33"
```

---

## Self-Review

Ran against the spec:

**Spec coverage:**
- §2 Goal → Tasks 5+6 (UI), Task 4 (server)
- §4.1/4.2/4.3 UX → Task 5 (column + colSpan), Task 6 (drag, snap-back, banner, no-save-button, single ordered list)
- §5.1 endpoint contract → Task 4 (body shape, auth, set-equality, db.batch, audit, response codes)
- §5.2 query helper → Task 2
- §6.1 deps → Task 1
- §6.2 client wiring → Task 6 (DndContext, SortableContext, onDragEnd, optimistic + rollback, sortOrder mutation in local state)
- §6.3 concurrent-edit handling → Task 4 server check + Task 6 `await refresh()` on failure
- §7 file map → matches the File map at the top of this plan
- §8 edge cases → Task 6 steps 5-9 cover every row in the table
- §9 a11y → Task 6 Step 2 (`aria-label` on grip), Step 3 (`KeyboardSensor` + `sortableKeyboardCoordinates`), manual check in Step 8
- §10 testing → distributed across Task 1 Step 3, Task 5 Step 3, Task 6 Steps 5-9
- §11 out-of-scope → Task 7 Step 1 explicitly carves out the size-guide editor

**Placeholder scan:** no "TBD"/"TODO"/"add appropriate X". All code blocks contain real code. Section number §4.33 in Task 7 flagged as provisional (with instructions to verify the next free number).

**Type consistency:** `reorderCatalogItems(tenantId, orderedIds)` signature matches between Tasks 2 and 4. `tenantSlug` + `orderedIds` body shape matches between Tasks 3, 4, and 6. `tenant.id` is the slug-string consistently.

No issues found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-catalog-drag-reorder.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Best for this plan because Tasks 2/3/4 are independent file additions that can be reviewed in isolation, and Task 6 is meaty enough to deserve focused attention.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch with checkpoints.

Which approach?
