# Catalog Drag-to-Reorder — Design Spec

**Date:** 2026-05-13
**Status:** Approved
**Scope:** Admin portal catalog page only
**Backlog source:** `docs/remaining_work.md` §3.12 (gap-analysis §5.12), drag-to-reorder portion only. Size-guide editor — also bundled in that backlog entry — is **deferred** to a separate spec.

---

## 1. Problem

`catalog_items.sortOrder` already exists (`db/schema.ts:107`) and is honoured by `getActiveCatalog` (`db/queries.ts:947`) and the admin read path (`db/queries.ts:889`). But there is no UI to change it — `app/admin/[tenant]/catalog/catalog-table.tsx` renders items in stored order with no reorder affordance. Operators today cannot change parent-shop catalogue order without a DB edit.

## 2. Goal

Give school admins a direct-manipulation UI to reorder catalogue items, with the new order persisted atomically to the server and immediately reflected on the parent shop on next page load.

## 3. Non-goals

- Reordering variants within an item (no current ask).
- Drag-and-drop in any other admin table (orders, bulk-upload preview, etc.).
- Size-guide editing (separate spec — see §11).
- Cross-tenant moves (architecturally impossible — table is tenant-scoped).
- Per-collection ordering (collections feature isn't shipped yet — §3.12 phase 1 backlog item).

## 4. UX

### 4.1 Visual

A new leftmost column (~28px) on the catalog table contains a small `⠿` grip glyph rendered in `var(--color-ink-dim)`. On hover the glyph darkens to ink-primary; cursor switches to `grab`. Active drag switches to `grabbing` and applies dnd-kit's transform to the row.

The rest of the row continues to be clickable to open the edit drawer (existing behaviour at `catalog-table.tsx:87`). The handle column has its own pointer target and stops propagation, so dragging the handle never opens the drawer and clicking elsewhere on the row never starts a drag.

### 4.2 Interaction

1. Operator presses on the grip and drags vertically.
2. dnd-kit shows the dragged row floating with a subtle shadow; other rows shift to make space (animated via dnd-kit's default `verticalListSortingStrategy`).
3. On drop the optimistic order is committed to local state immediately. A `POST /api/catalog/reorder` fires in the background.
4. On success: no visible feedback (silent success is fine — the visual reorder is the feedback).
5. On error: order snaps back to the pre-drag state and an inline error banner appears at the top of the table using the existing `tableError` slot (`catalog-table.tsx:63`). Message: `"Reorder failed: <server message>"`.

### 4.3 Affordances

- **Inactive items are draggable** — they participate in the same single ordered list. Lets the operator position an item where it should appear when re-activated.
- **Single-item catalogue** — handle still renders but no useful drag; acceptable.
- **No "save order" button** — every drop persists. There is no draft/pending order state in the table.

## 5. Server contract

### 5.1 New endpoint

`POST /api/catalog/reorder`

**Request body:**
```ts
{ tenantSlug: string; orderedIds: string[] }
```

**Route placement:** `apps/web/src/app/api/catalog/reorder/route.ts` (sibling of the existing `apps/web/src/app/api/catalog/[itemId]/route.ts`). Tenant is supplied in the body rather than the URL because there is no single `itemId` to derive it from, and adding a `[tenant]` path segment would diverge from the existing `/api/catalog/*` shape.

**Validation:**
- Auth: `requireSessionUser` → resolve tenant via `getTenantBySlug(tenantSlug)` (same helper used elsewhere) → `ensureTenantAccess(user, tenant.shopEmail)`. Platform-admin emails pass via the same path the PATCH route uses.
- `orderedIds` must be a non-empty `string[]` of UUIDs.
- The set of `orderedIds` must equal the full set of catalog item IDs for the tenant — no missing IDs, no extras, no duplicates. Mismatch returns `400 { error: "stale_set" }`.

**Write:**
- One `db.batch([...])` running `UPDATE catalog_items SET sort_order = $i WHERE id = $id AND tenant_id = $tenantId` per item. `db.batch` (not `db.transaction`) per CLAUDE.md neon-http note.
- All rows renumbered to dense `0..N-1` on every drop. Simple, predictable, no gaps. At realistic catalogue sizes (≤100 SKUs per tenant) the batch round-trip is sub-100ms.

**Audit:**
- One `logAuditEvent` call with `action: "catalog.reordered"`, `actorRole: "operator"`, `actorEmail: session.user.email`, `targetType: "tenant"`, `targetId: tenantId`, `metadata: { itemCount: orderedIds.length }`. **Not** one entry per row — reorder is a single user intent.

**Response:** `200 { ok: true }`.

### 5.2 Query helper

New helper in `apps/web/src/db/queries.ts`:
```ts
export async function reorderCatalogItems(tenantId: string, orderedIds: string[]): Promise<void>
```
Builds and executes the batch update. Caller is responsible for auth + set-validity check.

## 6. Client wiring

### 6.1 Dependencies

Add to `apps/web/package.json`:
- `@dnd-kit/core`
- `@dnd-kit/sortable`

Both work fine under React Server Components when used inside a `"use client"` boundary (the table is already a client component). Combined bundle impact ≈ 10kb gz.

### 6.2 Component changes

`catalog-table.tsx` is wrapped in `<DndContext>` + `<SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>`. Each `<tr>` becomes a `SortableRow` child component that calls `useSortable({ id: item.id })` and applies transform/transition styles. The grip cell uses `{...attributes} {...listeners}` so only it initiates the drag.

`onDragEnd` handler:
1. If `active.id === over?.id` (no movement), return.
2. Compute new order with `arrayMove(items, oldIndex, newIndex)`.
3. Capture `previousItems = items` for rollback.
4. Call `setItems(newOrder.map((it, i) => ({ ...it, sortOrder: i })))` — keeps in-memory `sortOrder` consistent so the drawer's `initialFromItem` reads the right number.
5. `fetch('/api/catalog/reorder', { method: 'POST', body: JSON.stringify({ orderedIds: newOrder.map(it => it.id) }) })`.
6. On non-ok response or thrown error: `setItems(previousItems)` + `setTableError("Reorder failed: " + msg)`.

### 6.3 Concurrent-edit handling

If operator A drags while operator B deletes an item, the server's stale-set check fires `400 { error: "stale_set" }`. Client surfaces "Catalog changed — please retry" via `tableError` and calls the parent's `refresh()` to pull current state. No silent state divergence.

## 7. Files touched

| File | Change |
|---|---|
| `apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx` | DnD wiring, grip column, `SortableRow` extraction |
| `apps/web/src/app/api/catalog/reorder/route.ts` | **New** — bulk reorder endpoint |
| `apps/web/src/db/queries.ts` | New `reorderCatalogItems(tenantId, orderedIds)` helper |
| `apps/web/package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable` |

No DB migration. No schema change. No changes to read paths (`getActiveCatalog`, parent shop) — they already honour `sortOrder`.

## 8. Edge cases

| Case | Behaviour |
|---|---|
| Drop in the same slot (no movement) | Skip the API call (early return on `active.id === over?.id`) |
| Single-item catalogue | Handle still renders; drag does nothing meaningful; not blocked |
| Empty catalogue | Existing empty-state row renders; no DnD context needed but harmless |
| Operator session expires mid-drag | API returns 401; client snaps back + surfaces "Session expired" |
| Concurrent delete by another operator | Server 400 `stale_set`; client refreshes from server + surfaces toast |
| Concurrent add by another operator | Same — server's set-equality check rejects; client refreshes |
| Inactive item drag | Allowed; visual treatment of inactive rows unchanged (the existing `●` / `○` indicator stays) |

## 9. Accessibility

dnd-kit provides keyboard support out of the box via `KeyboardSensor`:
- Tab to the grip handle → Space/Enter to pick up → Arrow up/down to move → Space/Enter to drop → Esc to cancel.
- Live region announcements ("Picked up item X", "Moved over item Y") are built into dnd-kit's defaults; we accept defaults rather than customising.

The grip cell has `aria-label="Reorder ${item.name}"`. Tab order: grip cell first, then row content (handled naturally by column order).

## 10. Testing

No unit tests (project has no test runner — CLAUDE.md: "`check-types` is the correctness gate"). Manual verification:

1. Open `/admin/nsbh/catalog` as operator. Drag a row down by 3 positions; refresh the page; order persists.
2. Open `/nsbh` parent shop in another tab; reordered item appears in the new position after `revalidate`/next visit.
3. Drag and drop in the same position — DevTools Network shows no POST.
4. Throttle network in DevTools, drag a row, immediately fail the request (offline toggle): row snaps back + error banner appears.
5. With two browser sessions on the same tenant: A drags while B deletes a row; A sees "Catalog changed — please retry" and refreshes cleanly.
6. Keyboard-only: tab to grip, Space, arrow down, Space — order changes and persists.
7. `pnpm check-types:web` passes.

## 11. Out of scope (deferred)

- **Size-guide editor** — the other half of remaining_work.md §3.12. Tabular grid on `item-drawer.tsx` editing `catalog_items.sizeGuide` jsonb. Separate spec when next prioritised. The size-guide PDP render path already exists, so this is a pure form-UI add.
- **Sparse-spacing + collision rebalancing.** Considered and rejected: at ≤100 SKUs per tenant, dense renumber is <100ms in one batch round-trip; sparse spacing adds ~30 lines of route code and an extra branch to test for headroom that won't be exercised at this scale. Re-evaluate at first tenant >300 SKUs.
- **Bulk select + move to position N.** Power-user feature; no current ask.
- **Reorder via drawer (numeric `sortOrder` input).** Considered; DnD is faster and obviates the input. The field stays on the schema and continues to be set programmatically by the reorder route.

## 12. Open questions

None at design freeze. Ready for plan.
