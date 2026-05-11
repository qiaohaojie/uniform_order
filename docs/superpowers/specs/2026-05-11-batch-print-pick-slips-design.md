# Batch print pick slips — design

**Date:** 2026-05-11
**Source:** `docs/remaining_work.md` §3.7 (print stylesheet QA) — split into a code half (this spec) and a manual A4/Chrome/Safari QA pass handed off to the operator after merge.
**Status:** Spec.

## Problem

The "Print pick slips" button on `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx:48` calls `window.print()` directly on the orders page. With the current `@media print` rules in `src/index.css:78-107` this prints the visible Kanban board — not a sequence of one-pick-slip-per-page. Operators have no way to print the day's picking queue in a single action; they must navigate into each order's detail page and print slips one at a time.

Single-slip printing from `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` already works correctly (the detail-page card was designed to be print-friendly). The gap is batch printing.

## Goal

Clicking **Print pick slips** on the orders page prints one pick slip per "new" order (the picking queue), one slip per A4 page, in the same visual format as the single-slip print from the order detail page. No new routes, no popup tabs, no server snapshot/Kanban-snapshot drift.

## Non-goals

- Multi-select print (per-order checkboxes on the Kanban).
- Printing `packing`, `ready`, or `collected` orders in bulk. Reprints stay on the per-order detail page.
- Per-day or per-filter scope. Always the full `new` bucket.
- PDF download. The browser's print-to-PDF is sufficient.
- Audit log integration. Printing is a read action and is not part of the 12 audited mutations.

## Background — current data flow

- `app/admin/[tenant]/orders/page.tsx` (RSC): fetches tenant only, renders `<OrdersPageClient />`.
- `orders-page-client.tsx` (client): owns search state + topbar (which contains the **Print pick slips** button), renders `<OrdersBoard />`.
- `orders-board.tsx` (client): owns the orders array. Loads via `fetch('/api/orders?tenantId=…')` in a `useEffect`. Handles status advance, optimistic update, error revert.

The Kanban data is therefore client-fetched. A naïve fix that adds a separate server-side fetch to `page.tsx` would create a split-brain: the printed slips would come from a request-time snapshot while the on-screen Kanban came from the client fetch, possibly drifting by seconds-to-minutes. The design below keeps the orders state in one place (`OrdersBoard`) and renders the hidden batch-print block as a sibling of the Kanban — so the slips printed and the Kanban shown are always the same array.

## Order status semantics

`OrderStatus` (`orders-board.tsx:7`): `"pending_payment" | "new" | "packing" | "ready" | "collected"`.

Batch print includes **`new` only**:

- `pending_payment` — Stripe hasn't confirmed.
- **`new` — paid, awaiting pick. The picking queue.**
- `packing` — operator already started; they already have the slip in hand. Reprints go through the detail page.
- `ready` — picked + emailed.
- `collected` — done.

## Design

### 1. Shared `PickSlip` component

Extract the pick-slip card body from `app/admin/[tenant]/orders/[orderId]/page.tsx` into `apps/web/src/components/admin/pick-slip.tsx`. The card body comprises: optional parent-note banner (print-only), crest + "Pick Slip" title + order ID + `createdAt`, student/parent/order details grid, line items table, totals, and the local barcode SVG. **The Refunds block, the audit `OrderActivityStrip`, and the topbar `<Back / Print / OrderDetailActions>` all stay on the detail page outside `<PickSlip />`.** Reasons:

- Active pickers do not need refund history or audit trail on the slip.
- Refetching `getOrderRefunds` + `getTotalRefunded` for every `new` order would multiply queries with no operator benefit.

The barcode SVG (currently inline in the detail page) moves into the same file as a local component or sibling (`barcode.tsx`).

Props:

```ts
interface PickSlipProps {
  order: Order;            // shape returned by /api/orders (deserialized; createdAt is string)
  tenant: Tenant;          // the static shape from @/lib/data — what <Crest> accepts today
  lines: OrderLine[];      // line items
}
```

`Order` / `OrderLine` types: define a single shared interface in the new component file. The canonical shape is the JSON-over-the-wire form (`createdAt` as ISO `string`, `unitPrice` / `lineTotal` / `total` as `string`) — the slip only needs to display these fields, not arithmetic on them, so the simpler string form wins. The detail page (which uses Drizzle's row type from `getOrderById` returning `Date`/`Decimal`) is responsible for converting `createdAt.toISOString()` and `String(decimal)` *before* passing the row into `<PickSlip />`. Conversion happens at exactly one site, in one direction, so the component never has to accept a union shape.

The detail page renders `<PickSlip order={…} tenant={…} lines={…} />` inside its existing white card. There is no visual change to the single-slip print path.

### 2. Batch render inside `OrdersBoard`

Inside `orders-board.tsx`:

1. Derive `newOrders = orders.filter(o => o.status === "new").sort(byCreatedAtAsc)` (FIFO — oldest paid order first).
2. Render a hidden print-only section as a **sibling of the Kanban**, using the same `orders` state:

```tsx
<div className="print:block hidden" aria-hidden>
  {newOrders.map((order, idx) => (
    <div
      key={order.id}
      className={idx < newOrders.length - 1 ? "break-after-page" : undefined}
    >
      <PickSlip order={order} tenant={tenant} lines={linesByOrderId[order.id] ?? []} />
    </div>
  ))}
</div>
```

3. Add `data-no-print` to the Kanban root container so the existing `@media print` rule in `src/index.css` hides it. **This is required** — the Kanban is not inside an `aside`, so the existing `aside { display: none }` rule does not catch it.

4. Lift `newOrders.length` to `OrdersPageClient` via a callback prop on `<OrdersBoard onNewCountChange={…} />`. `OrdersPageClient` stores it in local state and passes it to the topbar button for the disable/confirm logic in §4. The callback must fire from a `useEffect(() => onNewCountChange(newOrders.length), [newOrders.length, onNewCountChange])` — never inline during render — to avoid a parent-`setState`-during-child-render warning and a render loop.

### 3. Line items — eager fetch via `/api/orders?withLines=1`

`/api/orders` GET today calls `getOrdersByTenant(tenantId)` which selects from `orders` only. Extend the operator path (no `email` param) so that when `withLines=1` is set, the response includes `lines: OrderLine[]` on each row.

Implementation:

```ts
const rows = await getOrdersByTenant(tenantId);
if (searchParams.get("withLines") === "1" && rows.length > 0) {
  const ids = rows.map(r => r.id);
  const lines = await db.select().from(orderLines).where(inArray(orderLines.orderId, ids));
  const linesByOrderId: Record<string, OrderLine[]> = {};
  for (const line of lines) (linesByOrderId[line.orderId] ??= []).push(line);
  return NextResponse.json(rows.map(r => ({ ...r, lines: linesByOrderId[r.id] ?? [] })));
}
return NextResponse.json(rows);
```

`OrdersBoard` calls `/api/orders?tenantId=…&withLines=1`. Lines stay attached to the order rows in state; the Kanban ignores them, the hidden print block consumes them via the `linesByOrderId` lookup built in the same component.

Trade-off (acceptable at school-shop scale): every Kanban load now fetches all lines for the tenant, not just `new` orders. Even at 200 orders × 10 lines that is ~50 KB extra JSON. The alternative (a second `/api/orders/lines?orderIds=…` fetched at click time) introduces a state-flush race with `window.print()` and a sync gap between Kanban and slips. Eager fetch is simpler and avoids both.

### 4. Button behaviour

Replace the existing `onClick={() => window.print()}` in `orders-page-client.tsx`:

```tsx
function handlePrint() {
  if (newCount === 0) return;
  // Threshold rationale: 25 is roughly a full-day picking run at one school.
  // Above that we want a moment of pause before we commit operator-side paper + ink.
  if (newCount >= 25 && !window.confirm(`Print ${newCount} pick slips?`)) {
    return;
  }
  window.print();
}
```

- Button is `disabled` when `newCount === 0` (with a `title` tooltip "No new orders to pick").
- Button label remains "Print pick slips"; append a count in parentheses when > 0 (e.g. "Print pick slips (7)").

### 5. Print CSS additions (`src/index.css`)

Add to the existing `@media print` block:

```css
@page {
  size: A4;
  margin: 12mm;
}
```

12 mm gives standard home/office printers a safe area without cramping the slip. No other CSS changes; the existing rules already hide `nav`, `aside`, `[data-admin-sidebar]`, `[data-admin-topbar]`, `[data-no-print]` and remove backgrounds.

`break-after-page`: Tailwind v4 ships this utility. Verify during implementation that the class resolves under this project's Tailwind v4 config; if not, add a one-line `@layer utilities` rule:

```css
@layer utilities {
  .break-after-page { break-after: page; }
}
```

### 6. Data flow summary

```
orders/page.tsx (RSC)
  └─ fetches tenant only → passes to OrdersPageClient

orders-page-client.tsx (client)
  ├─ topbar
  │    └─ Print button (handlePrint; reads newCount from local state)
  ├─ <OrdersBoard onNewCountChange={setNewCount} />
  └─ search state

orders-board.tsx (client)
  ├─ fetch('/api/orders?tenantId=…&withLines=1') → orders state (with .lines)
  ├─ newOrders = orders.filter(status === "new").sort(createdAt ASC)
  ├─ useEffect → onNewCountChange(newOrders.length)
  ├─ Kanban (data-no-print on root)
  └─ Hidden batch-print section
       └─ <PickSlip /> × newOrders.length, break-after-page on all but last

[orderId]/page.tsx (RSC, unchanged data fetching)
  └─ <PickSlip /> inside its existing card
  └─ Refunds + OrderActivityStrip (outside <PickSlip />)
```

## Files touched

- **New:** `apps/web/src/components/admin/pick-slip.tsx`.
- **Modified:** `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx` (`newCount` state + `handlePrint` with confirm + label suffix + `disabled`).
- **Modified:** `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx` (request `withLines=1`, derive `newOrders` sorted FIFO, call `onNewCountChange`, render hidden batch-print section, add `data-no-print` to Kanban root).
- **Modified:** `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` (replace inline slip markup with `<PickSlip />`; Refunds + `OrderActivityStrip` stay outside).
- **Modified:** `apps/web/src/app/api/orders/route.ts` (handle `withLines=1` on the operator-tenant path; second batched `inArray` query for lines).
- **Modified:** `apps/web/src/index.css` (add `@page` rule; conditionally add `.break-after-page` if Tailwind utility is unavailable).

## Risks

- **Tailwind v4 `break-after-page` utility.** Verify at implementation time. Fallback CSS is one line.
- **`/api/orders?withLines=1` payload size.** Negligible at current scale (<= a few hundred KB even with 500 orders × 10 lines). Not a concern until well beyond school-shop scale.
- **Long line-item lists.** A single order with > 20 line items could overflow one A4 page at 12 mm margin. Acceptable: the overflow continues onto a second page and the next slip still starts fresh because `break-after-page` is on the wrapper, not on rows. Documented as a known edge case rather than special-cased; school uniform orders rarely exceed 10 items.

## Verification (handed off to operator after merge)

Manual QA on real A4, both Chrome and Safari, on macOS:

1. Single slip: navigate to an order detail page, click Print pick slip, confirm one page with the slip filling it, margins look right, parent-note banner present when set, barcode renders, refunds + activity strip do *not* print.
2. Batch (0 new): orders page button is disabled.
3. Batch (1 new): button shows "Print pick slips (1)"; clicking opens the print dialog with exactly one page.
4. Batch (5 new): five pages, one slip per page, no trailing blank page, slips ordered oldest-`createdAt`-first.
5. Batch (≥ 25 new, if available): confirm dialog appears with correct count.
6. Kanban does not appear anywhere in the print output.
7. Repeat 1, 4 in Safari.
