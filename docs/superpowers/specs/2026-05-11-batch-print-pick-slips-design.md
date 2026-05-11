# Batch print pick slips — design

**Date:** 2026-05-11
**Source:** `docs/remaining_work.md` §3.7 (print stylesheet QA) — split into code half (this spec) and manual A4/Chrome/Safari verification half (to be done by the operator after merge).
**Status:** Spec.

## Problem

The "Print pick slips" button on `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx:48` calls `window.print()` directly on the orders page. With the current `@media print` rules in `src/index.css:78-107` this prints the visible Kanban board — not a sequence of one-pick-slip-per-page. Operators have no way to print the day's picking queue in a single action; they must navigate into each order's detail page and print slips one at a time.

Single-slip printing from `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` already works correctly (the detail-page card was designed to be print-friendly). The gap is batch printing.

## Goal

Clicking **Print pick slips** on the orders page prints one pick slip per "Paid" order, one slip per A4 page, in the same visual format as the single-slip print from the order detail page. No new routes, no popup tabs, no data refetch.

## Non-goals

- Multi-select print (per-order checkboxes on the Kanban).
- Printing "Ready" or "Collected" orders in bulk (reprints stay on the detail page).
- Per-day or per-filter scope. Always the full "Paid" bucket.
- PDF download. The browser's print-to-PDF is sufficient.
- Audit log integration. Printing is a read action and not part of the 12 audited mutations.

## Design

### 1. Shared `PickSlip` component

Extract the existing pick-slip markup from `app/admin/[tenant]/orders/[orderId]/page.tsx` (the inner card starting at the `print:block hidden` parent-note banner, through the crest header, student/parent/order grid, line items, and totals) into a new `apps/web/src/components/admin/pick-slip.tsx`.

Props:

```ts
interface PickSlipProps {
  order: Order;            // from db/schema, includes parentNote, studentName, etc.
  tenant: Tenant;          // for Crest + accent colour
  lines: OrderLine[];      // line items
}
```

The detail page (`[orderId]/page.tsx`) renders `<PickSlip order={…} tenant={…} lines={…} />` inside its existing card wrapper. There is no visual or behavioural change to the single-slip print path.

### 2. Batch render on the orders page

`app/admin/[tenant]/orders/page.tsx` is a Server Component that fetches the Kanban data. It already loads orders for the tenant. Add a query for line items keyed on the "Paid" subset only (so we do not over-fetch lines for "Ready" or "Collected" buckets, which can grow indefinitely):

```ts
const paidOrders = orders.filter(o => o.status === "paid");
const paidOrderIds = paidOrders.map(o => o.id);
const paidLines = paidOrderIds.length > 0
  ? await db.select().from(orderLines).where(inArray(orderLines.orderId, paidOrderIds))
  : [];
const linesByOrderId: Record<string, OrderLine[]> = {};
for (const line of paidLines) {
  (linesByOrderId[line.orderId] ??= []).push(line);
}
```

Pass `paidOrders`, `linesByOrderId`, and `tenant` to the client component.

In `orders-page-client.tsx`, append a print-only section after the Kanban:

```tsx
<div className="print:block hidden" aria-hidden>
  {paidOrders.map((order, idx) => (
    <div
      key={order.id}
      className={idx < paidOrders.length - 1 ? "break-after-page" : undefined}
    >
      <PickSlip order={order} tenant={tenant} lines={linesByOrderId[order.id] ?? []} />
    </div>
  ))}
</div>
```

`break-after-page` on every slip except the last avoids a trailing blank page. The Tailwind v4 utility maps to `break-after: page;` so no custom CSS rule is required; if it does not resolve in this project's Tailwind v4 config, fall back to a one-line `@layer utilities` declaration in `src/index.css`.

Slip order: by `placedAt ASC` (oldest paid order first), matching the picking queue's FIFO intent.

### 3. Print CSS additions (`src/index.css`)

Add a single `@page` rule inside the existing `@media print` block:

```css
@page {
  size: A4;
  margin: 12mm;
}
```

The 12 mm margin gives standard home/office printers a safe area without consuming so much page that the slip's content gets cramped. No other CSS changes; the existing rules already hide `nav`, `aside`, `[data-admin-sidebar]`, `[data-admin-topbar]`, and `[data-no-print]`, and remove backgrounds.

The Kanban itself does not have a `data-no-print` attribute today — it is hidden by virtue of the page's surrounding `aside`/sidebar wrapper. Verify during QA that the Kanban (which lives inside the page body, not inside an `aside`) is also hidden. If it is not, tag the Kanban container with `data-no-print` so the existing rule catches it.

### 4. Button behaviour

In `orders-page-client.tsx`, replace the existing `onClick={() => window.print()}` with:

```tsx
function handlePrint() {
  if (paidOrders.length === 0) return;
  if (paidOrders.length >= 25 && !window.confirm(`Print ${paidOrders.length} pick slips?`)) {
    return;
  }
  window.print();
}
```

Also:

- Button is `disabled` when `paidOrders.length === 0`.
- Button label remains "Print pick slips"; append a count in parentheses when > 0 (e.g. "Print pick slips (7)") to give the operator a heads-up before they click. Hidden when 0.

### 5. Data flow summary

```
orders/page.tsx (RSC)
  ├─ fetches orders + (for Paid only) orderLines
  └─ passes paidOrders + linesByOrderId to client
        │
orders-page-client.tsx
  ├─ Kanban (visible on screen, hidden in print)
  ├─ Print button (handlePrint with confirm at ≥ 25)
  └─ Hidden batch-print section (hidden on screen, visible in print)
        └─ <PickSlip /> × N with break-after-page on all but last

[orderId]/page.tsx
  └─ single <PickSlip /> inside its card (unchanged data fetching)
```

## Risks & open questions

- **Tailwind v4 `break-after-page` utility.** Tailwind v4 ships this utility, but the project's `@theme` block in `src/index.css` does not extend it. If the class does not resolve, add `.break-after-page { break-after: page; }` to `@layer utilities`. Verify during implementation.
- **Kanban visibility in print.** The orders page wraps the Kanban in a flex container inside the admin shell. The shell's sidebar and topbar are hidden via `aside` and `[data-admin-sidebar]`/`[data-admin-topbar]`. The Kanban itself may still render unless the surrounding container is tagged. Plan to add `data-no-print` to the Kanban container in step 2 to make this explicit rather than rely on inheritance.
- **DOM weight.** With 50 paid orders × ~30 elements per slip, the hidden print block adds ~1500 nodes to the orders page. Negligible for desktop Chrome/Safari at school-shop scale; not a concern until > 500 paid orders, which would itself be a workflow problem worth flagging.
- **Long line-item lists.** A single order with > 20 line items could overflow a single A4 page even at 12 mm margin. Acceptable: the slip overflows to a second page and the next slip still starts fresh because `break-after-page` is on the wrapper, not on `tr`. Document this as a known edge case rather than special-case it; school uniform orders rarely exceed 10 items.

## Files touched

- **New:** `apps/web/src/components/admin/pick-slip.tsx`.
- **Modified:** `apps/web/src/app/admin/[tenant]/orders/page.tsx` (fetch paid-only lines, pass through).
- **Modified:** `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx` (handlePrint, count in label, hidden batch-print section, `data-no-print` on Kanban container).
- **Modified:** `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` (replace inline slip markup with `<PickSlip />`).
- **Modified:** `apps/web/src/index.css` (add `@page` rule; conditionally add `.break-after-page` if Tailwind utility is unavailable).

## Verification (handed off to operator after merge)

Manual QA on real A4, both Chrome and Safari, on macOS:

1. Single slip: navigate to an order detail page, click Print pick slip, confirm one page with the slip filling it, margins look right, parent-note banner present when set.
2. Batch (0 paid): orders page button is disabled.
3. Batch (1 paid): button shows "Print pick slips (1)"; clicking opens the print dialog with exactly one page.
4. Batch (5 paid): five pages, one slip per page, no trailing blank page, slips ordered oldest-paid-first.
5. Batch (≥ 25 paid, if available): confirm dialog appears with correct count.
6. Kanban does not appear anywhere in the print output.
7. Repeat 1, 4 in Safari.
